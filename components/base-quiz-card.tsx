/*
 * Adapted from https://github.com/3DJakob/react-tinder-card at v1.6.2
 *
 */

import {
  ReactNode,
  Ref,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
} from 'react';
import {
  Dimensions,
  PanResponder,
  Platform,
  RegisteredStyle,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

type Direction = 'left' | 'right' | 'up' | 'down' | 'none';
type SwipeHandler = (direction: Direction) => void;
type CardLeftScreenHandler = (direction: Direction) => void;

interface API {
  /**
   * Programmatically trigger a swipe of the card in one of the valid directions `'left'`, `'right'`, `'up'` and `'down'`. This function, `swipe`, can be called on a reference of the BaseQuizCard instance.
   *
   * @param dir The direction in which the card should be swiped. One of: `'left'`, `'right'`, `'up'` and `'down'`.
   */
  swipe(dir?: Direction): Promise<void>

  /**
   * Restore swiped-card state. Use this function if you want to undo a swiped-card (e.g. you have a back button that shows last swiped card or you have a reset button. The promise is resolved once the card is returned
   */
  restoreCard(): Promise<void>
}

interface Props {
  ref?: Ref<API>;
  onSwipe?: SwipeHandler;
  onCardLeftScreen?: CardLeftScreenHandler;
  preventSwipe?: string[];
  swipeThreshold?: number;
  containerStyle?: RegisteredStyle<ViewStyle>;
  children?: ReactNode;
  initialPosition?: Direction;
  leftComponent?: JSX.Element;
  rightComponent?: JSX.Element;
  downComponent?: JSX.Element;
}

const { height, width } = Dimensions.get('window');

const settings = {
  maxTilt: 20, // in deg
  rotationPower: 50,
  swipeThreshold: 0.5, // default threshold
};

const physics = {
  animateOut: {
    // We'll approximate with a timing-based approach or a spring
    friction: 30,
    tension: 400,
  },
  animateBack: {
    friction: 20,
    tension: 200,
  },
};

function pythagoras(x: number, y: number) {
  return Math.sqrt(x * x + y * y);
}

function normalize(vector: { x: number; y: number }) {
  const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
  return { x: vector.x / length, y: vector.y / length };
}

function rotateByDx(dx: number) {
  return Math.max(Math.min(dx * 0.05, settings.maxTilt), -settings.maxTilt);
}

function diagonal() {
  return pythagoras(height, width);
}

function finalXyrot(gesture: { x: number; y: number }) {
  const finalX = diagonal() * normalize(gesture).x;
  const finalY = diagonal() * normalize(gesture).y;
  const finalRotation = rotateByDx(finalX);

  return { x: finalX, y: finalY, rot: finalRotation };
}

function getSwipeDirection(
  property: { x: number; y: number },
  swipeThreshold = settings.swipeThreshold
): Direction {
  'worklet';

  if (Math.abs(property.x) > Math.abs(property.y)) {
    if (property.x > swipeThreshold) {
      return 'right';
    } else if (property.x < -swipeThreshold) {
      return 'left';
    }
  } else {
    if (property.y > swipeThreshold) {
      return 'down';
    } else if (property.y < -swipeThreshold) {
      return 'up';
    }
  }
  return 'none';
}

/**
 * Reanimated-based "start" function that mimics react-spring's .start() API.
 * - If `config.duration` is specified, we use `withTiming`.
 * - Otherwise we use `withSpring`.
 * - `immediate` updates the shared values instantly, no animation.
 * - `onResolve` is called at the end of the animation.
 */
function createSpringStarter(
  xSV: Animated.SharedValue<number>,
  ySV: Animated.SharedValue<number>,
  rotSV: Animated.SharedValue<number>
) {
  return (params: {
    x?: number;
    y?: number;
    rot?: number;
    config?: any;
    immediate?: boolean;
    onResolve?: () => void;
  }) => {
    'worklet';

    const { x, y, rot, config, immediate, onResolve } = params;

    const runAnimation = (
      val: number | undefined,
      sharedVal: Animated.SharedValue<number>
    ) => {
      if (val === undefined) return;
      if (immediate) {
        // update instantly
        sharedVal.value = val;
        if (onResolve) {
          runOnJS(onResolve)();
        }
        return;
      }
      // If there's a duration, use timing; otherwise spring
      if (config?.duration !== undefined) {
        sharedVal.value = withTiming(
          val,
          { duration: config.duration },
          (isFinished) => {
            if (isFinished && onResolve) {
              runOnJS(onResolve)();
            }
          }
        );
      } else {
        // approximate friction/tension with reanimated's damping/stiffness
        const damping = config?.friction ?? 20;
        const stiffness = config?.tension ?? 200;
        sharedVal.value = withSpring(
          val,
          { damping, stiffness },
          (isFinished) => {
            if (isFinished && onResolve) {
              runOnJS(onResolve)();
            }
          }
        );
      }
    };

    runAnimation(x, xSV);
    runAnimation(y, ySV);
    runAnimation(rot, rotSV);
  };
}

/**
 * Animate the card out of the screen. We'll call our internal setSpringTarget
 * with Reanimated logic instead of react-spring.
 */
async function animateOut(
  gesture: { x: number; y: number },
  setSpringTarget: React.MutableRefObject<
    { start: (args: any) => void }[]
  >,
  dir?: Direction
) {
  // Ensure we move at least 2 units if direction is forced
  const normalizedGesture = (() => {
    if (dir === 'right') return { x: Math.max(2, gesture.x), y: gesture.y };
    if (dir === 'left') return { x: Math.min(-2, gesture.x), y: gesture.y };
    if (dir === 'up') return { x: gesture.x, y: Math.min(-2, gesture.y) };
    if (dir === 'down') return { x: gesture.x, y: Math.max(2, gesture.y) };
    return gesture;
  })();

  const velocity = pythagoras(normalizedGesture.x, normalizedGesture.y);
  const duration = diagonal() / velocity;

  // We use timing for "animateOut" with a computed duration
  return new Promise((resolve) => {
    setSpringTarget.current[0].start({
      ...finalXyrot(normalizedGesture),
      config: { duration },
      onResolve: () => {
        resolve(undefined);
      },
    });
  });
}

/**
 * Animate the card back to the starting position using a spring.
 */
function animateBack(
  setSpringTarget: React.MutableRefObject<
    { start: (args: any) => void }[]
  >
) {
  return new Promise((resolve) => {
    setSpringTarget.current[0].start({
      x: 0,
      y: 0,
      rot: 0,
      config: physics.animateBack,
      onResolve: resolve,
    });
  });
}

const ReanimatedView = Animated.createAnimatedComponent(View);

const BaseQuizCard = forwardRef(
  (
    {
      children,
      onSwipe,
      onCardLeftScreen,
      preventSwipe = [],
      swipeThreshold = settings.swipeThreshold,
      containerStyle,
      initialPosition,
      leftComponent,
      rightComponent,
      downComponent,
    }: Props,
    ref: React.Ref<API>
  ) => {
    const isAnimating = useRef(false);

    // Compute initial x, y, rot
    const startPosition = (() => {
      if (initialPosition === 'left') return finalXyrot({ x: -1, y: 0 });
      if (initialPosition === 'right') return finalXyrot({ x: 1, y: 0 });
      if (initialPosition === 'up') return finalXyrot({ x: 0, y: -1 });
      if (initialPosition === 'down') return finalXyrot({ x: 0, y: 1 });
      return { x: 0, y: 0, rot: 0 };
    })();

    // Reanimated shared values in place of react-spring
    const x = useSharedValue(startPosition.x);
    const y = useSharedValue(startPosition.y);
    const rot = useSharedValue(startPosition.rot);

    // We'll store an array with a single object that has .start(...) to match your usage
    const setSpringTarget = useRef([{ start: () => {} }]);
    // Create the function that actually updates x, y, rot
    setSpringTarget.current[0].start = createSpringStarter(x, y, rot);

    // Update threshold in settings for continuity
    settings.swipeThreshold = swipeThreshold;

    // Expose the swipe, restoreCard APIs
    useImperativeHandle(ref, () => ({
      async swipe(dir: Direction = 'right') {
        if (isAnimating.current) return;
        isAnimating.current = true;

        if (onSwipe) onSwipe(dir);

        const power = 2.0;
        const disturbance = (Math.random() - 0.5) / 2;
        if (dir === 'right') {
          await animateOut({ x: power, y: disturbance }, setSpringTarget, dir);
        } else if (dir === 'left') {
          await animateOut({ x: -power, y: disturbance }, setSpringTarget, dir);
        } else if (dir === 'up') {
          await animateOut({ x: disturbance, y: -power }, setSpringTarget, dir);
        } else if (dir === 'down') {
          await animateOut({ x: disturbance, y: power }, setSpringTarget, dir);
        }
        if (onCardLeftScreen) onCardLeftScreen(dir);

        isAnimating.current = false;
      },
      async restoreCard() {
        if (isAnimating.current) return;
        isAnimating.current = true;

        await animateBack(setSpringTarget);

        isAnimating.current = false;
      },
    }));

    const handleSwipeReleased = useCallback(
      async (
        setSpring: React.MutableRefObject<
          { start: (args: any) => void }[]
        >,
        gesture
      ) => {
        if (isAnimating.current) return;
        isAnimating.current = true;

        // Check if it is a swipe
        const dir = getSwipeDirection(
          {
            x: gesture.dx,
            y: gesture.dy,
          },
          swipeThreshold
        );

        if (dir === 'none' || preventSwipe.includes(dir)) {
          // Animate back to start
          await animateBack(setSpring);
        } else {
          if (onSwipe) onSwipe(dir);

          await animateOut({ x: gesture.vx, y: gesture.vy }, setSpring, dir);

          if (onCardLeftScreen) onCardLeftScreen(dir);
        }

        isAnimating.current = false;
      },
      [onSwipe, onCardLeftScreen, preventSwipe, swipeThreshold]
    );

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: () => !isAnimating.current,
        onMoveShouldSetPanResponderCapture: () => !isAnimating.current,
        onPanResponderGrant: (evt, gestureState) => {
          if (Platform.OS === 'web') {
            evt.preventDefault?.();
          }
          setSpringTarget.current[0].start({
            x: gestureState.dx,
            y: gestureState.dy,
            rot: 0,
            immediate: true,
          });
        },
        onPanResponderMove: (evt, gestureState) => {
          if (Platform.OS === 'web') {
            evt.preventDefault?.();
          }
          setSpringTarget.current[0].start({
            x: gestureState.dx,
            y: gestureState.dy,
            rot: rotateByDx(gestureState.dx),
            immediate: true,
          });
        },
        onPanResponderTerminationRequest: () => true,
        onPanResponderRelease: (evt, gestureState) => {
          handleSwipeReleased(setSpringTarget, gestureState);
        },
      })
    ).current;

    // Main card style
    const cardStyle = useAnimatedStyle(() => {
      return {
        transform: [
          { translateX: x.value },
          { translateY: y.value },
          { rotate: `${rot.value}deg` },
        ],
      };
    });

    // Left indicator style
    const leftComponentStyle = useAnimatedStyle(() => {
      const dir = getSwipeDirection({ x: x.value, y: y.value }, 0);
      return {
        position: 'absolute',
        width: '100%',
        height: '100%',
        zIndex: Math.round(Math.abs(x.value)),
        opacity:
          dir === 'left'
            ? Math.max(0.0, -x.value * 0.01 - 0.5)
            : 0.0,
        transform: [{ rotate: `${-rot.value}deg` }],
      };
    });

    // Right indicator style
    const rightComponentStyle = useAnimatedStyle(() => {
      const dir = getSwipeDirection({ x: x.value, y: y.value }, 0);
      return {
        position: 'absolute',
        width: '100%',
        height: '100%',
        zIndex: Math.round(Math.abs(x.value)),
        opacity:
          dir === 'right'
            ? Math.max(0.0, x.value * 0.01 - 0.5)
            : 0.0,
        transform: [{ rotate: `${-rot.value}deg` }],
      };
    });

    // Down indicator style
    const downComponentStyle = useAnimatedStyle(() => {
      const dir = getSwipeDirection({ x: x.value, y: y.value }, 0);
      return {
        position: 'absolute',
        width: '100%',
        height: '100%',
        zIndex: Math.round(Math.abs(y.value)),
        opacity:
          dir === 'down'
            ? Math.max(0.0, y.value * 0.01 - 0.5)
            : 0.0,
        transform: [{ rotate: `${-rot.value}deg` }],
      };
    });

    return (
      <ReanimatedView
        {...panResponder.panHandlers}
        style={[cardStyle, containerStyle]}
      >
        {/* Left indicator */}
        <Animated.View style={leftComponentStyle}>{leftComponent}</Animated.View>

        {/* Right indicator */}
        <Animated.View style={rightComponentStyle}>{rightComponent}</Animated.View>

        {/* Down indicator */}
        <Animated.View style={downComponentStyle}>{downComponent}</Animated.View>

        {/* Actual card content */}
        {children}
      </ReanimatedView>
    );
  }
);

export { BaseQuizCard, Direction };

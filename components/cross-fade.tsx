import { ReactNode, useEffect, useRef, useState } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Animated, {
  SharedValue,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

// Shared rendering for both crossfades below: a `front` layer whose opacity
// tracks `progress` (0 -> 1) stacked over a `back` layer whose opacity is the
// inverse. The two public components differ only in how they drive `progress`.
type FadeLayersProps = {
  progress: SharedValue<number>
  front: ReactNode
  back: ReactNode
  style?: StyleProp<ViewStyle>
};

const FadeLayers = ({ progress, front, back, style }: FadeLayersProps) => {
  const frontStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const backStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));

  return (
    <View style={style}>
      <Animated.View style={frontStyle}>
        {front}
      </Animated.View>
      {back !== null &&
        <Animated.View
          style={[
            { position: 'absolute', width: '100%', height: '100%', justifyContent: 'center' },
            backStyle,
          ]}
          pointerEvents="none"
        >
          {back}
        </Animated.View>
      }
    </View>
  );
};

// Controlled, one-shot reveal between two fixed slots: shows `back` until
// `showFront` turns true, then crossfades to `front` (optionally lingering on
// `back` for at least `minBackMs` first).
type CrossFadeProps = {
  showFront: boolean
  front: ReactNode
  back: ReactNode
  minBackMs?: number
  duration?: number
  style?: StyleProp<ViewStyle>
};

const CrossFade = ({
  showFront,
  front,
  back,
  minBackMs = 0,
  duration = 500,
  style,
}: CrossFadeProps) => {
  const progress = useSharedValue(0);
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    if (!showFront) {
      return;
    }

    const remaining = Math.max(0, minBackMs - (Date.now() - mountedAt.current));

    progress.value = withDelay(remaining, withTiming(1, { duration }));
  }, [showFront]);

  return (
    <FadeLayers progress={progress} front={front} back={back} style={style} />
  );
};

// Uncontrolled crossfade that re-animates whenever `triggerKey` changes: the
// previous children fade out while the new ones fade in. Suits content that
// toggles back and forth (e.g. a button label), where `CrossFade`'s one-shot
// reveal doesn't fit.
type CrossFadeTextProps = {
  triggerKey: string
  children: ReactNode
  duration?: number
  style?: StyleProp<ViewStyle>
};

const CrossFadeText = ({
  triggerKey,
  children,
  duration = 300,
  style,
}: CrossFadeTextProps) => {
  // 0 = mid-swap (outgoing fully shown), 1 = settled (incoming fully shown).
  const progress = useSharedValue(1);
  // `key` is the key currently rendered as the incoming layer; `outgoing` holds
  // the previous children while they fade out.
  const [tx, setTx] = useState<{ key: string, outgoing: ReactNode }>({
    key: triggerKey,
    outgoing: null,
  });
  const lastChildren = useRef(children);

  // Stage the swap during render (not an effect) and reset progress in the same
  // tick, so the outgoing layer mounts already-opaque in the *same* commit as
  // the new incoming layer. Staging in an effect would leave a frame where the
  // incoming layer is hidden but the outgoing one hasn't mounted yet — the
  // button would blink empty before the fade began.
  if (tx.key !== triggerKey) {
    setTx({ key: triggerKey, outgoing: lastChildren.current });
    progress.value = 0;
  }

  useEffect(() => {
    lastChildren.current = children;
  });

  useEffect(() => {
    if (tx.outgoing === null) return;
    progress.value = withTiming(1, { duration }, (finished) => {
      if (finished) runOnJS(setTx)((t) => ({ ...t, outgoing: null }));
    });
  }, [tx.key]);

  return (
    <FadeLayers
      progress={progress}
      front={children}
      back={tx.outgoing}
      style={style}
    />
  );
};

export {
  CrossFade,
  CrossFadeText,
};

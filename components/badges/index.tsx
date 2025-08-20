import { View } from 'react-native';
import { DefaultText } from '../default-text';
import { Logo16 } from '../logo';
import { QAndADevice } from '../q-and-a-device';
import { useEffect, useRef, useState } from 'react';
import Svg, { Polygon } from 'react-native-svg';
import { faPen } from '@fortawesome/free-solid-svg-icons/faPen'
import { faSeedling } from '@fortawesome/free-solid-svg-icons/faSeedling'
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
} from 'react-native-reanimated';


// TODO: Add tooltips to explain the badges

const size = 20;

const durationColor = '#ff6bfa';

const Admin = () => {
  return (
    <View
      style={{
          backgroundColor: '#70f',
          borderRadius: 999,
          paddingLeft: 9,
          paddingRight: 10,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 2,
      }}
    >
      <Ionicons
        style={{
          fontSize: size / 3 * 2,
        }}
        color="white"
        name="shield-checkmark"
      />
      <DefaultText
        style={{
          fontSize: 12,
          color: 'white',
          fontWeight: 700,
        }}
      >
        Admin
      </DefaultText>
    </View>
  );
};

const GoldBadge = () => {
  return (
    <View
      style={{
        backgroundColor: '#70f',
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
      }}
    >
      <Logo16
        size={16}
        color="#ffd700"
        doAnimate={true}
      />
    </View>
  );
};

const OgMember = () => {
  return <></>;
};

const QAndA100 = ({
  intervalMs = 400,  // time between each step
  step = 50,         // increment amount
  startAt = 0,
  target = 100,
  pauseMs = 3000,    // pause at target before looping
}) => {
  const [count, setCount] = useState(startAt);
  const timerRef = useRef<NodeJS.Timeout>(null);
  const countRef = useRef(startAt);

  useEffect(() => {
    // Ensure we start from startAt each time props change
    setCount(startAt);
    countRef.current = startAt;

    const schedule = (delay, fn) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(fn, delay);
    };

    const tick = () => {
      const current = countRef.current;
      const next = current + step;

      if (next >= target) {
        // Step to target (if not already there), then pause, then reset and continue
        if (current < target) {
          setCount(target);
          countRef.current = target;
        }
        // Pause at 100, then reset to startAt and continue after the normal interval
        schedule(pauseMs, () => {
          setCount(startAt);
          countRef.current = startAt;
          schedule(intervalMs, tick);
        });
      } else {
        // Normal increment
        setCount(next);
        countRef.current = next;
        schedule(intervalMs, tick);
      }
    };

    // Kick off the loop after the first interval
    schedule(intervalMs, tick);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [startAt, step, target, intervalMs, pauseMs]);

  return (
    <View
      style={{
        height: size,
        width: size,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <QAndADevice
        color="#004467"
        height={(size / 3) * 2}
        backgroundColor="#45ddc0"
        isBold
      />
      <DefaultText
        style={{
          marginTop: -2,
          fontSize: 8,
          backgroundColor: '#45ddc0',
          zIndex: -1,
          borderRadius: 999,
          paddingHorizontal: 3,
        }}
      >
        {count}
      </DefaultText>
    </View>
  );
};

const OneWeek = () => {
  return (
    <View
      style={{
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: size / 2,
        borderRightWidth: size / 2,
        borderBottomWidth: size,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: durationColor,
      }}
    />
  );
};


const OneMonth = () => {
  const inner = size / Math.SQRT2; // tip-to-tip box of a 45° square

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
      }}
    >
      <View
        style={{
          width: inner,
          height: inner,
          backgroundColor: durationColor,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

const OneYear = ({
  orientation = 'pointy',
}) => {
  const SQRT3 = Math.sqrt(3);

  // Flat-top hex viewBox is 2 : √3; Pointy-top is √3 : 2
  let viewBox, points;
  if (orientation === 'pointy') {
    // width = √3, height = 2
    viewBox = `0 0 ${SQRT3} 2`;
    points = [
      [SQRT3 / 2, 0],
      [SQRT3, 0.5],
      [SQRT3, 1.5],
      [SQRT3 / 2, 2],
      [0, 1.5],
      [0, 0.5],
    ]
      .map(([x, y]) => `${x},${y}`)
      .join(' ');
  } else {
    // flat-top (default): width = 2, height = √3
    viewBox = `0 0 2 ${SQRT3}`;
    points = [
      [0.5, 0],
      [1.5, 0],
      [2, SQRT3 / 2],
      [1.5, SQRT3],
      [0.5, SQRT3],
      [0, SQRT3 / 2],
    ]
      .map(([x, y]) => `${x},${y}`)
      .join(' ');
  }

  return (
    <Svg
      width={size}
      height={size}
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet" // keep it regular; never distort
    >
      <Polygon points={points} fill={durationColor} />
    </Svg>
  );
};

const LongBio = () => {
  const iconSize = 14;
  const stepDuration = 200;

  const x = useSharedValue(0);
  const rot = useSharedValue(0);

  // A tiny “writing” path (all points are within 0..max)
  const path = [
    { x: 0, rot:   0 },
    { x: 0, rot: -10 },
    { x: 2, rot: -10 },
    { x: 0, rot: -10 },
    { x: 2, rot: -10 },
    { x: 0, rot: -10 },
    { x: 2, rot: -10 },
    { x: 0, rot:   0 },
    // Adds a delay before looping
    ...new Array(10).fill({ x: 0, rot: 0 })
  ];

  useEffect(() => {
    // Move along the path, then loop
    x.value = withRepeat(
      withSequence(
        ...path.map(
          p => withTiming(
            p.x,
            { duration: stepDuration, easing: Easing.inOut(Easing.quad) }
          )
        )
      ),
      -1,
      true,
    );

    // Subtle “write” tilt: tip forward, back past center a bit, then settle
    rot.value = withRepeat(
      withSequence(
        ...path.map(
          path => withTiming(
            path.rot,
            { duration: stepDuration, easing: Easing.inOut(Easing.quad) }
          )
        )
      ),
      -1,
      true,
    );
  }, [x, rot]);

  const penStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { rotateZ: `${rot.value}deg` },
    ],
  }));

  return (
    <View
      style={{
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
      }}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            alignItems: 'center',
            justifyContent: 'center',
            left: 0,
            top: 0,
            bottom: 0,
            right: 0,
          },
          penStyle
        ]}
      >
        <FontAwesomeIcon
          icon={faPen}
          size={iconSize}
          style={{ color: '#373990' }}
        />
      </Animated.View>
    </View>
  );
};

const EarlyAdopter = () => {
  return (
    <View
      style={{
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <FontAwesomeIcon
        icon={faSeedling}
        size={14}
        style={{color: '#3ba55d'}}
      />
    </View>
  );
};

export {
  Admin,
  GoldBadge,
  OgMember,
  QAndA100,
  OneWeek,
  OneMonth,
  OneYear,
  LongBio,
  EarlyAdopter,
};

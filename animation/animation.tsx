import {
  Animated,
  Easing,
} from 'react-native';
import {
  useCallback,
  useRef,
} from 'react';


const useShake = (): [Animated.Value, () => void] => {
  const shakeAnimation = useRef(new Animated.Value(0)).current;

  const startShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnimation, {
        toValue: -25,
        duration: 75,
        useNativeDriver: true,
        easing: Easing.linear
      }),
      Animated.timing(shakeAnimation, {
        toValue: 20,
        duration: 75,
        useNativeDriver: true,
        easing: Easing.linear
      }),
      Animated.timing(shakeAnimation, {
        toValue: -15,
        duration: 75,
        useNativeDriver: true,
        easing: Easing.linear
      }),
      Animated.timing(shakeAnimation, {
        toValue: 0,
        duration: 75,
        useNativeDriver: true,
        easing: Easing.linear
      })
    ]).start();
  }, [shakeAnimation]);

  return [shakeAnimation, startShake];
};


const useFadePressable = (
  opacityLo: number = 0.5,
  opacityHi: number = 1.0,
  duration: number = 200
) => {
  const animatedOpacity = useRef(new Animated.Value(opacityHi)).current;

  const fade = useCallback(() => {
    animatedOpacity.stopAnimation();
    animatedOpacity.setValue(opacityLo);
  }, [opacityLo, opacityHi, duration]);

  const unfade = useCallback(() => {
    animatedOpacity.stopAnimation();
    Animated.timing(animatedOpacity, {
      toValue: opacityHi,
      duration,
      useNativeDriver: true,
    }).start();
  }, [opacityLo, opacityHi, duration]);

  return { animatedOpacity, fade, unfade };
};

export {
  useFadePressable,
  useShake,
};

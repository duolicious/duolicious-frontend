import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import {
  LinearGradient,
} from 'expo-linear-gradient';
import {
  clamp,
  hslToHex,
} from './util';

type HuePickerProps = {
  borderRadius: number;
  hue: number;
  barWidth: number;
  barHeight: number;
  sliderSize: number;
  onDragMove?: (event: { hue: number; gestureState: any }) => void;
  containerStyle?: ViewStyle;
}

type HuePickerRef = {
  getHue: () => number;
  setHue: (h: number) => void;
};

const HuePicker = forwardRef<
  HuePickerRef,
  HuePickerProps
>(
  (
    {
      borderRadius,
      hue, // TODO: Delete?
      barWidth,
      barHeight,
      sliderSize,
      onDragMove,
      containerStyle = {}
    },
    ref
  ) => {
    const hueColors = [
      '#ff0000',
      '#ffff00',
      '#00ff00',
      '#00ffff',
      '#0000ff',
      '#ff00ff',
      '#ff0000',
    ];

    const initialY = 0;

    const sliderY = useRef(initialY);
    const animatedSliderY = useRef(new Animated.Value(initialY));

    const backgroundColor = animatedSliderY.current.interpolate({
      inputRange: hueColors.map((_, i) => i * barHeight / (hueColors.length - 1)),
      outputRange: hueColors,
    });

    const panResponder = useRef(PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) =>
        animatedSliderY.current.setValue(clamp(sliderY.current + gestureState.dy, 0, barHeight)),
      onPanResponderRelease: (_, gestureState) =>
        sliderY.current = clamp(sliderY.current + gestureState.dy, 0, barHeight),
    })).current;

    const getHue = () => sliderY.current;

    const setHue = (h: number) => {
      const clamped = clamp(h, 0, barHeight);

      animatedSliderY.current.setValue(clamped);
      sliderY.current = clamped;
    };

    useImperativeHandle(ref, () => ({ getHue, setHue }), [getHue, setHue]);

    return (
      <View style={[
        styles.container,
        containerStyle,
        {
          paddingTop: sliderSize / 2,
          paddingBottom: sliderSize / 2,
        },
      ]}>
        <LinearGradient
          colors={hueColors}
          style={{ borderRadius, width: barWidth, height: barHeight }}
        />
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.slider,
            {
              backgroundColor: backgroundColor,
              borderRadius: sliderSize / 2,
              borderWidth: sliderSize / 10,
              width: sliderSize,
              height: sliderSize,
              transform: [
                { translateY: animatedSliderY.current }
              ],
            }
          ]}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  slider: {
    position: 'absolute',
    borderColor: '#fff',
    top: 0,
  },
});

export {
  HuePicker,
};

import React, {
  useCallback,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { View, TouchableWithoutFeedback, PanResponder, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  clamp,
  hslToHex,
  hsvToHex,
} from './util';

type SaturationValuePickerRef = {
  getCurrentColor: () => string;
};

type SaturationValuePickerProps = {
  borderRadius: number;
  size: number;
  sliderSize: number;
  hue: number;
  saturation: number;
  value: number;
  containerStyle?: ViewStyle;
  onDragStart?: (params: { saturation: number; value: number; gestureState: any }) => void;
  onDragMove?: (params: { saturation: number; value: number; gestureState: any }) => void;
}

const SaturationValuePicker = forwardRef<
  SaturationValuePickerRef,
  SaturationValuePickerProps
>(
  (
    {
      borderRadius,
      size,
      sliderSize,
      hue,
      saturation,
      value,
      containerStyle = {},
      onDragStart,
      onDragMove,
    },
    ref,
  ) => {
    const initialXY = {x: 0, y: 0};

    const sliderXY = useRef(initalXY);
    const animatedSliderXY = useRef(new Animated.ValueXY(initialXY));

    const computeSatVal = (locationX: number, locationY: number) => ({
      saturation: clamp(locationX / size),
      value: 1 - clamp(locationY / size),
    });

    const getCurrentColor = useCallback(
      () => hsvToHex(hue, saturation, value),
      [hue, saturation, value]
    );

    useImperativeHandle(ref, () => ({ getCurrentColor }), [getCurrentColor]);

    const panResponder = useRef(PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gestureState) => {
        const initialSatVal = computeSatVal(gestureState.x0, gestureState.y0);
        onDragStart?.({ ...initialSatVal, gestureState });
      },
      onPanResponderMove: (_, gestureState) => {
        const moveSatVal = computeSatVal(gestureState.moveX, gestureState.moveY);
        onDragMove?.({ ...moveSatVal, gestureState });
      },
    })).current;

    return (
      <View
        style={[
          styles.container,
          containerStyle,
          {
            height: size + sliderSize,
            width: size + sliderSize,
          },
        ]}
      >
        <LinearGradient
          style={[{ borderRadius }, styles.linearGradient]}
          colors={['#fff', hslToHex(hue, 1, 0.5)]}
          start={[0, 0.5]}
          end={[1, 0.5]}
        >
          <LinearGradient
            colors={['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 1)']}
            style={{ height: size, width: size }}
          />
        </LinearGradient>
        <View
          {...panResponder.panHandlers}
          style={[
            styles.slider,
            {
              backgroundColor: getCurrentColor(),
              borderRadius: sliderSize / 2,
              borderWidth: sliderSize / 10,
              width: sliderSize,
              height: sliderSize,
              transform: [
                { translateX: size * saturation - sliderSize / 2 },
                { translateY: size * (1 - value) - sliderSize / 2 },
              ],
            },
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
  },
  linearGradient: {
    overflow: 'hidden',
  },
});

export {
  SaturationValuePicker,
  SaturationValuePickerRef,
};

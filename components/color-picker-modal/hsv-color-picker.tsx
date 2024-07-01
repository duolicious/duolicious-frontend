import React, {
  useRef,
} from 'react';
import {
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import {
  HuePicker,
} from './hue-picker';
import {
  SaturationValuePicker,
  SaturationValuePickerRef,
} from './saturation-value-picker';

type HsvColorPickerProps = {
  containerStyle?: ViewStyle;
  huePickerContainerStyle?: ViewStyle;
  huePickerBorderRadius?: number;
  huePickerHue?: number;
  huePickerBarWidth?: number;
  huePickerBarHeight?: number;
  huePickerSliderSize?: number;
  onHuePickerDragStart?: () => void;
  onHuePickerDragMove?: ({ hue }: { hue: number }) => void;
  satValPickerContainerStyle?: ViewStyle;
  satValPickerBorderRadius?: number;
  satValPickerSize?: number;
  satValPickerSliderSize?: number;
  satValPickerHue?: number;
  satValPickerSaturation?: number;
  satValPickerValue?: number;
  onSatValPickerDragMove?: (
    { saturation, value }: { saturation: number, value: number }) => void;
}

const HsvColorPicker: React.FC<HsvColorPickerProps> = (props) => {
  const satValPickerRef = useRef<SaturationValuePickerRef>(null);

  const getCurrentColor = () => {
    return satValPickerRef.current?.getCurrentColor();
  };

  return (
    <View style={[styles.container, props.containerStyle]}>
      <SaturationValuePicker
        containerStyle={props.satValPickerContainerStyle}
        borderRadius={props.satValPickerBorderRadius ?? 0}
        size={props.satValPickerSize ?? 200}
        sliderSize={props.satValPickerSliderSize ?? 24}
        hue={props.satValPickerHue ?? 0}
        saturation={props.satValPickerSaturation ?? 1}
        value={props.satValPickerValue ?? 1}
        onDragMove={props.onSatValPickerDragMove}
        ref={satValPickerRef}
      />
      <HuePicker
        containerStyle={props.huePickerContainerStyle}
        borderRadius={props.huePickerBorderRadius ?? 0}
        hue={props.huePickerHue ?? 0}
        barWidth={props.huePickerBarWidth ?? 12}
        barHeight={props.huePickerBarHeight ?? 200}
        sliderSize={props.huePickerSliderSize ?? 24}
        onDragMove={props.onHuePickerDragMove}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export {
  HsvColorPicker,
};

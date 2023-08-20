import {
  View,
} from 'react-native';
import {
  useState,
  useRef,
} from 'react';
import Slider from '@react-native-community/slider';

import { LabelledSlider } from './labelled-slider';

const RangeSlider = ({minimumValue, maximumValue, ...props}) => {
  const {
    containerStyle,
    unitsLabel,
    onLowerValueChange,
    onUpperValueChange,
    initialLowerValue,
    initialUpperValue,
    valueRewriter,
  } = props;

  const args = {
    minimumValue: minimumValue,
    maximumValue: maximumValue,
    step: 1,
    valueRewriter: valueRewriter,
  };

  const topSliderStyle = useRef({
    marginBottom: 30
  }).current;

  const [lowerValue, setLowerValue] = useState(initialLowerValue ?? args.minimumValue);
  const [upperValue, setUpperValue] = useState(initialUpperValue ?? args.maximumValue);

  const _onLowerValueChange = (value: number) => {
    setLowerValue(value);
    onLowerValueChange(value);

    if (value > upperValue) {
      setUpperValue(value);
      onUpperValueChange(value);
    }
  };

  const _onUpperValueChange = (value: number) => {
    setUpperValue(value);
    onUpperValueChange(value);

    if (value < lowerValue) {
      setLowerValue(value)
      onLowerValueChange(value);
    }
  };

  return (
    <View
      style={{
        ...containerStyle,
      }}
    >
      <LabelledSlider
        value={lowerValue}
        onValueChange={_onLowerValueChange}
        label={"Min" + (unitsLabel ? ` (${unitsLabel})` : '')}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        step={1}
        valueRewriter={valueRewriter}
        style={topSliderStyle}
      />
      <LabelledSlider
        value={upperValue}
        onValueChange={_onUpperValueChange}
        label={"Max" + (unitsLabel ? ` (${unitsLabel})` : '')}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        step={1}
        valueRewriter={valueRewriter}
      />
    </View>
  );
};

export {
  RangeSlider,
};

// TODO: uninstall chromajs dependency
// TODO: uninstall other unused dependency
// TODO: Remove touchablewithoutfeedback

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  StyleSheet,
  View,
  Animated,
  Text,
} from 'react-native';
import {
  listen,
  notify,
} from '../../events/events';
import {
  Title,
} from '../../components/title';
import { HsvColorPicker } from './hsv-color-picker';


type ColorPickedEvent = string;

const styles = StyleSheet.create({
  modal: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    borderColor: '#555',
    padding: 28,
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    width: 14,
    height: 14,
  },
  title: {
    color: 'white',
    marginTop: 0,
    marginBottom: 0,
  },
  container2: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  text: {
    marginTop: 20,
  },
});


const ColorPicker = () => {
  const [hue, setHue] = useState(0);
  const [sat, setSat] = useState(0.0);
  const [val, setVal] = useState(0.0);

  console.log('render', hue); // TODO

  const onHuePickerDragMove = ({ hue }) => {
    setHue(hue);
  };

  const onSatValPickerDragMove = ({ saturation, value }) => {
    setSat(saturation);
    setVal(value);
  };

  return (
    <View style={styles.container2}>
      <HsvColorPicker
        key={1}
        huePickerHue={hue}
        onHuePickerDragMove={onHuePickerDragMove}
        satValPickerHue={hue}
        satValPickerSaturation={sat}
        satValPickerValue={val}
        onSatValPickerDragMove={onSatValPickerDragMove}
      />
      <Text style={styles.text}>
        Selected Color: H: {hue}, S: {sat}, V: {val}
      </Text>
    </View>
  );
};

const ColorPickerModal: React.FC = () => {
  // TODO
  const [isShowing, setIsShowing] = useState(true);
  const [shouldShow, setShouldShow] = useState(true);

  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: shouldShow ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => setIsShowing(shouldShow));
  }, [setIsShowing, shouldShow, opacity]);

  const onPressColor = useCallback((color: string) => {
    notify<ColorPickedEvent>('color-picked', color);
    setShouldShow(false);
  }, []);

  const onPressNowhere = useCallback(() => {
    setShouldShow(false)
  }, []);

  useEffect(() => {
    return listen('show-color-picker', () => setShouldShow(true));
  }, [setShouldShow]);

  if (!(isShowing || shouldShow)) {
    return null;
  }

  return (
    <Animated.View style={[styles.modal, { opacity: opacity }]}>
      <Title style={styles.title}>
        Pick Your Color
      </Title>
      <ColorPicker />
    </Animated.View>
  );
};

export {
  ColorPickerModal,
};

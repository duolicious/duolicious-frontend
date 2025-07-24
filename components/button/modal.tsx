import {
  Animated,
  Pressable,
  StyleSheet,
} from 'react-native';
import { DefaultText } from '../default-text';
import { useFadePressable } from '../../animation/animation';

const ModalButton = ({onPress, title, color}) => {
  const { animatedOpacity, fade, unfade } = useFadePressable();

  return <Pressable
    style={styles.pressable}
    onPressIn={fade}
    onPressOut={unfade}
    onPress={onPress}
  >
    <Animated.View
      style={{
        borderRadius: 5,
        backgroundColor: color,
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: animatedOpacity,
      }}
    >
      <DefaultText
        selectable={false}
        style={styles.defaultText}
      >
        {title}
      </DefaultText>
    </Animated.View>
  </Pressable>
};

const styles = StyleSheet.create({
  pressable: {
    height: 40,
    width: 100,
  },
  defaultText: {
    color: 'white',
    fontWeight: '700',
  },
});

export {
  ModalButton,
};

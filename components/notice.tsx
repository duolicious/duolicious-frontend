import {
  Pressable,
  View,
} from 'react-native';
import {
  createElement
} from 'react';
import { DefaultText } from './default-text';

const Notice = ({children, ...rest}) => {
  const {
    onPress,
    navigation,
    style,
  } = rest;

  return (
    createElement(
      onPress ? Pressable : View,
      {
        style: {
          width: '100%',
        },
        onPress: onPress,
      },
      <View
        style={[
          {
            backgroundColor: 'rgba(119, 0, 255, 0.1)',
            padding: 15,
            borderRadius: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 5,
            marginRight: 5,
          },
          style,
        ]}
      >
        {children}
      </View>
    )
  );
};

export {
  Notice,
};

import {
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

const QAndADevice = ({
  color,
  fontSize = 20,
  isBold = false,
  spacing = -6,
}) => {
  const noIcon = isBold ? 'close-circle' : 'close-circle-outline';
  const yesIcon = isBold ? 'checkmark-circle' : 'checkmark-circle-outline';

  return (
    <View style={{flexDirection: 'row'}}>
      <View
        style={{
          backgroundColor: 'white',
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <Ionicons
          style={{color: color, fontSize: fontSize}}
          name={noIcon}
        />
      </View>
      <View
        style={{
          backgroundColor: 'white',
          borderRadius: 999,
          overflow: 'hidden',
          marginLeft: spacing,
        }}
      >
        <Ionicons
          style={{
            color: color,
            fontSize: fontSize,
            flexShrink: 1,
            overflow: 'hidden',
          }}
          name={yesIcon}
        />
      </View>
    </View>
  );
};

export {
  QAndADevice,
};

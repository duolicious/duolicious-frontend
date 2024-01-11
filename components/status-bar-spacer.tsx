import {
  Platform,
  StatusBar,
  View,
} from 'react-native';

const StatusBarSpacer = (props) => {
  return (
    <View
      style={{
        height: (props.extraHeight ?? 0) + (Platform.OS === 'web' ? 0 : StatusBar.currentHeight),
        backgroundColor: 'transparent',
        ...props.style,
      }}
    />
  );
};

export {
  StatusBarSpacer,
}

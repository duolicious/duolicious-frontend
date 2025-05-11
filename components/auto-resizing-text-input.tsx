import {
  Platform,
  View,
  useWindowDimensions,
} from 'react-native';
import { DefaultText } from './default-text';
import { DefaultLongTextInput } from './default-long-text-input';
import { styles as defaultTextInputStyles } from './default-text-input';


const AutoResizingTextInput = (props) => {
  const { height } = useWindowDimensions();

  return (
    <View style={{ flex: 1, maxHeight: height / 4 }}>
      <DefaultText
        style={{
          zIndex: -1,
          flexWrap: 'wrap',
          width: '100%',
          minHeight: 30,
          opacity: 0,
          fontSize: defaultTextInputStyles.textInput.fontSize,
          paddingTop: Platform.OS === 'web' ? 5 : 4,
        }}
      >
        {props.value}
      </DefaultText>
      <DefaultLongTextInput
        {...props}
        style={{
          ...props.style,
          outline: 'none',
          position: 'absolute',
          top: Platform.OS === 'web' ? 5 : 4,
          bottom: 0,
          left: 0,
          right: 0,
        }}
      />
    </View>
  );
};


export {
  AutoResizingTextInput,
};

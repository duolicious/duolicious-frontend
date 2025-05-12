import {
  Platform,
  View,
} from 'react-native';
import { DefaultText } from './default-text';
import { DefaultLongTextInput } from './default-long-text-input';
import { styles as defaultTextInputStyles } from './default-text-input';


const AutoResizingTextInput = ({
  maxHeight = undefined,
  ...props
}: any) => {
  return (
    <View style={{ flex: 1, maxHeight }}>
      <DefaultText
        style={{
          zIndex: -1,
          flexWrap: 'wrap',
          width: '100%',
          minHeight: 30,
          overflow: 'hidden',

          // TODO
          borderRadius: 0,
          borderWidth: 0,
          backgroundColor: 'transparent',
          color: 'red',
          paddingTop: 0,
          paddingLeft: 0,
          paddingRight: 0,
          paddingBottom: 0,
          fontSize: defaultTextInputStyles.textInput.fontSize,

          ...props.style,
        }}
      >
        {props.value}
      </DefaultText>
      <DefaultLongTextInput
        {...props}
        style={{
          outline: 'none',
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,

          // TODO
          borderRadius: 0,
          borderWidth: 0,
          backgroundColor: 'transparent',
          color: 'blue',
          paddingTop: 0,
          paddingLeft: 0,
          paddingRight: 0,
          paddingBottom: 0,
          fontSize: defaultTextInputStyles.textInput.fontSize,

          ...props.style,
        }}
      />
    </View>
  );
};


export {
  AutoResizingTextInput,
};

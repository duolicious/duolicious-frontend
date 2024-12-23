import {
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBarSpacer } from './status-bar-spacer';
import { DefaultText } from './default-text';
import { Logo16 } from './logo';
import { isMobile } from '../util/util';

const TopNavBar = (props) => {
  return (
    <View
      style={{
        backgroundColor: 'white',
        zIndex: 999,
        width: '100%',
        overflow: 'visible',
        ...props.containerStyle,
      }}
    >
      <StatusBarSpacer/>
      <View
        style={{
          width: '100%',
          maxWidth: 600,
          height: 40,
          alignSelf: 'center',
          alignItems: 'center',
          justifyContent: 'center',
          ...props.style,
        }}
      >
        {props.children}
      </View>
    </View>
  );
};

const DuoliciousTopNavBar = (props) => {
  if (!isMobile()) {
    return <View style={{ height: 10 }} />;
  }

  const {style, backgroundColor, textColor} = props;

  return (
    <TopNavBar
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 1,
        ...style,
      }}
      backgroundColor={backgroundColor}
    >
      <Logo16 size={16 * 2} color="#70f" rectSize={0.35} />
      <DefaultText
        style={{
          fontFamily: 'TruenoBold',
          color: textColor || '#70f',
          fontSize: 22,
        }}
      >
        Duolicious
      </DefaultText>
      {props.children}
    </TopNavBar>
  );
};

export {
  DuoliciousTopNavBar,
  TopNavBar,
};

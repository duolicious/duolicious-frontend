import {
  Text,
  TextProps,
} from 'react-native';

const DefaultText = (props: TextProps) => {
  const fontWeight = (props?.style as any)?.fontWeight;
  const fontFamily = (props?.style as any)?.fontFamily;

  const montserratFontFamily: string | undefined = {
    '100': 'MontserratThin',
    '200': 'MontserratExtraLight',
    '300': 'MontserratLight',
    '400': 'MontserratRegular',
    '500': 'MontserratMedium',
    '600': 'MontserratSemiBold',
    '700': 'MontserratBold',
    '800': 'MontserratExtraBold',
    '900': 'MontserratBlack',
  }[fontWeight] || 'MontserratRegular';


  const robotoFontFamily: string | undefined = {
    '100': 'RobotoThin',
    '200': 'RobotoExtraLight',
    '300': 'RobotoLight',
    '400': 'RobotoRegular',
    '500': 'RobotoMedium',
    '600': 'RobotoSemiBold',
    '700': 'RobotoBold',
    '800': 'RobotoExtraBold',
    '900': 'RobotoBlack',
  }[fontWeight] || 'RobotoRegular';


  const props_ = {
    style: [
      { fontFamily: fontFamily || `${robotoFontFamily}` },
      props.style,
      { fontWeight: undefined },
    ]
  };

  return (
    <Text
      selectable={false}
      {...{ ...props, ...props_ }}
    >
      {props.children}
    </Text>
  );
};

export {
  DefaultText,
};

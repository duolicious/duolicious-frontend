import {
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import {
  createElement,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { ButtonGroup } from '@rneui/themed';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ButtonWithCenteredText } from './button/centered-text';
import { StatusBarSpacer } from './status-bar-spacer';
import { LabelledSlider } from './labelled-slider';
import { RangeSlider as RangeSlider_ } from './range-slider';
import { DefaultText } from './default-text';
import { DefaultTextInput } from './default-text-input';
import { OtpInput } from './otp-input';
import { DatePicker } from './date-picker';
import { LocationSelector as LocationSelector_ } from './location-selector';
import {
  OptionGroupOtp,
  OptionGroup,
  isOptionGroupButtons,
  isOptionGroupDate,
  isOptionGroupDeletion,
  isOptionGroupGivenName,
  isOptionGroupLocationSelector,
  isOptionGroupOtp,
  isOptionGroupPhotos,
  isOptionGroupSlider,
  isOptionGroupTextLong,
  isOptionGroupTextShort,
  isOptionGroupVerification,
  isOptionGroupRangeSlider,
  isOptionGroupCheckChips,
  isOptionGroupNone,
} from '../data/option-groups';
import {
  SecondaryImages,
} from './images';
import { DefaultLongTextInput } from './default-long-text-input';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckChip as CheckChip_, CheckChips as CheckChips_ } from './check-chip';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons/faArrowLeft'
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { japi } from '../api/api';

type InputProps = {
  input,
  onAnswerGiven,
  title,
  showSkipButton
};

type OtpProps = {
  input: OptionGroupOtp,
};

const Buttons = ({input, onPress}) => {
  return <ButtonGroup_
    buttons={input.buttons}
    initialSelectedIndex={input.initialSelectedIndex}
    onPress={onPress}
  />;
};

const Verification = ({input}) => {
  // TODO
  if (true) {
    return (
      <>
        <DefaultTextInput
          placeholder="Mobile (with country code)"
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
        />
        <ButtonWithCenteredText
          containerStyle={{
            marginLeft: 20,
            marginRight: 20,
          }}
        >
          Send SMS
        </ButtonWithCenteredText>
      </>
    );
  } else {
    return (
      <DefaultText
        style={{
          textAlign: 'center',
          fontSize: 22,
          color: '#444',
        }}
      >
        You're already verified!
      </DefaultText>
    );
  }
};

const Slider = ({input, onPress, title, showDoneButton}) => {
  return (
    <>
      <LabelledSlider
        label={`${title} (${input.slider.unitsLabel})`}
        minimumValue={input.slider.sliderMin}
        maximumValue={input.slider.sliderMax}
        initialValue={input.slider.sliderInitial}
        step={input.slider.step}
        addPlusAtMax={input.slider.addPlusAtMax}
        style={{
          marginLeft: 20,
          marginRight: 20,
        }}
      />
      {showDoneButton &&
        <ButtonWithCenteredText
          onPress={onPress}
          containerStyle={{
            marginTop: 30,
            marginLeft: 20,
            marginRight: 20,
          }}
        >
          Done
        </ButtonWithCenteredText>
      }
    </>
  );
};

const Deletion = ({input, onPress}) => {
  return (
    <ButtonWithCenteredText
      onPress={onPress}
      containerStyle={{
        marginTop: 30,
        marginLeft: 20,
        marginRight: 20,
      }}
    >
      Yes, delete my account right now
    </ButtonWithCenteredText>
  );
};

const GivenName = ({input}) => {
  return (
    <DefaultTextInput
      placeholder="First name"
      textContentType="givenName"
      autoComplete="name-given"
    />
  );
};

const Otp = forwardRef(({input}: OtpProps, ref) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isCodeIncorrect, setIsCodeIncorrect] = useState(false);
  const otpRef = useRef<string | undefined>(undefined);

  const requiredCodeLength = 6;

  const onChangeOtp = useCallback((otp: string) => {
    otpRef.current = otp;
  }, []);

  const submit = useCallback(async () => {
    setIsLoading(true);

    if (otpRef.current === undefined) {
      setIsCodeIncorrect(true);
    } else if (otpRef.current.length != requiredCodeLength) {
      setIsCodeIncorrect(true);
    } else {
      setIsCodeIncorrect(await input.otp.submit(otpRef.current));
    }

    setIsLoading(false);
  }, []);

  useImperativeHandle(ref, () => ({
    submit: submit
  }), []);

  return (
    <>
      <OtpInput codeLength={requiredCodeLength} submit={submit}
        onChangeOtp={onChangeOtp}/>
      <DefaultText
        style={{
          textAlign: 'center',
          color: 'white',
          height: 30,
          opacity: isCodeIncorrect ? 1 : 0,
        }}
      >
        Incorrect code. Try Again.
      </DefaultText>
      <ButtonWithCenteredText
        containerStyle={{
          marginTop: 10,
          marginLeft: 20,
          marginRight: 20,
        }}
        fontSize={14}
      >
        Resend code
      </ButtonWithCenteredText>
    </>
  );
});

const LocationSelector = ({input, onPress, showDoneButton}) => {
  return (
    <>
      <LocationSelector_/>
      {showDoneButton &&
        <ButtonWithCenteredText
          onPress={onPress}
          containerStyle={{
            zIndex: -1,
            elevation: -1,
            marginTop: 30,
            marginLeft: 20,
            marginRight: 20,
          }}
        >
          Done
        </ButtonWithCenteredText>
      }
    </>
  );
};

const Photos = ({input}) => {
  return (
    <View
      style={{
        marginLeft: 20,
        marginRight: 20,
      }}
    >
      <SecondaryImages/>
    </View>
  );
};

const TextLong = ({input}) => {
  return <DefaultLongTextInput
    style={{
      marginLeft: 20,
      marginRight: 20,
    }}
  />
};

const TextShort = ({input, onPress}) => {
  return (
    <>
      <DefaultTextInput
        style={{
          marginLeft: 20,
          marginRight: 20,
        }}
        placeholder="Type here..."
      />
      <ButtonWithCenteredText
        onPress={onPress}
        containerStyle={{
          marginTop: 30,
          marginLeft: 20,
          marginRight: 20,
        }}
      >
        Done
      </ButtonWithCenteredText>
    </>
  );
};

const CheckChips = ({input, onPress, showDoneButton}) => {
  return (
    <>
      <CheckChips_
        style={{
          marginLeft: 20,
          marginRight: 20,
          alignSelf: 'center',
        }}
      >
        {
          input.checkChips.map((checkChip, i) =>
            <CheckChip_
              key={i}
              label={checkChip.label}
              initialCheckedState={checkChip.checked}
            />
          )
        }
      </CheckChips_>
      {showDoneButton &&
        <ButtonWithCenteredText
          onPress={onPress}
          containerStyle={{
            marginTop: 30,
            marginLeft: 20,
            marginRight: 20,
          }}
        >
          Done
        </ButtonWithCenteredText>
      }
    </>
  );
};

const RangeSlider = ({input}) => {
  return <RangeSlider_
    unitsLabel={input.rangeSlider.unitsLabel}
    minimumValue={input.rangeSlider.sliderMin}
    maximumValue={input.rangeSlider.sliderMax}
    containerStyle={{
      marginLeft: 20,
      marginRight: 20,
    }}
  />
};

const InputElement = forwardRef((
  {input, onAnswerGiven, title, showSkipButton}: InputProps,
  ref
) => {
  if (isOptionGroupButtons(input)) {
    return <Buttons input={input} onPress={onAnswerGiven}/>;
  } else if (isOptionGroupVerification(input)) {
    return <Verification input={input}/>;
  } else if (isOptionGroupSlider(input)) {
    return <Slider input={input} title={title} onPress={onAnswerGiven}
      showDoneButton={showSkipButton}/>;
  } else if (isOptionGroupDeletion(input)) {
    return <Deletion input={input} onPress={onAnswerGiven}/>;
  } else if (isOptionGroupGivenName(input)) {
    return <GivenName input={input}/>
  } else if (isOptionGroupOtp(input)) {
    return <Otp ref={ref} input={input}/>
  } else if (isOptionGroupDate(input)) {
    return <DatePicker ref={ref}/>;
  } else if (isOptionGroupLocationSelector(input)) {
    return <LocationSelector input={input} onPress={onAnswerGiven}
      showDoneButton={showSkipButton}/>;
  } else if (isOptionGroupPhotos(input)) {
    return <Photos input={input}/>;
  } else if (isOptionGroupTextLong(input)) {
    return <TextLong input={input}/>;
  } else if (isOptionGroupTextShort(input)) {
    return <TextShort input={input} onPress={onAnswerGiven}/>;
  } else if (isOptionGroupCheckChips(input)) {
    return <CheckChips input={input} onPress={onAnswerGiven}
      showDoneButton={showSkipButton}/>;
  } else if (isOptionGroupRangeSlider(input)) {
    return <RangeSlider input={input}/>;
  } else if (isOptionGroupNone(input)) {
    return <></>;
  } else {
    throw Error('Unhandled input: ' + JSON.stringify(input));
  }
});

const OptionScreen = ({navigation, route}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isValid, setIsValid] = useState(true);

  const optionGroups: OptionGroup[] = route?.params?.optionGroups ?? [];
  const showSkipButton: boolean = route?.params?.showSkipButton ?? true;
  const showCloseButton: boolean = route?.params?.showCloseButton ?? true;
  const showBackButton: boolean = route?.params?.showBackButton ?? false;
  const buttonBorderWidth: number = route?.params?.buttonBorderWidth;
  const buttonBackgroundColor: number = route?.params?.buttonBackgroundColor;
  const buttonTextColor: number = route?.params?.buttonTextColor;
  const backgroundColor: string | undefined = route?.params?.backgroundColor;
  const color: string | undefined = route?.params?.color;

  const thisOptionGroup = optionGroups[0];

  const inputRef = useRef(undefined);

  const {
    title,
    description,
    input,
    scrollView,
  } = thisOptionGroup;

  const onAnswerGiven = useCallback(async () => {
    switch (optionGroups.length) {
      case 0: {
        throw Error('Expected there to be some option groups');
      }
      case 1: {
        const submit = inputRef.current?.submit;

        if (submit) {
          setIsLoading(true);
          const isValid_ = await submit();
          if (isValid_) {
            navigation.popToTop();
          }
          setIsValid(isValid_);
          setIsLoading(false);
        } else {
          navigation.popToTop();
        }

        break;
      }
      default: {
        navigation.push(
          route.name,
          {
            ...route.params,
            optionGroups: optionGroups.slice(1)
          }
        );
      }
    }
  }, [inputRef]);

  return (
    <View
      style={{
        backgroundColor: backgroundColor,
        width: '100%',
        height: '100%',
      }}
    >
      <View
        style={{
          height: '100%',
          width: '100%',
          maxWidth: 600,
          alignSelf: 'center',
        }}
      >
        <StatusBarSpacer/>
        {showCloseButton &&
          <Pressable onPress={() => navigation.popToTop()}>
            <Ionicons
              style={{
                marginTop: 10,
                marginLeft: 10,
                fontSize: 30,
              }}
              name="close"
            />
          </Pressable>
        }
        {showBackButton &&
          <Pressable onPress={() => navigation.goBack()}>
            <FontAwesomeIcon
              style={{
                margin: 15,
                color: 'white',
              }}
              icon={faArrowLeft}
              size={24}
              color="white"
            />
          </Pressable>
        }
        <View
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 1,
            paddingTop: showCloseButton || showBackButton ? 0 : 40,
            paddingBottom: 40,
          }}
        >
          <DefaultText
            style={{
              textAlign: 'center',
              fontWeight: '700',
              fontSize: 28,
              color: color,
              paddingLeft: 20,
              paddingRight: 20,
            }}
          >
            {title}
          </DefaultText>
          <DefaultText
            style={{
              color: color || '#777',
              textAlign: 'center',
              paddingLeft: 20,
              paddingRight: 20,
              paddingTop: 20,
            }}
          >
            {description}
          </DefaultText>
        </View>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            overflow: 'visible',
            zIndex: 999,
          }}
        >
          {scrollView === false &&
            <InputElement
              input={input}
              onAnswerGiven={onAnswerGiven}
              title={title}
              showSkipButton={showSkipButton}/>
          }
          {scrollView !== false && <>
              <ScrollView
                contentContainerStyle={{
                  flexGrow: 1,
                  justifyContent: 'center',
                }}
              >
                <View style={{height: 20}}/>
                <InputElement
                  input={input}
                  onAnswerGiven={onAnswerGiven}
                  title={title}
                  showSkipButton={showSkipButton}/>
                <View style={{height: 20}}/>
              </ScrollView>
              <LinearGradient
                colors={[backgroundColor || 'white', 'transparent']}
                style={{
                  position: 'absolute',
                  height: 20,
                  width: '100%',
                  top: 0,
                  left: 0,
                }}
              />
              <LinearGradient
                colors={['transparent', backgroundColor || 'white']}
                style={{
                  position: 'absolute',
                  height: 20,
                  width: '100%',
                  bottom: 0,
                  left: 0,
                }}
              />
            </>
          }
        </View>
        <View
          style={{
            flexShrink: 1,
            justifyContent: 'flex-end',
            padding: 20,
            paddingBottom: 40,
          }}
        >
          <ButtonWithCenteredText
            secondary={true}
            borderWidth={buttonBorderWidth}
            backgroundColor={buttonBackgroundColor}
            textColor={buttonTextColor}
            onPress={onAnswerGiven}
          >
            {showSkipButton ? 'Skip' : 'Continue'}
          </ButtonWithCenteredText>
        </View>
      </View>
    </View>
  );
};

const ButtonGroup_ = ({buttons, initialSelectedIndex, ...rest}) => {
  const {onPress} = rest;

  const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex);

  const onPress_ = (value: number) => {
    setSelectedIndex(value);
    if (onPress !== undefined) {
      onPress(value);
    }
  };

  return <ButtonGroup
    vertical={true}
    buttons={buttons}
    selectedIndex={selectedIndex}
    onPress={onPress_}
    buttonContainerStyle={{
      backgroundColor: 'transparent',
    }}
    selectedButtonStyle={{
      backgroundColor: '#70f',
    }}
    containerStyle={{
      marginTop: 0,
      marginLeft: 20,
      marginRight: 20,
      marginBottom: 0,
      borderWidth: 1,
      borderRadius: 10,
      backgroundColor: 'white',
    }}
    activeOpacity={0}
    innerBorderStyle={{
      width: 1,
      color: '#ddd',
    }}
    textStyle={{
      color: 'black',
      fontFamily: 'MontserratMedium',
    }}
  />;
};

export {
  OptionScreen,
};

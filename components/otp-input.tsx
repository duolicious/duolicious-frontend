import React, {useState, useRef} from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {
  DefaultTextInput,
} from './default-text-input';
import { DefaultText } from './default-text';
import { otpDestination } from '../App';

type Props = {
  codeLength: number,
  submit: () => void,
  onChangeOtp: (string: string) => void
};

const clamp = (min: number, max: number) => (x: number) => {
  return Math.min(Math.max(x, min), max);
};

const OtpInput = (props: Props) => {
  type State = StateElement[]
  type StateElement = {
    digit: string,
    isFocused: boolean,
  };

  const [state, setState] = useState<State>(
    Array(props.codeLength).fill(undefined).map(() => ({
      digit: '',
      isFocused: false,
    }))
  );
  const inputRefs = useRef<any>([]);

  const copyStateObj = (stateObj: State) => {
    return stateObj.map(digitState => ({...digitState}));
  };

  const setDigit = (i: number, digit: string) => {
    setState(state => {
      const stateCopy = copyStateObj(state);
      stateCopy[i].digit = digit;
      return stateCopy;
    });
  };

  const setIsFocused = (i: number, isFocused: boolean) => {
    setState(state => {
      const stateCopy = copyStateObj(state);
      stateCopy[i].isFocused = isFocused;
      return stateCopy;
    });
  };

  const clampedInputRefsIndex = (x: number) => {
    return clamp(0, inputRefs.current.length - 1)(x);
  };

  const moveFocusToIndex = (i: number) => {
    inputRefs.current[clampedInputRefsIndex(i)].focus()
  };

  const ensureFocusWithinDigits = (i: number) => {
    if (state[i].digit === '') {
      moveFocusToIndex(state.findIndex(digitState => digitState.digit === ''));
    }
  };

  const onKeyPress = (i: number) => ({nativeEvent: {key: keyValue}}) => {
    if (keyValue === 'Backspace' && state[i].digit === '') {
      const clampedI = clampedInputRefsIndex(i - 1);
      setDigit(clampedI, '');
      moveFocusToIndex(clampedI);
    }
  };

  const onChangeText = (i: number) => (changedText: string) => {
    if (/[^0-9]/g.test(changedText)) {
      setState(state => [...state]);
      return;
    }

    // Update fields such that they only ever have one digit
    const stateCopy_ = copyStateObj(state);

    stateCopy_[i].digit = changedText;

    const inputValues = stateCopy_.map(digitState => digitState.digit);

    const joinedInputValues = inputValues.join('');

    const updatedDigits = Array(props.codeLength).fill('').map((_, i) =>
      joinedInputValues[i] || ''
    );

    const updatedDigitStates = Array(props.codeLength).fill(undefined).map(
      (_, i) => ({
        digit: updatedDigits[i],
        isFocused: state[i].isFocused,
      })
    );


    setState(_ => updatedDigitStates)

    // Move focus
    moveFocusToIndex(joinedInputValues.length);

    // Provide OTP to callback
    props.onChangeOtp(updatedDigits.join(''));
  };

  const onFocus = (i: number) => () => {
    setIsFocused(i, true);
  };

  const onBlur = (i: number) => () => {
    setIsFocused(i, false);
  };

  return (
    <View
      style={{
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <DefaultText style={{ color: 'white' }} >
        One-time pass sent to:
      </DefaultText>
      <DefaultText
        style={{
          color: 'white',
          fontWeight: '700',
          marginBottom: 10,
          marginLeft: 10,
          marginRight: 10,
          textAlign: 'center',
          width: '100%',
        }}
      >
        {otpDestination.value}
      </DefaultText>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {
          state.map((digitState, i) =>
            <DefaultTextInput
              key={i}
              autoFocus={i === 0}
              innerRef={e => inputRefs.current[i] = e}
              onFocus={onFocus(i)}
              onBlur={onBlur(i)}
              onChangeText={onChangeText(i)}
              onKeyPress={onKeyPress(i)}
              onSubmitEditing={props.submit}
              value={digitState.digit}
              inputMode="numeric"
              keyboardType="number-pad"
              style={{
                width: 35,
                margin: 5,
                marginLeft: undefined,
                marginRight: undefined,
                fontSize: 20,
                backgroundColor: 'white',
                borderColor: digitState.isFocused ? '#222' : '#ccc',
                borderWidth: Platform.OS === 'web' ? 0 : 3,
                fontFamily: 'MontserratSemiBold',
                textAlign: 'center',
              }}
            />
          )
        }
      </View>
    </View>
  );
};

export {
  OtpInput,
};

import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { DefaultText } from './default-text';
import { listen, notify } from '../events/events';

type TooltipState = {
  text: string
  padding: number
  bottom?: number
  top?: number
  left?: number
  right?: number
} | null | undefined;

const EVENT_KEY = 'tooltip';

const setTooltip = (state: TooltipState) => {
  notify<TooltipState>(EVENT_KEY, state);
}

const Tooltip = ({
  children,
  style,
}: {
  children: any,
  style?: object,
}) => {
  return (
    <DefaultText
      style={{
        backgroundColor: 'black',
        color: 'white',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 5,
        fontSize: 14,
        ...style,
      }}
      numberOfLines={1}
    >
      {children}
    </DefaultText>
  );
};

const TooltipListener = () => {
  const [state, setState] = useState<TooltipState>(null);

  useEffect(() => {
    listen<TooltipState>(EVENT_KEY, setState);
  }, []);

  if (Platform.OS !== 'web') {
    return null;
  }

  if (!state) {
    return null;
  }

  const padding = state.padding;

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      }}
      // @ts-ignore
      onMouseMove={
        (e) => {
          if (e.target === e.currentTarget) {
            setTooltip(null);
          }
        }
      }
    >
      <View
        style={{
          position: 'absolute',
          top: state.top === undefined ? undefined : state.top - padding,
          bottom: state.bottom === undefined ? undefined : state.bottom - padding,
          left: state.left === undefined ? undefined : state.left - padding,
          right: state.right === undefined ? undefined : state.right - padding,

          paddingTop: state.top === undefined ? undefined : padding,
          paddingBottom: state.bottom === undefined ? undefined : padding,
          paddingLeft: state.left === undefined ? undefined : padding,
          paddingRight: state.right === undefined ? undefined : padding,
        }}
      >
        <Tooltip>{state.text}</Tooltip>
      </View>
    </View>
  );
};

export {
  Tooltip,
  TooltipListener,
  TooltipState,
  setTooltip,
};

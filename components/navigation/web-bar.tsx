import {
  Animated,
  Pressable,
  Text,
  View,
} from 'react-native';
import {
  useCallback,
  useEffect,
  useRef,
} from 'react';
import {
  DefaultText,
} from '../default-text';
import {
  CommonActions,
} from '@react-navigation/native';
import {
  Logo16
} from '../logo';
import {
  LabelToIcon
} from './util';
import { Inbox, inboxStats } from '../../xmpp/xmpp';
import { listen } from '../../events/events';

const Logo = () => {
  return (
    <View
      style={{
        flexDirection: 'row',
        padding: 16,
        gap: 10,
      }}
    >
      <View
        style={{
          width: 60,
          alignItems: 'center',
        }}
      >
        <Logo16/>
      </View>
      <Text
        style={{
          color: 'white',
          alignSelf: 'center',
          fontFamily: 'TruenoBold',
          fontSize: 24,
          textAlign: 'center',
        }}
        selectable={false}
      >
        Duolicious
      </Text>
    </View>
  );
};

const NavigationItems = ({state, navigation, descriptors}) => {
  const prevNumUnread = useRef(0);
  const numUnread = useRef(0);

  const unreadIndicatorOpacity = useRef(new Animated.Value(0)).current;

  const hideIndicator = useCallback(() => {
    unreadIndicatorOpacity.setValue(0);
  }, []);

  const showIndicator = useCallback(() => {
    unreadIndicatorOpacity.setValue(1);
  }, []);

  const onChangeInbox = useCallback((inbox: Inbox | null) => {
    if (inbox) {
      prevNumUnread.current = numUnread.current;

      const stats = inboxStats(inbox);
      numUnread.current = stats.numChats ?
        stats.numUnreadChats :
        stats.numUnreadIntros;

    } else {
      prevNumUnread.current = numUnread.current;
      numUnread.current = 0;
    }

    if (numUnread.current === 0) {
      hideIndicator();
    } else if (numUnread.current > prevNumUnread.current) {
      showIndicator();
    }
  }, []);

  useEffect(() => {
    return listen<Inbox | null>('inbox', onChangeInbox, true);
  }, []);

  return (
    <View
      style={{
        flex: 1,
      }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        const isFocused = state.index === index;

        return (
          <Pressable
            key={route.key}
            onPress={() => {
              const isFocused = state.index === index;
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
                data: {
                  isAlreadyFocused: isFocused,
                },
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.dispatch({
                  ...CommonActions.navigate(route),
                  target: state.key,
                });
              }
            }}
            style={{
              padding: 16,
              flexDirection: 'row',
              gap: 10,
            }}
          >
            <View
              style={{
                width: 60,
                alignItems: 'center',
              }}
            >
              <LabelToIcon
                label={label}
                isFocused={isFocused}
                unreadIndicatorOpacity={unreadIndicatorOpacity}
                color="white"
                backgroundColor="#70f"
                fontSize={28}
              />
            </View>
            <DefaultText
              style={{
                color: 'white',
                fontWeight: isFocused ? 900 : 700,
                fontSize: 22,
              }}
            >
              {descriptors[route.key].options.title || route.name}
            </DefaultText>
          </Pressable>
        );
      })}
    </View>
  );
};

const WebBar = ({state, navigation, tabBarStyle, descriptors}) => {
  return (
    <View style={[
        {
          flexDirection: 'column',
          width: 280,
          gap: 20,
        },
        tabBarStyle,
      ]}
    >
      <Logo/>
      <NavigationItems
        state={state}
        navigation={navigation}
        descriptors={descriptors}
      />
    </View>
  );
};

export {
  WebBar,
}

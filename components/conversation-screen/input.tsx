import {
  ActivityIndicator,
  Platform,
  Pressable,
  View,
  KeyboardAvoidingView,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons/faPaperPlane'
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { isMobile } from '../../util/util';
import { DefaultLongTextInput } from '../default-long-text-input';
import Reanimated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  GifPickedEvent,
} from '../modal/gif-picker-modal';
import {
  MessageStatus,
  sendMessage,
} from '../../chat/application-layer';
import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import * as _ from 'lodash';
import { listen, notify } from '../../events/events';
import { DefaultText } from '../default-text';

const Input = ({
  onPress,
  recipientPersonUuid
}: {
  onPress: (text: string) => Promise<MessageStatus>,
  recipientPersonUuid: string,
}) => {
  const { height } = useWindowDimensions();
  const [text, setText] = useState("");

  const maxHeight = height * 0.4;
  const minHeight = Platform.OS !== 'web' ?
      50 :
      Math.min(maxHeight, Math.max(80, Math.round(text.length / 40) * 15));

  const [isLoading, setIsLoading] = useState(false);

  const opacity = useSharedValue(1);
  const fadeIn = useCallback(() => { opacity.value = 0.5; }, []);
  const fadeOut = useCallback(() => { opacity.value = withTiming(1); }, []);

  const debouncedSendMessage = useCallback(
    _.debounce(
      () => sendMessage(recipientPersonUuid, { type: 'typing' }),
      1000,
      {
        leading: true,
        trailing: false,
        maxWait: 1000,
      },
    ),
    [recipientPersonUuid]
  );

  const maybeSetText = useCallback((t: string) => {
    if (!isLoading) {
      setText(t);
      debouncedSendMessage();
    }
  }, [isLoading, debouncedSendMessage]);

  const sendMessage_ = useCallback(async (textArg?: string) => {
    const trimmed = (textArg ?? text).trim();
    if (trimmed) {
      setIsLoading(true);
      const messageStatus = await onPress(trimmed);
      if (messageStatus === 'sent') {
        setText("");
      }
      setIsLoading(false);
    }
  }, [text]);

  const showGifPicker = useCallback(() => {
    notify('show-gif-picker');
  }, []);

  useEffect(() => {
    return listen<GifPickedEvent>('gif-picked', sendMessage_);
  }, []);

  const onKeyPress = useCallback((e) => {
    if (
      !isMobile() &&
      e.key === 'Enter' &&
      (e.ctrlKey || e.altKey)
    ) {
      e.preventDefault();
      setText((text) => text + "\n");
    } else if (
      !isMobile() &&
      e.key === 'Enter' &&
      !e.shiftKey &&
      !e.ctrlKey &&
      !e.altKey
    ) {
      e.preventDefault();
      sendMessage_();
    }
  }, [sendMessage_]);

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={styles.keyboardAvoidingView}
      enabled={Platform.OS === 'ios'}
    >
      <DefaultLongTextInput
        style={{
          ...styles.textInput,
          ...{
            minHeight: minHeight,
            maxHeight: maxHeight,
          },
        }}
        value={text}
        onChangeText={maybeSetText}
        onKeyPress={onKeyPress}
        placeholder="Type a message..."
        placeholderTextColor="#888888"
        multiline={true}
      />
      <View style={styles.sendButton}>
        <Reanimated.View
          style={{
            opacity,
            height: '100%',
            width: '100%',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Pressable
            style={{
              height: '100%',
              width: '100%',
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgb(228, 204, 255)',
              borderRadius: 999,
              borderWidth: 1,
              borderColor: '#70f',
            }}
            onPressIn={fadeIn}
            onPressOut={fadeOut}
            onPress={() => sendMessage_()}
          >
            {isLoading &&
              <ActivityIndicator size="small" color="#70f" />
            }
            {!isLoading &&
              <FontAwesomeIcon
                icon={faPaperPlane}
                size={20}
                color="#70f"
                style={{
                  marginRight: 5,
                  marginBottom: 5,
                  outline: 'none',
                }}
              />
            }
          </Pressable>
        </Reanimated.View>
        {text === "" &&
          <Reanimated.View
            style={styles.gifButton}
            entering={FadeIn}
            exiting={FadeOut}
          >
            <Reanimated.View
              style={{
                opacity,
                height: '100%',
                width: '100%',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {isLoading &&
                <ActivityIndicator size="small" color="#70f" />
              }
              {!isLoading &&
                <Pressable
                  style={{
                    aspectRatio: 16/9,
                    width: '100%',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: 'white',
                    borderRadius: 5,
                    borderWidth: 3,
                    borderColor: 'black',
                  }}
                  hitSlop={10}
                  onPressIn={fadeIn}
                  onPressOut={fadeOut}
                  onPress={showGifPicker}
                >
                    <DefaultText style={{ fontWeight: 900 }} >
                      GIF
                    </DefaultText>
                </Pressable>
              }
            </Reanimated.View>
          </Reanimated.View>
        }
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flexDirection: 'row',
    maxWidth: 600,
    width: '100%',
    paddingHorizontal: 10,
    marginTop: 10,
    alignSelf: 'center',
    alignItems: 'flex-end',
    gap: 10,
  },
  textInput: {
    backgroundColor: '#eee',
    borderRadius: 10,
    borderWidth: 0,
    padding: 10,
    marginBottom: 10,
    fontSize: 16,
    flex: 1,
    flexGrow: 1,
  },
  gifButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    height: 50,
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  }
});

export {
  Input,
};

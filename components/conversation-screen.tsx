import {
  Animated,
  Image,
  ListRenderItemInfo,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TopNavBar } from './top-nav-bar';
import { SpeechBubble } from './speech-bubble';
import { DefaultText } from './default-text';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons/faPaperPlane'
import { DefaultFlatList } from './default-flat-list';
import {
  onReceiveMessage,
  fetchMessages,
  sendMessage,
  Message,
} from '../xmpp/xmpp';
import {
  IMAGES_URL,
} from '../env/env';

// TODO: Inbox notification indicator needs to light up when you get a message
// TODO: Need to load list of people you've messaged
// TODO: Implement a way to differentiate message requests from established conversations
// TODO: Check if it scrolls to the bottom on mobile devices after the messages first load, and after you send a message
// TODO: Re-add the ability to load old messages past the first page

const ConversationScreen = ({navigation, route}) => {
  const [messages, setMessages] = useState<Message[]>([]);

  const userId: number = route?.params?.userId;
  const name: string = route?.params?.name;
  const imageUuid: number = route?.params?.imageUuid; // TODO: Use a smaller image

  const listRef = useRef(null)

  const scrollToEnd = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollToEnd({animated: true});
    }
  }, [listRef.current]);

  const onPressSend = useCallback((text: string) => {
    const message: Message = {
      text: text,
      from: '',
      to: '',
      id: '',
      fromCurrentUser: true,
    };
    setMessages(messages => [...messages, message]);
    sendMessage(userId, message.text);
  }, []);

  useEffect(() => {
    // TODO: unbind on unmount
    onReceiveMessage(
      (msg) => setMessages(msgs => [...msgs, msg])
    );

    fetchMessages(
      userId,
      (msgs1) => setMessages(msgs2 => [...msgs2, ...msgs1])
    );
  }, []);

  return (
    <>
      <TopNavBar>
        <Pressable
          onPress={() => navigation.goBack()}
          style={{
            zIndex: 999,
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: '100%',
            aspectRatio: 1,
            justifyContent: 'center',
            alignItems: 'center',
            marginLeft: 10,
          }}
        >
          <Ionicons
            style={{
              fontSize: 20,
            }}
            name="arrow-back"
          />
        </Pressable>
        <View
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Image
            source={imageUuid && {uri: `${IMAGES_URL}/450-${imageUuid}.jpg`}}
            style={{
              width: 30,
              height: 30,
              borderRadius: 9999,
              position: 'absolute',
              left: -40,
              top: -3,
            }}
          />
          <DefaultText
            style={{
              fontWeight: '700',
              fontSize: 20,
            }}
          >
            {name ?? '...'}
          </DefaultText>
        </View>
      </TopNavBar>
      <ScrollView
        ref={listRef}
        onLayout={scrollToEnd}
        onContentSizeChange={scrollToEnd}
      >
        {messages.map((x, i) =>
          <SpeechBubble
            key={i}
            fromCurrentUser={x.fromCurrentUser}
          >
            {x.text}
          </SpeechBubble>
        )}
      </ScrollView>

      {/*
      <DefaultFlatList
        innerRef={listRef}
        emptyText={`This is the start of your conversation with ${name}.`}
        fetchPage={fetchPage}
        renderItem={(x: ListRenderItemInfo<Message>) =>
          <SpeechBubble
            fromCurrentUser={x.item.fromCurrentUser}
            state={x.item.state}
          >
            {x.item.text}
          </SpeechBubble>
        }
        disableRefresh={true}
        inverted={true}
        firstPage={10}
      />
      <DefaultFlatList
      */}
      <TextInputWithButton onPress={onPressSend}/>
    </>
  );
};

const TextInputWithButton = ({onPress}) => {
  const opacity = useRef(new Animated.Value(1)).current;

  const fadeIn = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0.5,
      duration: 0,
      useNativeDriver: false,
    }).start();
  }, []);

  const fadeOut = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 50,
      useNativeDriver: false,
    }).start();
  }, []);

  const [text, setText] = useState("");

  const sendMessage = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed) {
      onPress(trimmed)
      setText("");
    }
  }, [text]);

  const onKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.controlKey && !e.altKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  return (
    <View
      style={{
        flexDirection: 'row',
        padding: 10,
      }}
    >
      <TextInput
        style={{
          textAlignVertical: 'top',
          backgroundColor: '#eeeeee',
          borderRadius: 10,
          padding: 10,
          fontSize: 16,
          flex: 1,
          flexGrow: 1,
          marginRight: 5,
        }}
        value={text}
        onChangeText={setText}
        onKeyPress={onKeyPress}
        placeholder="Type a message"
        placeholderTextColor="#888888"
        multiline={true}
        numberOfLines={2}
      />
      <View
        style={{
          width: 50,
        }}
      >
        <View
          style={{
            width: '100%',
            aspectRatio: 1,
            position: 'absolute',
            bottom: 0,
          }}
        >
          <Pressable
            style={{
              height: '100%',
              width: '100%',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPressIn={fadeIn}
            onPressOut={fadeOut}
            onPress={sendMessage}
          >
            <Animated.View
              style={{
                height: '100%',
                width: '100%',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: 'rgb(228, 204, 255)',
                borderRadius: 999,
                opacity: opacity,
                paddingRight: 5,
                paddingBottom: 5,
              }}
            >
              <FontAwesomeIcon
                icon={faPaperPlane}
                size={20}
                color="#70f"
              />
            </Animated.View>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

export {
  ConversationScreen
};

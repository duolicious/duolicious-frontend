import {
  ActivityIndicator,
  Animated,
  Image,
  ImageBackground,
  ListRenderItemInfo,
  Pressable,
  ScrollView,
  Text,
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

// TODO: Check if it scrolls to the bottom on mobile devices after the messages first load, and after you send a message
// TODO: Re-add the ability to load old messages past the first page

const ConversationScreen = ({navigation, route}) => {
  const [messages, setMessages] = useState<Message[] | null>(null);

  const personId: number = route?.params?.personId;
  const name: string = route?.params?.name;
  const imageUuid: number = route?.params?.imageUuid;

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
    setMessages(messages => [...(messages ?? []), message]);
    sendMessage(personId, message.text);
  }, []);

  const _fetchMessages = useCallback(async () => {
    const messages = await fetchMessages(personId);
    setMessages(existingMessages => [...(existingMessages ?? []), ...messages])
  }, []);

  useEffect(() => {
    _fetchMessages();

    return onReceiveMessage((msg) => setMessages(msgs => [...msgs, msg]));
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
      {messages === null &&
        <View style={{height: '100%', justifyContent: 'center', alignItems: 'center'}}>
          <ActivityIndicator size="large" color="#70f" />
        </View>
      }
      {messages !== null && messages.length === 0 &&
        <View style={{
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
          alignSelf: 'center',
        }}>
          <ImageBackground
            source={imageUuid && {uri: `${IMAGES_URL}/450-${imageUuid}.jpg`}}
            style={{
              height: 200,
              width: 200,
              margin: 2,
              borderRadius: 999,
              borderColor: 'white',
              backgroundColor: imageUuid ? 'white' : '#f1e5ff',
              overflow: 'hidden',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {!imageUuid &&
              <Ionicons
                style={{fontSize: 40, color: 'rgba(119, 0, 255, 0.2)'}}
                name={'person'}
              />
            }
          </ImageBackground>
          <Text
            style={{
              marginTop: 20,
              marginBottom: 10,
              fontFamily: 'Trueno',
              textAlign: 'center',
              marginLeft: '25%',
              marginRight: '25%',
            }}
          >
            This is the start of your conversation with {name}
          </Text>
          <DefaultText
            style={{
              textAlign: 'center',
              marginLeft: '15%',
              marginRight: '15%',
            }}
          >
            Intros on Duolicious need to be totally unique! Try asking {name} about something interesting on their profile...
          </DefaultText>
        </View>
      }
      {messages !== null && messages.length > 0 &&
        <ScrollView
          ref={listRef}
          onLayout={scrollToEnd}
          onContentSizeChange={scrollToEnd}
          contentContainerStyle={{
            paddingTop: 10,
            maxWidth: 600,
            width: '100%',
            alignSelf: 'center',
          }}
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
      }
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
        maxWidth: 600,
        width: '100%',
        alignSelf: 'center',
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

import {
  useCallback,
  useState,
} from 'react';
import {
  Pressable,
  View,
} from 'react-native';
import { DefaultText } from './default-text';
import { longFriendlyTimestamp } from '../util/util';
import { Image } from 'expo-image';
import { IMAGES_URL } from '../env/env';

type State = 'Read' | 'Delivered';

type Props = {
  fromCurrentUser: boolean,
  timestamp: Date,
  text: string,
  imageUuid: string | null | undefined,
};

const isEmojiOnly = (str: string) => {
  const emojiRegex = /^\p{Emoji_Presentation}+$/u;
  return emojiRegex.test(str);
}

const SpeechBubble = (props: Props) => {
  const [showTimestamp, setShowTimestamp] = useState(false);

  const onPress = useCallback(() => {
    setShowTimestamp(t => !t);
  }, [setShowTimestamp]);

  const backgroundColor = (() => {
    if (isEmojiOnly(props.text)) {
      return 'transparent';
    } else if (props.fromCurrentUser) {
      return '#70f';
    } else {
      return '#eee';
    }
  })();

  return (
    <View
      style={{
        paddingTop: 5,
        paddingBottom: 5,
        paddingLeft: 10,
        paddingRight: 10,
        alignItems: props.fromCurrentUser ? 'flex-end' : 'flex-start',
        width: '100%',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          gap: 5,
          alignItems: 'flex-end',
          maxWidth: '80%',
        }}
      >
        {props.imageUuid &&
          <Image
            source={{ uri: `${IMAGES_URL}/450-${props.imageUuid}.jpg` }}
            transition={150}
            style={{
              width: 24,
              height: 24,
              borderRadius: 9999,
            }}
          />
        }
        <Pressable
          onPress={onPress}
          style={{
            borderRadius: 10,
            backgroundColor: backgroundColor,
            padding: 10,
            flexShrink: 1,
          }}
        >
          <DefaultText
            selectable={true}
            style={{
              color: props.fromCurrentUser ? 'white' : 'black',
              fontSize: isEmojiOnly(props.text) ? 50 : 15,
            }}
          >
            {props.text}
          </DefaultText>
        </Pressable>
      </View>
      {showTimestamp &&
        <DefaultText
          selectable={true}
          style={{
            fontSize: 13,
            paddingTop: 10,
            alignSelf: props.fromCurrentUser ? 'flex-end' : 'flex-start',
            color: '#666',
          }}
        >
          {longFriendlyTimestamp(props.timestamp)}
        </DefaultText>
      }
    </View>
  );
};

export {
  SpeechBubble,
};

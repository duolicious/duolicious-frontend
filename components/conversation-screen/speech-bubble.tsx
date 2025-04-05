import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { DefaultText } from '../default-text';
import { longFriendlyTimestamp } from '../../util/util';
import { Image } from 'expo-image';
import { IMAGES_URL } from '../../env/env';
import { AutoResizingGif } from '../auto-resizing-gif';
import { isMobile } from '../../util/util';
import { AudioPlayer } from '../audio-player';
import { MessageStatus } from '../../chat/application-layer';
import { useMessage } from '../../chat/application-layer/hooks/message';
import { onReceiveMessage, Message } from '../../chat/application-layer';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

// TODO: Animate audio player while it loads
// TODO: Conversation reloads after sending a message

const otherUserBackgroundColor = '#eee';

const currentUserBackgroundColor = '#70f';

type MarkdownBlock = QuoteBlock | TextBlock;

type QuoteBlock = {
  type: 'quote';
  text: string;
  attribution?: string;
};

type TextBlock = {
  type: 'text';
  text: string;
};

const parseMarkdown = (markdown: string): MarkdownBlock[] => {
  const lines = markdown.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
  let currentBlockType: 'quote' | 'text' | null = null;
  let currentBlockLines: string[] = [];

  const parseQuoteBlock = (lines: string[]): QuoteBlock => {
    const trimmedLines = lines.map(line => line.trim());
    let attribution: string | undefined;
    let endIndex = lines.length;

    for (let i = trimmedLines.length - 1; i >= 0; i--) {
      if (trimmedLines[i] === '') continue;
      if (/^-\s+/.test(trimmedLines[i])) {
        attribution = trimmedLines[i].replace(/^-\s+/, '');
        endIndex = i;
      }
      break;
    }

    return {
      type: 'quote',
      text: lines.slice(0, endIndex).join('\n').trim(),
      attribution,
    };
  };

  const flushBlock = (): void => {
    if (currentBlockLines.length === 0 || currentBlockType === null) return;

    if (currentBlockType === 'quote') {
      blocks.push(parseQuoteBlock(currentBlockLines));
    } else {
      blocks.push({
        type: 'text',
        text: currentBlockLines.join('\n').trim(),
      });
    }

    currentBlockLines = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith('>')) {
      if (currentBlockType !== 'quote') {
        flushBlock();
        currentBlockType = 'quote';
      }
      // Remove the leading ">" and an optional space.
      currentBlockLines.push(line.replace(/^>\s?/, ''));
    } else {
      if (currentBlockType !== 'text') {
        flushBlock();
        currentBlockType = 'text';
      }
      currentBlockLines.push(line);
    }
  }

  flushBlock();
  return blocks;
};

const isSafeImageUrl = (str: string): boolean => {
  const urlRegex = /^https:\/\/media\.tenor\.com\/\S+\.(gif|webp)$/i;
  return urlRegex.test(str);
};

const isEmojiOnly = (str: string): boolean => {
  const emojiRegex = /^\p{Emoji_Presentation}+$/u;
  return emojiRegex.test(str);
}

const FormattedText = ({
  text,
  color,
  fontSize,
}: {
  text: string
  color: string,
  fontSize: number,
}) => {
  const blocks = parseMarkdown(text);

  return (
    <>
      {blocks.map((block, i) =>
        <DefaultText
          key={i}
          selectable={true}
          style={{
            color,
            fontSize,
            ...(block.type === "quote" ? {
              paddingLeft: 7,
              paddingRight: 10,
              paddingVertical: 8,
              borderLeftWidth: 6,
              borderColor: 'black',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              color: 'black',
              borderRadius: 4,
            }: {})
          }}
        >
          {block.type === "quote" && block?.attribution &&
            <DefaultText
              style={{
                fontWeight: '700',
              }}
            >
              {block.attribution}{'\n'}
            </DefaultText>
          }
          {block.text}
        </DefaultText>
      )}
    </>
  );
};

const MessageStatusComponent = ({
  messageStatus,
  name,
}: {
  messageStatus: MessageStatus,
  name: string,
}) => {
  const messageTexts: Record<MessageStatus, string> = {
    'sending': '',
    'sent': '',
    'timeout': 'Message not delivered. Are you online?',
    'rate-limited-1day-unverified-basics': `You’ve used today’s daily intro limit! Message ${name} tomorrow or unlock extra daily intros by getting verified...`,
    'rate-limited-1day-unverified-photos': `You’ve used today’s daily intro limit! Message ${name} tomorrow or unlock extra daily intros by verifying your photos...`,
    'rate-limited-1day': `You’ve used today’s daily intro limit! Try messaging ${name} tomorrow...`,
    'voice-intro': `Voice messages aren’t allowed in intros`,
    'spam': `We think that might be spam. Try sending ${name} a different message...`,
    'offensive': `Intros can’t be too rude. Try sending ${name} a different message...`,
    'blocked': name + ' is unavailable right now. Try messaging someone else!',
    'not unique': `Someone already sent that intro! Try sending ${name} a different message...`,
    'too long': 'That message is too big! 😩',
  };

  const messageText = messageTexts[messageStatus];

  if (messageText === '') {
    return <></>;
  }

  return (
    <View
      style={{
        borderRadius: 10,
        backgroundColor: 'black',
        padding: 10,
        maxWidth: '80%',
      }}
    >
      <DefaultText style={{
        color: 'white',
        fontWeight: 700,
      }}>
        {messageText}
      </DefaultText>
    </View>
  );
};

const SpeechBubble = ({
  messageId,
  name,
  avatarUuid
}: {
  messageId: string
  name: string
  avatarUuid: string | null | undefined
}) => {
  const opacity = useSharedValue(0);
  const [showTimestamp, setShowTimestamp] = useState(false);
  const [speechBubbleImageError, setSpeechBubbleImageError] = useState(false);
  const message = useMessage(messageId);

  const onPress = useCallback(() => {
    setShowTimestamp(t => !t);
  }, [setShowTimestamp]);

  const doRenderUrlAsImage = (
    message &&
    message.message.type === 'chat-text' &&
    isSafeImageUrl(message.message.text) &&
    !speechBubbleImageError
  );

  const backgroundColor = (() => {
    if (!message) {
      return 'transparent';
    } else if (message.message.type !== 'chat-text') {
      return 'transparent';
    } else if (doRenderUrlAsImage) {
      return 'transparent';
    } else if (isEmojiOnly(message.message.text)) {
      return 'transparent';
    } else if (message.message.fromCurrentUser) {
      return currentUserBackgroundColor;
    } else {
      return otherUserBackgroundColor;
    }
  })();

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  useEffect(() => {
    if (message?.status === 'sent') {
      opacity.value = withTiming(1.0);
    } else {
      opacity.value = 0.5;
    }
  }, [message?.status === 'sent']);

  if (!message) {
    return <></>;
  }

  if (message.message.type === 'typing') {
    return <></>;
  }

  return (
    <View
      style={[
        {
          paddingLeft: 10,
          paddingRight: 10,
          alignItems: message.message.fromCurrentUser ? 'flex-end' : 'flex-start',
          width: '100%',
          gap: 4,
        },
      ]}
    >
      <Animated.View
        style={[
          {
            flexDirection: 'row',
            gap: 5,
            alignItems: 'flex-end',
            ...(doRenderUrlAsImage ? {
              width: '66%',
            }: {
              maxWidth: '80%',
            })
          },
          animatedContainerStyle
        ]}
      >
        {!message.message.fromCurrentUser && avatarUuid &&
          <Image
            source={{ uri: `${IMAGES_URL}/450-${avatarUuid}.jpg` }}
            transition={150}
            style={{
              width: 24,
              height: 24,
              borderRadius: 9999,
            }}
          />
        }
        {message.message.type === 'chat-text' &&
          <Pressable
            onPress={onPress}
            style={{
              borderRadius: 10,
              backgroundColor: backgroundColor,
              gap: 10,
              ...(doRenderUrlAsImage ? {
                width: '100%',
              }: {
                padding: 10,
                flexShrink: 1,
              })
            }}
          >
            {doRenderUrlAsImage &&
              <AutoResizingGif
                uri={message.message.text}
                onError={() => setSpeechBubbleImageError(true)}
                requirePress={isMobile()}
              />
            }
            {!doRenderUrlAsImage &&
              <FormattedText
                text={message.message.text}
                color={message.message.fromCurrentUser ? 'white' : 'black'}
                fontSize={isEmojiOnly(message.message.text) ? 50 : 15}
              />
            }
          </Pressable>
        }
        {message.message.type === 'chat-audio' &&
          <AudioPlayer
            sending={message.status === 'sending'}
            uuid={message.message.audioUuid}
            presentation="conversation"
          />
        }
      </Animated.View>
      {showTimestamp &&
        <DefaultText
          selectable={true}
          style={{
            fontSize: 13,
            alignSelf: message.message.fromCurrentUser ? 'flex-end' : 'flex-start',
            color: '#666',
          }}
        >
          {longFriendlyTimestamp(message.message.timestamp)}
        </DefaultText>
      }
      <MessageStatusComponent
        messageStatus={message.status}
        name={name}
      />
    </View>
  );
};

const TypingSpeechBubble = ({
  personUuid,
  avatarUuid,
}: {
  personUuid: string
  avatarUuid: string
}) => {
  const opacity = useSharedValue(0.0);
  const progress = useSharedValue(0);

  useEffect(() => {
    return onReceiveMessage(
      (message: Message) => {
        // Cancel any ongoing animation (including a pending fade-out)
        cancelAnimation(opacity);

        if (message.type === 'typing') {
          opacity.value = withSequence(
            withTiming(1),
            withDelay(5000, withTiming(0))
          );
        } else {
          opacity.value = withTiming(0);
        }
      },
      personUuid
    );
  }, [personUuid]);

  // Only run the dot animation while visible
  useAnimatedReaction(
    () => opacity.value,
    (current, previous) => {
      if (current > 0 && (previous ?? 0) === 0) {
        // Start the repeating animation when bubble becomes visible
        progress.value = withRepeat(
          withTiming(1, { duration: 2000, easing: Easing.linear }),
          -1,
          false
        );
      } else if (current === 0 && (previous ?? 0) > 0) {
        // Stop the animation when bubble is no longer visible
        cancelAnimation(progress);
        progress.value = 0;
      }
    }
  );

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const Dot = ({ phaseOffset }: { phaseOffset: number }) => {
    const animatedStyle = useAnimatedStyle(() => ({
      opacity: 0.5 + 0.5 * Math.sin(2 * Math.PI * (phaseOffset - progress.value))
    }));
    return <Animated.View style={[styles.dot, animatedStyle]} />;
  };

  return (
    <Animated.View style={[styles.speechBubbleContainer, animatedContainerStyle]}>
      <View
        style={{
          flexDirection: 'row',
          gap: 5,
          alignItems: 'flex-end',
          maxWidth: '80%',
        }}
      >
        {avatarUuid &&
          <Image
            source={{ uri: `${IMAGES_URL}/450-${avatarUuid}.jpg` }}
            transition={150}
            style={{
              width: 24,
              height: 24,
              borderRadius: 9999,
            }}
          />
        }
        <View
          style={{
            borderRadius: 10,
            backgroundColor: otherUserBackgroundColor,
            gap: 5,
            paddingVertical: 15,
            paddingHorizontal: 12,
            flexShrink: 1,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Dot phaseOffset={0} />
          <Dot phaseOffset={0.33} />
          <Dot phaseOffset={0.66} />
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  speechBubbleContainer: {
    paddingLeft: 10,
    paddingRight: 10,
    alignItems: 'flex-start',
    width: '100%',
    gap: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#555',
  },
});

export {
  SpeechBubble,
  TypingSpeechBubble,
  parseMarkdown,
};

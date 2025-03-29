import { useState, useEffect, useCallback } from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, RectButton } from 'react-native-gesture-handler';
import { LayoutChangeEvent } from 'react-native';

const useComponentWidth = () => {
  const [width, setWidth] = useState(0);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setWidth(width);
  }, []);

  return { width, onLayout };
};

const Input = ({ onPressGif, onAudioComplete, onPressSend, onChange }) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const { width, onLayout } = useComponentWidth();

  // Shared value for GIF container width.
  const gifWidth = useSharedValue(40);
  // Shared value for horizontal translation of the mic during pan.
  const recordTranslateX = useSharedValue(0);
  // Shared values for animating the input area and cancel text.
  const inputTranslateX = useSharedValue(0);
  const cancelTextTranslateX = useSharedValue(width); // initial offset (assumed width)

  // Animate the GIF container based on text input.
  useEffect(() => {
    if (text.length > 0) {
      gifWidth.value = withTiming(0, { duration: 200 });
    } else {
      gifWidth.value = withTiming(40, { duration: 200 });
    }
  }, [text, gifWidth]);

  // Animate the input area and cancel text when recording starts/ends.
  useEffect(() => {
    if (isRecording) {
      // Slide the input area out left and bring cancel text in.
      inputTranslateX.value = withTiming(-width, { duration: 200 });
      cancelTextTranslateX.value = withTiming(0, { duration: 200 });
    } else {
      // Restore the input area and slide the cancel text out.
      inputTranslateX.value = withTiming(0, { duration: 200 });
      cancelTextTranslateX.value = withTiming(width, { duration: 200 });
    }
  }, [isRecording, inputTranslateX, cancelTextTranslateX]);

  const animatedGifStyle = useAnimatedStyle(() => ({
    width: gifWidth.value,
    opacity: gifWidth.value / 40,
  }));

  const animatedInputStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: inputTranslateX.value }],
  }));

  const animatedCancelTextStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cancelTextTranslateX.value }],
  }));

  const animatedRecordingStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: recordTranslateX.value }],
  }));

  // Define functions before they're used in gestures.
  const handleFinishRecording = () => {
    onAudioComplete();
    setIsRecording(false);
  };

  const handleCancelRecording = () => {
    setIsRecording(false);
  };

  const handleSendPress = () => {
    if (text.trim().length > 0) {
      onPressSend(text.trim());
      setText('');
    }
  };

  const handleTextChange = (newText) => {
    setText(newText);
    onChange();
  };

  // Create a long press gesture to trigger recording.
  const longPressGesture = Gesture.LongPress()
    .minDuration(300)
    .onStart(() => {
      runOnJS(setIsRecording)(true);
    });

  // Create a pan gesture to let the user slide the mic leftwards.
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      recordTranslateX.value = event.translationX;
    })
    .onEnd(() => {
      if (recordTranslateX.value < -50) {
        runOnJS(handleCancelRecording)();
      } else {
        runOnJS(handleFinishRecording)();
      }
      recordTranslateX.value = 0;
    });

  // Combine the long press and pan gestures so they work on the same element.
  const combinedGesture = Gesture.Simultaneous(longPressGesture, panGesture);

  return (
    <View style={styles.container} onLayout={onLayout}>
      <View style={styles.row}>
        {/* Input wrapper: position relative so we can overlay the cancel text */}
        <View style={styles.inputWrapper}>
          <Animated.View style={[styles.inputContainer, animatedInputStyle]}>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              value={text}
              onChangeText={handleTextChange}
            />
            <RectButton onPress={onPressGif}>
              <Animated.View style={[styles.gifContainer, animatedGifStyle]}>
                <Text style={styles.gifText}>GIF</Text>
              </Animated.View>
            </RectButton>
          </Animated.View>
          {isRecording && (
            <Animated.View style={[styles.cancelContainer, animatedCancelTextStyle]}>
              <Text style={styles.recordingText}>Slide to cancel</Text>
            </Animated.View>
          )}
        </View>
        {/* Mic/Send icon container */}
        <View style={styles.iconContainer}>
          {text.trim().length === 0 ? (
            // When there's no text, show the mic with the combined gesture.
            <GestureDetector gesture={combinedGesture}>
              <Animated.View style={[styles.icon, isRecording && animatedRecordingStyle]}>
                <Text style={styles.iconText}>🎤</Text>
              </Animated.View>
            </GestureDetector>
          ) : (
            // When text exists, show the send icon.
            <RectButton onPress={handleSendPress}>
              <Text style={styles.iconText}>📤</Text>
            </RectButton>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  inputWrapper: { flex: 1, position: 'relative', overflow: 'hidden' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eee',
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  textInput: { flex: 1, paddingVertical: 10 },
  gifContainer: { justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  gifText: { fontSize: 16 },
  cancelContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  recordingText: { fontSize: 16, color: 'black' },
  iconContainer: { width: 40, height: 40, marginLeft: 5, justifyContent: 'center', alignItems: 'center' },
  icon: { justifyContent: 'center', alignItems: 'center' },
  iconText: { fontSize: 24 },
});

export { Input };

import {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { listen } from '../../events/events';

type OnThumbDrag = (x: number) => void;

type ScrollViewData = {
  onThumbDrag?: (offset: number) => void,
  contentHeight?: number,
  offset?: number,
};

const Scrollbar = () => {
  const [scrollViewIsMounted, setScrollViewIsMounted] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);

  // We store the scrollView's info (including onThumbDrag) here
  const scrollViewDataRef = useRef<ScrollViewData>({});

  // The current Animated thumb position
  const thumbPosition = useRef(new Animated.Value(0)).current;
  // The numeric value of the thumb position
  const thumbPositionValue = useRef(0);

  // Where the thumb was when the user first put their finger down
  const gestureStartY = useRef(0);

  // Optional: track if user is dragging right now
  const isDragging = useRef(false);

  // Keep track of the old contentHeight so we can preserve offset after changes
  const oldContentHeightRef = useRef(0);

  const { height: scrollHeight } = useWindowDimensions();
  const trackHeight = scrollHeight;

  // Compute thumb size and max offset each render
  const thumbHeight = Math.max(
    (scrollHeight / contentHeight) * scrollHeight,
    30
  );
  const maxThumbOffset = trackHeight - thumbHeight;

  // ---
  // Store these values in refs so the PanResponder always has up-to-date data
  // without being re-created. We’ll update them in an effect below.
  // ---
  const contentHeightRef = useRef(contentHeight);
  const scrollHeightRef = useRef(scrollHeight);
  const maxThumbOffsetRef = useRef(maxThumbOffset);

  // The function that sets the thumb position immediately
  const updateThumbPosition = (scrollY: number) => {
    const maxScroll = contentHeightRef.current - scrollHeightRef.current;
    const ratio = maxScroll <= 0 ? 0 : scrollY / maxScroll;
    const newThumbOffset = ratio * maxThumbOffsetRef.current;
    Animated.timing(thumbPosition, {
      toValue: newThumbOffset,
      duration: 0,
      useNativeDriver: false,
    }).start();
  };

  // Create the PanResponder once. All the dynamic data is read from refs.
  const panResponderRef = useRef<ReturnType<typeof PanResponder.create>>(null);
  if (!panResponderRef.current) {
    panResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        if (Platform.OS === 'web') {
          evt.preventDefault?.();
        }
        isDragging.current = true; // user started drag
        gestureStartY.current = thumbPositionValue.current;
      },

      onPanResponderMove: (evt, gestureState) => {
        if (Platform.OS === 'web') {
          evt.preventDefault?.();
        }
        const { dy } = gestureState;

        // read the current max offset from ref
        const currentMaxThumbOffset = maxThumbOffsetRef.current;

        let newOffset = gestureStartY.current + dy;
        // clamp top/bottom
        newOffset = Math.max(0, Math.min(newOffset, currentMaxThumbOffset));

        // Convert thumb offset -> content scroll offset
        const maxScroll =
          contentHeightRef.current - scrollHeightRef.current;
        const newScrollY =
          maxScroll <= 0 ? 0 : (newOffset / currentMaxThumbOffset) * maxScroll;

        // Notify parent to scroll
        scrollViewDataRef.current.onThumbDrag?.(newScrollY);

        // Update the thumb immediately
        thumbPosition.setValue(newOffset);
      },

      onPanResponderRelease: () => {
        isDragging.current = false; // user finished drag
      },
      onPanResponderTerminate: () => {
        isDragging.current = false; // user stopped
      },
    });
  }

  // Keep thumbPositionValue in sync with the Animated.Value
  useEffect(() => {
    const listenerId = thumbPosition.addListener(({ value }) => {
      thumbPositionValue.current = value;
    });
    return () => {
      thumbPosition.removeListener(listenerId);
    };
  }, [thumbPosition]);

  // Whenever contentHeight or scrollHeight changes, store them in refs.
  useEffect(() => {
    contentHeightRef.current = contentHeight;
    scrollHeightRef.current = scrollHeight;
    maxThumbOffsetRef.current = maxThumbOffset;
  }, [contentHeight, scrollHeight, maxThumbOffset]);

  // Preserve the user’s scroll offset when new content arrives (like infinite scroll).
  // We'll do that only if we're NOT currently dragging. (Your choice.)
  useEffect(() => {
    const oldContentHeight = oldContentHeightRef.current;
    oldContentHeightRef.current = contentHeight;

    // If there's no old content height or it hasn't changed, do nothing
    if (!oldContentHeight || oldContentHeight === contentHeight) {
      return;
    }
    if (isDragging.current) {
      // If user is in the middle of a drag, you might decide to skip
      // updating the offset here. Or handle it differently.
      return;
    }

    // The current thumb offset => oldScrollY in px
    const oldMaxScroll = oldContentHeight - scrollHeight;
    const newMaxScroll = contentHeight - scrollHeight;

    let oldScrollY = 0;
    if (oldMaxScroll > 0 && maxThumbOffsetRef.current > 0) {
      oldScrollY =
        (thumbPositionValue.current / maxThumbOffsetRef.current) *
        oldMaxScroll;
    }

    // Keep same absolute offset, but clamp if new content is smaller
    let newScrollY = oldScrollY;
    if (newScrollY < 0) {
      newScrollY = 0;
    }
    if (newMaxScroll < newScrollY) {
      newScrollY = newMaxScroll;
    }

    updateThumbPosition(newScrollY);
  }, [contentHeight, scrollHeight]);

  // If you only want to start at the top the very first time the scrollbar mounts,
  // do it here. That way it won’t jump back to top on subsequent changes.
  useEffect(() => {
    updateThumbPosition(0);
  }, []);

  // Listen for the scrollview to mount
  useEffect(() => {
    return listen<ScrollViewData>(
      'main-scroll-view-mount',
      (data) => {
        setScrollViewIsMounted(true);
        scrollViewDataRef.current = data;
      },
      true
    );
  }, []);

  // Listen for content-height changes
  useEffect(() => {
    return listen<ScrollViewData>(
      'main-scroll-view-change-height',
      (data) => {
        setContentHeight(data.contentHeight || 0);
      },
      true
    );
  }, []);

  // Listen for offset changes and update the thumb unless the user is dragging
  useEffect(() => {
    return listen<ScrollViewData>(
      'main-scroll-view-change-offset',
      (data) => {
        const offset = data.offset ?? 0;
        // Typically skip changing the thumb if the user is already dragging it
        if (!isDragging.current) {
          updateThumbPosition(offset);
        }
      },
      true
    );
  }, []);

  if (!scrollViewIsMounted) {
    return null;
  }

  return (
    <View
      style={[styles.scrollbar, { height: scrollHeight }]}
    >
      <Animated.View
        {...panResponderRef.current.panHandlers}
        style={[
          styles.thumb,
          {
            height: thumbHeight,
            transform: [{ translateY: thumbPosition }],
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  scrollbar: {
    width: 14,
    backgroundColor: 'white',
    borderColor: 'black',
    borderLeftWidth: 1,
    position: 'absolute',
    right: 0,
    top: 0,
    userSelect: 'none',          // prevent selection on web
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
    WebkitUserDrag: 'none',
  },
  thumb: {
    width: '100%',
    backgroundColor: '#70f',
    borderWidth: 1,
    borderColor: 'white',
    borderRadius: 99,
    touchAction: 'none',         // prevent selection on web
  },
});

export {
  Scrollbar,
  ScrollViewData,
};

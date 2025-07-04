import {
  Animated,
  BackHandler,
  Image,
  PanResponder,
  Platform,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { DefaultText } from './default-text';
import { listen, notify } from '../events/events';
import { ModalButton } from './button/modal';

const buttonHeight = 110; // Define the height for the button

type ImageCropperInput = {
  base64: string
  height: number
  width: number
  outputEventName: string
  fileNumber: number
  showProtip?: boolean
};

type ImageCropperOutput = {
  [fileNumber: number]: {
    originalBase64: string
    top: number
    left: number
    size: number
  } | null
};

type NonNullImageCropperOutput = Exclude<ImageCropperOutput[number], null>;

const ImageCropper = () => {
  const [data, setData] = useState<ImageCropperInput>();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const imageSource = useMemo(() => ({uri: data?.base64}), [data?.base64]);

  const cropAreaBase = useRef<
    {top: number, left: number, size: number} | null
  >(null);
  const cropArea = useRef({ top: 0, left: 0, size: 0 });
  const animatedCropArea = useRef({
    top: new Animated.Value(0),
    left: new Animated.Value(0),
    right: new Animated.Value(0),
    bottom: new Animated.Value(0),
    size: new Animated.Value(0),
  });

  const setCropArea = (p: {top: number, left: number, size: number}) => {
    cropArea.current = p;

    animatedCropArea.current.top.setValue(p.top);
    animatedCropArea.current.bottom.setValue(p.top + p.size);
    animatedCropArea.current.left.setValue(p.left);
    animatedCropArea.current.right.setValue(p.left + p.size);
    animatedCropArea.current.size.setValue(p.size);
  };

  const statusBarHeight = (
    Platform.OS === 'web' ? 0 : (StatusBar.currentHeight ?? 0));

  const computeRenderedImageSize = () => {
    if (!data) {
      return null;
    }

    const aspectRatio = data.width / data.height;

    // Reduce the available height by the button's height
    const availableHeight = windowHeight - buttonHeight - statusBarHeight;

    let newWidth: number;
    let newHeight: number;

    if (windowWidth / availableHeight < aspectRatio) {
      newWidth = windowWidth;
      newHeight = windowWidth / aspectRatio;
    } else {
      newWidth = availableHeight * aspectRatio;
      newHeight = availableHeight;
    }

    return { width: newWidth, height: newHeight };
  };

  const renderedImageSize = useRef(computeRenderedImageSize());
  renderedImageSize.current = computeRenderedImageSize();

  const onPanResponderMove = (event, gestureState) => {
    if (!renderedImageSize.current) {
      return;
    }

    if (cropAreaBase.current === null) {
      cropAreaBase.current = {
        top: cropArea.current.top,
        left: cropArea.current.left,
        size: cropArea.current.size,
      };
    }

    let newTop = cropAreaBase.current.top + gestureState.dy;
    let newLeft = cropAreaBase.current.left + gestureState.dx;

    // Bounds checking
    newTop = Math.max(0, newTop);
    newLeft = Math.max(0, newLeft);
    const maxTop = renderedImageSize.current.height - cropAreaBase.current.size;
    const maxLeft = renderedImageSize.current.width - cropAreaBase.current.size;
    newTop = Math.min(maxTop, newTop);
    newLeft = Math.min(maxLeft, newLeft);

    setCropArea({top: newTop, left: newLeft, size: cropAreaBase.current.size});
  };

  const onPressEnd = () => {
    cropAreaBase.current = null;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove,
      onPanResponderRelease: onPressEnd,
      onPanResponderTerminate: onPressEnd,
    })
  ).current;

  const initCropArea = useCallback(() => {
    if (!renderedImageSize.current) {
      return;
    }

    const { width: newWidth, height: newHeight } = renderedImageSize.current;

    const cropSize = Math.min(newWidth, newHeight);

    setCropArea({
      top: (newHeight - cropSize) / 2,
      left: (newWidth - cropSize) / 2,
      size: cropSize
    });
  }, [JSON.stringify(renderedImageSize.current)]);

  useEffect(() => {
    if (!data) return;

    initCropArea();
  }, [data, initCropArea]);

  useEffect(() => {
    return listen<ImageCropperInput>(
      'image-cropper-open',
      (data) => setData(data)
    );
  }, []);

  const onCancelPress = () => {
    if (!data) {
      return true;
    }

    notify<ImageCropperOutput>(
      data.outputEventName,
      {
        [data.fileNumber]: null
      }
    );

    setData(undefined);

    return true;
  };

  const onCropPress = async () => {
    if (!data) {
      return;
    }

    if (!renderedImageSize.current) {
      return;
    }

    const realCropArea = {
      top: data.height / renderedImageSize.current.height * cropArea.current.top,
      left: data.width / renderedImageSize.current.width * cropArea.current.left,
      size: Math.min(data.height, data.width),
    };

    notify<ImageCropperOutput>(
      data.outputEventName,
      {
        [data.fileNumber]: {
          originalBase64: data.base64,
          top:  Math.round(realCropArea.top),
          left: Math.round(realCropArea.left),
          size: realCropArea.size,
        }
      }
    );

    setData(undefined);
  };

  useEffect(() => {
    if (!data) {
      return;
    }

    if (Platform.OS !== 'ios') {
      return;
    }

    const pushed = StatusBar.pushStackEntry({ hidden: true });
    return () => StatusBar.popStackEntry(pushed);
  }, []);

  useEffect(() => {
    if (!data) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onCancelPress,
    );

    return () => subscription.remove();
  }, [data]);

  if (!data) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={{
        marginTop: statusBarHeight,
        width:  renderedImageSize.current?.width ?? 0,
        height: renderedImageSize.current?.height ?? 0,
        backgroundColor: 'black'
      }}>
        <Image
          resizeMode="cover"
          source={imageSource}
          style={styles.image}
        />

        {/* Opaque overlay view - top */}
        <Animated.View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: animatedCropArea.current.top,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        }} />

        {/* Opaque overlay view - bottom */}
        <Animated.View style={{
          position: 'absolute',
          top: animatedCropArea.current.bottom,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        }} />

        {/* Opaque overlay view - left */}
        <Animated.View style={{
          position: 'absolute',
          top: animatedCropArea.current.top,
          left: 0,
          width: animatedCropArea.current.left,
          height: animatedCropArea.current.size,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        }} />

        {/* Opaque overlay view - right */}
        <Animated.View style={{
          position: 'absolute',
          top: animatedCropArea.current.top,
          left: animatedCropArea.current.right, // This looks wrong but it's right
          right: 0,
          height: animatedCropArea.current.size,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        }} />

        {/* Crop window */}
        <Animated.View
          {...panResponder.panHandlers}
          style={{
            position: 'absolute',
            top: animatedCropArea.current.top,
            left: animatedCropArea.current.left,
            width: animatedCropArea.current.size,
            height: animatedCropArea.current.size,
            borderWidth: 1,
            borderColor: 'white',
            backgroundColor: 'transparent',
          }}
        />
      </View>
      <View style={styles.bottomContainer}>
        <View style={styles.buttonContainer}>
          <ModalButton color="#999" onPress={onCancelPress} title="Cancel" />
          <ModalButton color="#70f" onPress={onCropPress} title="Crop" />
        </View>
        {(data?.showProtip ?? true) &&
          <DefaultText style={styles.protip}>
            <DefaultText style={styles.boldProtip} >
              Pro tip: {}
            </DefaultText>
            Visitors to your profile can see the uncropped pic too
          </DefaultText>
        }
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...(Platform.OS === 'web' ? {
      touchAction: 'none',         // prevent selection on web
    } : {}),

    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
  },
  pressable: {
    height: 40,
    width: 100,
  },
  defaultText: {
    color: 'white',
    fontWeight: '700',
  },
  bottomContainer: {
    height: buttonHeight,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 10,
    paddingRight: 10,
  },
  buttonContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    flexDirection: 'row',
  },
  protip: {
    color: 'white',
    textAlign: 'center',
  },
  boldProtip: {
    fontWeight: '700',
  },
  image: {
    width: '100%',
    height: '100%',
  }
});

export {
  ImageCropper,
  ImageCropperInput,
  ImageCropperOutput,
  NonNullImageCropperOutput,
};

import {
  ActivityIndicator,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  View,
} from 'react-native';
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faCircleXmark } from '@fortawesome/free-solid-svg-icons/faCircleXmark'
import { notify, listen, lastEvent } from '../events/events';
import { ImageCropperInput, ImageCropperOutput } from './image-cropper';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { isImagePickerOpen } from '../App';
import { Image } from 'expo-image';
import { VerificationEvent } from '../verification/verification';
import { VerificationBadge } from './verification-badge';
import { DefaultText } from './default-text';
import { RenderedHoc } from './rendered-hoc';
import * as Haptics from 'expo-haptics';
import
  Animated,
  {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
  } from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';

// TODO: Image picker is shit and lets you upload any file type on web
// TODO: Reordering needs to happen during drag rather than at the end
// TODO: Get this working on mobile (needs runOnJS)
// TODO: Make images hold their positions between renders
// TODO: Backend logic

type Point2D = {
  x: number
  y: number
};

type ImageLayout = {
  Image: React.FC
  FileNumber: React.FC
  fileNumber: number
  point: Point2D
  empty: boolean
};

type ImageLayoutMap = {
  [k: number]: ImageLayout
}

const euclideanDistance = (p1: Point2D, p2: Point2D) => {
  return ((p1.x - p2.x) ** 2.0 + (p1.y - p2.y) ** 2.0) ** 0.5;
};

const vecSub = (p1: Point2D, p2: Point2D): Point2D => {
  return {
    x: p1.x - p2.x,
    y: p1.y - p2.y,
  }
};

const remap = <T,>(
  obj: { [k: number]: T },
  fromKey: number,
  toKey: number
): { [k: number]: T } => {
  // If there's nothing to move or no actual move, return a copy
  if (fromKey === toKey || !(fromKey in obj)) {
    return { ...obj };
  }

  // Make a shallow copy so we never mutate the original
  const newObj: { [k: number]: T } = { ...obj };

  // Grab the item we're moving, then remove it
  const movingItem = newObj[fromKey];
  delete newObj[fromKey];

  // Decide which direction we'll bubble in:
  // - If fromKey < toKey, we bubble "backwards" (toKey down to fromKey).
  // - If fromKey > toKey, we bubble "forwards"  (toKey up   to fromKey).
  const direction = fromKey < toKey ? -1 : +1;

  /**
   * Bubbles the occupant at `pos` in the given direction
   * until it finds a gap (an unoccupied position) or
   * the old `fromKey` (which we vacated).
   *
   * This "chain reaction" is what allows us to skip
   * shifting large ranges if we encounter a gap early.
   */
  function bubble(pos: number): void {
    // If there's no occupant at `pos`, we're done; it's already a gap.
    if (!(pos in newObj)) {
      return;
    }

    const occupant = newObj[pos];
    const nextPos = pos + direction;

    // If `nextPos` is out of range, we can't bubble further—do nothing.
    if (nextPos < 1 || nextPos > 7) {
      return;
    }

    // If `nextPos` is exactly `fromKey`, that position is free now.
    // So we can move the occupant there and free up `pos`.
    if (nextPos === fromKey) {
      newObj[nextPos] = occupant;
      delete newObj[pos];
      return;
    }

    // Otherwise, try to bubble whoever is at `nextPos` first.
    bubble(nextPos);

    // After attempting to bubble `nextPos`, check if it’s become free.
    if (!(nextPos in newObj)) {
      // Move occupant from `pos` → `nextPos`
      newObj[nextPos] = occupant;
      delete newObj[pos];
    }
    // If it’s still not free, it means we couldn’t bubble it (out of range,
    // or some other situation). We just leave occupant where it is.
  }

  // First, "bubble away" whatever is currently at `toKey`, if anything,
  // so that `toKey` eventually becomes free.
  bubble(toKey);

  // Now we can place our moving item directly in `toKey`.
  newObj[toKey] = movingItem;

  return newObj;
};

const isSquareish = (width: number, height: number) => {
  if (width === 0) return true;
  if (height === 0) return true;

  const biggerDim = Math.max(width, height);
  const smallerDim = Math.min(width, height);

  return biggerDim / smallerDim < 1.1;
};

const isGif = (mimeType: string) => mimeType === 'image/gif';

const cropImage = async (
  base64: string,
  height: number,
  originX: number,
  originY: number,
  width: number,
): Promise<string> => {
  if (base64.startsWith('data:image/gif;')) {
    return base64;
  }

  const result = await manipulateAsync(
    base64,
    [{ crop: { height, originX, originY, width }}],
    {
      base64: true,
      compress: 1,
      format: SaveFormat.JPEG
    }
  );

  if (!result.base64) {
    throw Error('Unexpected output from manipulateAsync');
  }

  return `data:image/jpeg;base64,${result.base64}`;
};

const MoveableImage = ({
  fileNumber,
  addImage,
  imageUri,
  resolution,
  imageBlurhash,
  round,
  removeImage,
  isLoading,
  isVerified,
  style,
}) => {
  const images = useRef(lastEvent<ImageLayout[]>('layout-image') ?? []);

  // We'll store the long-press timeout handle here
  const longPressTimeout = useRef<NodeJS.Timeout | null>(null);

  const getNearestImage = (p: Point2D): ImageLayout => {
    let nearest: ImageLayout | null = null;

    const imagesCopy = images.current.filter(Boolean);

    imagesCopy.sort((a, b) =>
      euclideanDistance(a.point, p) -
      euclideanDistance(b.point, p));

    return imagesCopy[0];
  };

  useEffect(() => {
    return listen<ImageLayout[]>(
      'layout-image',
      (x) => {
        if (!x) {
          return;
        }

        images.current = x;
      },
    );
  }, []);

  const [zIndex, setZIndex] = useState<number>(0);
  const resetZIndex = () => runOnJS(setZIndex)(0);

  const panX = useSharedValue<number>(0);
  const panY = useSharedValue<number>(0);
  const scale = useSharedValue<number>(1);
  const borderRadius = useSharedValue<number>(fileNumber === 1 ? 999 : 5);

  const hapticsSelection = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync();
    }
  };

  const pan =
    Gesture
    .Pan()
    .activateAfterLongPress(200)
    .onStart((event) => {
      scale.value = withTiming(1.1);
      runOnJS(setZIndex)(1);
      runOnJS(hapticsSelection)();
    })
    .onChange((event) => {
      panX.value = event.translationX;
      panY.value = event.translationY;
    })
    .onFinalize(() => {
      const p: Point2D = {
        x: images.current[fileNumber].point.x + panX.value,
        y: images.current[fileNumber].point.y + panY.value,
      };

      const nearestImage = getNearestImage(p);

      const imagesCopy: ImageLayout[] = [];
      for (let i = 0; i <= images.current.length; i++) {
        if (!(images.current[i]?.empty ?? true)) {
          imagesCopy[i] = images.current[i];
        }
      }

      const remappedImages: {
        [k: number]: ImageLayout
      } = remap(
        imagesCopy,
        fileNumber,
        nearestImage.fileNumber
      );

      notify<ImageLayoutMap>('remapped-images', remappedImages);
    })

  useEffect(() => {
    const onRemap = (remappedImages: ImageLayoutMap | undefined) => {
      if (!remappedImages) {
        return;
      }

      Object
        .keys(remappedImages)
        .map(Number)
        .forEach((toFileNumber) => {
          const fromFileNumber = remappedImages[toFileNumber].fileNumber;

          const fromPoint = images.current[fromFileNumber].point;
          const toPoint = images.current[toFileNumber].point;

          const updatedPoint = vecSub(toPoint, fromPoint);

          if (fromFileNumber === fileNumber) {
            panX.value = withTiming(updatedPoint.x);
            panY.value = withTiming(updatedPoint.y)
            scale.value = withTiming(1, undefined, resetZIndex);
            borderRadius.value = withTiming(toFileNumber === 1 ? 999 : 5);
          }
        });
    };

    listen<ImageLayoutMap>('remapped-images', onRemap);
  }, [fileNumber]);

  const tap =
    Gesture
    .Tap()
    .requireExternalGestureToFail(pan)
    .onStart(() => {
      runOnJS(addImage)();
    })

  const composed = Gesture.Exclusive(pan, tap);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: panX.value },
      { translateY: panY.value },
      { scale: scale.value },
    ],
  }));

  const animatedImageContainerStyle = useAnimatedStyle(() => ({
    borderRadius: borderRadius.value,
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[
          {
            zIndex: zIndex,
            ...style,
          },
          animatedContainerStyle,
        ]}
      >
        <Animated.View
          style={[
            {
              height: '100%',
              width: '100%',
              overflow: 'hidden',
            },
            animatedImageContainerStyle,
          ]}
        >
          <Image
            pointerEvents="none"
            source={{
              uri: imageUri,
              height: resolution,
              width: resolution,
            }}
            placeholder={imageBlurhash && { blurhash: imageBlurhash }}
            transition={150}
            style={{
              height: '100%',
              width: '100%',
              borderColor: '#eee',
            }}
            contentFit="contain"
          />
        </Animated.View>
        <Pressable
          style={{
            position: 'absolute',
            top: -10,
            left: -10,
            padding: 2,
            borderRadius: 999,
            backgroundColor: 'white',
          }}
          onPress={
            imageUri === null || isLoading ? undefined : removeImage
          }
        >
          <FontAwesomeIcon
            icon={faCircleXmark}
            size={26}
            color="#000"
          />
        </Pressable>
        {isVerified && (
          <VerificationBadge
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
            }}
            size={20}
          />
        )}
      </Animated.View>
    </GestureDetector>
  );
};

const UserImage = ({
  input,
  fileNumber,
  setIsLoading,
  setIsInvalid,
  resolution,
  setHasImage = (x: boolean) => {},
  showProtip = true,
  round = false,
}) => {
  const viewRef = useRef<View>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBlurhash, setImageBlurhash] = useState<string | null>(null);
  const [isLoading_, setIsLoading_] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [parentViewLayout, setParentViewLayout] = useState<number[]>();

  const imageCropperCallback = `image-cropped-${fileNumber}`;

  const fetchImage = useCallback(async () => {
    const getUri = input.photos.getUri;
    const getExtraExts = input.photos.getExtraExts;;
    const getBlurhash = input.photos.getBlurhash;

    if (getUri) {
      setIsLoading(true);
      setIsLoading_(true);

      setImageUri(getUri(String(fileNumber), resolution));
      setImageBlurhash(getBlurhash(String(fileNumber)));

      setIsLoading(false);
      setIsLoading_(false);
      setHasImage(true);
    }
  }, [input]);

  const addImage = useCallback(async () => {
    if (isLoading_) {
      return;
    }
    if (isImagePickerOpen.value) {
      return;
    }

    if (Platform.OS !== 'web') {
      setIsLoading(true);
      setIsLoading_(true);
      isImagePickerOpen.value = true;
    }

    // No permissions request is necessary for launching the image library
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      selectionLimit: 1,
      base64: true,
    });

    if (result.canceled && Platform.OS !== 'web') {
      isImagePickerOpen.value = false;
      setIsLoading(false);
      setIsLoading_(false);
    }
    if (result.canceled) {
      return;
    }

    const width = result.assets[0].width;
    const height = result.assets[0].height;
    const mimeType = result.assets[0].mimeType;
    const base64 = result.assets[0].base64;
    if (!width) return;
    if (!height) return;
    if (!mimeType) return;
    if (!base64) {
      console.warn('Unexpected output from launchImageLibraryAsync');
      return;
    }

    const base64Uri = `data:${mimeType};base64,${base64}`;

    setIsLoading(true);
    setIsLoading_(true);
    setIsInvalid(false);

    if (isGif(mimeType) || isSquareish(width, height)) {
      const size = Math.min(width, height);

      notify<ImageCropperOutput>(
        imageCropperCallback,
        {
          originalBase64: base64Uri,
          top:  Math.round((height - size) / 2),
          left: Math.round((width  - size) / 2),
          size,
        },
      );
    } else {
      notify<ImageCropperInput>(
        'image-cropper-open',
        {
          base64: base64Uri,
          height,
          width,
          callback: imageCropperCallback,
          showProtip: showProtip,
        }
      );
    }
  }, [isLoading_]);

  const removeImage = useCallback(async () => {
    setIsLoading(true);
    setIsLoading_(true);
    setIsInvalid(false);

    if (await input.photos.delete(fileNumber)) {
      setImageUri(null);
      setIsLoading(false);
      setIsLoading_(false);
      setIsInvalid(false);
      setHasImage(false);

      notify<VerificationEvent>(
        'updated-verification',
        { photos: { [`${fileNumber}`]: false } }
      );
    } else {
      setIsLoading(false);
      setIsLoading_(false);
      setIsInvalid(true);
    }
  }, []);

  useEffect(() => void fetchImage(), [fetchImage]);
  useEffect(() => {
    return listen<ImageCropperOutput>(
      imageCropperCallback,
      async (data) => {
        isImagePickerOpen.value = false;

        if (data === undefined) {
          return;
        }

        if (data === null) {
          setIsLoading(false);
          setIsLoading_(false);
          setIsInvalid(false);
        } else if (await input.photos.submit(fileNumber, data)) {
          const base64 = await cropImage(
            data.originalBase64,
            data.size,
            data.left,
            data.top,
            data.size,
          );

          setImageUri(base64);
          setIsLoading(false);
          setIsLoading_(false);
          setIsInvalid(false);
          setHasImage(true);

          notify<VerificationEvent>(
            'updated-verification',
            { photos: { [`${fileNumber}`]: false } }
          );
        } else {
          setIsLoading(false);
          setIsLoading_(false);
          setIsInvalid(true);
        }
      }
    );
  }, []);

  useEffect(() => {
    return listen<VerificationEvent>(
      'updated-verification',
      (data) => {
        if (!data) {
          return;
        }

        if (!data.photos) {
          return;
        }

        const photoData: boolean | undefined = data.photos[fileNumber];

        if (photoData === undefined) {
          return;
        }

        setIsVerified(photoData);
      },
      true
    );
  }, []);

  useEffect(() => {
    return listen<number[]>(
      'layout-image-parent-view',
      setParentViewLayout,
      true,
    );
  }, []);

  useLayoutEffect(() => {
    viewRef.current?.measure((x, y, width, height, pageX, pageY) => {
      const [, , , , parentPageX = 0, parentPageY = 0] = parentViewLayout ?? [];

      const MoveableImage_ = () => {
        if (!isLoading_ && imageUri !== null) {
          return <MoveableImage
            fileNumber={fileNumber}
            addImage={addImage}
            imageUri={imageUri}
            resolution={resolution}
            imageBlurhash={imageBlurhash}
            round={round}
            removeImage={removeImage}
            isLoading={isLoading_}
            isVerified={isVerified}
            style={{
              position: 'absolute',
              height: height,
              width: width,
              left: pageX - parentPageX,
              top: pageY - parentPageY,
            }}
          />
        } else {
          return null;
        }
      };

      const FileNumber_ = () => {
        if (fileNumber < 1) {
          return null;
        }

        return (
          <View
            style={{
              position: 'absolute',
              left: pageX + 2 - parentPageX,
              top: pageY + height - 2 - parentPageY,
              overflow: 'visible',
            }}
          >
            <DefaultText
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                backgroundColor: 'white',
                borderWidth: 1,
                borderColor: 'black',
                paddingHorizontal: 8,
                paddingVertical: 1,
                borderRadius: 999,
                fontSize: 12,
              }}
            >
              {fileNumber === 1 ? 'Main' : fileNumber}
            </DefaultText>
          </View>
        );
      };

      const point: Point2D = {
        x: pageX - parentPageX + width / 2,
        y: pageY - parentPageY + height / 2,
      };


      console.log('oldImages', lastEvent<ImageLayout[]>('layout-image') ?? []);
      const newImages = [ ...(lastEvent<ImageLayout[]>('layout-image') ?? []) ];

      newImages[fileNumber] = {
        Image: MoveableImage_,
        FileNumber: FileNumber_,
        fileNumber: fileNumber,
        point: point,
        empty: imageUri === null,
      };

      notify<ImageLayout[]>('layout-image', newImages);
    });
  }, [
    parentViewLayout,
    isLoading_,
    imageUri,
    addImage,
    resolution,
    imageBlurhash,
    round,
    removeImage,
    isVerified,
  ]);

  return (
    <Pressable
      ref={viewRef}
      onPress={addImage}
      disabled={imageUri !== null}
      style={{
        borderRadius: round ? 999 : 5,
        backgroundColor: '#eee',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
        flex: 1,
        aspectRatio: 1,
      }}
    >
      { isLoading_ && <Loading/>}
      {!isLoading_ && imageUri === null && <AddIcon/>}
    </Pressable>
  );
};

const UserImageMemo = memo(UserImage);

const PrimaryImage = ({
  input,
  fileNumber,
  setIsLoading,
  setIsInvalid,
  setHasImage = (x: boolean) => {},
  showProtip = true
}) => {
  return <UserImageMemo
    {...{
      input,
      fileNumber,
      setIsLoading,
      setIsInvalid,
      showProtip,
      setHasImage,
      resolution: 900
    }}
  />
};

const FirstRow = ({
  input,
  firstFileNumber,
  setIsLoading,
  setIsInvalid,
  setHasImage = (x: boolean) => {},
}) => {
  const [name, setName] = useState(lastEvent<string>('updated-name'));

  const isLoading1 = useRef(false);

  const setIsLoading_ = useCallback(() => setIsLoading(
    isLoading1.current
  ), []);

  const setIsLoading1 = useCallback(
    x => { isLoading1.current = x; setIsLoading_() }, []);

  useEffect(() => {
    return listen<string>('updated-name', setName);
  }, []);

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 20,
        width: '100%',
        paddingBottom: 20,
      }}
    >
      <UserImageMemo
        input={input}
        fileNumber={firstFileNumber + 0}
        setIsLoading={setIsLoading1}
        setIsInvalid={setIsInvalid}
        setHasImage={setHasImage}
        resolution={450}
        round={true}
      />
      <View
        style={{
          flex: 2,
          justifyContent: 'center',
        }}
      >
        <DefaultText
          style={{
            fontSize: 28,
            fontWeight: '700',
            borderRadius: 10,
          }}
        >
          {name}
        </DefaultText>
      </View>
    </View>
  );
};

const Row = ({
  input,
  firstFileNumber,
  setIsLoading,
  setIsInvalid,
  setHasImage = (x: boolean) => {},
}) => {
  const isLoading1 = useRef(false);
  const isLoading2 = useRef(false);
  const isLoading3 = useRef(false);

  const setIsLoading_ = useCallback(() => setIsLoading(
    isLoading1.current ||
    isLoading2.current ||
    isLoading3.current
  ), []);

  const setIsLoading1 = useCallback(
    x => { isLoading1.current = x; setIsLoading_() }, []);
  const setIsLoading2 = useCallback(
    x => { isLoading2.current = x; setIsLoading_() }, []);
  const setIsLoading3 = useCallback(
    x => { isLoading3.current = x; setIsLoading_() }, []);

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 10,
        width: '100%',
      }}
    >
      <UserImageMemo
        input={input}
        fileNumber={firstFileNumber + 0}
        setIsLoading={setIsLoading1}
        setIsInvalid={setIsInvalid}
        setHasImage={setHasImage}
        resolution={450}
      />
      <UserImageMemo
        input={input}
        fileNumber={firstFileNumber + 1}
        setIsLoading={setIsLoading2}
        setIsInvalid={setIsInvalid}
        setHasImage={setHasImage}
        resolution={450}
      />
      <UserImageMemo
        input={input}
        fileNumber={firstFileNumber + 2}
        setIsLoading={setIsLoading3}
        setIsInvalid={setIsInvalid}
        setHasImage={setHasImage}
        resolution={450}
      />
    </View>
  );
};

const Images = ({
  input,
  setIsLoading,
  setIsInvalid,
  setHasImage = (x: boolean) => {},
}) => {
  const [layoutChanged, setLayoutChanged] = useState(0);
  const viewRef = useRef<View>(null);
  const [images, setImages] = useState(
    lastEvent<ImageLayout[]>('layout-image') ?? []);

  const isLoading1 = useRef(false);
  const isLoading2 = useRef(false);
  const isLoading3 = useRef(false);

  const setIsLoading_ = useCallback(() => setIsLoading(
    isLoading1.current ||
    isLoading2.current ||
    isLoading3.current
  ), []);

  const setIsLoading1 = useCallback(
    x => { isLoading1.current = x; setIsLoading_() }, []);
  const setIsLoading2 = useCallback(
    x => { isLoading2.current = x; setIsLoading_() }, []);
  const setIsLoading3 = useCallback(
    x => { isLoading3.current = x; setIsLoading_() }, []);

  useEffect(() => {
    return listen<ImageLayout[]>(
      'layout-image',
      (x) => {
        if (!x) {
          return;
        }

        setImages(x);
      }
    );
  }, []);

  useLayoutEffect(() => {
    viewRef.current?.measure(
      (...args) => notify('layout-image-parent-view', args)
    );
  }, [layoutChanged]);

  return (
    <View
      ref={viewRef}
      style={{
        padding: 10,
        gap: 10,
      }}
      onLayout={() => setLayoutChanged((l) => l + 1)}
    >
      <FirstRow
        input={input}
        firstFileNumber={1}
        setIsLoading={setIsLoading1}
        setIsInvalid={setIsInvalid}
        setHasImage={setHasImage}
      />
      <Row
        input={input}
        firstFileNumber={2}
        setIsLoading={setIsLoading2}
        setIsInvalid={setIsInvalid}
        setHasImage={setHasImage}
      />
      <Row
        input={input}
        firstFileNumber={5}
        setIsLoading={setIsLoading3}
        setIsInvalid={setIsInvalid}
        setHasImage={setHasImage}
      />

      {images.filter(Boolean).map((image) =>
        <RenderedHoc key={image.fileNumber} Hoc={image.Image} />
      )}

      {images.filter(Boolean).map((image) =>
        <RenderedHoc key={image.fileNumber} Hoc={image.FileNumber} />
      )}
    </View>
  );
};

const AddIcon = () => {
  return (
    <Ionicons
      style={{
        color: 'black',
        fontSize: 36,
      }}
      name="add"/>
  );
};

const Loading = () => {
  return (
    <ActivityIndicator size="large" color="#70f"/>
  );
}

export {
  Images,
  PrimaryImage,
};

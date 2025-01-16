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
import {
  OptionGroupPhotos,
} from '../data/option-groups';

// TODO: Image picker is shit and lets you upload any file type on web
// TODO: Reordering needs to happen during drag rather than at the end
// TODO: Get this working on mobile (needs runOnJS)
// TODO: Make images hold their positions between renders
// TODO: Backend logic
// TODO: Ensure verification badges on images update properly
// TODO: Image placeholders don't regain plus symbols when their image is dragged away
// TODO: Images don't shift when scaled on web

type Point2D = {
  x: number
  y: number
};

type ImageLayout = {
  image: {
    fileNumber: number
    addImage: () => void
    uri: string | null | undefined
    resolution: number | null | undefined
    blurhash: string | null | undefined
    removeImage: () => void
    isLoading: boolean
    isVerified: boolean
  }

  center: Point2D
  origin: Point2D

  height: number
  width: number
};

type RemappedImages = {
  imageLayoutMap: { [k: number]: ImageLayout }
  fileNumberMap: { [ k: number ]: number }
  pressedFileNumber: number | null
}

const imageLayoutCopy = (imageLayout: ImageLayout): ImageLayout => {
  return {
    ...imageLayout,
    image: {
      ...imageLayout.image,
    },
    center: {
      ...imageLayout.center,
    },
    origin: {
      ...imageLayout.origin,
    },
  };
};

const euclideanDistance = (p1: Point2D, p2: Point2D) => {
  return ((p1.x - p2.x) ** 2.0 + (p1.y - p2.y) ** 2.0) ** 0.5;
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

const FileNumber = ({fileNumber, left, top}) => {
  if (fileNumber < 1) {
    return null;
  }

  return (
    <View
      style={{
        position: 'absolute',
        left: left,
        top: top,
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

const MoveableImage = ({
  initialFileNumber,
  addImage,
  uri,
  resolution,
  blurhash,
  removeImage,
  isLoading,
  isVerified,
  height,
  width,
  left,
  top,
}) => {
  const fileNumber = useRef<number>(initialFileNumber);
  const imageLayouts = useRef(lastEvent<ImageLayout[]>('layout-image') ?? []);

  const getNearestImage = (p: Point2D): ImageLayout => {
    const imagesCopy = imageLayouts.current.filter(Boolean);

    imagesCopy.sort((a, b) =>
      euclideanDistance(a.center, p) -
      euclideanDistance(b.center, p));

    return imagesCopy[0];
  };

  useEffect(() => {
    return listen<ImageLayout[]>(
      'layout-image',
      (x) => {
        if (!x) {
          return;
        }

        imageLayouts.current = [ ...x ];
      },
    );
  }, []);

  const getBorderRadius = (fileNumber: number) =>
    fileNumber === 1 ? Math.max(height, width) / 2 : 5;


  const [zIndex, setZIndex] = useState<number>(0);
  const resetZIndex = () => runOnJS(setZIndex)(0);

  const panX = useSharedValue<number>(left);
  const panY = useSharedValue<number>(top);
  const scale = useSharedValue<number>(1);
  const borderRadius = useSharedValue<number>(
    getBorderRadius(fileNumber.current));

  const hapticsSelection = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync();
    }
  };

  const remapImages = (pressedFileNumber: number | null) => {
    const p: Point2D = {
      x:
        imageLayouts.current[fileNumber.current].center.x -
        imageLayouts.current[fileNumber.current].origin.x +
        panX.value,
      y:
        imageLayouts.current[fileNumber.current].center.y -
        imageLayouts.current[fileNumber.current].origin.y +
        panY.value,
    };

    const nearestImage = getNearestImage(p);

    // Partition list into empty and non-empty slots
    const imagesCopy: ImageLayout[] = [];
    const emptyImagesCopy: ImageLayout[] = [];
    for (let i = 0; i <= imageLayouts.current.length; i++) {
      if (!imageLayouts.current[i]) {
        ;
      } else if (imageLayouts.current[i].image.uri) {
        imagesCopy[i] = imageLayouts.current[i];
      } else {
        emptyImagesCopy[i] = imageLayouts.current[i];
      }
    }

    const remappedImages: {
      [k: number]: ImageLayout
    } = remap(
      imagesCopy,
      fileNumber.current,
      nearestImage.image.fileNumber
    );

    // Add empty positions back in if necessary
    const destinations = Object.keys(remappedImages).map(Number);
    const sources = Object.values(remappedImages).map((i) => i.image.fileNumber);

    const previouslyEmpty = destinations.find((d) => !sources.includes(d));
    const newlyEmpty = sources.find((s) => !destinations.includes(s));

    if (previouslyEmpty && newlyEmpty) {
      remappedImages[newlyEmpty] = emptyImagesCopy[previouslyEmpty];
    }

    const fileNumberMap: { [k: number]: number } = { };
    Object.keys(remappedImages).forEach((toFileNumber) => {
      const fromFileNumber = remappedImages[toFileNumber].image.fileNumber;
      if (toFileNumber) {
        fileNumberMap[fromFileNumber] = Number(toFileNumber);
      }
    });

    notify<RemappedImages>(
      'remapped-images',
      {
        imageLayoutMap: remappedImages,
        fileNumberMap: fileNumberMap,
        pressedFileNumber: pressedFileNumber,
      }
    );
  };

  const remapImagesOnChange =
    () => remapImages(fileNumber.current);

  const remapImagesonFinalize =
    () => remapImages(null);

  const pan =
    Gesture
    .Pan()
    .activateAfterLongPress(200)
    .onStart((event) => {
      scale.value = withTiming(1.1, { duration: 50 });
      runOnJS(setZIndex)(1);
      runOnJS(hapticsSelection)();
    })
    .onChange((event) => {
      panX.value += event.changeX;
      panY.value += event.changeY;

      runOnJS(remapImagesOnChange)();
    })
    .onFinalize(() => {
      runOnJS(remapImagesonFinalize)();
    })

  useEffect(() => {
    const onRemap = (remappedImages: RemappedImages | undefined) => {
      if (!remappedImages) {
        return;
      }

      const fromFileNumber = fileNumber.current;
      const toFileNumber = remappedImages.fileNumberMap[fromFileNumber];

      if (!fromFileNumber || !toFileNumber) {
        return;
      }

      const fromPoint = imageLayouts.current[fromFileNumber].origin;
      const toPoint = imageLayouts.current[toFileNumber].origin;

      if (remappedImages.pressedFileNumber !== fromFileNumber) {
        panX.value = withTiming(toPoint.x);
        panY.value = withTiming(toPoint.y);
        scale.value = withTiming(
          1,
          undefined,
          resetZIndex,
        );
      }
      borderRadius.value = withTiming(getBorderRadius(toFileNumber));

      if (remappedImages.pressedFileNumber === null) {
        // Deep-copy `imageLayouts` to `newImageLayouts`
        const newImageLayouts: ImageLayout[] = [];

        imageLayouts.current.forEach((imageLayout, i) => {
          if (imageLayout) {
            newImageLayouts[i] = imageLayoutCopy(imageLayout);
          }
        });

        // Remap
        Object
          .entries(remappedImages.fileNumberMap)
          .forEach(([fromFileNumber, toFileNumber]) => {
            newImageLayouts[toFileNumber].image = {
              ...imageLayouts.current[fromFileNumber]?.image,
              fileNumber: toFileNumber,
            };
          });

        newImageLayouts.forEach((newImageLayout, i) => {
          imageLayouts.current[i] = newImageLayout;
        });

        fileNumber.current = remappedImages.fileNumberMap[fileNumber.current];
      }
    };

    return listen<RemappedImages>('remapped-images', onRemap);
  }, []);

  const tap =
    Gesture
    .Tap()
    .requireExternalGestureToFail(pan)
    .onStart(() => {
      runOnJS(addImage)();
    })

  const composed = Gesture.Exclusive(pan, tap);

  const removeGesture =
    Gesture
    .Tap()
    .onStart(() => {
      if (uri === null || isLoading) {
        return;
      }

      removeImage();
    });

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

  if (isLoading || uri === null) {
    return null;
  }

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[
          {
            cursor: 'pointer',
            zIndex: zIndex,
            position: 'absolute',
            height: height,
            width: width,
            left: 0,
            top: 0,
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
              uri: uri,
              height: resolution,
              width: resolution,
            }}
            placeholder={blurhash && { blurhash: blurhash }}
            transition={150}
            style={{
              height: '100%',
              width: '100%',
              borderColor: '#eee',
            }}
            contentFit="contain"
          />
        </Animated.View>
        <GestureDetector gesture={removeGesture}>
          <View
            style={{
              position: 'absolute',
              top: -10,
              left: -10,
              padding: 2,
              borderRadius: 999,
              backgroundColor: 'white',
            }}
          >
            <FontAwesomeIcon
              icon={faCircleXmark}
              size={26}
              color="#000"
            />
          </View>
        </GestureDetector>
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
  resolution,
  showProtip = true,
  round = false,
}: {
  input: OptionGroupPhotos
  fileNumber: number
  resolution: number
  showProtip?: boolean
  round?: boolean
}) => {
  const viewRef = useRef<View>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [blurhash, setBlurhash] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [parentViewLayout, setParentViewLayout] = useState<number[]>();

  const imageCropperCallback = `image-cropped-${fileNumber}`;

  const fetchImage = useCallback(async () => {
    const getUri = input.photos.getUri;
    const getBlurhash = input.photos.getBlurhash;

    if (getUri && getBlurhash) {
      setIsLoading(true);

      setUri(getUri(String(fileNumber), String(resolution)));
      setBlurhash(getBlurhash(String(fileNumber)));

      setIsLoading(false);
    }
  }, [input]);

  const addImage = useCallback(async () => {
    if (isLoading) {
      return;
    }
    if (isImagePickerOpen.value) {
      return;
    }

    if (Platform.OS !== 'web') {
      setIsLoading(true);
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
  }, [isLoading]);

  const removeImage = useCallback(async () => {
    setIsLoading(true);

    if (await input.photos.delete(String(fileNumber))) {
      setUri(null);
      setIsLoading(false);

      notify<VerificationEvent>(
        'updated-verification',
        { photos: { [`${fileNumber}`]: false } }
      );
    } else {
      setIsLoading(false);
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
        } else if (await input.photos.submit(fileNumber, data)) {
          const base64 = await cropImage(
            data.originalBase64,
            data.size,
            data.left,
            data.top,
            data.size,
          );

          setUri(base64);
          setIsLoading(false);

          notify<VerificationEvent>(
            'updated-verification',
            { photos: { [`${fileNumber}`]: false } }
          );
        } else {
          setIsLoading(false);
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

      const center: Point2D = {
        x: pageX - parentPageX + width / 2,
        y: pageY - parentPageY + height / 2,
      };

      const origin: Point2D = {
        x: pageX - parentPageX,
        y: pageY - parentPageY,
      };

      const newImages = [ ...(lastEvent<ImageLayout[]>('layout-image') ?? []) ];

      newImages[fileNumber] = {
        image: {
          fileNumber: fileNumber,
          addImage: addImage,
          uri: uri,
          resolution: resolution,
          blurhash: blurhash,
          removeImage: removeImage,
          isLoading: isLoading,
          isVerified: isVerified,
        },

        center: center,
        origin: origin,

        height,
        width,
      };

      notify<ImageLayout[]>('layout-image', newImages);
    });
  }, [
    parentViewLayout,
    isLoading,
    uri,
    addImage,
    resolution,
    blurhash,
    removeImage,
    isVerified,
  ]);

  return (
    <Pressable
      ref={viewRef}
      onPress={addImage}
      disabled={uri !== null}
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
      { isLoading && <Loading/>}
      {!isLoading && <AddIcon/>}
    </Pressable>
  );
};

const UserImageMemo = memo(UserImage);

const PrimaryImage = ({
  input,
  fileNumber,
  showProtip = true
}: {
  input: OptionGroupPhotos
  fileNumber: number
  showProtip?: boolean
}) => {
  return <UserImageMemo
    {...{
      input,
      fileNumber,
      showProtip,
      resolution: 900
    }}
  />
};

const FirstRow = ({
  input,
  firstFileNumber,
}: {
  input: OptionGroupPhotos
  firstFileNumber: number
}) => {
  const [name, setName] = useState(lastEvent<string>('updated-name'));

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
}: {
  input: OptionGroupPhotos
  firstFileNumber: number
}) => {
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
        resolution={450}
      />
      <UserImageMemo
        input={input}
        fileNumber={firstFileNumber + 1}
        resolution={450}
      />
      <UserImageMemo
        input={input}
        fileNumber={firstFileNumber + 2}
        resolution={450}
      />
    </View>
  );
};

const Images = ({
  input
}: {
  input: OptionGroupPhotos
}) => {
  const [layoutChanged, setLayoutChanged] = useState(0);
  const viewRef = useRef<View>(null);
  const [imageLayouts, setImageLayouts] = useState(
    lastEvent<ImageLayout[]>('layout-image') ?? []);

  useEffect(() => {
    return listen<ImageLayout[]>(
      'layout-image',
      (x) => {
        if (!x) {
          return;
        }

        setImageLayouts(x);
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
      <FirstRow input={input} firstFileNumber={1} />
      <Row      input={input} firstFileNumber={2} />
      <Row      input={input} firstFileNumber={5} />

      {imageLayouts
        .filter(Boolean)
        .filter((imageLayout) => Boolean(imageLayout.image.uri))
        .map((imageLayout) =>
          <MoveableImage
            key={imageLayout.image.uri}
            initialFileNumber={imageLayout.image.fileNumber}
            addImage={imageLayout.image.addImage}
            uri={imageLayout.image.uri}
            resolution={imageLayout.image.resolution}
            blurhash={imageLayout.image.blurhash}
            removeImage={imageLayout.image.removeImage}
            isLoading={imageLayout.image.isLoading}
            isVerified={imageLayout.image.isVerified}
            height={imageLayout.height}
            width={imageLayout.width}
            left={imageLayout.origin.x}
            top={imageLayout.origin.y}
          />
        )
      }

      {imageLayouts.filter(Boolean).map((imageLayout) =>
        <FileNumber
          key={imageLayout.image.fileNumber}
          fileNumber={imageLayout.image.fileNumber}
          left={imageLayout.origin.x + 2}
          top={imageLayout.origin.y + imageLayout.height - 2}
        />
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

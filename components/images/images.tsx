import {
  ActivityIndicator,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  View,
} from 'react-native';
import {
  Dispatch,
  SetStateAction,
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
import { notify, listen, lastEvent } from '../../events/events';
import { ImageCropperInput, ImageCropperOutput } from '../image-cropper';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { isImagePickerOpen } from '../../App';
import { Image as ExpoImage } from 'expo-image';
import { VerificationEvent } from '../../verification/verification';
import { VerificationBadge } from '../verification-badge';
import { DefaultText } from '../default-text';
import * as Haptics from 'expo-haptics';
import
  Animated,
  {
    Easing,
    runOnJS,
    SharedValue,
    useSharedValue,
    withTiming,
  } from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import {
  OptionGroupPhotos,
} from '../../data/option-groups';
import debounce from 'lodash/debounce';
import { remap } from './logic';

// TODO: Image picker is shit and lets you upload any file type on web
// TODO: Reordering needs to happen during drag rather than at the end
// TODO: Get this working on mobile (needs runOnJS)
// TODO: Make images hold their positions between renders
// TODO: Backend logic
// TODO: Ensure verification badges on images update properly
// TODO: Images don't resize correctly when their parent window is resized, if those images were moved first
// TODO: Loading thing doesn't show
// TODO: Moving an image then uploading to it in its new position moves it back to its original position
// TODO: Queue movements and uploads

const EV_IMAGES = 'images';
const EV_IMAGE_LOADING = 'image-loading';
const EV_IMAGE_URI = 'image-uri';
const EV_SLOTS = 'slots';
const EV_SLOT_ASSIGNMENT_FINISH = 'slot-assignment-finish';
const EV_SLOT_ASSIGNMENT_START = 'slot-assignment-start';
const EV_SLOT_REQUEST = 'slot-request';
const EV_UPDATED_NAME = 'updated-name';
const EV_UPDATED_VERIFICATION = 'updated-verification';

type Point2D = {
  x: number
  y: number
};

type ImageLayout = {
  image: {
    fileNumber: number
    input: OptionGroupPhotos,
    uri: string | null | undefined
    resolution: number | null | undefined
    blurhash: string | null | undefined
    isVerified: boolean
  }

  center: Point2D
  origin: Point2D

  height: number
  width: number
};

type Image = {
  exists: boolean
};

type Images = {
  [k: number]: Image
};

type Slot = {
  center: Point2D
  origin: Point2D

  height: number
  width: number
};

type Slots = {
  [k: number]: Slot
};

type SlotRequest = {
  from: number
  to: number
  pressed: number | null
};

type SlotAssignmentStart = {
  from: number
  to: number
  pressed: number | null
};

type ImageLoading = {
  [k: number]: boolean
};

type ImageUri = {
  [k: number]: string | null
};

const getOccupancyMap = (images: Images): { [k: number]: boolean } => {
  return Object
    .entries(images)
    .reduce(
      (acc, [fileNumber, slot]) => {
        acc[Number(fileNumber)] = slot.exists;
        return acc;
      },
      {} as { [k: number]: boolean }
    );
};

const getNearestSlot = (slots: Slots, p: Point2D): number => {
  let nearestSlot = -1;
  let nearestDistance = -1;

  Object.entries(slots).map(([fileNumber, slot]) => {
    const distance = euclideanDistance(slot.center, p);

    if (nearestDistance === -1 || distance < nearestDistance) {
      nearestSlot = Number(fileNumber);
      nearestDistance = distance;
    }
  });

  return nearestSlot;
};

const getRelativeSlot = (slot: Slot, pageX: number, pageY: number): Slot => {
  return {
    center: {
      x: slot.center.x - pageX,
      y: slot.center.y - pageY,
    },
    origin: {
      x: slot.origin.x - pageX,
      y: slot.origin.y - pageY,
    },
    height: slot.height,
    width: slot.width,
  };
};

const getRelativeSlots = (slots: Slots, pageX: number, pageY: number): Slots => {
  return Object
    .entries(slots)
    .reduce(
      (acc, [fileNumber, slot]) => {
        acc[Number(fileNumber)] = getRelativeSlot(slot, pageX, pageY);

        return acc
      },
      {} as Slots
    )
};

const setIsImageLoading = (
  fileNumber: SharedValue<number>,
  isLoading: boolean,
) => {
  const isImageLoading = lastEvent<ImageLoading>(EV_IMAGE_LOADING) ?? {};

  const updatedIsImageLoading: ImageLoading = {
    ...isImageLoading,
    [fileNumber.value]: isLoading,
  };

  notify<ImageLoading>(EV_IMAGE_LOADING, updatedIsImageLoading);
};

const getIsImageLoading = (fileNumber: SharedValue<number>): boolean => {
  const isImageLoading = lastEvent<ImageLoading>(EV_IMAGE_LOADING) ?? {};

  return isImageLoading[fileNumber.value] ?? false;
};

const useIsImageLoading = (
  fileNumber: SharedValue<number>,
  callback: (isLoading: boolean) => void
) => {
  useEffect(() => {
    return listen<ImageLoading>(
      EV_IMAGE_LOADING,
      (data) => {
        if (!data) {
          return;
        }

        const isLoading = data[fileNumber.value];

        if (isLoading === undefined) {
          return;
        }

        callback(isLoading);
      }
    );
  }, []);
};

const useIsImageUri = (
  fileNumber: SharedValue<number>,
  callback: (uri: string | null) => void
) => {
  useEffect(() => {
    return listen<ImageUri>(
      EV_IMAGE_URI,
      (data) => {
        if (!data) {
          return;
        }

        const imageUri = data[fileNumber.value];

        if (imageUri === undefined) {
          return;
        }

        callback(imageUri);
      }
    );
  }, []);
};

const euclideanDistance = (p1: Point2D, p2: Point2D) => {
  return ((p1.x - p2.x) ** 2.0 + (p1.y - p2.y) ** 2.0) ** 0.5;
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

const getImageCropperCallback = (fileNumber: number) =>
  `image-cropped-${fileNumber}`;

const addImage = async (
  fileNumber: SharedValue<number>,
  showProtip: boolean,
) => {
  if (getIsImageLoading(fileNumber)) {
    return;
  }
  if (isImagePickerOpen.value) {
    return;
  }

  if (Platform.OS !== 'web') {
    setIsImageLoading(fileNumber, true);
    isImagePickerOpen.value = true;
  }

  // No permissions request is necessary for launching the image library
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    quality: 1,
    selectionLimit: 1,
    base64: true,
  });

  if (result.canceled && Platform.OS !== 'web') {
    isImagePickerOpen.value = false;
    setIsImageLoading(fileNumber, false);
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

  setIsImageLoading(fileNumber, true);

  const imageCropperCallback = getImageCropperCallback(fileNumber.value);

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
};

const useImagePickerResult = (
  input: OptionGroupPhotos,
  fileNumber: SharedValue<number>
): void => {
  useEffect(() => {
    const imageCropperCallback = getImageCropperCallback(fileNumber.value);

    return listen<ImageCropperOutput>(
      imageCropperCallback,
      async (data) => {
        isImagePickerOpen.value = false;

        if (data === undefined) {
          return;
        }

        if (data === null) {
          ;
        } else if (await input.photos.submit(fileNumber.value, data)) {
          const base64 = await cropImage(
            data.originalBase64,
            data.size,
            data.left,
            data.top,
            data.size,
          );

          notify<ImageUri>(EV_IMAGE_URI, { [fileNumber.value]: base64 });

          notify<VerificationEvent>(
            EV_UPDATED_VERIFICATION,
            { photos: { [`${fileNumber.value}`]: false } }
          );
        }

        setIsImageLoading(fileNumber, false);
      }
    );
  }, []);
};

const removeImage = async (
  input: OptionGroupPhotos,
  fileNumber: SharedValue<number>,
) => {
  setIsImageLoading(fileNumber, true);

  if (await input.photos.delete(String(fileNumber.value))) {
    notify<ImageUri>(EV_IMAGE_URI, { [fileNumber.value]: null });

    notify<VerificationEvent>(
      EV_UPDATED_VERIFICATION,
      { photos: { [`${fileNumber.value}`]: false } }
    );
  }

  setIsImageLoading(fileNumber, false);
};

const hapticsSelection = () => {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync();
  }
};

const FileNumber = ({
  fileNumber,
  left,
  top
}: {
  fileNumber: number
  left: number
  top: number
}) => {
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
  input,
  slots,
  initialFileNumber,
  height,
  width,
  left,
  top,
}: {
  input: OptionGroupPhotos
  slots: Slots,
  initialFileNumber: number
  height: number,
  width: number,
  left: number,
  top: number,
}) => {
  const initialUri =
    input.photos.getUri ?
    input.photos.getUri(String(initialFileNumber), '450') :
    null;

  const initialBlurhash =
    input.photos.getBlurhash ?
    input.photos.getBlurhash(String(initialFileNumber)) :
    null;

  const fileNumber = useSharedValue(initialFileNumber);
  const _slots = useSharedValue(slots);
  const isSlotAssignmentUnfinished = useSharedValue(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uri, setUri] = useState<string | null>(initialUri);
  const [blurhash, setBlurhash] = useState<string | null>(initialBlurhash);
  const [isVerified, setIsVerified] = useState(false);

  const getBorderRadius = useCallback(
    (fileNumber: number) => fileNumber === 1 ? Math.max(height, width) / 2 : 5,
    [height, width]
  );

  const [zIndex, setZIndex] = useState<number>(0);
  const resetZIndex = () => runOnJS(setZIndex)(0);

  const initialBorderRadius = getBorderRadius(initialFileNumber);

  const translateX = useSharedValue<number>(left);
  const translateY = useSharedValue<number>(top);
  const scale = useSharedValue<number>(1);
  const borderRadius = useSharedValue<number>(initialBorderRadius);

  const requestNearestSlot = (pressed: number | null) => {
    const p: Point2D = {
      x:
        _slots.value[fileNumber.value].center.x -
        _slots.value[fileNumber.value].origin.x +
        translateX.value,
      y:
        _slots.value[fileNumber.value].center.y -
        _slots.value[fileNumber.value].origin.y +
        translateY.value,
    };

    const nearestSlot = getNearestSlot(_slots.value, p);

    const from = fileNumber.value;
    const to = nearestSlot;

    notify<SlotRequest>('slot-request', { from, to, pressed });
  };

  const requestNearestSlotOnChange =
    debounce(
      () => requestNearestSlot(fileNumber.value),
      500,
      { maxWait: 500 },
    );

  const requestNearestSlotOnFinalize =
    () => requestNearestSlot(null);

  const addImageOnStart =
    () => addImage(fileNumber, true);

  const removeImageOnTap =
    () => removeImage(input, fileNumber);

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
      translateX.value += event.changeX;
      translateY.value += event.changeY;

      runOnJS(requestNearestSlotOnChange)();
    })
    .onFinalize(() => {
      runOnJS(requestNearestSlotOnFinalize)();
    })

  const tap =
    Gesture
    .Tap()
    .requireExternalGestureToFail(pan)
    .onStart(() => {
      runOnJS(addImageOnStart)();
    })

  const composedGesture = uri ? Gesture.Exclusive(pan, tap) : tap;

  const removeGesture =
    Gesture
    .Tap()
    .onStart(() => {
      if (uri === null || isLoading) {
        return;
      }

      runOnJS(removeImageOnTap)();
    });

  const onSlotAssignmentStart = useCallback(
    (data: SlotAssignmentStart | undefined) => {
      if (!data) {
        return;
      }
      if (fileNumber.value !== data.from) {
        return;
      }
      if (isSlotAssignmentUnfinished.value) {
        return;
      }

      if (fileNumber.value !== data.pressed) {
        translateX.value = withTiming(_slots.value[data.to].origin.x);
        translateY.value = withTiming(_slots.value[data.to].origin.y);
        scale.value = withTiming(
          1,
          undefined,
          resetZIndex,
        );
      }
      borderRadius.value = withTiming(getBorderRadius(data.to));

      if (data.pressed === null) {
        isSlotAssignmentUnfinished.value = true;
        fileNumber.value = data.to;
      }
    },
    [getBorderRadius]
  );

  const onSlotAssignmentFinish = useCallback(() => {
    notify<Images>('images', { [fileNumber.value]: { exists: Boolean(uri) } });
    isSlotAssignmentUnfinished.value = false;
  }, [uri]);

  useEffect(() => { translateX.value = left; }, [left]);
  useEffect(() => { translateY.value = top; }, [top]);
  useEffect(() => { _slots.value = slots; }, [slots]);

  useImagePickerResult(input, fileNumber);
  useIsImageLoading(fileNumber, setIsLoading);
  useIsImageUri(fileNumber, setUri);

  useEffect(() => {
    return listen<SlotAssignmentStart>(
      EV_SLOT_ASSIGNMENT_START,
      onSlotAssignmentStart
    );
  }, [onSlotAssignmentStart]);

  useEffect(() => {
    return listen(
      EV_SLOT_ASSIGNMENT_FINISH,
      onSlotAssignmentFinish
    );
  }, [onSlotAssignmentFinish]);

  useEffect(() => {
    notify<Images>(EV_IMAGES, { [fileNumber.value]: { exists: Boolean(uri) } });
  }, [uri]);

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        style={{
            cursor: 'pointer',
            zIndex: zIndex,
            position: 'absolute',
            height: height,
            width: width,
            left: 0,
            top: 0,
            transform: [
              { translateX },
              { translateY },
              { scale },
            ],
        }}
      >
        <Animated.View
          style={[
            {
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              borderRadius: initialBorderRadius,
            },
            { borderRadius },
          ]}
        >
          {uri &&
            <ExpoImage
              pointerEvents="none"
              source={{
                uri: uri,
                height: 450,
                width: 450,
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
          }
          {isLoading &&
            <Loading/>
          }
        </Animated.View>
        {uri &&
          <GestureDetector gesture={removeGesture}>
            <View
              style={{
                position: 'absolute',
                top: -10,
                left: -10,
                padding: 2,
                borderRadius: 999,
                backgroundColor: 'white',
                outline: 'none',
              }}
            >
              <FontAwesomeIcon
                icon={faCircleXmark}
                size={26}
                color="#000"
              />
            </View>
          </GestureDetector>
        }
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

const Slot = ({
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
  const [layoutChanged, setLayoutChanged] = useState({});

  useLayoutEffect(() => {
    viewRef.current?.measureInWindow((x, y, width, height) => {
      const center: Point2D = {
        x: x + width / 2,
        y: y + height / 2,
      };

      const origin: Point2D = {
        x: x,
        y: y,
      };

      const slot: Slot = {
        center,
        origin,
        height,
        width,
      };

      notify<Slots>('slots', { [fileNumber]: slot });
    });
  }, [layoutChanged]);

  return (
    <View
      ref={viewRef}
      onLayout={() => setLayoutChanged({})}
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
      <AddIcon/>
    </View>
  );
};

const SlotMemo = memo(Slot);

const PrimaryImage = ({
  input,
  fileNumber,
  showProtip = true
}: {
  input: OptionGroupPhotos
  fileNumber: number
  showProtip?: boolean
}) => {
  return <SlotMemo
    {...{
      input,
      fileNumber,
      showProtip,
      resolution: 900
    }}
  />
};

const FirstSlotRow = ({
  input,
  firstFileNumber,
}: {
  input: OptionGroupPhotos
  firstFileNumber: number
}) => {
  const [name, setName] = useState(lastEvent<string>('updated-name'));

  useEffect(() => {
    return listen<string>(EV_UPDATED_NAME, setName);
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
      <SlotMemo
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

const SlotRow = ({
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
      <SlotMemo
        input={input}
        fileNumber={firstFileNumber + 0}
        resolution={450}
      />
      <SlotMemo
        input={input}
        fileNumber={firstFileNumber + 1}
        resolution={450}
      />
      <SlotMemo
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
  const viewRef = useRef<View>(null);
  const [layoutChanged, setLayoutChanged] = useState({});
  const [pageX, setPageX] = useState(0);
  const [pageY, setPageY] = useState(0);
  const [images, setImages] = useState(
    lastEvent<Images>(EV_IMAGES) ?? {});
  const [slots, setSlots] = useState(
    lastEvent<Slots>(EV_SLOTS) ?? {});

  const relativeSlots = getRelativeSlots(slots, pageX, pageY);

  const onSlotRequest = (data: SlotRequest | undefined) => {
    if (!data) {
      return;
    }

    const occupancyMap = getOccupancyMap(images);

    const remappedSlots = remap(occupancyMap, data.from, data.to);

    const pressed = data.pressed;

    Object
      .entries(remappedSlots)
      .map(([from, to]) => ([Number(from), Number(to)]))
      .forEach(([from, to]) => {
        notify<SlotAssignmentStart>(
          EV_SLOT_ASSIGNMENT_START,
          { from, to, pressed }
        );
      });

    notify(EV_SLOT_ASSIGNMENT_FINISH);
  };

  const onSlots = (data: Slots | undefined) => {
    setSlots((old) => ({ ...old, ...data }))
  };

  const onImages = (data: Images | undefined) => {
    setImages((old) => ({ ...old, ...data }))
  };

  useEffect(
    () => listen<SlotRequest>(EV_SLOT_REQUEST, onSlotRequest),
    [onSlotRequest]);

  useLayoutEffect(
    () => listen<Slots>(EV_SLOTS, onSlots),
    []);

  useLayoutEffect(
    () => listen<Images>(EV_IMAGES, onImages),
    []);

  useLayoutEffect(() => {
    viewRef.current?.measureInWindow((x, y) => {
      setPageX(x);
      setPageY(y);
    });
  }, [layoutChanged]);

  return (
    <View
      ref={viewRef}
      style={{
        padding: 10,
        gap: 10,
      }}
      onLayout={() => setLayoutChanged({})}
    >
      <FirstSlotRow input={input} firstFileNumber={1} />
      <SlotRow      input={input} firstFileNumber={2} />
      <SlotRow      input={input} firstFileNumber={5} />

      {Object
        .entries(relativeSlots)
        .map(([fileNumber, slot]) =>
          <MoveableImage
            key={fileNumber}
            slots={relativeSlots}
            input={input}
            initialFileNumber={Number(fileNumber)}
            height={slot.height}
            width={slot.width}
            left={slot.origin.x}
            top={slot.origin.y}
          />
        )
      }

      {Object
        .entries(relativeSlots)
        .map(([fileNumber, slot]) =>
          <FileNumber
            key={fileNumber}
            fileNumber={Number(fileNumber)}
            left={slot.origin.x + 2}
            top={slot.origin.y + slot.height - 2}
          />
        )
      }
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
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
      }}
    >
      <ActivityIndicator size="large" color="white"/>
    </View>
  );
}

export {
  Images,
  PrimaryImage,
};

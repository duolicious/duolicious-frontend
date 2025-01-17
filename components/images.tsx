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
import { Image as ExpoImage } from 'expo-image';
import { VerificationEvent } from '../verification/verification';
import { VerificationBadge } from './verification-badge';
import { DefaultText } from './default-text';
import * as Haptics from 'expo-haptics';
import
  Animated,
  {
    Easing,
    runOnJS,
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
import debounce from 'lodash/debounce';
import * as _ from "lodash";

// TODO: Image picker is shit and lets you upload any file type on web
// TODO: Reordering needs to happen during drag rather than at the end
// TODO: Get this working on mobile (needs runOnJS)
// TODO: Make images hold their positions between renders
// TODO: Backend logic
// TODO: Ensure verification badges on images update properly
// TODO: Image placeholders don't regain plus symbols when their image is dragged away
// TODO: Images don't shift when scaled on web
// TODO: Loading thing doesn't show
// TODO: Moving an image then uploading to it in its new position moves it back to its original position
// TODO: Queue movements and uploads

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

type RemappedImages = {
  imageLayoutMap: { [k: number]: ImageLayout }
  fileNumberMap: { [ k: number ]: number }
  pressedFileNumber: number | null
}

type ImageLoading = {
  [k: number]: boolean
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

const getRelativeSlots = (slots: Slots, pageX: number, pageY: number): Slots => {
  return Object
    .entries(slots)
    .reduce(
      (acc, [fileNumber, slot]) => {
        acc[Number(fileNumber)] = {
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
        }

        return acc
      },
      {} as Slots
    )
};

const setIsImageLoading = (fileNumber: number, isLoading: boolean) => {
  const isImageLoading = lastEvent<ImageLoading>('image-loading') ?? {};
  const updatedIsImageLoading = {
    ...isImageLoading,
    [fileNumber]: isLoading,
  };
  notify<ImageLoading>('image-loading', updatedIsImageLoading);
};

const getIsImageLoading = (fileNumber: number): boolean => {
  const isImageLoading = lastEvent<ImageLoading>('image-loading') ?? {};
  return isImageLoading[fileNumber] ?? false;
};

const euclideanDistance = (p1: Point2D, p2: Point2D) => {
  return ((p1.x - p2.x) ** 2.0 + (p1.y - p2.y) ** 2.0) ** 0.5;
};

const remapInverseMap = (
  obj: { [k: number]: number },
  fromKey: number,
  toKey: number
): { [k: number]: number } => {
  // If there's nothing to move or no actual move, return a copy
  if (fromKey === toKey || !(fromKey in obj)) {
    return { ...obj };
  }

  // Make a shallow copy so we never mutate the original
  const newObj = { ...obj };

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

const remap = (
  occupancyMap: { [k: number]: boolean },
  fromKey: number,
  toKey: number
): { [k: number]: number } => {
  const input: { [k: number]: number } = {};

  Object.entries(occupancyMap).forEach(([k, occupied]) => {
    if (occupied) {
      input[k] = Number(k);
    }
  });

  const inverseMap = remapInverseMap(input, fromKey, toKey);

  const map: { [k: number]: number } = {};

  Object
    .entries(inverseMap)
    .forEach(([k, v]) => {
      map[Number(v)] = Number(k);
    });

  // Add empty positions back
  const allPositions = _.range(1, 8);

  const occupiedAfterMove = Object.values(map).map(Number);

  allPositions
    .forEach((i) => {
      if (i in map) {
        ;
      } else if (occupiedAfterMove.includes(i)) {
        map[i] = inverseMap[i];
      } else {
        map[i] = i;
      }
    });

  return map;
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

const addImage = async (fileNumber: number, showProtip: boolean) => {
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

  const imageCropperCallback = `image-cropped-${fileNumber}`;

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

const removeImage = async (input: OptionGroupPhotos, fileNumber: number) => {
  setIsImageLoading(fileNumber, true);

  if (await input.photos.delete(String(fileNumber))) {
    // TODO: Listen for this
    notify<string | null>(`image-${fileNumber}-uri`, null);

    notify<VerificationEvent>(
      'updated-verification',
      { photos: { [`${fileNumber}`]: false } }
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

  const getBorderRadius = (fileNumber: number) =>
    fileNumber === 1 ? Math.max(height, width) / 2 : 5;

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
    () => addImage(fileNumber.value, true);

  const removeImageOnTap =
    () => removeImage(input, fileNumber.value);

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

  const composed = uri ? Gesture.Exclusive(pan, tap) : tap;

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
    []
  );

  const onSlotAssignmentFinish = useCallback(() => {
    notify<Images>('images', { [fileNumber.value]: { exists: Boolean(uri) } });
    isSlotAssignmentUnfinished.value = false;
  }, [uri]);

  useEffect(() => { translateX.value = left; }, [left]);
  useEffect(() => { translateY.value = top; }, [top]);
  useEffect(() => { _slots.value = slots; }, [slots]);

  useEffect(() => {
    return listen<SlotAssignmentStart>(
      'slot-assignment-start',
      onSlotAssignmentStart
    );
  }, [onSlotAssignmentStart]);

  useEffect(() => {
    return listen(
      'slot-assignment-finish',
      onSlotAssignmentFinish
    );
  }, [onSlotAssignmentFinish]);

  useEffect(() => {
    notify<Images>('images', { [fileNumber.value]: { exists: Boolean(uri) } });
  }, [uri]);

  return (
    <GestureDetector gesture={composed}>
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
    lastEvent<Images>('images') ?? {});
  const [slots, setSlots] = useState(
    lastEvent<Slots>('slots') ?? {});

  const relativeSlots = getRelativeSlots(slots, pageX, pageY);

  const onSlotRequest = (data: SlotRequest | undefined) => {
    if (!data) {
      return;
    }

    const occupancyMap = getOccupancyMap(images);
    const remappedSlots = remap(occupancyMap, data.from, data.to);

    if (!data.pressed) {
      console.log('images', JSON.stringify(images)); // TODO
      console.log('occupancyMap', JSON.stringify(occupancyMap)); // TODO
      console.log('remappedSlots', JSON.stringify(remappedSlots)); // TODO
    }

    const pressed = data.pressed;

    Object
      .entries(remappedSlots)
      .map(([from, to]) => ([Number(from), Number(to)]))
      .forEach(([from, to]) => {
        notify<SlotAssignmentStart>(
          'slot-assignment-start',
          { from, to, pressed }
        );
      });

    notify('slot-assignment-finish');
  };

  const onSlots = (data: Slots | undefined) => {
    setSlots((old) => ({ ...old, ...data }))
  };

  const onImages = (data: Images | undefined) => {
    setImages((old) => ({ ...old, ...data }))
  };

  useEffect(
    () => listen<SlotRequest>('slot-request', onSlotRequest),
    [onSlotRequest]);

  useLayoutEffect(
    () => listen<Slots>('slots', onSlots),
    []);

  useLayoutEffect(
    () => listen<Images>('images', onImages),
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

      {Object
        .entries(relativeSlots)
        .map(([fileNumber, slot]) =>
          <View
            key={fileNumber}
            style={{
              position: 'absolute',
              backgroundColor: 'red',
              height: 3,
              width: 3,
              left: slot.center.x,
              top: slot.center.y
            }}
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

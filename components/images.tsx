import {
  ActivityIndicator,
  Platform,
  Pressable,
  View,
} from 'react-native';
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faCircleXmark } from '@fortawesome/free-solid-svg-icons/faCircleXmark'
import { notify, listen } from '../events/events';
import { ImageCropperInput, ImageCropperOutput } from './image-cropper';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { isImagePickerOpen } from '../App';
import { Image } from 'expo-image';
import { VerificationEvent } from '../verification/verification';
import { VerificationBadge } from './verification-badge';

// TODO: Image picker is shit and lets you upload any file type on web

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

const Images = ({
  input,
  setIsLoading,
  setIsInvalid,
  setHasImage = (x: boolean) => {},
}) => {
  const isLoading1 = useRef(false);
  const isLoading2 = useRef(false);

  const isInvalid1 = useRef(false);
  const isInvalid2 = useRef(false);

  const setIsLoading_ = useCallback(() => setIsLoading(
    isLoading1.current ||
    isLoading2.current
  ), []);

  const setIsInvalid_ = useCallback(() => setIsInvalid(
    isInvalid1.current ||
    isInvalid2.current
  ), []);

  const setIsLoading1 = useCallback(
    x => { isLoading1.current = x; setIsLoading_() }, []);
  const setIsLoading2 = useCallback(
    x => { isLoading2.current = x; setIsLoading_() }, []);

  const setIsInvalid1 = useCallback(
    x => { isInvalid1.current = x; setIsInvalid_() }, []);
  const setIsInvalid2 = useCallback(
    x => { isInvalid2.current = x; setIsInvalid_() }, []);

  return (
    <View>
      <PrimaryImage
        input={input}
        fileNumber={1}
        setIsLoading={setIsLoading1}
        setIsInvalid={setIsInvalid1}
        setHasImage={setHasImage}
      />
      <SecondaryImages
        input={input}
        firstFileNumber={2}
        setIsLoading={setIsLoading2}
        setIsInvalid={setIsInvalid2}
        setHasImage={setHasImage}
      />
    </View>
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
}) => {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBlurhash, setImageBlurhash] = useState<string | null>(null);
  const [isLoading_, setIsLoading_] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

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

  return (
    <View
      style={{
        flex: 1,
        padding: 5,
      }}
    >
      <Pressable
        onPress={addImage}
        style={{
          borderRadius: 5,
          backgroundColor: '#eee',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible',
          width: '100%',
          aspectRatio: 1,
        }}
      >
        { isLoading_ && <Loading/>}
        {!isLoading_ && imageUri === null && <AddIcon/>}
        {!isLoading_ && imageUri !== null &&
          <>
            <Image
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
                borderRadius: 5,
                borderColor: '#eee',
                borderWidth: 1,
              }}
              contentFit="contain"
            />
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
                (imageUri === null || isLoading_) ?
                undefined :
                removeImage
              }
            >
              <FontAwesomeIcon
                icon={faCircleXmark}
                size={26}
                color="#000"
              />
            </Pressable>
            {isVerified &&
              <VerificationBadge
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                }}
                size={20}
              />
            }
          </>
        }
      </Pressable>
    </View>
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

const SecondaryImages = ({
  input,
  firstFileNumber,
  setIsLoading,
  setIsInvalid,
  setHasImage = (x: boolean) => {},
}) => {
  const isLoading1 = useRef(false);
  const isLoading2 = useRef(false);

  const setIsLoading_ = useCallback(() => setIsLoading(
    isLoading1.current ||
    isLoading2.current
  ), []);

  const setIsLoading1 = useCallback(
    x => { isLoading1.current = x; setIsLoading_() }, []);
  const setIsLoading2 = useCallback(
    x => { isLoading2.current = x; setIsLoading_() }, []);

  return (
    <View>
      <Row
        input={input}
        firstFileNumber={firstFileNumber + 0}
        setIsLoading={setIsLoading1}
        setIsInvalid={setIsInvalid}
        setHasImage={setHasImage}
      />
      <Row
        input={input}
        firstFileNumber={firstFileNumber + 3}
        setIsLoading={setIsLoading2}
        setIsInvalid={setIsInvalid}
        setHasImage={setHasImage}
      />
    </View>
  );
};

const AddIcon = () => {
  return (
    <Ionicons
      style={{
        color: '#666',
        fontSize: 42,
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
  SecondaryImages,
};

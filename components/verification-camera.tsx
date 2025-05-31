import { useCallback, useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { faTimes } from '@fortawesome/free-solid-svg-icons/faTimes';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { DefaultText } from './default-text';
import { SomethingWentWrongToast } from './toast';
import { notify, listen } from '../events/events';
import { japi, api } from '../api/api';
import { notifyUpdatedVerification } from '../verification/verification';

// TODO: Show an 'uploading' message

const EVENT_KEY_SHOW = 'verification-camera-show';

const showVerificationCamera = (show: boolean) => {
  notify(EVENT_KEY_SHOW, show);
};

const VerificationCamera = () => {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const { width, height } = useWindowDimensions();
  const size = Math.min(width, height);

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  const onPressClose = useCallback(() => {
    showVerificationCamera(false);
  }, []);

  const handleTakePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true
        });
        if (!photo.base64) {
          throw new Error(
            'Expected base64 property to be set while taking verification photo'
          );
        }

        notifyUpdatedVerification({
          status: 'uploading-photo',
          message: 'Uploading photo...',
        });

        showVerificationCamera(false);

        await japi(
          'post',
          '/verification-selfie',
          {
            base64_file: {
              position: 1,
              base64: photo.base64,
              top: 0,
              left: 0,
            },
          },
          {
            timeout: 2 * 60 * 1000, // 2 minutes
            showValidationToast: true,
          }
        );

        notify('watch-verification');

        await api('post', '/verify', undefined, { maxRetries: 0 });
      } catch (err) {
        console.warn('Error capturing photo:', err);
        notify<React.FC>('toast', SomethingWentWrongToast);
      }
    }
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <DefaultText style={styles.message}>
          We need your permission to show the camera
        </DefaultText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={{ width: size, height: size }}>
        <CameraView
          ref={cameraRef}
          facing="front"
          ratio="1:1"
          zoom={0}
          flash="off"
          mute={true}
          mirror={false}
          style={styles.camera}
        />
      </View>
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onPressClose}
        >
          <FontAwesomeIcon
            icon={faTimes}
            size={28}
            color="white"
            style={{
              // @ts-ignore
              outline: 'none'
            }}
          />
        </TouchableOpacity>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.shutterOuter} onPress={handleTakePhoto}>
            <View style={styles.shutterInner} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const VerificationCameraModal = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    return listen(EVENT_KEY_SHOW, setShow);
  }, []);

  if (show) {
    return <VerificationCamera/>;
  } else {
    return null;
  }
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
  },
  controlsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  message: {
    color: 'white',
    textAlign: 'center',
    paddingBottom: 10,
  },
  buttonContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    margin: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  button: {
    flex: 1,
    alignSelf: 'flex-end',
    alignItems: 'center',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  closeButton: {
    position: 'absolute',
    top: 26,
    left: 26,
    zIndex: 2,
  },
  shutterOuter: {
    width: 70,
    height: 70,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 50,
    height: 50,
    borderRadius: 32,
    backgroundColor: 'red',
  },
});

export {
  VerificationCameraModal,
  notifyUpdatedVerification,
  showVerificationCamera,
};

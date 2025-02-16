import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import {
  listen,
  notify,
} from '../../events/events';
import {
  backgroundColors,
} from './background-colors';
import Reanimated, {
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { ModalButton } from '../button/modal';

type GifPickedEvent = string;

const styles = StyleSheet.create({
  modal: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    ...backgroundColors.dark,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 50,
    bottom: 50,
    left: 10,
    right: 10,
    backgroundColor: 'white',
    borderRadius: 10,
    overflow: 'hidden',
  },
  buttonContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    flexDirection: 'row',
    marginVertical: 10,
  },
  gifGalleryContainer: {
    width: '100%',
    flex: 1,
    backgroundColor: 'red',
  }
});


const GifPickerModal: React.FC = () => {
  const [isShowing, setIsShowing] = useState(false);
  const [pickedGif, setPickedGif] = useState<null | string>(null);

  const cancel = useCallback(() => {
    setIsShowing(false)
  }, []);

  const pickGif = useCallback(() => {
    if (pickedGif) {
      notify<GifPickedEvent>('gif-picked', pickedGif);
    }
  }, []);

  useEffect(() => {
    return listen(
      'show-gif-picker',
      () => {
        setIsShowing(true);
        setPickedGif(null);
      }
    );
  }, []);

  if (!isShowing) {
    return null;
  }

  return (
    <Reanimated.View
      style={styles.modal}
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
    >
      <View style={styles.container}>
        <View style={styles.gifGalleryContainer}>
        </View>
        <View style={styles.buttonContainer}>
          <ModalButton color="#999" onPress={cancel} title="Cancel" />
          <ModalButton color="#70f" onPress={pickGif} title="Send" />
        </View>
      </View>
    </Reanimated.View>
  );
};

export {
  GifPickerModal,
  GifPickedEvent,
};

import {
  useState,
} from 'react';
import {
  Dimensions,
  Image,
  StyleSheet,
  Pressable,
  View,
} from 'react-native';
import { isMobile } from '../util/util';
import {
  ImageOrSkeleton,
} from './profile-card';
import { ChevronLeft, ChevronRight } from "react-native-feather";
import Ionicons from '@expo/vector-icons/Ionicons';

// TODO: Uninstall Image viewer dependency

const ImageCarousel = ({
  uuids,
  onChangeEmbiggened,
}: {
  uuids: string[]
  onChangeEmbiggened: (uuid: string) => void
}) => {
  const [active, setActive] = useState(0);

  const goToPrevSlide = () => {
    if (active > 0) setActive(active - 1);
  };

  const goToNextSlide = () => {
    if (active < uuids.length - 1) setActive(active + 1);
  };

  return (
    <View style={styles.container}>
      {uuids.length === 0 &&
        <ImageOrSkeleton
          resolution={900}
          imageUuid={null}
          style={styles.image}
        />
      }

      {uuids.map((uuid, index) => (
        <ImageOrSkeleton
          key={index}
          resolution={900}
          imageUuid={uuid}
          style={[styles.image, { opacity: index === active ? 1 : 0 }]}
        />
      ))}

      {uuids.length >= 2 &&
        <View style={styles.pagination}>
          {uuids.map((_, index) => (
            <View key={index} style={index === active ? styles.activeDot : styles.dot} />
          ))}
        </View>
      }

      {uuids.length >= 2 &&
        <Pressable onPress={goToPrevSlide} style={styles.leftPressable}>
          {!isMobile() &&
            <View style={styles.leftButton}>
              <ChevronLeft
                stroke="white"
                strokeWidth={4}
                width={40}
                height={40}
              />
            </View>
          }
        </Pressable>
      }

      {uuids.length >= 1 &&
        <Pressable
          onPress={() => onChangeEmbiggened(uuids[active])}
          style={styles.middleButton}
        />
      }

      {uuids.length >= 2 &&
        <Pressable onPress={goToNextSlide} style={styles.rightPressable}>
          {!isMobile() &&
            <View style={styles.rightButton}>
              <ChevronRight
                stroke="white"
                strokeWidth={4}
                width={40}
                height={40}
              />
            </View>
          }
        </Pressable>
      }
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 1,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  pagination: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    justifyContent: 'center',
    width: '100%',
    display: 'flex',
    padding: 3,
  },
  dot: {
    margin: 3,
    flex: 1,
    height: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#777',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  activeDot: {
    margin: 3,
    flex: 1,
    height: 5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#777',
    backgroundColor: 'white',
  },
  leftPressable: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '33%',
    zIndex: 2,
    justifyContent: 'center',
    alignItems: 'flex-start',
    alignSelf: 'center',
  },
  middleButton: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  rightPressable: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '33%',
    zIndex: 2,
    justifyContent: 'center',
    alignItems: 'flex-end',
    alignSelf: 'center',
  },
  leftButton: {
    opacity: 0.6,
    backgroundColor: 'black',
    borderRadius: 999,
    marginLeft: 5,
  },
  rightButton: {
    opacity: 0.6,
    backgroundColor: 'black',
    borderRadius: 999,
    marginRight: 5,
  },
});

export {
  ImageCarousel,
}

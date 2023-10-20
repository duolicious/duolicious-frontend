import {
  useRef,
  useState,
} from 'react';
import {
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  isMobile,
} from '../util/util'

// TODO: Uninstall Image viewer dependency
// TODO: Fix this for screen widths that change
const { width } = Dimensions.get('window');

const ImageCarousel = () => {
  return (
    <_ImageCarousel
      images={[
        'https://placehold.co/600x400/png',
        'https://placehold.co/300x200/png',
        'https://placehold.co/600x400/png',
      ]}
    />
  );
};

const _ImageCarousel = ({ images }) => {
  // TODO: Reduce the number of redraws

  const [active, setActive] = useState(0);

  const scrollViewRef = useRef<ScrollView>(null);  // Reference to the ScrollView

  const change = ({ nativeEvent }) => {
    const slide = Math.ceil(nativeEvent.contentOffset.x / nativeEvent.layoutMeasurement.width);
    if (slide !== active) {
      setActive(slide);
    }
  };

  const goToPrevSlide = () => {
    if (scrollViewRef.current && active > 0) {
      scrollViewRef.current.scrollTo({ x: width * (active - 1), animated: false });
      setActive(active - 1);  // Update the active slide index
    }
  };

  const goToNextSlide = () => {
    if (scrollViewRef.current && active < images.length - 1) {
      scrollViewRef.current.scrollTo({ x: width * (active + 1), animated: false });
      setActive(active + 1);  // Update the active slide index
    }
  };

  const embiggenImage = () => {
    console.log('embiggen image'); // TODO
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        decelerationRate="fast"
        horizontal={true}
        onScroll={change}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        snapToInterval={width}
        snapToAlignment="start"
        bounces={false}
        overScrollMode="never"
        style={styles.scroll}
      >
        {images.map((image, index) =>
          <Image
            key={index}
            source={{ uri: image }}
            style={styles.image}
          />
        )}
      </ScrollView>
      <View style={styles.pagination}>
        {images.map((i, k) => (
          <View key={k} style={k === active ? styles.activeDot : styles.dot} />
        ))}
      </View>

      <TouchableOpacity onPress={goToPrevSlide} style={styles.leftButton}>
        {!isMobile() &&
          <Text style={styles.leftButtonText}>{"<"}</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={embiggenImage} style={styles.middleButton}/>

      <TouchableOpacity onPress={goToNextSlide} style={styles.rightButton}>
        {!isMobile() &&
          <Text style={styles.rightButtonText}>{">"}</Text>
        }
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width,
    aspectRatio: 1,
  },
  scroll: {
    width,
    aspectRatio: 1,
    scrollSnapType: 'x mandatory'  // This activates snapping on the x-axis.
  },
  image: {
    width,
    aspectRatio: 1,
    resizeMode: 'cover',
    borderWidth: 1,
    borderColor: 'red',
    scrollSnapAlign: 'start'  // This makes the image snap to the start.
  },
  pagination: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    justifyContent: 'center',
    width: '100%',
    display: 'flex',
    padding: 5,
  },
  dot: {
    margin: 5,
    flex: 1,
    height: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'black',
    backgroundColor: '#70f',
  },
  activeDot: {
    margin: 5,
    flex: 1,
    height: 5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'black',
    backgroundColor: 'white',
  },
  leftButton: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '33%',
    zIndex: 2,
    justifyContent: 'center',
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
  rightButton: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '33%',
    zIndex: 2,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  leftButtonText: {
    fontSize: 40,
    color: 'white',
    textAlign: 'left',
    paddingLeft: '15%',
  },
  rightButtonText: {
    fontSize: 40,
    color: 'white',
    textAlign: 'right',
    paddingRight: '15%',
  },
});

export {
  ImageCarousel,
}

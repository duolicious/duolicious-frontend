import { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import Reanimated, { FadeIn, FadeOut } from 'react-native-reanimated';
import * as _ from "lodash";
import { ModalButton } from '../button/modal';
import { listen, notify } from '../../events/events';
import { backgroundColors } from './background-colors';
import { DefaultTextInput } from '../default-text-input';
import { AutoResizingGif } from '../auto-resizing-gif';

type GifPickedEvent = string;

// TODO: Masonry list

const TENOR_API_KEY = 'LIVDSRZULELA'; // TODO: Define via env vars
const TENOR_SEARCH_URL = 'https://g.tenor.com/v1/search';

const GifPickerModal: React.FC = () => {
  const [isShowing, setIsShowing] = useState(false);
  const [pickedGif, setPickedGif] = useState<null | string>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [gifResults, setGifResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const cancel = useCallback(() => {
    setIsShowing(false);
  }, []);

  const pickGif = useCallback(() => {
    if (pickedGif) {
      notify<GifPickedEvent>('gif-picked', pickedGif);
      setIsShowing(false);
    }
  }, [pickedGif]);

  // Fetch gifs from Tenor when a search query is provided
  const fetchGifs = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${TENOR_SEARCH_URL}` +
        `?q=${encodeURIComponent(query)}` +
        `&key=${TENOR_API_KEY}` +
        `&media_filter=gif,nanogif` +
        `&limit=50`
      );
      const json = await response.json();
      // The Tenor API returns an array of results – adjust according to your needs
      setGifResults(json.results || []);
    } catch (error) {
      console.error('Error fetching gifs:', error);
    }
    setLoading(false);
  }, []);

  // Use lodash debounce to delay search requests
  const debouncedFetchGifs = useCallback(_.debounce((query: string) => {
    fetchGifs(query);
  }, 500), [fetchGifs]);

  useEffect(() => {
    debouncedFetchGifs(searchQuery);
  }, [searchQuery, debouncedFetchGifs]);

  useEffect(() => {
    return listen('show-gif-picker', () => {
      setIsShowing(true);
      setPickedGif(null);
      setSearchQuery('');
      setGifResults([]);
      debouncedFetchGifs("");
    });
  }, [debouncedFetchGifs]);

  if (!isShowing) {
    return null;
  }

  const renderGifItem = ({ item }: { item: any }) => {
    const previewUrl = item.media[0]?.nanogif?.url;
    const gifUrl = item.media[0]?.gif?.url;

    return (
      <Reanimated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={styles.gifItemContainer}
      >
        <Pressable onPress={() => setPickedGif(gifUrl)}>
          <AutoResizingGif
            uri={previewUrl}
            style={[
              styles.gifImage,
              pickedGif === gifUrl ? styles.selectedGif : styles.unselectedGif,
            ]}
          />
        </Pressable>
      </Reanimated.View>
    );
  };

  return (
    <Reanimated.View
      style={styles.modal}
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
    >
      <View style={styles.container}>
        <View style={styles.gifGalleryContainer}>
          <DefaultTextInput
            style={styles.searchInput}
            placeholder="Search for gifs..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {loading ? (
            <ActivityIndicator
              size="large"
              color="#70f"
              style={styles.loadingIndicator}
            />
          ) : (
            <FlatList
              data={gifResults}
              keyExtractor={(item, index) => item.id || index.toString()}
              numColumns={3}
              renderItem={renderGifItem}
              contentContainerStyle={styles.gifList}
            />
          )}
        </View>
        <View style={styles.buttonContainer}>
          <ModalButton color="#999" onPress={cancel} title="Cancel" />
          <ModalButton color="#70f" onPress={pickGif} title="Send" />
        </View>
      </View>
    </Reanimated.View>
  );
};

const styles = StyleSheet.create({
  modal: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    ...backgroundColors.dark,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 600,
    height: '80%',
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
    padding: 10,
  },
  searchInput: {
    backgroundColor: '#eee',
    borderWidth: 0,
    marginLeft: 0,
    marginRight: 0,
  },
  gifList: {
    justifyContent: 'center',
  },
  gifItemContainer: {
    flex: 1,
    margin: 5,
    justifyContent: 'center',
  },
  gifImage: {
    borderRadius: 5,
    borderWidth: 6,
  },
  selectedGif: {
    borderColor: '#70f',
  },
  unselectedGif: {
    borderColor: 'transparent',
  },
  loadingIndicator: {
    marginTop: 20,
  },
});

export {
  GifPickerModal,
  GifPickedEvent,
};

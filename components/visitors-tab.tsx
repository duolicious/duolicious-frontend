import {
  SafeAreaView,
  StyleSheet,
  View,
  ActivityIndicator,
  Pressable,
  Animated as RNAnimated,
} from 'react-native';
import { memo, useCallback, useEffect, useState } from 'react';
import { DefaultText } from './default-text';
import { TopNavBar } from './top-nav-bar';
import { useScrollbar } from './navigation/scroll-bar-hooks';
import { Avatar } from './avatar';
import { friendlyTimestamp } from '../util/util';
import { commonStyles } from '../styles';
import { VerificationBadge } from './verification-badge';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { japi } from '../api/api';
import { useSkipped } from '../hide-and-block/hide-and-block';
import { useAppTheme } from '../app-theme/app-theme';
import { usePressableAnimation } from '../animation/animation';
import { ButtonGroup } from './button-group';
import Animated from 'react-native-reanimated';
import * as _ from 'lodash';
import { z } from 'zod';
import { listen, notify, lastEvent } from '../events/events';



// TODO: Upon loading the app, it should show the number of new visitors since
//       last checked
// TODO: Endpoint: /visitors
// TODO: Endpoint: /mark-visitors-checked - should update store
// TODO: Include "Today" at the top of the list

// Event keys
const EVENT_VISITORS = 'visitors';
const EVENT_NUM_VISITORS = 'num-visitors';

// Keep public setter for badge count
const setNumVisitors = (num: number) => {
  notify<number>(EVENT_NUM_VISITORS, num);
};

const useNumVisitors = () => {
  const initialNumVisitors = lastEvent<number>(EVENT_NUM_VISITORS) ?? 0;
  const [numVisitors, setNumVisitors_] = useState(initialNumVisitors);

  useEffect(() => {
    listen<number>(EVENT_NUM_VISITORS, x => { if(x) setNumVisitors_(x); });
  }, []);

  return numVisitors;
};

const DataItemSchema = z.object({
  person_uuid: z.string(),
  photo_uuid: z.string().nullable(),
  photo_blurhash: z.string().nullable(),
  time: z.string(),
  name: z.string(),
  age: z.number().nullable(),
  gender: z.string(),
  location: z.string().nullable(),
  is_verified: z.boolean(),
  match_percentage: z.number(),
  verification_required_to_view: z.union([
    z.literal('photos'),
    z.literal('basics'),
    z.null(),
  ]),
  is_new: z.boolean(),
});

const DataSchema = z.object({
  visited_you: z.array(DataItemSchema),
  you_visited: z.array(DataItemSchema),
});

type DataItem = z.infer<typeof DataItemSchema>;
type Data = z.infer<typeof DataSchema>;

const isValidData = (item: unknown): item is Data => {
  const result = DataSchema.safeParse(item);

  if (!result.success) {
    console.warn(result.error);
  }

  return result.success;
};

// Helpers for keys/sections

type SectionKey = 'visited-you' | 'you-visited';

const sectionFromIndex = (sectionIndex: number): SectionKey =>
  sectionIndex === 0 ? 'visited-you' : 'you-visited';

const makeKey = (section: SectionKey, personUuid: string): string =>
  `${section}-${personUuid}`;

const parseKey = (key: string): { section: SectionKey, personUuid: string } | null => {
  if (key.startsWith('visited-you-')) {
    return { section: 'visited-you', personUuid: key.slice('visited-you-'.length) };
  } else if (key.startsWith('you-visited-')) {
    return { section: 'you-visited', personUuid: key.slice('you-visited-'.length) };
  }
  return null;
};

const computeKeys = (data: Data | null, section: SectionKey): string[] => {
  if (!data) return [];
  const arr = section === 'visited-you' ? data.visited_you : data.you_visited;
  return arr.map(d => makeKey(section, d.person_uuid));
};

// Hook: list of item keys (minimises re-renders by only updating on membership/order changes)
const useVisitorItemKeys = (sectionIndex: number): string[] | null => {
  const section = sectionFromIndex(sectionIndex);
  const initialData = lastEvent<Data | null>(EVENT_VISITORS) ?? null;
  const initialKeys = initialData ? computeKeys(initialData, section) : null;
  const [keys, setKeys] = useState<string[] | null>(initialKeys);

  useEffect(() => {
    // Recompute immediately for new section based on last known data
    setKeys(() => computeKeys(lastEvent<Data | null>(EVENT_VISITORS) ?? null, section));

    return listen<Data | null>(
      EVENT_VISITORS,
      (newData) => {
        const newKeys = computeKeys(newData ?? null, section);
        setKeys((prev) => _.isEqual(prev, newKeys) ? prev : newKeys);
      },
      true,
    );
  }, [section]);

  return keys;
};

// Hook: subscribe to a specific item by key
const getItemByKey = (data: Data | null, key: string): DataItem | null => {
  if (!data) return null;
  const parsed = parseKey(key);
  if (!parsed) return null;
  const { section, personUuid } = parsed;
  const list = section === 'visited-you' ? data.visited_you : data.you_visited;
  return list.find(d => d.person_uuid === personUuid) ?? null;
};

const useVisitorItem = (key: string): DataItem => {
  const initial = getItemByKey(lastEvent<Data | null>(EVENT_VISITORS) ?? null, key);
  const [item, setItem] = useState<DataItem | null>(initial);

  useEffect(() => {
    return listen<Data | null>(
      EVENT_VISITORS,
      (newData) => {
        const newItem = getItemByKey(newData ?? null, key);
        setItem((prev) => _.isEqual(prev, newItem) ? prev : newItem);
      },
      true,
    );
  }, [key]);

  if (!item) {
    throw new Error('item key not found');
  }

  return item;
};

// Notify updates to the visitors store
const notifyVisitors = (data: Data) => notify<Data>(EVENT_VISITORS, data);

// TODO: memoize? Otherwise i'll get called each time the user switches between
//       'you visited' and 'visited you'. Maybe there should be two endpoints
//
//        Another strategy is to refresh every minute or so
const fetchVisitors = async (): Promise<Data | null> => {
  const response = await japi('get', '/visitors');

  if (!response.ok) {
    return null
  }

  if (!isValidData(response.json)) {
    return null;
  }

  // Update badge count and push data to subscribers
  setNumVisitors(response.json.visited_you.filter(d => d.is_new).length);
  notifyVisitors(response.json);

  return response.json;
};

const markVisitorsChecked = () => {
  // Optimistically update local store to clear "new" indicators
  const current = lastEvent<Data | null>(EVENT_VISITORS) ?? null;
  if (current) {
    const updated: Data = {
      visited_you: current.visited_you.map(d => ({ ...d, is_new: false })),
      you_visited: current.you_visited,
    };
    notifyVisitors(updated);
    setNumVisitors(0);
  }

  // Fire-and-forget server update
  japi('post', '/mark-visitors-checked');
}

const useNavigationToProfile = (
  personUuid: string,
  photoBlurhash: string | null,
  verificationRequired: boolean
) => {
  const navigation = useNavigation<any>();

  return useCallback((e) => {
    e.preventDefault();

    if (verificationRequired) {
      return navigation.navigate('Profile');
    } else if (personUuid) {
      return navigation.navigate(
        'Prospect Profile Screen',
        {
          screen: 'Prospect Profile',
          params: { personUuid, photoBlurhash },
        }
      );
    }

  }, [personUuid, photoBlurhash, verificationRequired]);
};

const VisitorsItem = ({ itemKey }: { itemKey: string }) => {
  const dataItem = useVisitorItem(itemKey);
  const { appTheme } = useAppTheme();

  const { isSkipped } = useSkipped(dataItem.person_uuid);
  const { backgroundColor, onPressIn, onPressOut } = usePressableAnimation();
  const onPress = useNavigationToProfile(
    dataItem.person_uuid,
    dataItem.photo_blurhash,
    dataItem.verification_required_to_view !== null,
  );

  if (isSkipped) {
    return <></>;
  }

  return (
    <Pressable
      style={styles.pressableStyle}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress}
    >
      <RNAnimated.View style={[styles.cardBorders, appTheme.card, { backgroundColor }]}>
        <Avatar
          percentage={dataItem.match_percentage}
          personUuid={dataItem.person_uuid}
          photoUuid={dataItem.photo_uuid}
          photoBlurhash={dataItem.photo_blurhash}
          verificationRequired={dataItem.verification_required_to_view}
        />
        <View style={{ flexShrink: 1 }} >
          <View
            style={{
              width: '100%',
              flexDirection: 'row',
              gap: 5,
              alignItems: 'center',
            }}
          >
            <DefaultText
              style={{
                fontWeight: '700',
                flexShrink: 1,
              }}
            >
              {dataItem.name}
            </DefaultText>
            {dataItem.is_verified &&
              <VerificationBadge size={14} />
            }
          </View>
          <DefaultText style={{ color: appTheme.hintColor }}>
            {
              [
                dataItem.age,
                dataItem.gender,
                dataItem.location
              ]
                .filter(Boolean)
                .join(' • ')
            }
          </DefaultText>
          <DefaultText style={{ color: appTheme.hintColor }}>
            {friendlyTimestamp(new Date(dataItem.time))}
          </DefaultText>
        </View>
        <View
          style={{
            flexGrow: 1,
            alignItems: 'flex-end',
            marginRight: 10,
          }}
        >
          {dataItem.is_new &&
            <View
              style={{
                backgroundColor: appTheme.brandColor,
                height: 12,
                width: 12,
                borderRadius: 999,
              }}
            />
          }
        </View>
      </RNAnimated.View>
    </Pressable>
  );
};

const VisitorsItemMemo = memo(VisitorsItem);

const RenderItem = ({ item }: { item: string }) => {
  return <VisitorsItemMemo itemKey={item} />
};

const keyExtractor = (id: string) => id;

const VisitorsTab = () => {
  const { appTheme } = useAppTheme();
  const {
    onLayout,
    onContentSizeChange,
    onScroll,
    showsVerticalScrollIndicator,
    observeListRef,
  } = useScrollbar('visitors');

  const [sectionIndex, setSectionIndex] = useState(0);

  // Load visitors on mount/focus
  useEffect(() => { fetchVisitors(); }, []);
  useFocusEffect(markVisitorsChecked);

  const itemKeys = useVisitorItemKeys(sectionIndex);

  const emptyText = sectionIndex === 0 ? (
    "Nobody’s visited yet. Try answering more Q&A questions or " +
    "updating your profile."
  ) : (
    "You haven’t visited anybody lately"
  );

  const endText = sectionIndex === 0 ? (
    "That’s everybody who’s visited you for now"
  ) : (
    "That’s everybody you’ve visited recently"
  );

  return (
    <SafeAreaView style={styles.safeAreaView}>
      <TopNavBar>
        <DefaultText
          style={{
            fontWeight: '700',
            fontSize: 20,
          }}
        >
          Visitors
        </DefaultText>
      </TopNavBar>
      {itemKeys === null &&
        <View style={{height: '100%', justifyContent: 'center', alignItems: 'center'}}>
          <ActivityIndicator size="large" color={appTheme.brandColor} />
        </View>
      }
      {itemKeys !== null &&
        <View style={styles.flatListContainer} onLayout={onLayout}>
          <Animated.FlatList<string>
            ref={observeListRef}
            data={itemKeys}
            ListHeaderComponent={
              <ButtonGroup
                buttons={[
                  'Visited You',
                  'You Visited',
                ]}
                selectedIndex={sectionIndex}
                onPress={setSectionIndex}
                containerStyle={{
                  marginTop: 5,
                  marginLeft: 20,
                  marginRight: 20,
                }}
              />
            }
            ListEmptyComponent={
              <DefaultText style={styles.emptyText}>
                {emptyText}
              </DefaultText>
            }
            ListFooterComponent={
              itemKeys.length > 0 ?
                <DefaultText style={styles.endText}>{endText}</DefaultText> :
                null
            }
            renderItem={RenderItem}
            keyExtractor={keyExtractor}
            onContentSizeChange={onContentSizeChange}
            onScroll={onScroll}
            showsVerticalScrollIndicator={showsVerticalScrollIndicator}
            contentContainerStyle={styles.listContentContainerStyle}
          />
        </View>
      }
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  listContentContainerStyle: {
    paddingTop: 10,
    paddingLeft: 10,
    paddingRight: 10,
    paddingBottom: 20,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  safeAreaView: {
    flex: 1
  },
  cardBorders: {
    ...commonStyles.cardBorders,
    flexDirection: 'row',
    gap: 10,
    padding: 10,
    alignItems: 'center',
    width: '100%',
  },
  pressableStyle: {
    marginTop: 20,
    width: '100%',
  },
  flatListContainer: {
    flex: 1,
  },
  emptyText: {
    fontFamily: 'Trueno',
    margin: '20%',
    textAlign: 'center',
  },
  endText: {
    fontFamily: 'TruenoBold',
    fontSize: 16,
    textAlign: 'center',
    alignSelf: 'center',
    marginTop: 30,
    marginBottom: 30,
    marginLeft: '15%',
    marginRight: '15%',
  }
});

export {
  VisitorsTab,
  fetchVisitors,
  useNumVisitors,
};

import {
  Platform,
  SafeAreaView,
  StyleSheet,
  View,
} from 'react-native';
import { useCallback, useEffect, useState, useRef } from 'react';
import { DefaultText } from './default-text';
import { TopNavBar } from './top-nav-bar';
import { useScrollbar } from './navigation/scroll-bar-hooks';
import { Avatar } from './avatar';
import { friendlyTimestamp } from '../util/util';
import { Pressable, Animated } from 'react-native';
import { commonStyles } from '../styles';
import { VerificationBadge } from './verification-badge';
import { useNavigation } from '@react-navigation/native';
import { japi } from '../api/api';
import { DefaultFlatList, DefaultFlashList } from './default-flat-list';
import { z } from 'zod';
import { listen, notify, lastEvent } from '../events/events';
import { useSkipped } from '../hide-and-block/hide-and-block';
import { useAppTheme } from '../app-theme/app-theme';
import { usePressableAnimation } from '../animation/animation';
import { useFocusEffect } from '@react-navigation/native';
import { ButtonGroup } from './button-group';



// TODO: Upon loading the app, it should show the number of new visitors since
//       last checked
// TODO: Endpoint: /visitors
// TODO: Endpoint: /mark-visitors-checked
// TODO: Add to mobile and web nav bars
// TODO: Include "Today" at the top of the list
// TODO: Add the refresh button back in?

const DefaultList = Platform.OS === 'web' ? DefaultFlatList : DefaultFlashList;

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
  is_new: z.boolean(),
});

const DataSchema = z.object({
  visited_you: z.array(DataItemSchema),
  you_visited: z.array(DataItemSchema),
});

type DataItem = z.infer<typeof DataItemSchema>;
type Data = z.infer<typeof DataSchema>;

const EVENT_NUM_VISITORS = 'num-visitors';

const setNumVisitors = (num: number) => {
  notify<number>(EVENT_NUM_VISITORS, num);
};

const useNumVisitors = () => {
  const initialNumVisitors = lastEvent<number>(EVENT_NUM_VISITORS) ?? 0;
  const [numVisitors, setNumVisitors] = useState(initialNumVisitors);

  useEffect(() => {
    listen<number>(EVENT_NUM_VISITORS, x => { if(x) setNumVisitors(x); });
  }, []);

  return numVisitors;
};

const isValidData = (item: unknown): item is Data => {
  const result = DataSchema.safeParse(item);

  if (!result.success) {
    console.warn(result.error);
  }

  return result.success;
};

// TODO: memoize? Otherwise i'll get called each time the user switches between
//       'you visited' and 'visited you'. Maybe there should be two endpoints
const fetchVisitors = async (): Promise<Data | null> => {
  const response = await japi('get', '/visitors');

  if (!response.ok) {
    return null
  }

  if (!isValidData(response.json)) {
    return null;
  }

  setNumVisitors(response.json.visited_you.filter(d => d.is_new).length);

  return response.json;
};

const fetchVisitedYou = async (pageNumber: number = 1): Promise<DataItem[] | null> => {
  if (pageNumber !== 1) {
    return [];
  }

  const fetched = await fetchVisitors();

  if (fetched) {
    return fetched.visited_you;
  } else {
    return null;
  }
};

const fetchYouVisited = async (pageNumber: number = 1): Promise<DataItem[] | null> => {
  if (pageNumber !== 1) {
    return [];
  }

  const fetched = await fetchVisitors();

  if (fetched) {
    return fetched.you_visited;
  } else {
    return null;
  }
};

const markVisitorsChecked = () => {
  japi('get', '/mark-visitors-checked');
}

const useNavigationToProfile = (
  personUuid: string,
  photoBlurhash: string | null
) => {
  const navigation = useNavigation<any>();

  return useCallback(() => {
    navigation.navigate(
      'Prospect Profile Screen',
      {
        screen: 'Prospect Profile',
        params: { personUuid, photoBlurhash },
      }
    );
  }, [personUuid, photoBlurhash]);
};

const FeedItem = ({ dataItem }: { dataItem: DataItem }) => {
  const { appTheme } = useAppTheme();
  const { isSkipped } = useSkipped(dataItem.person_uuid);
  const { backgroundColor, onPressIn, onPressOut } = usePressableAnimation();
  const onPress = useNavigationToProfile(
    dataItem.person_uuid,
    dataItem.photo_blurhash,
  );

  if (isSkipped) {
    return <></>;
  }

  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress}
     >
       <Animated.View style={[styles.cardBorders, appTheme.card, { backgroundColor }]}>
         <Avatar
           percentage={dataItem.match_percentage}
           personUuid={dataItem.person_uuid}
           photoUuid={dataItem.photo_uuid}
           photoBlurhash={dataItem.photo_blurhash}
         />
         <View>
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
          <DefaultText>
            {dataItem.age}
            •
            {dataItem.gender}
            •
            {dataItem.location}
          </DefaultText>
          <DefaultText>
            {friendlyTimestamp(new Date(dataItem.time))}
          </DefaultText>
         </View>
         <View
          style={{
            height: 40,
            aspectRatio: 1,
          }}
         >
          {dataItem.is_new &&
            <View
              style={{
                backgroundColor: appTheme.brandColor,
                height: '50%',
                aspectRatio: 1,
              }}
            />
          }
         </View>
       </Animated.View>
     </Pressable>
  );
};

const VisitorsTab = () => {
  const {
    onLayout,
    onContentSizeChange,
    onScroll,
    showsVerticalScrollIndicator,
    observeListRef,
  } = useScrollbar('visitors');

  const [sectionIndex, setSectionIndex] = useState(0);

  const listRef = useRef<any>(undefined);

  // TODO: tabs for visited you and you visited
  useFocusEffect(markVisitorsChecked);

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
      <DefaultList
        ref={listRef}
        innerRef={observeListRef}
        emptyText={
          sectionIndex === 0 ? (
            "Nobody’s visited yet. Try answering more Q&A questions or " +
            "updating your profile."
          ) : (
            "You haven’t visited anybody lately"
          )
        }
        errorText={"Something went wrong while fetching visitors\xa0😵‍💫"}
        endText={
          sectionIndex === 0 ? (
            "That’s everybody who’s visited you for now"
          ) : (
            "That’s everybody you’ve visited recently"
          )
        }
        fetchPage={sectionIndex === 0 ? fetchVisitedYou : fetchYouVisited}
        dataKey={String(sectionIndex)}
        contentContainerStyle={styles.listContentContainerStyle}
        renderItem={({ item }: { item: DataItem }) =>
          <FeedItem dataItem={item} />
        }
        keyExtractor={(item: DataItem) => item.person_uuid}
        onLayout={onLayout}
        onContentSizeChange={onContentSizeChange}
        onScroll={onScroll}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
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
      />
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
    marginBottom: 20,
  },
});

export {
  VisitorsTab,
  fetchVisitors,
  useNumVisitors,
};

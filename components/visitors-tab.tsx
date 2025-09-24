import {
  Platform,
  SafeAreaView,
  StyleSheet,
  View,
} from 'react-native';
import { useCallback, useEffect, useState, useRef } from 'react';
import { DefaultText } from './default-text';
import { DuoliciousTopNavBar } from './top-nav-bar';
import { useScrollbar } from './navigation/scroll-bar-hooks';
import { Avatar } from './avatar';
import { getShortElapsedTime, isMobile, assertNever, capLuminance } from '../util/util';
import { GestureResponderEvent, Pressable, Animated } from 'react-native';
import { EnlargeablePhoto } from './enlargeable-image';
import { commonStyles } from '../styles';
import { VerificationBadge } from './verification-badge';
import { useNavigation } from '@react-navigation/native';
import { japi } from '../api/api';
import { DefaultFlatList, DefaultFlashList } from './default-flat-list';
import { z } from 'zod';
import { listen, notify, lastEvent } from '../events/events';
import { ReportModalInitialData } from './modal/report-modal';
import { Flag } from "react-native-feather";
import { AudioPlayer } from './audio-player';
import { useSkipped } from '../hide-and-block/hide-and-block';
import { TopNavBarButton } from './top-nav-bar-button';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faReply } from '@fortawesome/free-solid-svg-icons/faReply';
import { OnlineIndicator } from './online-indicator';
import { Flair } from './badges';
import { useAppTheme } from '../app-theme/app-theme';
import { usePressableAnimation } from '../animation/animation';
import { useFocusEffect } from '@react-navigation/native';



// TODO: Upon loading the app, it should show the number of new visitors since
//       last checked
// TODO: Endpoint: /visitors
// TODO: Endpoint: /mark-visitors-checked
// TODO: Add to mobile and web nav bars

const NAME_ACTION_TIME_GAP_VERTICAL = 16;

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
});

type DataItem = z.infer<typeof DataItemSchema>;

const EVENT_NUM_VISITORS = 'num-visitors';

const setNumVisitors = (num: number) => {
  notify<number>(EVENT_NUM_VISITORS, num);
};

const useNumVisitors = () => {
  const initialNumVisitors = lastEvent<number>(EVENT_NUM_VISITORS) ?? 0;
  const [numVisitors, setNumVisitors] = useState(initialNumVisitors);

  useEffect(() => {
    listen<number>(EVENT_NUM_VISITORS, setNumVisitors);
  }, []);

  return numVisitors;
};

const isValidDataItem = (item: unknown): item is DataItem => {
  const result = DataItemSchema.safeParse(item);

  if (!result.success) {
    console.warn(result.error);
  }

  return result.success;
};

const fetchVisitors = async (pageNumber: number = 1): Promise<DataItem[] | null> => {
  if (pageNumber !== 1) {
    return [];
  }

  const response = await japi('get', '/visitors');

  if (!response.ok) {
    return null
  }

  if (!Array.isArray(response.json)) {
    return null;
  }

  setNumVisitors(response.json.length);

  return response.json.filter(isValidDataItem);
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

// const NameActionTime = ({
//   personUuid,
//   name,
//   isVerified,
//   action,
//   time,
//   doUseOnline,
//   flair,
//   style,
// }: {
//   personUuid: string
//   name: string
//   isVerified: boolean
//   action: Action
//   time: Date
//   doUseOnline: boolean
//   flair: string[]
//   style?: any
// }) => {
//   const { appTheme } = useAppTheme();
// 
//   const onPress = useCallback((event: GestureResponderEvent) => {
//     event.stopPropagation();
// 
//     const data: ReportModalInitialData = {
//       name,
//       personUuid,
//       context: 'Feed',
//     };
//     notify('open-report-modal', data);
//   }, [notify, name, personUuid]);
// 
//   return (
//     <View
//       style={{
//         flex: 1,
//         flexDirection: 'row',
//       }}
//     >
//       <View
//         style={{
//           flex: 1,
//           flexWrap: 'wrap',
//           justifyContent: 'center',
//           gap: 2,
//           ...style,
//         }}
//       >
//         <View
//           style={{
//             width: '100%',
//             flexDirection: 'row',
//             gap: 5,
//             alignItems: 'center',
//           }}
//         >
//           {doUseOnline &&
//             <OnlineIndicator
//               personUuid={personUuid}
//               size={12}
//               borderWidth={0}
//             />
//           }
//           <DefaultText
//             style={{
//               fontWeight: '700',
//               flexShrink: 1,
//             }}
//           >
//             {name}
//           </DefaultText>
//           {isVerified &&
//             <VerificationBadge size={14} />
//           }
//         </View>
//         <DefaultText
//           style={{
//             color: '#999',
//             width: '100%',
//           }}
//         >
//           {action} • {getShortElapsedTime(time)}
//         </DefaultText>
//         <Flair flair={flair} />
//       </View>
//       <Flag
//         hitSlop={20}
//         onPress={onPress}
//         stroke={`${appTheme.secondaryColor}80`}
//         strokeWidth={2}
//         height={18}
//         width={18}
//         style={{
//           marginLeft: 10,
//         }}
//       />
//     </View>
//   );
// };
// 
// const FeedItemJoined = ({ fields }: { fields: JoinedFields }) => {
//   const { appTheme } = useAppTheme();
// 
//   const onPress = useNavigationToProfile(
//     fields.person_uuid,
//     fields.photo_blurhash,
//   );
// 
//   const { backgroundColor, onPressIn, onPressOut } = usePressableAnimation();
// 
//   return (
//     <Pressable
//       onPressIn={onPressIn}
//       onPressOut={onPressOut}
//       onPress={onPress}
//     >
//       <Animated.View style={[styles.cardBorders, appTheme.card, { backgroundColor }]}>
//         {fields.photo_uuid &&
//           <Avatar
//             percentage={fields.match_percentage}
//             personUuid={fields.person_uuid}
//             photoUuid={fields.photo_uuid}
//             photoBlurhash={fields.photo_blurhash}
//             doUseOnline={!!fields.photo_uuid}
//           />
//         }
//         <NameActionTime
//           personUuid={fields.person_uuid}
//           name={fields.name}
//           isVerified={fields.is_verified}
//           action="joined"
//           time={new Date(fields.time)}
//           doUseOnline={!fields.photo_uuid}
//           flair={fields.flair}
//         />
//       </Animated.View>
//     </Pressable>
//   );
// };
// 
// const FeedItemWasRecentlyOnline = ({
//   dataItem
// }: {
//   dataItem:
//     | DataItemWasRecentlyOnlineWithBio
//     | DataItemWasRecentlyOnlineWithPhoto
//     | DataItemWasRecentlyOnlineWithVoiceBio
// }) => {
//   switch (dataItem.type) {
//     case 'recently-online-with-bio':
//       return <FeedItemUpdatedBio fields={dataItem} action="recently online" />;
//     case 'recently-online-with-photo':
//       return <FeedItemAddedPhoto fields={dataItem} action="recently online" />;
//     case 'recently-online-with-voice-bio':
//       return <FeedItemAddedVoiceBio fields={dataItem} action="recently online" />;
//     default:
//       return assertNever(dataItem);
//   }
// };
// 
// const FeedItemAddedPhoto = ({
//   fields,
//   action = "added a photo",
// }: {
//   fields: AddedPhotoFields,
//   action?: Action,
// }) => {
//   const { appTheme } = useAppTheme();
// 
//   const onPress = useNavigationToProfile(
//     fields.person_uuid,
//     fields.photo_blurhash,
//   );
// 
//   const onPressPhoto = useNavigationToProfileGallery(fields.added_photo_uuid);
// 
//   const { backgroundColor, onPressIn, onPressOut } = usePressableAnimation();
// 
//   return (
//     <Pressable
//       onPressIn={onPressIn}
//       onPressOut={onPressOut}
//       onPress={onPress}
//     >
//       <Animated.View style={[styles.cardBorders, appTheme.card, { backgroundColor }]}>
//         {fields.photo_uuid &&
//           <Avatar
//             percentage={fields.match_percentage}
//             personUuid={fields.person_uuid}
//             photoUuid={fields.photo_uuid}
//             photoBlurhash={fields.photo_blurhash}
//             doUseOnline={!!fields.photo_uuid}
//           />
//         }
//         <View style={{ flex: 1, gap: NAME_ACTION_TIME_GAP_VERTICAL }}>
//           <NameActionTime
//             personUuid={fields.person_uuid}
//             name={fields.name}
//             isVerified={fields.is_verified}
//             action={action}
//             time={new Date(fields.time)}
//             doUseOnline={!fields.photo_uuid}
//             flair={fields.flair}
//           />
//           <EnlargeablePhoto
//             onPress={onPressPhoto}
//             photoUuid={fields.added_photo_uuid}
//             photoExtraExts={fields.added_photo_extra_exts}
//             photoBlurhash={fields.added_photo_blurhash}
//             isPrimary={true}
//             style={{
//               ...commonStyles.secondaryEnlargeablePhoto,
//               marginTop: 0,
//               marginBottom: 0,
//             }}
//           />
//         </View>
//       </Animated.View>
//     </Pressable>
//   );
// };
// 
// const FeedItemAddedVoiceBio = ({
//   fields,
//   action = "added a voice bio"
// }: {
//   fields: AddedVoiceBioFields
//   action?: Action
// }) => {
//   const { appTheme } = useAppTheme();
// 
//   const onPress = useNavigationToProfile(
//     fields.person_uuid,
//     fields.photo_blurhash,
//   );
// 
//   const { backgroundColor, onPressIn, onPressOut } = usePressableAnimation();
// 
//   return (
//     <Pressable
//       onPressIn={onPressIn}
//       onPressOut={onPressOut}
//       onPress={onPress}
//     >
//       <Animated.View style={[styles.cardBorders, appTheme.card, { backgroundColor }]}>
//         {fields.photo_uuid &&
//           <Avatar
//             percentage={fields.match_percentage}
//             personUuid={fields.person_uuid}
//             photoUuid={fields.photo_uuid}
//             photoBlurhash={fields.photo_blurhash}
//             doUseOnline={!!fields.photo_uuid}
//           />
//         }
//         <View style={{ flex: 1, gap: NAME_ACTION_TIME_GAP_VERTICAL }}>
//           <NameActionTime
//             personUuid={fields.person_uuid}
//             name={fields.name}
//             isVerified={fields.is_verified}
//             action={action}
//             time={new Date(fields.time)}
//             doUseOnline={!fields.photo_uuid}
//             flair={fields.flair}
//           />
//           <AudioPlayer
//             uuid={fields.added_audio_uuid}
//             presentation="feed"
//             style={{ marginTop: 0 }}
//           />
//         </View>
//       </Animated.View>
//     </Pressable>
//   );
// };
// 
// const FeedItemUpdatedBio = ({
//   fields,
//   action = "updated their bio"
// }: {
//   fields: UpdatedBioFields,
//   action?: Action,
// }) => {
//   const { appThemeName, appTheme } = useAppTheme();
// 
//   const onPress = useNavigationToProfile(
//     fields.person_uuid,
//     fields.photo_blurhash,
//   );
// 
//   const onPressReply = useNavigationToConversation(
//     fields.person_uuid,
//     fields.name,
//     fields.photo_uuid,
//     fields.photo_blurhash,
//     fields.added_text,
//   );
// 
//   const { backgroundColor, onPressIn, onPressOut } = usePressableAnimation();
// 
//   return (
//     <Pressable
//       onPressIn={onPressIn}
//       onPressOut={onPressOut}
//       onPress={onPress}
//     >
//       <Animated.View style={[styles.cardBorders, appTheme.card, { backgroundColor }]}>
//         {fields.photo_uuid &&
//           <Avatar
//             percentage={fields.match_percentage}
//             personUuid={fields.person_uuid}
//             photoUuid={fields.photo_uuid}
//             photoBlurhash={fields.photo_blurhash}
//             doUseOnline={!!fields.photo_uuid}
//           />
//         }
//         <View style={{ flex: 1, gap: isMobile() ? 8 : 10 }}>
//           <View style={{ flex: 1, gap: NAME_ACTION_TIME_GAP_VERTICAL }}>
//             <NameActionTime
//               personUuid={fields.person_uuid}
//               name={fields.name}
//               isVerified={fields.is_verified}
//               action={
//                 fields.added_text.trim()
//                   ? action
//                   : "erased their bio"
//               }
//               time={new Date(fields.time)}
//               doUseOnline={!fields.photo_uuid}
//               flair={fields.flair}
//               style={{
//                 paddingHorizontal: 10,
//               }}
//             />
//             <DefaultText
//               style={{
//                 backgroundColor:
//                   appThemeName === 'dark'
//                     ? capLuminance(fields.background_color)
//                     : fields.background_color,
//                 color: fields.body_color,
//                 borderRadius: 10,
//                 padding: 10,
//               }}
//             >
//               {fields.added_text}
//             </DefaultText>
//           </View>
//           <View style={{ alignItems: 'flex-end' }} >
//             <Pressable
//               style={{
//                 flexDirection: 'row',
//                 gap: 6,
//                 paddingRight: 5,
//               }}
//               hitSlop={20}
//               onPress={onPressReply}
//             >
//               <DefaultText style={{ fontWeight: 700 }}>
//                 Reply
//               </DefaultText>
//               <FontAwesomeIcon
//                 icon={faReply}
//                 size={16}
//                 color={appTheme.secondaryColor}
//                 style={{
//                   /* @ts-ignore */
//                   outline: 'none',
//                 }}
//               />
//             </Pressable>
//           </View>
//         </View>
//       </Animated.View>
//     </Pressable>
//   );
// };

const FeedItem = ({ dataItem }: { dataItem: DataItem }) => {
  const { isSkipped } = useSkipped(dataItem.person_uuid);

  if (isSkipped) {
    return <></>;
  }

  // TODO
  console.log(dataItem);
  return <></>;
};

const VisitorsTab = () => {
  const {
    onLayout,
    onContentSizeChange,
    onScroll,
    showsVerticalScrollIndicator,
    observeListRef,
  } = useScrollbar('visitors');

  const listRef = useRef<any>(undefined);

  const onPressRefresh = useCallback(() => {
    const refresh = listRef?.current?.refresh;
    refresh && refresh() && markVisitorsChecked();
  }, []);

  useFocusEffect(markVisitorsChecked);

  return (
    <SafeAreaView style={styles.safeAreaView}>
      <DuoliciousTopNavBar>
        {Platform.OS === 'web' &&
          <TopNavBarButton
            onPress={onPressRefresh}
            iconName="refresh"
            position="left"
            secondary={true}
            label="Refresh"
          />
        }
      </DuoliciousTopNavBar>
      <DefaultList
        ref={listRef}
        innerRef={observeListRef}
        emptyText={
          "Nobody’s visited yet. Try answering more Q&A or updating your profile."
        }
        errorText={"Something went wrong while fetching visitors\xa0😵‍💫"}
        endText={"That’s everyone who's visited for now"}
        fetchPage={fetchVisitors}
        contentContainerStyle={styles.listContentContainerStyle}
        renderItem={({ item }: { item: DataItem }) =>
          <FeedItem dataItem={item} />
        }
        keyExtractor={(item: DataItem) => item.person_uuid}
        onLayout={onLayout}
        onContentSizeChange={onContentSizeChange}
        onScroll={onScroll}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
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

import {
  View,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useCallback } from 'react';
import { DefaultText } from './default-text';
import { DuoliciousTopNavBar } from './top-nav-bar';
import { useScrollbar } from './navigation/scroll-bar-hooks';
import { Avatar } from './avatar';
import { getShortElapsedTime } from '../util/util';
import { Pressable } from 'react-native';
import { EnlargeableImage } from './enlargeable-image';
import { commonStyles } from '../styles';
import { useOnline } from '../chat/application-layer/hooks/online';
import { ONLINE_COLOR } from '../constants/constants';
import { VerificationBadge } from './verification-badge';
import { useNavigation } from '@react-navigation/native';
import { japi } from '../api/api';
import { DefaultFlatList } from './default-flat-list';
import { z } from 'zod';

const NAME_ACTION_TIME_GAP = 12;

const DataItemBaseSchema = z.object({
  time: z.string(),
  person_uuid: z.string(),
  name: z.string(),
  image_uuid: z.string().nullable(),
  image_blurhash: z.string().nullable(),
  is_verified: z.boolean(),
  match_percentage: z.number(),
});

const DataItemJoinedSchema = DataItemBaseSchema.extend({
  type: z.literal('joined'),
});

const DataItemAddedImageSchema = DataItemBaseSchema.extend({
  type: z.literal('added-image'),
  added_image_uuid: z.string(),
  added_image_blurhash: z.string(),
});

const DataItemUpdatedBioSchema = DataItemBaseSchema.extend({
  type: z.literal('updated-bio'),
  added_text: z.string(),
  background_color: z.string(),
  body_color: z.string(),
});

const DataItemSchema = z.discriminatedUnion('type', [
  DataItemJoinedSchema,
  DataItemAddedImageSchema,
  DataItemUpdatedBioSchema,
]);

type DataItem = z.infer<typeof DataItemSchema>;
type DataItemJoined = z.infer<typeof DataItemJoinedSchema>;
type DataItemUpdatedBio = z.infer<typeof DataItemUpdatedBioSchema>;
type DataItemAddedImage = z.infer<typeof DataItemAddedImageSchema>;

const isValidDataItem = (item: unknown): item is DataItem => {
  const result = DataItemSchema.safeParse(item);

  if (!result.success) {
    console.warn(result.error);
  }

  return result.success;
};

const fetchPage = async (pageNumber: number): Promise<DataItem[] | null> => {
  const resultsPerPage = 10;
  const offset = resultsPerPage * (pageNumber - 1);

  const response = await japi(
    'get',
    `/feed` +
    `?n=${resultsPerPage}` +
    `&o=${offset}`
  );

  if (!response.ok) {
    return null
  }

  if (!Array.isArray(response.json)) {
    return null;
  }

  return response.json.filter(isValidDataItem);
};

const useNavigationToProfile = (
  personUuid: string,
  imageBlurhash: string | null
) => {
  const navigation = useNavigation<any>();

  return useCallback(() => {
    navigation.navigate(
      'Prospect Profile Screen',
      {
        screen: 'Prospect Profile',
        params: { personUuid, imageBlurhash },
      }
    );
  }, [personUuid, imageBlurhash]);
};

const useNavigationToProfileGallery = (imageUuid) => {
  const navigation = useNavigation<any>();

  return useCallback(() => {
    navigation.navigate(
      'Prospect Profile Screen',
      {
        screen: 'Gallery Screen',
        params: { imageUuid },
      }
    );
  }, [imageUuid]);
};

const NameActionTime = ({
  personUuid,
  name,
  isVerified,
  action,
  time,
  style,
}: {
  personUuid: string
  name: string
  isVerified: boolean
  action: string
  time: Date
  style?: any
}) => {
  const isOnline = useOnline(personUuid);

  return (
    <View
      style={{
        width: '100%',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 2,
        ...style,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          gap: 5,
          alignItems: 'center',
        }}
      >
        {isOnline &&
          <View
            style={{
              height: 10,
              width: 10,
              borderRadius: 999,
              backgroundColor: ONLINE_COLOR,
            }}
          />
        }
        <DefaultText
          style={{
            fontWeight: '700',
            color: 'black',
          }}
        >
          {name}
        </DefaultText>
        {isVerified &&
          <VerificationBadge size={14} />
        }
      </View>
      <DefaultText
        style={{
          color: '#999',
        }}
      >
        {action} • {getShortElapsedTime(time)}
      </DefaultText>
    </View>
  );
};

const FeedItemJoined = ({ dataItem }: { dataItem: DataItemJoined }) => {
  const onPress = useNavigationToProfile(
    dataItem.person_uuid,
    dataItem.image_blurhash,
  );

  return (
    <Pressable
      onPress={onPress}
      style={{
        ...commonStyles.cardBorders,
        padding: 10,
      }}
    >
      <NameActionTime
        personUuid={dataItem.person_uuid}
        name={dataItem.name}
        isVerified={dataItem.is_verified}
        action="joined"
        time={new Date(dataItem.time)}
      />
    </Pressable>
  );
};

const FeedItemAddedImage = ({ dataItem }: { dataItem: DataItemAddedImage }) => {
  const onPress = useNavigationToProfile(
    dataItem.person_uuid,
    dataItem.image_blurhash,
  );

  const onPressImage = useNavigationToProfileGallery(dataItem.added_image_uuid);

  return (
    <Pressable
      onPress={onPress}
      style={{
        ...commonStyles.cardBorders,
        gap: NAME_ACTION_TIME_GAP,
        padding: 10,
      }}
    >
      <NameActionTime
        personUuid={dataItem.person_uuid}
        name={dataItem.name}
        isVerified={dataItem.is_verified}
        action="added a photo"
        time={new Date(dataItem.time)}
      />

      <EnlargeableImage
        onPress={onPressImage}
        imageUuid={dataItem.added_image_uuid}
        imageBlurhash={dataItem.added_image_blurhash}
        isPrimary={true}
        style={{
          ...commonStyles.secondaryEnlargeableImage,
          marginTop: 0,
          marginBottom: 0,
        }}
      />
    </Pressable>
  );
};

const FeedItemUpdatedBio = ({ dataItem }: { dataItem: DataItemUpdatedBio }) => {
  const onPress = useNavigationToProfile(
    dataItem.person_uuid,
    dataItem.image_blurhash,
  );

  return (
    <Pressable
      onPress={onPress}
      style={{
        ...commonStyles.cardBorders,
        flexDirection: 'row',
        gap: 6,
        padding: 10,
      }}
    >
      <Avatar
        percentage={dataItem.match_percentage}
        personUuid={dataItem.person_uuid}
        imageUuid={dataItem.image_uuid}
        imageBlurhash={dataItem.image_blurhash}
        doUseOnline={false}
      />
      <View style={{ flex: 1, gap: NAME_ACTION_TIME_GAP }}>
        <NameActionTime
          personUuid={dataItem.person_uuid}
          name={dataItem.name}
          isVerified={dataItem.is_verified}
          action="updated their bio"
          time={new Date(dataItem.time)}
          style={{
            paddingHorizontal: 10,
          }}
        />
        <DefaultText
          style={{
            backgroundColor: dataItem.background_color,
            color: dataItem.body_color,
            borderRadius: 10,
            padding: 10,
          }}
        >
          {dataItem.added_text}
        </DefaultText>
      </View>
    </Pressable>
  );
};

const FeedItem = ({ dataItem }: { dataItem: DataItem }) => {
  if (dataItem.type === 'joined') {
    return <FeedItemJoined dataItem={dataItem} />;
  } else if (dataItem.type === 'added-image') {
    return <FeedItemAddedImage dataItem={dataItem} />;
  } else if (dataItem.type === 'updated-bio') {
    return <FeedItemUpdatedBio dataItem={dataItem} />;
  } else {
    return <></>;
  }
};

const FeedTab = () => {
  const {
    onLayout,
    onContentSizeChange,
    onScroll,
    showsVerticalScrollIndicator,
    observeListRef,
  } = useScrollbar('traits');

  return (
    <SafeAreaView style={styles.safeAreaView}>
      <DuoliciousTopNavBar/>
      <DefaultFlatList
        innerRef={observeListRef}
        emptyText={
          "Your feed is empty right now. Check back later to see what " +
          "everyone’s doing 👀"
        }
        errorText="Something went wrong while fetching your feed"
        endText="You’re all caught up!"
        fetchPage={fetchPage}
        contentContainerStyle={{
          paddingTop: 10,
          paddingLeft: 10,
          paddingRight: 10,
          paddingBottom: 20,
          maxWidth: 600,
          width: '100%',
          alignSelf: 'center',
          gap: 20,
        }}
        renderItem={({ item }: { item: DataItem }) =>
          <FeedItem dataItem={item} />
        }
        onLayout={onLayout}
        onContentSizeChange={onContentSizeChange}
        onScroll={onScroll}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeAreaView: {
    flex: 1
  }
});

export {
  FeedTab,
};

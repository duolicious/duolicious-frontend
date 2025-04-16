import { useCallback } from 'react';
import { GestureResponderEvent, Pressable } from 'react-native';
import { ImageOrSkeleton } from './profile-card';
import { VerificationBadge } from './verification-badge';
import * as _ from 'lodash';
import { useNavigation } from '@react-navigation/native';

const EnlargeableImage = ({
  imageUuid,
  imageExtraExts,
  imageBlurhash,
  style,
  innerStyle,
  isPrimary,
  isVerified = false,
  onPress,
}: {
  imageUuid: string | undefined | null
  imageExtraExts?: string[] | undefined | null
  imageBlurhash: string | undefined | null
  style?: any
  innerStyle?: any
  isPrimary: boolean
  isVerified?: boolean
  onPress?: () => void
}) => {
  const navigation = useNavigation<any>();

  const internalOnPress = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();

    if (!navigation) {
      return;
    }

    if (onPress) {
      return onPress();
    }

    if (imageUuid) {
      return navigation.navigate('Gallery Screen', { imageUuid });
    }
  }, [imageUuid]);


  if (imageUuid === undefined && !isPrimary) {
    return <></>;
  }

  return (
    <Pressable
      disabled={!!imageExtraExts?.length || !imageUuid}
      onPress={internalOnPress}
      style={[
        {
          width: '100%',
          aspectRatio: 1,
        },
        style,
      ]}
    >
      <ImageOrSkeleton
        resolution={900}
        imageExtraExts={imageExtraExts}
        imageUuid={imageUuid}
        imageBlurhash={imageBlurhash}
        showGradient={false}
        style={innerStyle}
        forceExpoImage={true}
      />
      {isVerified &&
        <VerificationBadge
          style={{
            position: 'absolute',
            top: 18,
            right: 18,
          }}
          size={28}
        />
      }
    </Pressable>
  );
};

export {
  EnlargeableImage,
}

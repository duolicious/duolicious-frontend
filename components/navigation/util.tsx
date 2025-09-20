import {
  Animated,
  View,
} from 'react-native';
import { QAndADevice } from '../q-and-a-device';
import { Gold } from '../badges';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSignedInUser } from '../../events/signed-in-user';
import { isMobile } from '../../util/util';
import { useAppTheme } from '../../app-theme/app-theme';

const LabelToIcon = ({
  label,
  isFocused,
  unreadIndicatorOpacity,
  color = undefined,
  backgroundColor = undefined,
  fontSize = 20,
  unreadIndicatorColor = '#70f',
}: {
  label: string
  isFocused: boolean
  unreadIndicatorOpacity: any,
  color?: string
  backgroundColor?: string
  fontSize?: number
  unreadIndicatorColor?: string
}) => {
  const [signedInUser] = useSignedInUser();
  const { appTheme } = useAppTheme();

  const searchIcon =
    isFocused ? 'search' : 'search-outline';
  const inboxIcon =
    isFocused ? 'chatbubbles' : 'chatbubbles-outline';
  const feedIcon =
    isFocused ? 'planet' : 'planet-outline';
  const profileIcon =
    isFocused ? 'person' : 'person-outline';

  const height = fontSize + 2;

  const iconStyle = {
    fontSize: fontSize,
    color: color ?? appTheme.secondaryColor,
    height,
  };

  return (
    <>
      {label === 'Q&A' &&
        <QAndADevice
          color={color ?? appTheme.secondaryColor}
          height={height}
          isBold={isFocused}
          backgroundColor={backgroundColor ?? appTheme.primaryColor}
        />
      }
      {label === 'Search' &&
        <Ionicons style={{...iconStyle}} name={searchIcon}/>
      }
      {label === 'Feed' &&
        <Ionicons style={{...iconStyle}} name={feedIcon}/>
      }
      {label === 'Inbox' &&
        <View>
          <Ionicons style={{...iconStyle}} name={inboxIcon}/>
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              right: -13,
              height: 12,
              width: 12,
              backgroundColor: unreadIndicatorColor,
              borderRadius: 999,
              opacity: unreadIndicatorOpacity,
            }}
          />
        </View>
      }
      {label === 'Profile' &&
        <View>
          {!!signedInUser?.hasGold &&
            <Gold
              style={{
                position: 'absolute',
                top: -4,
                right: -14,
                backgroundColor: 'transparent',
              }}
              color={color}
              doAnimate={false}
              enableTooltip={!isMobile()}
            />
          }
          <Ionicons style={{...iconStyle}} name={profileIcon}/>
        </View>
      }
    </>
  );
};

export {
  LabelToIcon,
}

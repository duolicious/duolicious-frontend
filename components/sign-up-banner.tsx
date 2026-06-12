import { Pressable, View } from 'react-native';
import { DefaultText } from './default-text';
import { Logo16 } from './logo';
import { isMobile } from '../util/util';
import { useAppTheme } from '../app-theme/app-theme';
import { showSignUp } from './modal/sign-up-modal';
import { useNumActiveUsers } from './welcome-screen';

// Persuasive sign-up banner that hovers at the bottom of the page for logged-out
// web visitors. Rendered once at the app root (in App.tsx) so a single instance
// stays mounted across the browsable surfaces it spans - the Search tab and
// prospect profiles. The Duolicious logo and live member count sit on the left
// half, a "Join or sign in" button on the right half. Opens the sign-up modal.
const SignUpBanner = () => {
  const { appTheme } = useAppTheme();
  const numActiveUsers = useNumActiveUsers(undefined);

  return (
    <View
      style={{
        position: 'absolute',
        // Mobile web has a bottom tab bar (~50px); sit above it. Desktop web
        // uses the side bar, so a small bottom gap is enough.
        bottom: isMobile() ? 70 : 20,
        left: 0,
        right: 0,
        height: 100,
        alignItems: 'center',
        paddingHorizontal: 20,
        zIndex: 999,
      }}
      pointerEvents="box-none"
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          width: '100%',
          maxWidth: 900,
          height: '100%',
          backgroundColor: 'white',
          borderRadius: 15,
          borderWidth: 1,
          borderColor: 'black',
          paddingHorizontal: 20,
          gap: 14,
        }}
      >
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <Logo16 size={64} color="#70f" rectSize={0.3} />
          <View style={{ flexShrink: 1 }}>
            <DefaultText style={{ fontWeight: '900', fontSize: 20 }}>
              {numActiveUsers === undefined ? '\xa0' : numActiveUsers.toLocaleString()}
            </DefaultText>
            <DefaultText style={{ fontWeight: '600', fontSize: 14 }}>
              Active Members
            </DefaultText>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Pressable
            onPress={() => showSignUp(true)}
            style={{
              backgroundColor: appTheme.brandColor,
              borderRadius: 999,
              paddingVertical: 16,
              paddingHorizontal: 16,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: appTheme.secondaryColor,
            }}
          >
            <DefaultText
              style={{
                color: appTheme.primaryColor,
                fontWeight: '700',
                fontSize: 16,
                textAlign: 'center',
              }}
            >
              {`Join or\xa0sign\xa0in`}
            </DefaultText>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

export {
  SignUpBanner,
};

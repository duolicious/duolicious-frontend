import {
  ActivityIndicator,
  Animated,
  Platform,
  StatusBar,
  UIManager,
  View,
} from 'react-native';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  DefaultTheme,
  NavigationContainer,
  NavigationContainerRef,
} from '@react-navigation/native';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as Font from 'expo-font';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { TabBar } from './components/tab-bar';
import SearchTab from './components/search-tab';
import { QuizTab } from './components/quiz-tab';
import ProfileTab from './components/profile-tab';
import InboxTab from './components/inbox-tab';
import { TraitsTab } from './components/traits-tab';
import { ConversationScreen } from './components/conversation-screen';
import { UtilityScreen } from './components/utility-screen';
import { ProspectProfileScreen } from './components/prospect-profile-screen';
import { InviteScreen, WelcomeScreen } from './components/welcome-screen';
import { sessionToken, sessionPersonUuid } from './kv-storage/session-token';
import { japi, SUPPORTED_API_VERSIONS } from './api/api';
import { login, logout, Inbox, inboxStats } from './xmpp/xmpp';
import { STATUS_URL } from './env/env';
import { delay, parseUrl } from './util/util';
import { ReportModal } from './components/report-modal';
import { ImageCropper } from './components/image-cropper';
import { StreamErrorModal } from './components/stream-error-modal';
import { setNofications, useNotificationObserver } from './notifications/notifications';
import { navigationState } from './kv-storage/navigation-state';
import { listen, notify } from './events/events';
import { verificationWatcher } from './verification/verification';
import { ColorPickerModal } from './components/color-picker-modal/color-picker-modal';
import { ClubItem } from './components/club-selector';
import { Toast } from './components/toast';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DonationNagModal } from './components/donation-nag-modal';

// TODO: iOS UI testing
// TODO: Add the ability to reply to things (e.g. pictures, quiz responses) from people's profiles. You'll need to change the navigation to make it easier to reply to things. Consider breaking profiles into sections which can be replied to, each having one image or block of text. Letting people reply to specific things on the profile will improve intro quality.
// TODO: A profile prompts. e.g. "If I had three wishes, I'd wish for...", "My favourite move is..."

setNofications();
verificationWatcher();

SplashScreen.preventAutoHideAsync();

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const HomeTabs = () => {
  return (
    <Tab.Navigator
      backBehavior="history"
      screenOptions={{ headerShown: false }}
      tabBar={props => <TabBar {...props} />}
    >
      <Tab.Screen name="Q&A" component={QuizTab} />
      <Tab.Screen name="Search" component={SearchTab} />
      <Tab.Screen name="Inbox" component={InboxTab} />
      <Tab.Screen name="Traits" component={TraitsTab} />
      <Tab.Screen name="Profile" component={ProfileTab} />
    </Tab.Navigator>
  );
};

const WebSplashScreen = ({loading}) => {
  const [isFaded, setIsFaded] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!loading) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => setIsFaded(true));
    }
  }, [loading]);

  if (Platform.OS !== 'web' || isFaded) {
    return <></>;
  } else {
    return (
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          alignItems: 'center',
          flexDirection: 'column',
          justifyContent: 'space-around',
          backgroundColor: '#70f',
          opacity: opacity,
          zIndex: 999,
        }}
      >
        <ActivityIndicator size={60} color="white"/>
      </Animated.View>
    );
  }
};

type SignedInUser = {
  personId: number
  personUuid: string,
  units: 'Metric' | 'Imperial'
  sessionToken: string
  pendingClub: ClubItem | null
  doShowDonationNag: boolean
  estimatedEndDate: Date
  name: string | null
};

type ServerStatus = "ok" | "down for maintenance" | "please update";

let referrerId: string | undefined;
let setReferrerId: React.Dispatch<React.SetStateAction<typeof referrerId>>;

let signedInUser: SignedInUser | undefined;
let setSignedInUser: React.Dispatch<React.SetStateAction<typeof signedInUser>>;

const otpDestination = { value: '' };
const isImagePickerOpen = { value: false };

const App = () => {
  const [numUnreadTitle, setNumUnreadTitle] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [serverStatus, setServerStatus] = useState<ServerStatus>("ok");
  [signedInUser, setSignedInUser] = useState<SignedInUser | undefined>();
  [referrerId, setReferrerId] = useState<string | undefined>();
  const navigationContainerRef = useRef<any>();

  const loadFonts = useCallback(async () => {
    await Font.loadAsync({
      Trueno: require('./assets/fonts/TruenoRound.otf'),
      TruenoBold: require('./assets/fonts/TruenoRoundBd.otf'),

      MontserratBlack: require('./assets/fonts/montserrat/static/Montserrat-Black.ttf'),
      MontserratBold: require('./assets/fonts/montserrat/static/Montserrat-Bold.ttf'),
      MontserratExtraBold: require('./assets/fonts/montserrat/static/Montserrat-ExtraBold.ttf'),
      MontserratExtraLight: require('./assets/fonts/montserrat/static/Montserrat-ExtraLight.ttf'),
      MontserratLight: require('./assets/fonts/montserrat/static/Montserrat-Light.ttf'),
      MontserratMedium: require('./assets/fonts/montserrat/static/Montserrat-Medium.ttf'),
      MontserratRegular: require('./assets/fonts/montserrat/static/Montserrat-Regular.ttf'),
      MontserratSemiBold: require('./assets/fonts/montserrat/static/Montserrat-SemiBold.ttf'),
      MontserratThin: require('./assets/fonts/montserrat/static/Montserrat-Thin.ttf'),
    });
  }, []);

  const lockScreenOrientation = useCallback(async () => {
    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
      }
    } catch (e) {
      console.warn(e);
    }
  }, []);

  const fetchSignInState = useCallback(async () => {
    const existingSessionToken = await sessionToken();

    if (existingSessionToken === null) {
      await sessionPersonUuid(null);
      await sessionToken(null);
      setSignedInUser(undefined);
      logout();
      return;
    }

    if (typeof existingSessionToken !== 'string') {
      return;
    }

    const response = await japi('post', '/check-session-token');

    if (response.clientError || !response?.json?.onboarded) {
      await sessionPersonUuid(null);
      await sessionToken(null);
      setSignedInUser(undefined);
      logout();
      return;
    }

    const clubs: ClubItem[] = response?.json?.clubs;

    setSignedInUser({
      personId: response?.json?.person_id,
      personUuid: response?.json?.person_uuid,
      units: response?.json?.units === 'Imperial' ? 'Imperial' : 'Metric',
      sessionToken: existingSessionToken,
      pendingClub: response?.json?.pending_club,
      doShowDonationNag: response?.json?.do_show_donation_nag,
      estimatedEndDate: new Date(response?.json?.estimated_end_date),
      name: response?.json?.name,
    });

    await sessionPersonUuid(response?.json?.person_uuid);

    notify<ClubItem[]>('updated-clubs', clubs);
  }, []);

  const fetchServerStatusState = useCallback(async () => {
    let response: Response | null = null
    try {
      response = await fetch(STATUS_URL, {cache: 'no-cache'});
    } catch (e) {};

    if (response === null || !response.ok) {
      // If even the status server is down, things are *very* not-okay. But odds
      // are it can't be contacted because the user has a crappy internet
      // connection. The "You're offline" notice should still provide some
      // feedback.
      setServerStatus("ok");
      return;
    }

    const j: any = await response.json();
    const apiVersion = j.api_version;
    const reportedStatus = j.statuses[j.status_index];

    const latestServerStatus: ServerStatus = (() => {
      if (reportedStatus === "down for maintenance") {
        return reportedStatus;
      } else if (!SUPPORTED_API_VERSIONS.includes(apiVersion)) {
        return "please update";
      } else if (reportedStatus === "ok") {
        return reportedStatus;
      } else {
        return "down for maintenance";
      }
    })();

    if (serverStatus !== latestServerStatus) {
      setServerStatus(latestServerStatus);
    }
  }, [serverStatus]);

  const ensureLoggedIntoXmpp = async () => {
    const personUuid = (await sessionPersonUuid()) ?? signedInUser?.personUuid;
    const token = await sessionToken();

    if (!personUuid || !token) {
      return;
    }

    await login(personUuid, token);
  };

  const parseUrl_ = useCallback(async () => {
    const parsedUrl = await parseUrl();

    switch (parsedUrl?.left) {
      case 'me': {
        setReferrerId(parsedUrl.right);
        break;
      }

      case 'invite': {
        const navigationContainer = navigationContainerRef?.current;

        if (navigationContainer) {
          navigationContainerRef.current.navigate(
            'Invite Screen',
            { clubName: decodeURIComponent(parsedUrl.right) },
          );
        }
        break;
      }

      default: {
        break;
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      await Promise.all([
        loadFonts(),
        lockScreenOrientation(),
        fetchSignInState(),
        fetchServerStatusState(),
      ]);

      setIsLoading(false);
    })();
  }, []);

  useEffect(() => {
    ensureLoggedIntoXmpp()
  }, [signedInUser?.personUuid]);

  useEffect(() => {
    // Without this flag, an infinite loop will start each time this effect
    // starts, which would effectively be whenever the server's status changes.
    // That would lead to multiple infinite loops running concurrently.
    var doBreak = false;

    (async () => {
      while (true) {
        await delay(5000);
        await fetchServerStatusState();
        if (doBreak) break;
      }
    })();

    return () => { doBreak = true; };
  }, [fetchServerStatusState]);

  useEffect(() => {
    (async () => {

      if (!signedInUser?.personId || !signedInUser?.sessionToken) {
        logout();
        return;
      }

      const lastNavigationState = await navigationState();

      const navigationContainer = navigationContainerRef?.current;

      const pendingClub = signedInUser?.pendingClub;

      if (navigationContainer && pendingClub) {
        navigationContainer.navigate('Search');
      } else if (await parseUrl()) {
        ; // Don't restore last navigation state
      } else if (navigationContainer && lastNavigationState) {
        navigationContainer.reset(lastNavigationState);
      }
    })();
  }, [signedInUser?.personId, signedInUser?.sessionToken]);

  const onNavigationStateChange = useCallback(async (state) => {
    if (Platform.OS === 'web') {
      history.pushState((history?.state ?? 0) + 1, "", "#");
    }

    if (!state) return;

    const lastNavigationState = {...state, stale: true};

    if (signedInUser) {
      await navigationState(lastNavigationState);
    }
  }, [signedInUser]);

  const onChangeInbox = useCallback((inbox: Inbox | null) => {
    const stats = inbox ? inboxStats(inbox) : undefined;
    const num = stats?.numChats ?
      stats?.numUnreadChats :
      stats?.numUnreadIntros;

    setNumUnreadTitle(num ?? 0);
  }, [inboxStats, setNumUnreadTitle]);

  if (Platform.OS === 'web') {
    useEffect(() => {
      const handlePopstate = (ev) => {
        ev.preventDefault();

        const navigationContainer = navigationContainerRef?.current;

        if (navigationContainer) {
          navigationContainer.goBack();
        }
      };

      window.addEventListener('popstate', handlePopstate);
    }, []);

    useEffect(() => {
      return listen<Inbox | null>('inbox', onChangeInbox, true);
    }, [onChangeInbox]);
  }

  useNotificationObserver((notification: Notifications.Notification) => {
    if (!isLoading) {
      const navigationContainer = navigationContainerRef.current;

      const { screen, params } = notification.request.content.data;

      if (!navigationContainer) return;
      if (!screen) return;

      navigationContainer.navigate(screen, params);
    }
  }, [isLoading]);

  useEffect(() => {
    (async () => {
      if (!isLoading) {
        await parseUrl_();
        await SplashScreen.hideAsync();
      }
    })();
  }, [isLoading]);

  if (serverStatus !== "ok") {
    return <UtilityScreen serverStatus={serverStatus}/>
  }

  return (
    <SafeAreaProvider>
      {!isLoading &&
        <>
          <NavigationContainer
            ref={navigationContainerRef}
            onStateChange={onNavigationStateChange}
            theme={{
              ...DefaultTheme,
              colors: {
                ...DefaultTheme.colors,
                background: 'white',
              },
            }}
            documentTitle={{
              formatter: () =>
                (numUnreadTitle ? `(${numUnreadTitle}) ` : '') + 'Duolicious'
            }}
          >
            <StatusBar
              translucent={true}
              backgroundColor="transparent"
              barStyle="dark-content"
            />
            <Stack.Navigator
              screenOptions={{
                headerShown: false,
                presentation: 'card',
              }}
            >
              {
                referrerId !== undefined ? (
                  <Tab.Screen name="Traits Screen" component={TraitsTab} />
                ) : signedInUser ? (
                  <>
                    <Tab.Screen name="Home" component={HomeTabs} />
                    <Tab.Screen name="Conversation Screen" component={ConversationScreen} />
                    <Tab.Screen name="Prospect Profile Screen" component={ProspectProfileScreen} />
                    <Tab.Screen name="Invite Screen" component={InviteScreen} />
                  </>
                ) : (
                  <>
                    <Tab.Screen name="Welcome" component={WelcomeScreen} />
                    <Tab.Screen name="Invite Screen" component={InviteScreen} />
                  </>
                )
              }
            </Stack.Navigator>
          </NavigationContainer>
          <DonationNagModal/>
          <ReportModal/>
          <ImageCropper/>
          <ColorPickerModal/>
          <Toast/>
          <StreamErrorModal/>
        </>
      }
      <WebSplashScreen loading={isLoading}/>
    </SafeAreaProvider>
  );
};

export default App;
export {
  isImagePickerOpen,
  otpDestination,
  referrerId,
  setSignedInUser,
  signedInUser,
};

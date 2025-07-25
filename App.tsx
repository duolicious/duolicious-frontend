import {
  Animated,
  Platform,
  StatusBar,
  UIManager,
} from 'react-native';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  DefaultTheme,
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as Font from 'expo-font';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TabBar } from './components/navigation/tab-bar';
import { SearchTab } from './components/search-tab';
import { QuizTab } from './components/quiz-tab';
import { ProfileTab } from './components/profile-tab';
import { InboxTab } from './components/inbox-tab';
import { FeedTab } from './components/feed-tab';
import { ConversationScreen } from './components/conversation-screen/conversation-screen';
import { ServerStatus, UtilityScreen, useHasDonations } from './components/utility-screen';
import { ProspectProfileScreen } from './components/prospect-profile-screen';
import { InviteScreen, WelcomeScreen } from './components/welcome-screen';
import { sessionToken, sessionPersonUuid } from './kv-storage/session-token';
import { navigationState } from './kv-storage/navigation-state';
import { clearAllKv } from './kv-storage/kv-storage';
import { maybeDoUpgrade } from './kv-storage/upgrade';
import { japi, SUPPORTED_API_VERSIONS } from './api/api';
import { login, logout } from './chat/application-layer';
import { useInboxStats } from './chat/application-layer/hooks/inbox-stats';
import { STATUS_URL } from './env/env';
import { delay, parseUrl } from './util/util';
import { ColorPickerModal } from './components/modal/color-picker-modal/color-picker-modal';
import { DonationNagModal } from './components/modal/donation-nag-modal';
import { GifPickerModal } from './components/modal/gif-picker-modal';
import { ReportModal } from './components/modal/report-modal';
import { ImageCropper } from './components/image-cropper';
import {
  useNotificationObserverOnMobile,
  getLastNotificationResponseOnMobile,
} from './notifications/mobile';
import { getCurrentScreen, getCurrentParams } from './navigation/navigation';
import { verificationWatcher } from './verification/verification';
import { ClubItem } from './club/club';
import { Toast } from './components/toast';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createWebNavigator } from './components/navigation/web-navigator';
import { isMobile } from './util/util';
import { Logo16 } from './components/logo';
import { useScrollbarStyle } from './components/navigation/scroll-bar-hooks';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundary } from './components/error-boundary';
import { TooltipListener } from './components/tooltip';
import { VerificationCameraModal } from './components/verification-camera';
import { notify } from './events/events';

verificationWatcher();

SplashScreen.preventAutoHideAsync();

const Stack = createNativeStackNavigator();
const Tab = isMobile() ? createBottomTabNavigator() : createWebNavigator();

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
      screenOptions={{
        headerShown: false,
        animation: 'shift',
      }}
      tabBar={props => <TabBar {...props} />}
    >
      <Tab.Screen name="Q&A" component={QuizTab} />
      <Tab.Screen name="Search" component={SearchTab} />
      <Tab.Screen name="Feed" component={FeedTab} />
      <Tab.Screen name="Inbox" component={InboxTab} />
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
    return null;
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
        <Logo16 size={96} fadeOutDelay={0} fadeInDelay={0} doAnimate={true} />
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


let signedInUser: SignedInUser | undefined;
let setSignedInUser: React.Dispatch<React.SetStateAction<typeof signedInUser>>;

const otpDestination = { value: '' };
const isImagePickerOpen = { value: false };

const navigationContainerRef = createNavigationContainerRef<any>();

const App = () => {
  const [initialState, setInitialState] = useState<any>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [serverStatus, setServerStatus] = useState<ServerStatus>("ok");
  [signedInUser, setSignedInUser] = useState<SignedInUser | undefined>();
  const hasDonations = useHasDonations(signedInUser?.estimatedEndDate);

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

  const restoreSessionAndNavigate = useCallback(async () => {
    const existingPersonUuid = await sessionPersonUuid();
    const existingSessionToken = await sessionToken();
    const existingNavigationState = await navigationState();
    const parsedUrl = await parseUrl();
    const notification = await getLastNotificationResponseOnMobile();

    if (!parsedUrl) {
      ;
    } else if (parsedUrl.left === 'invite') {
      setInitialState({
        routes: [
          {
            name: "Invite Screen",
            params: {
              clubName: decodeURIComponent(parsedUrl.right),
            }
          }
        ]
      });
    }

    if (!existingPersonUuid || !existingSessionToken) {
      await sessionPersonUuid(null);
      await sessionToken(null);
      setSignedInUser(undefined);
      logout();

      if (!parsedUrl) {
        setInitialState({ routes: [ { name: 'Welcome' } ]});
      }

      return;
    }

    if (typeof existingSessionToken !== 'string') {
      return;
    }

    // Log into XMPP
    login(existingPersonUuid, existingSessionToken);

    const response = await japi(
      'post',
      '/check-session-token',
      undefined,
      { retryOnServerError: true }
    );

    if (response.clientError || response?.json?.onboarded === false) {
      await sessionPersonUuid(null);
      await sessionToken(null);
      setSignedInUser(undefined);
      logout();

      if (!parsedUrl) {
        setInitialState({ routes: [ { name: 'Welcome' } ]});
      }

      return;
    }

    const clubs: ClubItem[] = response?.json?.clubs;

    const personId = response?.json?.person_id as number;

    const personUuid = response?.json?.person_uuid as string;

    const pendingClub = response?.json?.pending_club as ClubItem | null;

    setSignedInUser({
      personId: personId,
      personUuid: personUuid,
      units: response?.json?.units === 'Imperial' ? 'Imperial' : 'Metric',
      sessionToken: existingSessionToken,
      pendingClub: pendingClub,
      doShowDonationNag: response?.json?.do_show_donation_nag,
      estimatedEndDate: new Date(response?.json?.estimated_end_date),
      name: response?.json?.name,
    });

    notify<ClubItem[]>('updated-clubs', clubs);

    if (parsedUrl?.left === 'profile') {
      setInitialState({
        index: 1,
        routes: [
          { name: "Home" },
          {
            name: "Prospect Profile Screen",
            state: {
              routes: [
                {
                  name: "Prospect Profile",
                  params: {
                    personUuid: decodeURIComponent(parsedUrl.right)
                  }
                }
              ]
            }
          }
        ]
      });
    } else if (parsedUrl) {
      // Navigation was already handled before logging in; Do nothing.
      ;
    } else if (notification) {
      setInitialState({
        index: 1,
        routes: [
          { name: "Home" },
          { name: notification.screen, params: notification.params },
        ]
      });
    } else if (pendingClub) {
      // Navigate to search
      setInitialState({
        routes: [
          {
            name: "Home",
            state: {
              routes: [
                {
                  name: "Search"
                }
              ]
            }
          }
        ]
      });
    } else if (existingNavigationState) {
      setInitialState(existingNavigationState);
    } else {
      setInitialState({ routes: [ { name: "Home" } ] });
    }
  }, []);

  const fetchServerStatusState = useCallback(async () => {
    let response: Response | null = null
    try {
      response = await fetch(STATUS_URL, {cache: 'no-cache'});
    } catch (_) {};

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

  const loadApp = useCallback(async () => {
    await maybeDoUpgrade();

    await Promise.all([
      loadFonts(),
      lockScreenOrientation(),
      restoreSessionAndNavigate(),
      fetchServerStatusState(),
    ]);

    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadApp();
  }, []);

  useEffect(() => {
    // Without this flag, an infinite loop will start each time this effect
    // starts, which would effectively be whenever the server's status changes.
    // That would lead to multiple infinite loops running concurrently.
    let doBreak = false;

    (async () => {
      while (true) {
        await delay(5000);
        await fetchServerStatusState();
        if (doBreak) break;
      }
    })();

    return () => { doBreak = true; };
  }, [fetchServerStatusState]);

  const onError = useCallback(async () => {
    await clearAllKv();

    loadApp();
  }, []);

  const onNavigationStateChange = useCallback(async (state) => {
    if (Platform.OS !== 'web') {
      ; // Only update the URL bar on web
    } else if (getCurrentScreen(state) === 'Prospect Profile Screen/Prospect Profile') {
      const uri = `/profile/${getCurrentParams(state).personUuid}`;
      history.pushState((history?.state ?? 0) + 1, "", uri);
    } else {
      const uri = "/#";
      history.pushState((history?.state ?? 0) + 1, "", uri);
    }

    if (!state) return;

    if (signedInUser) {
      await navigationState(state);
    }
  }, [signedInUser]);

  // Only need live updates on web (for browser tab title)
  const stats = useInboxStats(Platform.OS === 'web');

  const numUnreadTitle = stats?.numChats
    ? stats?.numUnreadChats
    : stats?.numUnreadIntros;

  if (Platform.OS === 'web') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      const handlePopstate = (ev) => {
        ev.preventDefault();

        const navigationContainer = navigationContainerRef.current;

        if (navigationContainer) {
          navigationContainer.goBack();
        }
      };

      window.addEventListener('popstate', handlePopstate);
    }, []);
  }

  useNotificationObserverOnMobile((screen: string, params: any) => {
    const navigationContainer = navigationContainerRef.current;

    if (!navigationContainer) return;
    if (!screen) return;

    navigationContainer.navigate(screen, params);
  });

  useEffect(() => {
    (async () => {
      if (!isLoading) {
        await SplashScreen.hideAsync();
      }
    })();
  }, [isLoading]);

  useScrollbarStyle();

  // I realize this is a verbose way to write it, but TypeScript's type
  // narrowing couldn't figure out the types were correct otherwise.
  if (serverStatus !== "ok") {
    return <UtilityScreen
      serverStatus={serverStatus}
      hasDonations={hasDonations}
    />
  } else if (hasDonations === false && Platform.OS === 'web') {
    return <UtilityScreen
      serverStatus={serverStatus}
      hasDonations={hasDonations}
    />
  }

  return (
    <ErrorBoundary onError={onError}>
      <SafeAreaProvider>
        <GestureHandlerRootView>
          {!isLoading && initialState !== undefined &&
            <NavigationContainer
              ref={navigationContainerRef}
              initialState={
                initialState ?
                { ...initialState, stale: true } :
                undefined
              }
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
                <Tab.Screen
                  name="Welcome"
                  component={WelcomeScreen} />
                <Tab.Screen
                  name="Home"
                  component={HomeTabs} />
                <Tab.Screen
                  name="Conversation Screen"
                  component={ConversationScreen} />
                <Tab.Screen
                  name="Prospect Profile Screen"
                  component={ProspectProfileScreen} />
                <Tab.Screen
                  name="Invite Screen"
                  component={InviteScreen} />
              </Stack.Navigator>
            </NavigationContainer>
          }
          <TooltipListener/>
          <DonationNagModal
            name={signedInUser?.name}
            estimatedEndDate={signedInUser?.estimatedEndDate}
            visible={signedInUser?.doShowDonationNag}
          />
          <ReportModal/>
          <ImageCropper/>
          <ColorPickerModal/>
          <GifPickerModal/>
          <Toast/>
          <VerificationCameraModal/>
        </GestureHandlerRootView>
        <WebSplashScreen loading={isLoading}/>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
};

export default App;
export {
  isImagePickerOpen,
  navigationContainerRef,
  otpDestination,
  setSignedInUser,
  signedInUser,
};

import { AppState, Platform } from 'react-native';
import { registerPushToken } from '../chat/application-layer';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useEffect } from 'react';
import { notifyOnWeb } from './web';

type MaybeToken = { token: string | null } | null;

const requestPermissionOnWeb = async (): Promise<MaybeToken> => {
  if (Platform.OS !== 'web') {
    return { token: null };
  }

  if (Notification.permission === 'granted') {
    return { token: null };
  }

  const permission = await Notification.requestPermission();

  if (permission !== 'granted') {
    console.warn('Permissions not granted');
    return { token: null };
  }

  notifyOnWeb(
    'Duolicious',
    'Here’s what a message will look like 💜',
    true
  );

  return { token: null };
};


const requestPermissionOnMobile = async (): Promise<MaybeToken> => {
  const { status } = await Notifications.getPermissionsAsync();
  const finalStatus =
    status === 'granted' ?
    status :
    (await Notifications.requestPermissionsAsync()).status;

  if (finalStatus !== 'granted') {
    console.error('Failed to get push token for push notification!');
    return null;
  }

  // The setNotificationChannelAsync must be called before
  // getDevicePushTokenAsync or getExpoPushTokenAsync to obtain a push token.
  //
  // SRC: https://docs.expo.dev/versions/latest/sdk/notifications/#permissions

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: AppState.currentState !== 'active',
      shouldShowList: AppState.currentState !== 'active',
      shouldPlaySound: AppState.currentState !== 'active',
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return { token: await getExpoPushToken() };
};


// Passing the rolled `devicePushToken` avoids getExpoPushTokenAsync calling
// getDevicePushTokenAsync internally, which would re-trigger the push token
// listener and risk an infinite loop.
const getExpoPushToken = async (
  devicePushToken?: Notifications.DevicePushToken,
): Promise<string> => {
  const projectId = Constants.expoConfig?.extra?.eas.projectId;
  const token = await Notifications.getExpoPushTokenAsync(
    devicePushToken ? { projectId, devicePushToken } : { projectId }
  );

  return token.data;
};


const getAndRegisterPushToken = async (): Promise<void> => {
  const maybeToken = Platform.OS === 'web'
    ? await requestPermissionOnWeb()
    : await requestPermissionOnMobile();

  if (!maybeToken) {
    return;
  }

  registerPushToken(maybeToken.token);
};


// The push notification service can roll a device's push token while the app is
// running, invalidating the old one. Re-register the fresh Expo push token with
// the backend as soon as that happens.
const usePushTokenListenerOnMobile = () => {
  if (Platform.OS === 'web') {
    return;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const subscription = Notifications.addPushTokenListener(
      async (devicePushToken) => {
        registerPushToken(await getExpoPushToken(devicePushToken));
      }
    );

    return () => subscription.remove();
  }, []);
};

export {
  getAndRegisterPushToken,
  usePushTokenListenerOnMobile,
};

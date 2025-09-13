import { useLayoutEffect, useState } from 'react';
import { listen, notify, lastEvent } from '../events/events';
import { appThemeName as kvAppThemeName } from '../kv-storage/app-theme';
import { useSignedInUser } from '../events/signed-in-user';

type AppThemeName = 'light' | 'dark';

type AppTheme = {
  primaryColor: string
  secondaryColor: string
  inputColor: string
  card: {
    borderTopColor: string
    borderLeftColor: string
    borderRightColor: string
    borderBottomColor: string
  },
  interactiveBorderColor: string
  quizCardColor: string
  quizCardBackgroundColor: string
  speechBubbleOtherUserBackgroundColor: string
  speechBubbleOtherUserColor: string
  brandColor: string
};

type AppThemes = Record<AppThemeName, AppTheme>;

// TODO: Can some more purple be added, maybe to feed items?
const APP_THEME: AppThemes = {
  light: {
    primaryColor: '#ffffff',
    secondaryColor: '#000000',
    inputColor: '#eeeeee',
    card: {
      borderTopColor: '#eeeeee',
      borderLeftColor: '#dddddd',
      borderRightColor: '#dddddd',
      borderBottomColor: '#dddddd',
    },
    interactiveBorderColor: '#dddddd',
    quizCardBackgroundColor: '#ffffff',
    quizCardColor: '#7700ff',
    speechBubbleOtherUserBackgroundColor: '#eeeeee',
    speechBubbleOtherUserColor: '#000000',
    brandColor: '#7700ff',
  },
  dark: {
    primaryColor: '#121214',
    secondaryColor: '#ffffff',
    inputColor: '#222327',
    card: {
      borderTopColor: '#555555',
      borderLeftColor: '#3c3c3c',
      borderRightColor: '#3c3c3c',
      borderBottomColor: '#3c3c3c',
    },
    interactiveBorderColor: '#524068',
    quizCardBackgroundColor: '#2c2c33',
    quizCardColor: '#000000',
    speechBubbleOtherUserBackgroundColor: '#333333',
    speechBubbleOtherUserColor: '#ffffff',
    brandColor: '#ffffff',
  }
};

const EVENT_KEY = 'updated-theme';

const setAppThemeName = (appThemeName: AppThemeName) => {
  notify<AppThemeName>(EVENT_KEY, appThemeName);
  kvAppThemeName(appThemeName);
};

// React hook for components to subscribe to changes
const useAppTheme = (): { appThemeName: AppThemeName, appTheme: AppTheme } => {
  const initialAppThemeName = lastEvent<AppThemeName>(EVENT_KEY) ?? 'light';

  const [appThemeName, setAppThemeName] = useState<AppThemeName>(
    initialAppThemeName
  );
  const [signedInUser] = useSignedInUser();

  useLayoutEffect(() => {
    return listen<AppThemeName>(
      EVENT_KEY,
      (v) => {
        if (v) {
          setAppThemeName(v);
        }
      }
    );
  }, []);

  if (!signedInUser || !signedInUser.hasGold) {
    return { appThemeName: 'light', appTheme: APP_THEME['light'] };
  } else {
    return { appThemeName, appTheme: APP_THEME[appThemeName] };
  }
};

const loadAppTheme = async () => {
  notify<AppThemeName>(EVENT_KEY, await kvAppThemeName());
};


export {
  AppTheme,
  AppThemeName,
  AppThemes,
  loadAppTheme,
  setAppThemeName,
  useAppTheme,
};

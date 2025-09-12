import { useLayoutEffect, useState } from 'react';
import { listen, notify, lastEvent } from '../events/events';
import { appThemeName as kvAppThemeName } from '../kv-storage/app-theme';
import { useSignedInUser } from '../events/signed-in-user';

type AppThemeName = 'light' | 'dark';

type AppTheme = {
  backgroundColor: string
  textColor: string
  secondaryTextColor: string
};

type AppThemes = Record<AppThemeName, AppTheme>;

const APP_THEME: AppThemes = {
  light: {
    backgroundColor: 'white',
    textColor: 'black',
    secondaryTextColor: '',
  },
  dark: {
    backgroundColor: 'black',
    textColor: 'white',
    secondaryTextColor: '',
  }
};

const EVENT_KEY = 'updated-theme';

const setAppThemeName = (appThemeName: AppThemeName) => {
  notify<AppThemeName>(EVENT_KEY, appThemeName);
  kvAppThemeName(appThemeName);
};

// React hook for components to subscribe to changes
const useAppTheme = (): [AppThemeName, AppTheme] => {
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
    return ['light', APP_THEME['light']] as const;
  } else {
    return [appThemeName, APP_THEME[appThemeName]] as const;
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

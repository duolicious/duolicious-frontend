import 'react-native-get-random-values';
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import Constants, { ExecutionEnvironment } from "expo-constants";

// TODO: I think this should only be initialized once

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const API_KEYS = {
  apple: 'appl_kZWpuQifTvzoMWXaHawKZLSyEIf',
  google: 'goog_QNjAZZCsYwDXpCKuefskbAPUyje',
  web: 'rcb_MXlKZzQKIINGfBiYlObkCLZXxzrH',
};

const configurePurchases = async () => {
  Purchases.setDebugLogsEnabled(isExpoGo);

  if (isExpoGo) {
    await Purchases.configure({ apiKey: API_KEYS.web });
  } else if (Platform.OS === 'android') {
    await Purchases.configure({ apiKey: API_KEYS.google });
  } else if (Platform.OS ==='ios')  {
    await Purchases.configure({ apiKey: API_KEYS.apple });
  } else if (Platform.OS === 'web') {
    await Purchases.configure({ apiKey: API_KEYS.web });
  }
};

export {
  configurePurchases,
};

import { Platform } from 'react-native';

import { APP_RUNTIME, getEnvBoolean, getEnvCsv, getEnvString } from './appRuntime';

export type AdRequestOptions = {
  requestNonPersonalizedAdsOnly?: boolean;
  keywords?: string[];
};

export type AdUnitKey = 'INTERSTITIAL' | 'BANNER' | 'REWARDED' | 'APP_OPEN';

const DEFAULT_KEYWORDS = [
  'health',
  'food analysis',
  'nutrition',
  'barcode scanner',
  'wellness',
  'shopping',
  'market',
  'product',
];

const TEST_IDS = Object.freeze({
  INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
  BANNER: 'ca-app-pub-3940256099942544/6300978111',
  REWARDED: 'ca-app-pub-3940256099942544/5224354917',
  APP_OPEN: 'ca-app-pub-3940256099942544/9257395921',
});

const REAL_AD_UNITS = Object.freeze({
  INTERSTITIAL: Object.freeze({
    android: getEnvString(
      'EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID',
      'ca-app-pub-9503865696579023/2717914905'
    ),
    ios: getEnvString(
      'EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS',
      TEST_IDS.INTERSTITIAL
    ),
  }),
  BANNER: Object.freeze({
    android: getEnvString(
      'EXPO_PUBLIC_ADMOB_BANNER_ANDROID',
      'ca-app-pub-9503865696579023/5814530735'
    ),
    ios: getEnvString(
      'EXPO_PUBLIC_ADMOB_BANNER_IOS',
      TEST_IDS.BANNER
    ),
  }),
  REWARDED: Object.freeze({
    android: getEnvString(
      'EXPO_PUBLIC_ADMOB_REWARDED_ANDROID',
      'ca-app-pub-9503865696579023/7004190022'
    ),
    ios: getEnvString(
      'EXPO_PUBLIC_ADMOB_REWARDED_IOS',
      TEST_IDS.REWARDED
    ),
  }),
  APP_OPEN: Object.freeze({
    android: getEnvString(
      'EXPO_PUBLIC_ADMOB_APP_OPEN_ANDROID',
      'ca-app-pub-9503865696579023/7491631372'
    ),
    ios: getEnvString(
      'EXPO_PUBLIC_ADMOB_APP_OPEN_IOS',
      TEST_IDS.APP_OPEN
    ),
  }),
});

const ADMOB_APP_IDS = Object.freeze({
  android: getEnvString(
    'EXPO_PUBLIC_ADMOB_APP_ID_ANDROID',
    'ca-app-pub-9503865696579023~4685281890'
  ),
  ios: getEnvString('EXPO_PUBLIC_ADMOB_APP_ID_IOS', ''),
});

const adsEnabled = getEnvBoolean('EXPO_PUBLIC_ADS_ENABLED', true);
const useTestIds = getEnvBoolean(
  'EXPO_PUBLIC_ADS_USE_TEST_IDS',
  APP_RUNTIME.isDevelopment
);

const requestNonPersonalizedAdsOnly = getEnvBoolean(
  'EXPO_PUBLIC_ADS_NPA_ONLY',
  true
);

const keywords = getEnvCsv('EXPO_PUBLIC_ADS_KEYWORDS', DEFAULT_KEYWORDS);

export const ADMOB_RUNTIME = Object.freeze({
  enabled: adsEnabled,
  useTestIds,
  appIds: ADMOB_APP_IDS,
  testIds: TEST_IDS,
  realUnits: REAL_AD_UNITS,
  requestOptions: Object.freeze({
    requestNonPersonalizedAdsOnly,
    keywords,
  } satisfies AdRequestOptions),
});

export function resolveAdUnitId(type: AdUnitKey): string {
  if (!ADMOB_RUNTIME.enabled || ADMOB_RUNTIME.useTestIds) {
    return ADMOB_RUNTIME.testIds[type];
  }

  return (
    Platform.select({
      android: ADMOB_RUNTIME.realUnits[type].android,
      ios: ADMOB_RUNTIME.realUnits[type].ios,
      default: ADMOB_RUNTIME.testIds[type],
    }) ?? ADMOB_RUNTIME.testIds[type]
  );
}

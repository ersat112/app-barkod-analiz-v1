import { Platform } from 'react-native';

type RequestOptions = {
  requestNonPersonalizedAdsOnly?: boolean;
  keywords?: string[];
};

const TEST_IDS = {
  INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
  BANNER: 'ca-app-pub-3940256099942544/6300978111',
  REWARDED: 'ca-app-pub-3940256099942544/5224354917',
} as const;

/**
 * Elimizde şu an sadece Android gerçek reklam kimlikleri var.
 * iOS ve Rewarded için gerçek kimlik gelene kadar test ID kullanıyoruz.
 */
const REAL_AD_UNITS = {
  INTERSTITIAL: {
    android: 'ca-app-pub-9503865696579023/3089173355',
    ios: TEST_IDS.INTERSTITIAL,
  },
  BANNER: {
    android: 'ca-app-pub-9503865696579023/3580127941',
    ios: TEST_IDS.BANNER,
  },
  REWARDED: {
    android: TEST_IDS.REWARDED,
    ios: TEST_IDS.REWARDED,
  },
} as const;

const isDev = __DEV__;

const getAdUnit = (
  type: keyof typeof REAL_AD_UNITS,
  testId: string
): string => {
  if (isDev) {
    return testId;
  }

  return Platform.select({
    android: REAL_AD_UNITS[type].android,
    ios: REAL_AD_UNITS[type].ios,
    default: testId,
  }) as string;
};

export const AD_UNIT_ID = {
  INTERSTITIAL: getAdUnit('INTERSTITIAL', TEST_IDS.INTERSTITIAL),
  BANNER: getAdUnit('BANNER', TEST_IDS.BANNER),
  REWARDED: getAdUnit('REWARDED', TEST_IDS.REWARDED),
} as const;

export const GLOBAL_AD_CONFIG: RequestOptions = {
  requestNonPersonalizedAdsOnly: true,
  keywords: [
    'health',
    'food analysis',
    'nutrition',
    'barcode scanner',
    'wellness',
    'shopping',
    'market',
    'product'
  ],
};

export enum AdUnitType {
  SCAN_INTERSTITIAL = 'SCAN_INTERSTITIAL',
  HISTORY_BANNER = 'HISTORY_BANNER',
}
import { Platform } from 'react-native';

import { ADMOB_RUNTIME } from '../config/adRuntime';
import { APP_RUNTIME } from '../config/appRuntime';

type AdMobModuleType = typeof import('react-native-google-mobile-ads');

let cachedModule: AdMobModuleType | null = null;
let cachedReason: string | null = null;
let initStarted = false;
let initCompleted = false;

const loadModule = (): AdMobModuleType | null => {
  if (!ADMOB_RUNTIME.enabled) {
    cachedReason = 'Ads runtime disabled.';
    return null;
  }

  if (APP_RUNTIME.isExpoGo) {
    cachedReason =
      'Expo Go does not support react-native-google-mobile-ads. Use a dev build or release build.';
    return null;
  }

  if (cachedModule) {
    return cachedModule;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-google-mobile-ads') as AdMobModuleType;

    if (!mod) {
      cachedReason = 'react-native-google-mobile-ads module is empty.';
      return null;
    }

    cachedModule = mod;
    cachedReason = null;
    return cachedModule;
  } catch (error: unknown) {
    cachedReason =
      error instanceof Error
        ? error.message
        : 'react-native-google-mobile-ads could not be loaded.';
    return null;
  }
};

export const isAdMobAvailable = (): boolean => {
  return Boolean(loadModule());
};

export const getAdMobUnavailableReason = (): string => {
  if (cachedReason) {
    return cachedReason;
  }

  if (!ADMOB_RUNTIME.enabled) {
    return 'Ads runtime disabled.';
  }

  if (APP_RUNTIME.isExpoGo) {
    return 'Expo Go does not support native ads module.';
  }

  return 'Unknown reason.';
};

export const getAdMobModule = () => {
  const mod = loadModule();

  if (!mod) {
    return null;
  }

  const {
    AppOpenAd,
    BannerAd,
    BannerAdSize,
    InterstitialAd,
    RewardedAd,
    RewardedAdEventType,
    AdEventType,
    TestIds,
    default: mobileAds,
  } = mod;

  return {
    AppOpenAd,
    BannerAd,
    BannerAdSize,
    InterstitialAd,
    RewardedAd,
    RewardedAdEventType,
    AdEventType,
    TestIds,
    mobileAds,
  };
};

export const initializeAdMob = async (): Promise<boolean> => {
  if (initCompleted) {
    return true;
  }

  if (initStarted) {
    return initCompleted;
  }

  const mod = getAdMobModule();

  if (!mod?.mobileAds) {
    console.log(
      '[AdMobRuntime] initialize skipped:',
      getAdMobUnavailableReason()
    );
    return false;
  }

  try {
    initStarted = true;

    console.log('[AdMobRuntime] module check started');

    const adapterStatuses = await mod.mobileAds().initialize();

    initCompleted = true;

    console.log('[AdMobRuntime] initialized:', adapterStatuses);
    return true;
  } catch (error) {
    console.log('[AdMobRuntime] initialize failed:', error);
    initCompleted = false;
    return false;
  }
};

export const getAdMobRuntimeState = () => {
  return {
    enabled: ADMOB_RUNTIME.enabled,
    useTestIds: ADMOB_RUNTIME.useTestIds,
    platform: Platform.OS,
    appEnvironment: APP_RUNTIME.appEnvironment,
    expoGo: APP_RUNTIME.isExpoGo,
    available: isAdMobAvailable(),
    reason: getAdMobUnavailableReason(),
    initStarted,
    initCompleted,
    hasAndroidAppId: Boolean(ADMOB_RUNTIME.appIds.android),
    hasIosAppId: Boolean(ADMOB_RUNTIME.appIds.ios),
  };
};

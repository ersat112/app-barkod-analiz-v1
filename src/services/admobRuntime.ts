import { Platform } from 'react-native';

type AdMobModuleType = typeof import('react-native-google-mobile-ads');

let cachedModule: AdMobModuleType | null = null;
let cachedReason: string | null = null;
let initStarted = false;
let initCompleted = false;

const ADS_RUNTIME_ENABLED = true;

const isExpoGo = (): boolean => {
  try {
    // expo-constants varsa kullan
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const constants = require('expo-constants').default;
    return constants?.executionEnvironment === 'storeClient';
  } catch {
    return false;
  }
};

const loadModule = (): AdMobModuleType | null => {
  if (!ADS_RUNTIME_ENABLED) {
    cachedReason = 'Ads runtime disabled.';
    return null;
  }

  if (isExpoGo()) {
    cachedReason =
      'Expo Go does not support react-native-google-mobile-ads. Use a dev build or release build.';
    return null;
  }

  if (cachedModule) {
    return cachedModule;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-google-mobile-ads') as AdMobModuleType;

    if (!mod) {
      cachedReason = 'react-native-google-mobile-ads module is empty.';
      return null;
    }

    cachedModule = mod;
    cachedReason = null;
    return cachedModule;
  } catch (error: any) {
    cachedReason =
      error?.message || 'react-native-google-mobile-ads could not be loaded.';
    return null;
  }
};

export const isAdMobAvailable = (): boolean => {
  return !!loadModule();
};

export const getAdMobUnavailableReason = (): string => {
  if (cachedReason) return cachedReason;
  if (!ADS_RUNTIME_ENABLED) return 'Ads runtime disabled.';
  if (isExpoGo()) return 'Expo Go does not support native ads module.';
  return 'Unknown reason.';
};

export const getAdMobModule = () => {
  const mod = loadModule();

  if (!mod) {
    return null;
  }

  const {
    BannerAd,
    BannerAdSize,
    InterstitialAd,
    RewardedAd,
    AdEventType,
    TestIds,
    default: mobileAds,
  } = mod;

  return {
    BannerAd,
    BannerAdSize,
    InterstitialAd,
    RewardedAd,
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
    enabled: ADS_RUNTIME_ENABLED,
    platform: Platform.OS,
    expoGo: isExpoGo(),
    available: isAdMobAvailable(),
    reason: getAdMobUnavailableReason(),
    initStarted,
    initCompleted,
  };
};
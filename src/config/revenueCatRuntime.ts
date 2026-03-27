import { APP_RUNTIME, getEnvString, hasEnvOverride } from './appRuntime';

export type RevenueCatRuntimeSource = 'env_override' | 'fallback';
export type RevenueCatRuntimePlatform = 'ios' | 'android' | 'web';

export type RevenueCatRuntimeDiagnosticsSnapshot = {
  fetchedAt: string;
  source: RevenueCatRuntimeSource;
  platform: RevenueCatRuntimePlatform;
  isExpoGo: boolean;
  supportsNativePurchases: boolean;
  iosApiKeyPresent: boolean;
  androidApiKeyPresent: boolean;
  activePlatformApiKeyPresent: boolean;
  entitlementIdentifier: string;
  offeringIdentifier: string;
  isReady: boolean;
  missingKeys: string[];
};

const FALLBACK_REVENUECAT_CONFIG = Object.freeze({
  iosApiKey: '',
  androidApiKey: '',
  entitlementIdentifier: 'premium',
  offeringIdentifier: 'default',
});

const hasRuntimeOverrides = [
  'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY',
  'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY',
  'EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID',
  'EXPO_PUBLIC_REVENUECAT_OFFERING_ID',
].some((key) => hasEnvOverride(key));

const platform: RevenueCatRuntimePlatform =
  APP_RUNTIME.platform === 'ios' || APP_RUNTIME.platform === 'android'
    ? APP_RUNTIME.platform
    : 'web';

const iosApiKey = getEnvString(
  'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY',
  FALLBACK_REVENUECAT_CONFIG.iosApiKey
).trim();

const androidApiKey = getEnvString(
  'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY',
  FALLBACK_REVENUECAT_CONFIG.androidApiKey
).trim();

const entitlementIdentifier = getEnvString(
  'EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID',
  FALLBACK_REVENUECAT_CONFIG.entitlementIdentifier
).trim();

const offeringIdentifier = getEnvString(
  'EXPO_PUBLIC_REVENUECAT_OFFERING_ID',
  FALLBACK_REVENUECAT_CONFIG.offeringIdentifier
).trim();

const activePlatformApiKey =
  platform === 'ios'
    ? iosApiKey
    : platform === 'android'
      ? androidApiKey
      : '';

const missingKeys: string[] = [];

if (platform === 'ios' && !iosApiKey) {
  missingKeys.push('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY');
}

if (platform === 'android' && !androidApiKey) {
  missingKeys.push('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY');
}

if (!entitlementIdentifier) {
  missingKeys.push('EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID');
}

if (!offeringIdentifier) {
  missingKeys.push('EXPO_PUBLIC_REVENUECAT_OFFERING_ID');
}

export const REVENUECAT_RUNTIME = Object.freeze({
  source: (hasRuntimeOverrides ? 'env_override' : 'fallback') as RevenueCatRuntimeSource,
  platform,
  isExpoGo: APP_RUNTIME.isExpoGo,
  supportsNativePurchases: APP_RUNTIME.isNativeBuild && platform !== 'web',
  iosApiKey,
  androidApiKey,
  activePlatformApiKey,
  entitlementIdentifier,
  offeringIdentifier,
  isReady:
    platform !== 'web' &&
    Boolean(activePlatformApiKey) &&
    Boolean(entitlementIdentifier) &&
    Boolean(offeringIdentifier),
  missingKeys,
});

export function getRevenueCatRuntimeDiagnosticsSnapshot(): RevenueCatRuntimeDiagnosticsSnapshot {
  return {
    fetchedAt: new Date().toISOString(),
    source: REVENUECAT_RUNTIME.source,
    platform: REVENUECAT_RUNTIME.platform,
    isExpoGo: REVENUECAT_RUNTIME.isExpoGo,
    supportsNativePurchases: REVENUECAT_RUNTIME.supportsNativePurchases,
    iosApiKeyPresent: Boolean(REVENUECAT_RUNTIME.iosApiKey),
    androidApiKeyPresent: Boolean(REVENUECAT_RUNTIME.androidApiKey),
    activePlatformApiKeyPresent: Boolean(REVENUECAT_RUNTIME.activePlatformApiKey),
    entitlementIdentifier: REVENUECAT_RUNTIME.entitlementIdentifier,
    offeringIdentifier: REVENUECAT_RUNTIME.offeringIdentifier,
    isReady: REVENUECAT_RUNTIME.isReady,
    missingKeys: [...REVENUECAT_RUNTIME.missingKeys],
  };
}

import { Platform } from 'react-native';

import { APP_RUNTIME, getEnvString } from './appRuntime';

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

function normalizePlatform(value: string): RevenueCatRuntimePlatform {
  if (value === 'ios' || value === 'android') {
    return value;
  }

  return 'web';
}

const FALLBACK_REVENUECAT_CONFIG = Object.freeze({
  iosApiKey: '',
  androidApiKey: '',
  entitlementIdentifier: 'premium',
  offeringIdentifier: 'default',
});

const runtimeConfig = Object.freeze({
  iosApiKey: getEnvString(
    'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY',
    FALLBACK_REVENUECAT_CONFIG.iosApiKey
  ).trim(),
  androidApiKey: getEnvString(
    'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY',
    FALLBACK_REVENUECAT_CONFIG.androidApiKey
  ).trim(),
  entitlementIdentifier: getEnvString(
    'EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID',
    FALLBACK_REVENUECAT_CONFIG.entitlementIdentifier
  ).trim(),
  offeringIdentifier: getEnvString(
    'EXPO_PUBLIC_REVENUECAT_OFFERING_ID',
    FALLBACK_REVENUECAT_CONFIG.offeringIdentifier
  ).trim(),
});

const hasRuntimeOverrides = [
  'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY',
  'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY',
  'EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID',
  'EXPO_PUBLIC_REVENUECAT_OFFERING_ID',
].some((key) => Boolean(process.env[key]?.trim()));

const platform = normalizePlatform(Platform.OS);

const activePlatformApiKey =
  platform === 'ios'
    ? runtimeConfig.iosApiKey
    : platform === 'android'
      ? runtimeConfig.androidApiKey
      : '';

const missingKeys: string[] = [];

if (platform === 'ios' && !runtimeConfig.iosApiKey) {
  missingKeys.push('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY');
}

if (platform === 'android' && !runtimeConfig.androidApiKey) {
  missingKeys.push('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY');
}

if (!runtimeConfig.entitlementIdentifier) {
  missingKeys.push('EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID');
}

if (!runtimeConfig.offeringIdentifier) {
  missingKeys.push('EXPO_PUBLIC_REVENUECAT_OFFERING_ID');
}

const source: RevenueCatRuntimeSource = hasRuntimeOverrides
  ? 'env_override'
  : 'fallback';

const isReady =
  platform !== 'web' &&
  Boolean(activePlatformApiKey) &&
  Boolean(runtimeConfig.entitlementIdentifier) &&
  Boolean(runtimeConfig.offeringIdentifier);

export const REVENUECAT_RUNTIME = Object.freeze({
  source,
  platform,
  isExpoGo: APP_RUNTIME.isExpoGo,
  supportsNativePurchases: APP_RUNTIME.isNativeBuild && platform !== 'web',
  iosApiKey: runtimeConfig.iosApiKey,
  androidApiKey: runtimeConfig.androidApiKey,
  activePlatformApiKey,
  entitlementIdentifier: runtimeConfig.entitlementIdentifier,
  offeringIdentifier: runtimeConfig.offeringIdentifier,
  isReady,
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
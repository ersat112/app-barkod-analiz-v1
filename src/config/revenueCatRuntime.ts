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

const FALLBACK_REVENUECAT_CONFIG = Object.freeze({
  iosApiKey: '',
  androidApiKey: '',
  entitlementIdentifier: '',
  offeringIdentifier: '',
});

const ENV = process.env as Record<string, string | undefined>;

const RUNTIME_ENV_KEYS = [
  'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY',
  'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY',
  'EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID',
  'EXPO_PUBLIC_REVENUECAT_OFFERING_ID',
] as const;

function hasRuntimeOverride(key: (typeof RUNTIME_ENV_KEYS)[number]): boolean {
  return typeof ENV[key] === 'string' && ENV[key]!.trim().length > 0;
}

const hasRuntimeOverrides = RUNTIME_ENV_KEYS.some((key) => hasRuntimeOverride(key));

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

const supportsNativePurchases =
  APP_RUNTIME.isNativeBuild && (platform === 'ios' || platform === 'android');

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

if (platform !== 'web' && !entitlementIdentifier) {
  missingKeys.push('EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID');
}

if (platform !== 'web' && !offeringIdentifier) {
  missingKeys.push('EXPO_PUBLIC_REVENUECAT_OFFERING_ID');
}

const isReady =
  supportsNativePurchases &&
  Boolean(activePlatformApiKey) &&
  Boolean(entitlementIdentifier) &&
  Boolean(offeringIdentifier);

export const REVENUECAT_RUNTIME = Object.freeze({
  source: (hasRuntimeOverrides ? 'env_override' : 'fallback') as RevenueCatRuntimeSource,
  platform,
  isExpoGo: APP_RUNTIME.isExpoGo,
  supportsNativePurchases,
  iosApiKey,
  androidApiKey,
  activePlatformApiKey,
  entitlementIdentifier,
  offeringIdentifier,
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
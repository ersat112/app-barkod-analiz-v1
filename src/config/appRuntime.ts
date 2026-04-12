import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type AppEnvironment = 'development' | 'preview' | 'production';

type RuntimeSource = 'fallback' | 'env_override';

const EXPO_EXTRA = Object.freeze(
  ((Constants.expoConfig?.extra ??
    (Constants as typeof Constants & {
      manifest2?: {
        extra?: Record<string, unknown>;
      };
    }).manifest2?.extra ??
    {}) as Record<string, unknown>)
);

const EXPO_PUBLIC_ENV = Object.freeze({
  EXPO_PUBLIC_ADMOB_APP_ID_ANDROID: process.env.EXPO_PUBLIC_ADMOB_APP_ID_ANDROID,
  EXPO_PUBLIC_ADMOB_APP_ID_IOS: process.env.EXPO_PUBLIC_ADMOB_APP_ID_IOS,
  EXPO_PUBLIC_ADMOB_APP_OPEN_ANDROID: process.env.EXPO_PUBLIC_ADMOB_APP_OPEN_ANDROID,
  EXPO_PUBLIC_ADMOB_APP_OPEN_IOS: process.env.EXPO_PUBLIC_ADMOB_APP_OPEN_IOS,
  EXPO_PUBLIC_ADMOB_BANNER_ANDROID: process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID,
  EXPO_PUBLIC_ADMOB_BANNER_IOS: process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS,
  EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID:
    process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID,
  EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS:
    process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS,
  EXPO_PUBLIC_ADMOB_DETAILSCREEN_REWARDED_INTERSTITIAL_ANDROID:
    process.env.EXPO_PUBLIC_ADMOB_DETAILSCREEN_REWARDED_INTERSTITIAL_ANDROID,
  EXPO_PUBLIC_ADMOB_DETAILSCREEN_REWARDED_INTERSTITIAL_IOS:
    process.env.EXPO_PUBLIC_ADMOB_DETAILSCREEN_REWARDED_INTERSTITIAL_IOS,
  EXPO_PUBLIC_ADMOB_REWARDED_ANDROID: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID,
  EXPO_PUBLIC_ADMOB_REWARDED_IOS: process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS,
  EXPO_PUBLIC_ADS_ENABLED: process.env.EXPO_PUBLIC_ADS_ENABLED,
  EXPO_PUBLIC_ADS_KEYWORDS: process.env.EXPO_PUBLIC_ADS_KEYWORDS,
  EXPO_PUBLIC_ADS_NPA_ONLY: process.env.EXPO_PUBLIC_ADS_NPA_ONLY,
  EXPO_PUBLIC_ADS_USE_TEST_IDS: process.env.EXPO_PUBLIC_ADS_USE_TEST_IDS,
  EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_AUTH_EMAIL_CONTINUE_URL:
    process.env.EXPO_PUBLIC_AUTH_EMAIL_CONTINUE_URL,
  EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  EXPO_PUBLIC_FIRESTORE_MISSING_PRODUCT_WRITES_ENABLED:
    process.env.EXPO_PUBLIC_FIRESTORE_MISSING_PRODUCT_WRITES_ENABLED,
  EXPO_PUBLIC_FIRESTORE_SCAN_HISTORY_WRITES_ENABLED:
    process.env.EXPO_PUBLIC_FIRESTORE_SCAN_HISTORY_WRITES_ENABLED,
  EXPO_PUBLIC_FIRESTORE_SHARED_CACHE_READS_ENABLED:
    process.env.EXPO_PUBLIC_FIRESTORE_SHARED_CACHE_READS_ENABLED,
  EXPO_PUBLIC_FIRESTORE_SHARED_CACHE_WRITES_ENABLED:
    process.env.EXPO_PUBLIC_FIRESTORE_SHARED_CACHE_WRITES_ENABLED,
  EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID:
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  EXPO_PUBLIC_MARKET_GELSIN_API_URL: process.env.EXPO_PUBLIC_MARKET_GELSIN_API_URL,
  EXPO_PUBLIC_MARKET_GELSIN_RPC_BASE_URL:
    process.env.EXPO_PUBLIC_MARKET_GELSIN_RPC_BASE_URL,
  EXPO_PUBLIC_MARKET_GELSIN_ENABLED: process.env.EXPO_PUBLIC_MARKET_GELSIN_ENABLED,
  EXPO_PUBLIC_MARKET_GELSIN_RPC_PRODUCT_OFFERS:
    process.env.EXPO_PUBLIC_MARKET_GELSIN_RPC_PRODUCT_OFFERS,
  EXPO_PUBLIC_MARKET_GELSIN_RPC_PRODUCT_RESOLVE:
    process.env.EXPO_PUBLIC_MARKET_GELSIN_RPC_PRODUCT_RESOLVE,
  EXPO_PUBLIC_MARKET_GELSIN_RPC_PRODUCT_PRICE_HISTORY:
    process.env.EXPO_PUBLIC_MARKET_GELSIN_RPC_PRODUCT_PRICE_HISTORY,
  EXPO_PUBLIC_MARKET_GELSIN_RPC_SEARCH_PRODUCTS:
    process.env.EXPO_PUBLIC_MARKET_GELSIN_RPC_SEARCH_PRODUCTS,
  EXPO_PUBLIC_MARKET_GELSIN_RPC_LIST_CATEGORY_PRODUCTS:
    process.env.EXPO_PUBLIC_MARKET_GELSIN_RPC_LIST_CATEGORY_PRODUCTS,
  EXPO_PUBLIC_MARKET_GELSIN_RPC_RECORD_SCAN:
    process.env.EXPO_PUBLIC_MARKET_GELSIN_RPC_RECORD_SCAN,
  EXPO_PUBLIC_MARKET_GELSIN_TIMEOUT_MS:
    process.env.EXPO_PUBLIC_MARKET_GELSIN_TIMEOUT_MS,
  EXPO_PUBLIC_MONETIZATION_ANNUAL_PLAN_ENABLED:
    process.env.EXPO_PUBLIC_MONETIZATION_ANNUAL_PLAN_ENABLED,
  EXPO_PUBLIC_MONETIZATION_ANNUAL_PRICE_TRY:
    process.env.EXPO_PUBLIC_MONETIZATION_ANNUAL_PRICE_TRY,
  EXPO_PUBLIC_MONETIZATION_ANNUAL_PRODUCT_ID:
    process.env.EXPO_PUBLIC_MONETIZATION_ANNUAL_PRODUCT_ID,
  EXPO_PUBLIC_MONETIZATION_PAYWALL_ENABLED:
    process.env.EXPO_PUBLIC_MONETIZATION_PAYWALL_ENABLED,
  EXPO_PUBLIC_MONETIZATION_PURCHASE_PROVIDER_ENABLED:
    process.env.EXPO_PUBLIC_MONETIZATION_PURCHASE_PROVIDER_ENABLED,
  EXPO_PUBLIC_MONETIZATION_RESTORE_ENABLED:
    process.env.EXPO_PUBLIC_MONETIZATION_RESTORE_ENABLED,
  EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY:
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
  EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID:
    process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID,
  EXPO_PUBLIC_REVENUECAT_IOS_API_KEY:
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
  EXPO_PUBLIC_REVENUECAT_OFFERING_ID:
    process.env.EXPO_PUBLIC_REVENUECAT_OFFERING_ID,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  EXPO_PUBLIC_SUPABASE_PUBLIC_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLIC_KEY,
} satisfies Record<string, string | undefined>);

type ExpoPublicEnvKey = keyof typeof EXPO_PUBLIC_ENV;

function normalizeString(value?: string | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getOptionalExtraString(key: string): string | null {
  const raw = EXPO_EXTRA[key];

  if (typeof raw === 'string') {
    return normalizeString(raw);
  }

  if (typeof raw === 'number' || typeof raw === 'boolean') {
    return normalizeString(String(raw));
  }

  return null;
}

function getOptionalEnvString(key: string): string | null {
  return (
    normalizeString(EXPO_PUBLIC_ENV[key as ExpoPublicEnvKey]) ??
    getOptionalExtraString(key)
  );
}

export function hasEnvOverride(key: string): boolean {
  return Boolean(getOptionalEnvString(key));
}

export function getEnvString(key: string, fallback: string): string {
  return getOptionalEnvString(key) ?? fallback;
}

export function getEnvBoolean(key: string, fallback: boolean): boolean {
  const raw = getOptionalEnvString(key);

  if (!raw) {
    return fallback;
  }

  const normalized = raw.toLowerCase();

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

export function getEnvNumber(key: string, fallback: number): number {
  const raw = getOptionalEnvString(key);

  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);

  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getEnvCsv(key: string, fallback: string[]): string[] {
  const raw = getOptionalEnvString(key);

  if (!raw) {
    return fallback;
  }

  const items = raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return items.length > 0 ? items : fallback;
}

function resolveAppEnvironment(): AppEnvironment {
  const explicitEnv = getOptionalEnvString('EXPO_PUBLIC_APP_ENV')?.toLowerCase();

  if (explicitEnv === 'production') {
    return 'production';
  }

  if (explicitEnv === 'preview' || explicitEnv === 'staging') {
    return 'preview';
  }

  if (explicitEnv === 'development' || explicitEnv === 'dev') {
    return 'development';
  }

  return __DEV__ ? 'development' : 'production';
}

const executionEnvironment =
  Constants.executionEnvironment ?? 'unknown';

const isExpoGo = executionEnvironment === 'storeClient';
const appEnvironment = resolveAppEnvironment();

export const APP_RUNTIME = Object.freeze({
  appEnvironment,
  runtimeSource: (getOptionalEnvString('EXPO_PUBLIC_APP_ENV')
    ? 'env_override'
    : 'fallback') as RuntimeSource,
  isDevelopment: appEnvironment === 'development',
  isPreview: appEnvironment === 'preview',
  isProduction: appEnvironment === 'production',
  isExpoGo,
  isNativeBuild: !isExpoGo,
  executionEnvironment,
  platform: Platform.OS,
});

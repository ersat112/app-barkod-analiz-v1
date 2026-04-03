import { NativeModules, Platform } from 'react-native';

import {
  APP_RUNTIME,
  getEnvBoolean,
  getEnvNumber,
  getEnvString,
  hasEnvOverride,
} from './appRuntime';

export type MarketGelsinRuntimeSource =
  | 'env_override'
  | 'development_fallback'
  | 'emulator_fallback'
  | 'local_cache'
  | 'remote_live'
  | 'fallback';

export type MarketGelsinDisableReason =
  | 'missing_base_url'
  | 'disabled_by_env'
  | 'disabled_by_remote'
  | null;

export type MarketGelsinRuntimeSnapshot = {
  source: MarketGelsinRuntimeSource;
  version: number;
  fetchedAt: number | null;
  baseUrl: string;
  timeoutMs: number;
  isEnabled: boolean;
  disableReason: MarketGelsinDisableReason;
};

const normalizeBaseUrl = (value: string): string =>
  value.trim().replace(/\/+$/g, '');

const getPlatformConstants = (): Record<string, unknown> => {
  const platformWithConstants = Platform as typeof Platform & {
    constants?: Record<string, unknown>;
  };

  if (platformWithConstants.constants) {
    return platformWithConstants.constants;
  }

  const nativePlatformConstants =
    NativeModules?.PlatformConstants as Record<string, unknown> | undefined;

  return nativePlatformConstants ?? {};
};

const getPlatformConstantText = (key: string): string =>
  String(getPlatformConstants()[key] ?? '')
    .trim()
    .toLowerCase();

const isProbablyAndroidEmulator = (): boolean => {
  if (Platform.OS !== 'android') {
    return false;
  }

  const fingerprint = getPlatformConstantText('Fingerprint');
  const model = getPlatformConstantText('Model');
  const brand = getPlatformConstantText('Brand');

  return (
    fingerprint.includes('generic') ||
    fingerprint.includes('emulator') ||
    fingerprint.includes('sdk_gphone') ||
    model.includes('sdk_gphone') ||
    model.includes('emulator') ||
    model.includes('android sdk built for x86') ||
    brand.includes('generic')
  );
};

const resolveDevelopmentHost = (): string | null => {
  if (!APP_RUNTIME.isDevelopment) {
    return null;
  }

  const scriptUrl = String(NativeModules?.SourceCode?.scriptURL || '').trim();

  if (scriptUrl) {
    try {
      const parsed = new URL(scriptUrl);
      const hostname = parsed.hostname.trim();

      if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
        return hostname;
      }
    } catch {
      // Development fallback below handles malformed URLs.
    }
  }

  return Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
};

const developmentFallbackBaseUrl = (() => {
  const host = resolveDevelopmentHost();
  return host ? `http://${host}:8040` : '';
})();

const emulatorFallbackBaseUrl =
  !APP_RUNTIME.isDevelopment && isProbablyAndroidEmulator()
    ? 'http://10.0.2.2:8040'
    : '';

function resolveDefaultSnapshot(): MarketGelsinRuntimeSnapshot {
  const envBaseUrl = normalizeBaseUrl(
    getEnvString('EXPO_PUBLIC_MARKET_GELSIN_API_URL', '')
  );
  const baseUrl =
    envBaseUrl ||
    normalizeBaseUrl(developmentFallbackBaseUrl) ||
    normalizeBaseUrl(emulatorFallbackBaseUrl);
  const enabledByEnv = getEnvBoolean(
    'EXPO_PUBLIC_MARKET_GELSIN_ENABLED',
    Boolean(envBaseUrl || developmentFallbackBaseUrl || emulatorFallbackBaseUrl)
  );
  const timeoutMs = Math.max(
    3000,
    getEnvNumber('EXPO_PUBLIC_MARKET_GELSIN_TIMEOUT_MS', 8000)
  );
  const hasOverride =
    hasEnvOverride('EXPO_PUBLIC_MARKET_GELSIN_API_URL') ||
    hasEnvOverride('EXPO_PUBLIC_MARKET_GELSIN_ENABLED') ||
    hasEnvOverride('EXPO_PUBLIC_MARKET_GELSIN_TIMEOUT_MS');
  const source: MarketGelsinRuntimeSource = hasOverride
    ? 'env_override'
    : developmentFallbackBaseUrl
      ? 'development_fallback'
      : emulatorFallbackBaseUrl
        ? 'emulator_fallback'
      : 'fallback';
  const isEnabled = Boolean(baseUrl) && enabledByEnv;
  const disableReason: MarketGelsinDisableReason = !baseUrl
    ? 'missing_base_url'
    : !enabledByEnv
      ? 'disabled_by_env'
      : null;

  return {
    source,
    version: 1,
    fetchedAt: null,
    baseUrl,
    timeoutMs,
    isEnabled,
    disableReason,
  };
}

const defaultSnapshot = resolveDefaultSnapshot();
let currentSnapshot: MarketGelsinRuntimeSnapshot = defaultSnapshot;

export const hasMarketGelsinEnvOverride = (): boolean =>
  hasEnvOverride('EXPO_PUBLIC_MARKET_GELSIN_API_URL') ||
  hasEnvOverride('EXPO_PUBLIC_MARKET_GELSIN_ENABLED') ||
  hasEnvOverride('EXPO_PUBLIC_MARKET_GELSIN_TIMEOUT_MS');

export const getMarketGelsinEnvOverrideState = () => ({
  apiUrl: hasEnvOverride('EXPO_PUBLIC_MARKET_GELSIN_API_URL'),
  enabled: hasEnvOverride('EXPO_PUBLIC_MARKET_GELSIN_ENABLED'),
  timeoutMs: hasEnvOverride('EXPO_PUBLIC_MARKET_GELSIN_TIMEOUT_MS'),
});

export const getDefaultMarketGelsinRuntimeSnapshot =
  (): MarketGelsinRuntimeSnapshot => defaultSnapshot;

export const getMarketGelsinRuntimeSnapshot =
  (): MarketGelsinRuntimeSnapshot => currentSnapshot;

export const setMarketGelsinRuntimeSnapshot = (
  nextSnapshot: MarketGelsinRuntimeSnapshot
): MarketGelsinRuntimeSnapshot => {
  currentSnapshot = {
    ...nextSnapshot,
    baseUrl: normalizeBaseUrl(nextSnapshot.baseUrl),
  };
  return currentSnapshot;
};

export const resetMarketGelsinRuntimeSnapshot = (): MarketGelsinRuntimeSnapshot =>
  setMarketGelsinRuntimeSnapshot(defaultSnapshot);

export const MARKET_GELSIN_RUNTIME = Object.freeze({
  get source(): MarketGelsinRuntimeSource {
    return currentSnapshot.source;
  },
  get version(): number {
    return currentSnapshot.version;
  },
  get fetchedAt(): number | null {
    return currentSnapshot.fetchedAt;
  },
  get baseUrl(): string {
    return currentSnapshot.baseUrl;
  },
  get timeoutMs(): number {
    return currentSnapshot.timeoutMs;
  },
  get isEnabled(): boolean {
    return currentSnapshot.isEnabled;
  },
  get disableReason(): MarketGelsinDisableReason {
    return currentSnapshot.disableReason;
  },
});

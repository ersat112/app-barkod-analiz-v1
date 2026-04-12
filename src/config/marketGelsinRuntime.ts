import { NativeModules, Platform } from 'react-native';

import {
  getEnvBoolean,
  getEnvNumber,
  getEnvString,
  hasEnvOverride,
} from './appRuntime';

export type MarketGelsinRuntimeSource =
  | 'env_override'
  | 'local_cache'
  | 'remote_live'
  | 'fallback';

export type MarketGelsinDisableReason =
  | 'missing_base_url'
  | 'missing_anon_key'
  | 'disabled_by_env'
  | 'disabled_by_remote'
  | null;

export type MarketGelsinRuntimeSnapshot = {
  source: MarketGelsinRuntimeSource;
  version: number;
  fetchedAt: number | null;
  baseUrl: string;
  anonKey: string | null;
  timeoutMs: number;
  isEnabled: boolean;
  disableReason: MarketGelsinDisableReason;
};

const SUPABASE_RUNTIME_API_KEY_ENV_KEYS = [
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_SUPABASE_PUBLIC_KEY',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
] as const;

const normalizeBaseUrl = (value: string): string =>
  value.trim().replace(/\/+$/g, '');

const rewriteLoopbackHostForEmulator = (baseUrl: string): string => {
  const normalized = normalizeBaseUrl(baseUrl);

  if (!normalized || !isProbablyAndroidEmulator()) {
    return normalized;
  }

  try {
    const parsed = new URL(normalized);

    if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') {
      parsed.hostname = '10.0.2.2';
      return normalizeBaseUrl(parsed.toString());
    }
  } catch {
    return normalized;
  }

  return normalized;
};

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

export const getMarketGelsinSupabaseApiKey = (): string | null => {
  for (const key of SUPABASE_RUNTIME_API_KEY_ENV_KEYS) {
    const value = getEnvString(key, '').trim();
    if (value) {
      return value;
    }
  }

  return null;
};

export const hasMarketGelsinSupabaseApiKeyOverride = (): boolean =>
  SUPABASE_RUNTIME_API_KEY_ENV_KEYS.some((key) => hasEnvOverride(key));

function resolveDefaultSnapshot(): MarketGelsinRuntimeSnapshot {
  const envRpcBaseUrl = rewriteLoopbackHostForEmulator(
    getEnvString('EXPO_PUBLIC_MARKET_GELSIN_RPC_BASE_URL', '')
  );
  const envBaseUrl = rewriteLoopbackHostForEmulator(
    getEnvString('EXPO_PUBLIC_MARKET_GELSIN_API_URL', '')
  );
  const envAnonKey = getMarketGelsinSupabaseApiKey();
  const baseUrl = envRpcBaseUrl || envBaseUrl;
  const enabledByEnv = getEnvBoolean(
    'EXPO_PUBLIC_MARKET_GELSIN_ENABLED',
    Boolean(envRpcBaseUrl || envBaseUrl)
  );
  const timeoutMs = Math.max(
    3000,
    getEnvNumber('EXPO_PUBLIC_MARKET_GELSIN_TIMEOUT_MS', 8000)
  );
  const hasOverride =
    hasEnvOverride('EXPO_PUBLIC_MARKET_GELSIN_RPC_BASE_URL') ||
    hasEnvOverride('EXPO_PUBLIC_MARKET_GELSIN_API_URL') ||
    hasMarketGelsinSupabaseApiKeyOverride() ||
    hasEnvOverride('EXPO_PUBLIC_MARKET_GELSIN_ENABLED') ||
    hasEnvOverride('EXPO_PUBLIC_MARKET_GELSIN_TIMEOUT_MS');
  const source: MarketGelsinRuntimeSource = hasOverride
    ? 'env_override'
    : 'fallback';
  const requiresAnonKey = Boolean(envRpcBaseUrl || (baseUrl && /\/rest\/v1\/rpc\/?$/i.test(baseUrl)));
  const hasAnonKey = !requiresAnonKey || Boolean(envAnonKey);
  const isEnabled = Boolean(baseUrl) && enabledByEnv && hasAnonKey;
  const disableReason: MarketGelsinDisableReason = !baseUrl
    ? 'missing_base_url'
    : !hasAnonKey
      ? 'missing_anon_key'
    : !enabledByEnv
      ? 'disabled_by_env'
      : null;

  return {
    source,
    version: 1,
    fetchedAt: null,
    baseUrl,
    anonKey: envAnonKey,
    timeoutMs,
    isEnabled,
    disableReason,
  };
}

const defaultSnapshot = resolveDefaultSnapshot();
let currentSnapshot: MarketGelsinRuntimeSnapshot = defaultSnapshot;

export const hasMarketGelsinEnvOverride = (): boolean =>
  hasEnvOverride('EXPO_PUBLIC_MARKET_GELSIN_RPC_BASE_URL') ||
  hasEnvOverride('EXPO_PUBLIC_MARKET_GELSIN_API_URL') ||
  hasMarketGelsinSupabaseApiKeyOverride() ||
  hasEnvOverride('EXPO_PUBLIC_MARKET_GELSIN_ENABLED') ||
  hasEnvOverride('EXPO_PUBLIC_MARKET_GELSIN_TIMEOUT_MS');

export const getMarketGelsinEnvOverrideState = () => ({
  rpcBaseUrl: hasEnvOverride('EXPO_PUBLIC_MARKET_GELSIN_RPC_BASE_URL'),
  apiUrl: hasEnvOverride('EXPO_PUBLIC_MARKET_GELSIN_API_URL'),
  apiKey: hasMarketGelsinSupabaseApiKeyOverride(),
  anonKey: hasEnvOverride('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
  publishableKey:
    hasEnvOverride('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ||
    hasEnvOverride('EXPO_PUBLIC_SUPABASE_PUBLIC_KEY'),
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
    baseUrl: rewriteLoopbackHostForEmulator(nextSnapshot.baseUrl),
    anonKey:
      typeof nextSnapshot.anonKey === 'string' && nextSnapshot.anonKey.trim()
        ? nextSnapshot.anonKey.trim()
        : null,
  };
  return currentSnapshot;
};

export const normalizeMarketGelsinRuntimeBaseUrl = (
  value: string
): string => rewriteLoopbackHostForEmulator(value);

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
  get anonKey(): string | null {
    return currentSnapshot.anonKey;
  },
  get isEnabled(): boolean {
    return currentSnapshot.isEnabled;
  },
  get disableReason(): MarketGelsinDisableReason {
    return currentSnapshot.disableReason;
  },
});

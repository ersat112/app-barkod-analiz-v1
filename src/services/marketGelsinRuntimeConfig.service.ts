import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc } from 'firebase/firestore';

import { db } from '../config/firebase';
import {
  getDefaultMarketGelsinRuntimeSnapshot,
  getMarketGelsinRuntimeSnapshot,
  hasMarketGelsinEnvOverride,
  normalizeMarketGelsinRuntimeBaseUrl,
  resetMarketGelsinRuntimeSnapshot,
  setMarketGelsinRuntimeSnapshot,
  type MarketGelsinRuntimeSnapshot,
  type MarketGelsinRuntimeSource,
} from '../config/marketGelsinRuntime';
import { FEATURES, MARKET_GELSIN_RUNTIME_DOCUMENT, MARKET_GELSIN_RUNTIME_STORAGE_KEY, RUNTIME_CONFIG_COLLECTION } from '../config/features';

type StoredMarketGelsinRuntimeState = {
  schemaVersion: number;
  config: MarketGelsinRuntimeSnapshot;
};

type RemoteMarketGelsinRuntimeDocument = Partial<{
  version: number;
  enabled: boolean;
  baseUrl: string;
  base_url: string;
  apiKey: string;
  api_key: string;
  publishableKey: string;
  publishable_key: string;
  publicKey: string;
  public_key: string;
  anonKey: string;
  anon_key: string;
  timeoutMs: number;
  timeout_ms: number;
  updatedAt: unknown;
}>;

const SCHEMA_VERSION = 1;
const RUNTIME_CONFIG_TTL_MS = 1000 * 60 * 30;

let inMemoryConfig: MarketGelsinRuntimeSnapshot | null = null;
let refreshPromise: Promise<MarketGelsinRuntimeSnapshot> | null = null;

function warn(...args: unknown[]) {
  if (FEATURES.firebase.diagnosticsLoggingEnabled) {
    console.warn('[MarketGelsinRuntimeConfig]', ...args);
  }
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function clampInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function toBaseUrl(value: unknown): string {
  return typeof value === 'string'
    ? normalizeMarketGelsinRuntimeBaseUrl(value)
    : '';
}

function toAnonKey(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

function isConfigFresh(config: MarketGelsinRuntimeSnapshot | null): boolean {
  if (!config?.fetchedAt) {
    return false;
  }

  return Date.now() - config.fetchedAt < RUNTIME_CONFIG_TTL_MS;
}

function normalizeRuntimeConfig(
  raw: RemoteMarketGelsinRuntimeDocument | null | undefined,
  source: MarketGelsinRuntimeSource,
  fetchedAt: number
): MarketGelsinRuntimeSnapshot {
  const fallback = getDefaultMarketGelsinRuntimeSnapshot();
  const baseUrl = toBaseUrl(raw?.baseUrl ?? raw?.base_url) || fallback.baseUrl;
  const anonKey =
    toAnonKey(
      raw?.apiKey ??
        raw?.api_key ??
        raw?.publishableKey ??
        raw?.publishable_key ??
        raw?.publicKey ??
        raw?.public_key ??
        raw?.anonKey ??
        raw?.anon_key
    ) ?? fallback.anonKey ?? null;
  const enabled = toBoolean(raw?.enabled, Boolean(baseUrl));
  const timeoutMs = clampInteger(
    raw?.timeoutMs ?? raw?.timeout_ms,
    fallback.timeoutMs,
    3000,
    30000
  );
  const requiresAnonKey = /\/rest\/v1\/rpc\/?$/i.test(baseUrl);
  const hasAnonKey = !requiresAnonKey || Boolean(anonKey);
  const isEnabled = Boolean(baseUrl) && enabled && hasAnonKey;

  return {
    source,
    version: clampInteger(raw?.version, fallback.version, 1, 10000),
    fetchedAt,
    baseUrl,
    anonKey,
    timeoutMs,
    isEnabled,
    disableReason: !baseUrl
      ? 'missing_base_url'
      : !hasAnonKey
        ? 'missing_anon_key'
      : !enabled
        ? 'disabled_by_remote'
        : null,
  };
}

async function readStoredConfig(): Promise<MarketGelsinRuntimeSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(MARKET_GELSIN_RUNTIME_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredMarketGelsinRuntimeState>;
    const config =
      parsed.config && typeof parsed.config === 'object'
        ? (parsed.config as MarketGelsinRuntimeSnapshot)
        : null;

    if (!config) {
      return null;
    }

    return normalizeRuntimeConfig(
      {
        version: config.version,
        enabled: config.isEnabled,
        baseUrl: config.baseUrl,
        anonKey: config.anonKey ?? undefined,
        timeoutMs: config.timeoutMs,
      },
      config.source === 'remote_live' ? 'local_cache' : config.source,
      config.fetchedAt ?? Date.now()
    );
  } catch (error) {
    warn('readStoredConfig failed:', error);
    return null;
  }
}

async function writeStoredConfig(config: MarketGelsinRuntimeSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(
      MARKET_GELSIN_RUNTIME_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        config,
      } satisfies StoredMarketGelsinRuntimeState)
    );
  } catch (error) {
    warn('writeStoredConfig failed:', error);
  }
}

async function fetchRemoteConfig(): Promise<MarketGelsinRuntimeSnapshot> {
  if (!FEATURES.firebase.runtimeConfigRolloutEnabled || hasMarketGelsinEnvOverride()) {
    const fallback = resetMarketGelsinRuntimeSnapshot();
    inMemoryConfig = fallback;
    return fallback;
  }

  const ref = doc(db, RUNTIME_CONFIG_COLLECTION, MARKET_GELSIN_RUNTIME_DOCUMENT);
  const snapshot = await getDoc(ref);
  const fetchedAt = Date.now();

  if (!snapshot.exists()) {
    const fallback = setMarketGelsinRuntimeSnapshot(
      normalizeRuntimeConfig(null, 'fallback', fetchedAt)
    );
    inMemoryConfig = fallback;
    await writeStoredConfig(fallback);
    return fallback;
  }

  const nextConfig = setMarketGelsinRuntimeSnapshot(
    normalizeRuntimeConfig(
      snapshot.data() as RemoteMarketGelsinRuntimeDocument,
      'remote_live',
      fetchedAt
    )
  );
  inMemoryConfig = nextConfig;
  await writeStoredConfig(nextConfig);
  return nextConfig;
}

async function refreshInternal(): Promise<MarketGelsinRuntimeSnapshot> {
  if (!FEATURES.firebase.runtimeConfigRolloutEnabled || hasMarketGelsinEnvOverride()) {
    const fallback = resetMarketGelsinRuntimeSnapshot();
    inMemoryConfig = fallback;
    return fallback;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      return await fetchRemoteConfig();
    } catch (error) {
      const fallback =
        inMemoryConfig ??
        (await readStoredConfig()) ??
        getDefaultMarketGelsinRuntimeSnapshot();

      warn('remote config refresh failed, using fallback:', error);
      const nextConfig = setMarketGelsinRuntimeSnapshot(fallback);
      inMemoryConfig = nextConfig;
      return nextConfig;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export const resolveMarketGelsinRuntimeConfig = async (options?: {
  forceRefresh?: boolean;
  allowStale?: boolean;
}): Promise<MarketGelsinRuntimeSnapshot> => {
  if (!FEATURES.firebase.runtimeConfigRolloutEnabled || hasMarketGelsinEnvOverride()) {
    const fallback = resetMarketGelsinRuntimeSnapshot();
    inMemoryConfig = fallback;
    return fallback;
  }

  if (options?.forceRefresh) {
    return await refreshInternal();
  }

  const current = getMarketGelsinRuntimeSnapshot();

  if (current.fetchedAt && isConfigFresh(current)) {
    inMemoryConfig = current;
    return current;
  }

  const storedConfig = inMemoryConfig ?? (await readStoredConfig());

  if (storedConfig && isConfigFresh(storedConfig)) {
    const nextConfig = setMarketGelsinRuntimeSnapshot(storedConfig);
    inMemoryConfig = nextConfig;
    return nextConfig;
  }

  if (storedConfig && options?.allowStale) {
    const nextConfig = setMarketGelsinRuntimeSnapshot(storedConfig);
    inMemoryConfig = nextConfig;
    void refreshInternal().catch(() => undefined);
    return nextConfig;
  }

  return await refreshInternal();
};

export const clearMarketGelsinRuntimeConfigCache = async (): Promise<void> => {
  inMemoryConfig = null;
  resetMarketGelsinRuntimeSnapshot();

  try {
    await AsyncStorage.removeItem(MARKET_GELSIN_RUNTIME_STORAGE_KEY);
  } catch (error) {
    warn('clearMarketGelsinRuntimeConfigCache failed:', error);
  }
};

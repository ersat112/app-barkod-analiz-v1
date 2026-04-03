import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc } from 'firebase/firestore';

import { getEnvBoolean, hasEnvOverride } from '../config/appRuntime';
import { db } from '../config/firebase';
import {
  FEATURES,
  FIRESTORE_ROLLOUT_DOCUMENT,
  FIRESTORE_RUNTIME_CONFIG_STORAGE_KEY,
  RUNTIME_CONFIG_COLLECTION,
} from '../config/features';

export type FirestoreRuntimeConfigSource =
  | 'default'
  | 'local_cache'
  | 'remote_live';

export type FirestoreRuntimeConfigSnapshot = {
  source: FirestoreRuntimeConfigSource;
  version: number;
  fetchedAt: number | null;
  allowSharedCacheReads: boolean;
  allowClientSharedCacheWrites: boolean;
  allowUserScanHistoryWrites: boolean;
  allowClientAnalyticsWrites: boolean;
  allowMissingProductContributionWrites: boolean;
  allowAdPolicyReads: boolean;
};

type StoredFirestoreRuntimeConfigState = {
  schemaVersion: number;
  config: FirestoreRuntimeConfigSnapshot;
};

type RemoteFirestoreRolloutDocument = Partial<{
  version: number;
  allowSharedCacheReads: boolean;
  allowClientSharedCacheWrites: boolean;
  allowUserScanHistoryWrites: boolean;
  allowClientAnalyticsWrites: boolean;
  allowMissingProductContributionWrites: boolean;
  allowAdPolicyReads: boolean;
  updatedAt: unknown;
}>;

const SCHEMA_VERSION = 1;
const RUNTIME_CONFIG_TTL_MS = 1000 * 60 * 30;
let inMemoryConfig: FirestoreRuntimeConfigSnapshot | null = null;
let refreshPromise: Promise<FirestoreRuntimeConfigSnapshot> | null = null;

function log(...args: unknown[]) {
  if (FEATURES.firebase.diagnosticsLoggingEnabled) {
    console.log('[FirestoreRuntimeConfig]', ...args);
  }
}

function warn(...args: unknown[]) {
  if (FEATURES.firebase.diagnosticsLoggingEnabled) {
    console.warn('[FirestoreRuntimeConfig]', ...args);
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

function hasRuntimeOverride(key: string): boolean {
  return hasEnvOverride(key);
}

function applyRuntimeOverrides(
  config: FirestoreRuntimeConfigSnapshot
): FirestoreRuntimeConfigSnapshot {
  let nextConfig = config;

  if (hasRuntimeOverride('EXPO_PUBLIC_FIRESTORE_SHARED_CACHE_READS_ENABLED')) {
    nextConfig = {
      ...nextConfig,
      allowSharedCacheReads: getEnvBoolean(
        'EXPO_PUBLIC_FIRESTORE_SHARED_CACHE_READS_ENABLED',
        nextConfig.allowSharedCacheReads
      ),
    };
  }

  if (hasRuntimeOverride('EXPO_PUBLIC_FIRESTORE_SHARED_CACHE_WRITES_ENABLED')) {
    nextConfig = {
      ...nextConfig,
      allowClientSharedCacheWrites: getEnvBoolean(
        'EXPO_PUBLIC_FIRESTORE_SHARED_CACHE_WRITES_ENABLED',
        nextConfig.allowClientSharedCacheWrites
      ),
    };
  }

  if (hasRuntimeOverride('EXPO_PUBLIC_FIRESTORE_SCAN_HISTORY_WRITES_ENABLED')) {
    nextConfig = {
      ...nextConfig,
      allowUserScanHistoryWrites: getEnvBoolean(
        'EXPO_PUBLIC_FIRESTORE_SCAN_HISTORY_WRITES_ENABLED',
        nextConfig.allowUserScanHistoryWrites
      ),
    };
  }

  if (hasRuntimeOverride('EXPO_PUBLIC_FIRESTORE_MISSING_PRODUCT_WRITES_ENABLED')) {
    nextConfig = {
      ...nextConfig,
      allowMissingProductContributionWrites: getEnvBoolean(
        'EXPO_PUBLIC_FIRESTORE_MISSING_PRODUCT_WRITES_ENABLED',
        nextConfig.allowMissingProductContributionWrites
      ),
    };
  }

  return nextConfig;
}

function createDefaultRuntimeConfig(
  overrides?: Partial<FirestoreRuntimeConfigSnapshot>
): FirestoreRuntimeConfigSnapshot {
  return {
    source: 'default',
    version: 1,
    fetchedAt: null,
    allowSharedCacheReads: false,
    allowClientSharedCacheWrites: false,
    allowUserScanHistoryWrites: false,
    allowClientAnalyticsWrites: true,
    allowMissingProductContributionWrites: false,
    allowAdPolicyReads: true,
    ...overrides,
  };
}

function normalizeRuntimeConfig(
  raw: RemoteFirestoreRolloutDocument | null | undefined,
  source: FirestoreRuntimeConfigSource,
  fetchedAt: number
): FirestoreRuntimeConfigSnapshot {
  const fallback = createDefaultRuntimeConfig();

  if (!raw || typeof raw !== 'object') {
    return createDefaultRuntimeConfig({
      source,
      fetchedAt,
    });
  }

  return {
    source,
    fetchedAt,
    version: clampInteger(raw.version, fallback.version, 1, 10_000),
    allowSharedCacheReads: toBoolean(
      raw.allowSharedCacheReads,
      fallback.allowSharedCacheReads
    ),
    allowClientSharedCacheWrites: toBoolean(
      raw.allowClientSharedCacheWrites,
      fallback.allowClientSharedCacheWrites
    ),
    allowUserScanHistoryWrites: toBoolean(
      raw.allowUserScanHistoryWrites,
      fallback.allowUserScanHistoryWrites
    ),
    allowClientAnalyticsWrites: toBoolean(
      raw.allowClientAnalyticsWrites,
      fallback.allowClientAnalyticsWrites
    ),
    allowMissingProductContributionWrites: toBoolean(
      raw.allowMissingProductContributionWrites,
      fallback.allowMissingProductContributionWrites
    ),
    allowAdPolicyReads: toBoolean(
      raw.allowAdPolicyReads,
      fallback.allowAdPolicyReads
    ),
  };
}

function isConfigFresh(config: FirestoreRuntimeConfigSnapshot | null): boolean {
  if (!config?.fetchedAt) {
    return false;
  }

  return Date.now() - config.fetchedAt < RUNTIME_CONFIG_TTL_MS;
}

async function readStoredConfig(): Promise<FirestoreRuntimeConfigSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(FIRESTORE_RUNTIME_CONFIG_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredFirestoreRuntimeConfigState>;
    const config =
      parsed.config && typeof parsed.config === 'object'
        ? (parsed.config as FirestoreRuntimeConfigSnapshot)
        : null;

    if (!config) {
      return null;
    }

    return normalizeRuntimeConfig(
      {
        version: config.version,
        allowSharedCacheReads: config.allowSharedCacheReads,
        allowClientSharedCacheWrites: config.allowClientSharedCacheWrites,
        allowUserScanHistoryWrites: config.allowUserScanHistoryWrites,
        allowClientAnalyticsWrites: config.allowClientAnalyticsWrites,
        allowMissingProductContributionWrites:
          config.allowMissingProductContributionWrites,
        allowAdPolicyReads: config.allowAdPolicyReads,
      },
      config.source === 'remote_live' ? 'local_cache' : config.source,
      config.fetchedAt ?? Date.now()
    );
  } catch (error) {
    warn('readStoredConfig failed:', error);
    return null;
  }
}

async function writeStoredConfig(
  config: FirestoreRuntimeConfigSnapshot
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      FIRESTORE_RUNTIME_CONFIG_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        config,
      } satisfies StoredFirestoreRuntimeConfigState)
    );
  } catch (error) {
    warn('writeStoredConfig failed:', error);
  }
}

async function fetchRemoteConfig(): Promise<FirestoreRuntimeConfigSnapshot> {
  if (!FEATURES.firebase.runtimeConfigRolloutEnabled) {
    const fallback = createDefaultRuntimeConfig();
    inMemoryConfig = fallback;
    return fallback;
  }

  const ref = doc(db, RUNTIME_CONFIG_COLLECTION, FIRESTORE_ROLLOUT_DOCUMENT);
  const snapshot = await getDoc(ref);
  const fetchedAt = Date.now();

  if (!snapshot.exists()) {
    const fallback = createDefaultRuntimeConfig({
      source: 'default',
      fetchedAt,
    });

    inMemoryConfig = fallback;
    await writeStoredConfig(fallback);
    return fallback;
  }

  const nextConfig = normalizeRuntimeConfig(
    snapshot.data() as RemoteFirestoreRolloutDocument,
    'remote_live',
    fetchedAt
  );

  inMemoryConfig = nextConfig;
  await writeStoredConfig(nextConfig);

  log('remote config loaded:', nextConfig);

  return nextConfig;
}

async function refreshInternal(): Promise<FirestoreRuntimeConfigSnapshot> {
  if (!FEATURES.firebase.runtimeConfigRolloutEnabled) {
    const fallback = createDefaultRuntimeConfig();
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
        createDefaultRuntimeConfig({
          fetchedAt: Date.now(),
        });

      warn('remote config refresh failed, using fallback:', error);

      inMemoryConfig = fallback;
      return fallback;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export const resolveFirestoreRuntimeConfig = async (options?: {
  forceRefresh?: boolean;
  allowStale?: boolean;
}): Promise<FirestoreRuntimeConfigSnapshot> => {
  if (!FEATURES.firebase.runtimeConfigRolloutEnabled) {
    return applyRuntimeOverrides(createDefaultRuntimeConfig());
  }

  if (options?.forceRefresh) {
    return applyRuntimeOverrides(await refreshInternal());
  }

  if (inMemoryConfig && isConfigFresh(inMemoryConfig)) {
    return applyRuntimeOverrides(inMemoryConfig);
  }

  const storedConfig = inMemoryConfig ?? (await readStoredConfig());

  if (storedConfig && isConfigFresh(storedConfig)) {
    inMemoryConfig = storedConfig;
    return applyRuntimeOverrides(storedConfig);
  }

  if (storedConfig && options?.allowStale) {
    inMemoryConfig = storedConfig;
    void refreshInternal().catch(() => undefined);
    return applyRuntimeOverrides(storedConfig);
  }

  return applyRuntimeOverrides(await refreshInternal());
};

export const clearFirestoreRuntimeConfigCache = async (): Promise<void> => {
  inMemoryConfig = null;

  try {
    await AsyncStorage.removeItem(FIRESTORE_RUNTIME_CONFIG_STORAGE_KEY);
  } catch (error) {
    warn('clearFirestoreRuntimeConfigCache failed:', error);
  }
};

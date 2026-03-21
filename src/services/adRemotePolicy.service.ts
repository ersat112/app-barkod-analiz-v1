import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc } from 'firebase/firestore';

import { db } from '../config/firebase';
import {
  AD_POLICY,
  AD_REMOTE_POLICY_COLLECTION,
  AD_REMOTE_POLICY_DOCUMENT,
  AD_REMOTE_POLICY_STORAGE_KEY,
  FEATURES,
} from '../config/features';
import type {
  AdPolicySnapshot,
  AdPolicySource,
  RemoteAdPolicyDocument,
} from '../types/ads';
import { analyticsService } from './analytics.service';

type StoredRemotePolicyState = {
  schemaVersion: number;
  policy: AdPolicySnapshot;
};

const REMOTE_POLICY_SCHEMA_VERSION = 1;

let inMemoryPolicy: AdPolicySnapshot | null = null;
let refreshPromise: Promise<AdPolicySnapshot> | null = null;

function log(...args: unknown[]) {
  if (FEATURES.ads.diagnosticsLoggingEnabled) {
    console.log('[AdRemotePolicy]', ...args);
  }
}

function warn(...args: unknown[]) {
  if (FEATURES.ads.diagnosticsLoggingEnabled) {
    console.warn('[AdRemotePolicy]', ...args);
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

function createDefaultPolicy(
  overrides?: Partial<AdPolicySnapshot>
): AdPolicySnapshot {
  return {
    source: 'default',
    version: 1,
    fetchedAt: null,
    enabled: AD_POLICY.enabled,
    interstitialEnabled: AD_POLICY.interstitialEnabled,
    bannerEnabled: AD_POLICY.bannerEnabled,
    analyticsEnabled: AD_POLICY.analyticsEnabled,
    warmupSuccessfulScans: AD_POLICY.warmupSuccessfulScans,
    scansBetweenInterstitials: AD_POLICY.scansBetweenInterstitials,
    minInterstitialCooldownMs: AD_POLICY.minInterstitialCooldownMs,
    maxDailyInterstitials: AD_POLICY.maxDailyInterstitials,
    ...overrides,
  };
}

function normalizePolicy(
  raw: RemoteAdPolicyDocument | null | undefined,
  source: AdPolicySource,
  fetchedAt: number
): AdPolicySnapshot {
  const fallback = createDefaultPolicy();

  if (!raw || typeof raw !== 'object') {
    return createDefaultPolicy({
      source,
      fetchedAt,
    });
  }

  return {
    source,
    fetchedAt,
    version: clampInteger(raw.version, fallback.version, 1, 10_000),
    enabled: toBoolean(raw.enabled, fallback.enabled),
    interstitialEnabled: toBoolean(
      raw.interstitialEnabled,
      fallback.interstitialEnabled
    ),
    bannerEnabled: toBoolean(raw.bannerEnabled, fallback.bannerEnabled),
    analyticsEnabled: toBoolean(
      raw.analyticsEnabled,
      fallback.analyticsEnabled
    ),
    warmupSuccessfulScans: clampInteger(
      raw.warmupSuccessfulScans,
      fallback.warmupSuccessfulScans,
      0,
      50
    ),
    scansBetweenInterstitials: clampInteger(
      raw.scansBetweenInterstitials,
      fallback.scansBetweenInterstitials,
      1,
      50
    ),
    minInterstitialCooldownMs: clampInteger(
      raw.minInterstitialCooldownMs,
      fallback.minInterstitialCooldownMs,
      0,
      1000 * 60 * 60 * 12
    ),
    maxDailyInterstitials: clampInteger(
      raw.maxDailyInterstitials,
      fallback.maxDailyInterstitials,
      0,
      100
    ),
  };
}

function isPolicyFresh(policy: AdPolicySnapshot | null): boolean {
  if (!policy?.fetchedAt) {
    return false;
  }

  return Date.now() - policy.fetchedAt < AD_POLICY.remoteFetchTtlMs;
}

async function readStoredPolicy(): Promise<AdPolicySnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(AD_REMOTE_POLICY_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredRemotePolicyState>;
    const policy =
      parsed.policy && typeof parsed.policy === 'object'
        ? (parsed.policy as AdPolicySnapshot)
        : null;

    if (!policy) {
      return null;
    }

    return normalizePolicy(
      {
        version: policy.version,
        enabled: policy.enabled,
        interstitialEnabled: policy.interstitialEnabled,
        bannerEnabled: policy.bannerEnabled,
        analyticsEnabled: policy.analyticsEnabled,
        warmupSuccessfulScans: policy.warmupSuccessfulScans,
        scansBetweenInterstitials: policy.scansBetweenInterstitials,
        minInterstitialCooldownMs: policy.minInterstitialCooldownMs,
        maxDailyInterstitials: policy.maxDailyInterstitials,
      },
      policy.source === 'remote_live' ? 'local_cache' : policy.source,
      policy.fetchedAt ?? Date.now()
    );
  } catch (error) {
    warn('readStoredPolicy failed:', error);
    return null;
  }
}

async function writeStoredPolicy(policy: AdPolicySnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(
      AD_REMOTE_POLICY_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: REMOTE_POLICY_SCHEMA_VERSION,
        policy,
      } satisfies StoredRemotePolicyState)
    );
  } catch (error) {
    warn('writeStoredPolicy failed:', error);
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`remote_policy_timeout_${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

async function fetchRemotePolicy(): Promise<AdPolicySnapshot> {
  const docRef = doc(db, AD_REMOTE_POLICY_COLLECTION, AD_REMOTE_POLICY_DOCUMENT);
  const snapshot = await withTimeout(
    getDoc(docRef),
    AD_POLICY.remoteFetchTimeoutMs
  );

  const fetchedAt = Date.now();

  if (!snapshot.exists()) {
    const fallback = createDefaultPolicy({
      source: 'default',
      fetchedAt,
    });

    inMemoryPolicy = fallback;
    await writeStoredPolicy(fallback);

    return fallback;
  }

  const policy = normalizePolicy(
    snapshot.data() as RemoteAdPolicyDocument,
    'remote_live',
    fetchedAt
  );

  inMemoryPolicy = policy;
  await writeStoredPolicy(policy);

  if (policy.analyticsEnabled) {
    void analyticsService.track(
      'ad_policy_refresh_succeeded',
      {
        source: policy.source,
        version: policy.version,
        enabled: policy.enabled,
        interstitialEnabled: policy.interstitialEnabled,
        bannerEnabled: policy.bannerEnabled,
        analyticsEnabled: policy.analyticsEnabled,
      },
      { flush: false }
    );
  }

  log('remote policy loaded:', policy);

  return policy;
}

async function refreshPolicyInternal(): Promise<AdPolicySnapshot> {
  if (!FEATURES.ads.remotePolicyEnabled) {
    const fallback = createDefaultPolicy();
    inMemoryPolicy = fallback;
    return fallback;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      return await fetchRemotePolicy();
    } catch (error) {
      const fallback =
        inMemoryPolicy ?? (await readStoredPolicy()) ?? createDefaultPolicy();

      if (fallback.analyticsEnabled) {
        void analyticsService.track(
          'ad_policy_refresh_failed',
          {
            message: error instanceof Error ? error.message : String(error),
            fallbackSource: fallback.source,
            fallbackVersion: fallback.version,
          },
          { flush: false }
        );
      }

      warn('remote policy refresh failed, using fallback:', error);

      return fallback;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export const adRemotePolicyService = {
  async getResolvedPolicy(options?: {
    forceRefresh?: boolean;
    allowStale?: boolean;
  }): Promise<AdPolicySnapshot> {
    if (!FEATURES.ads.remotePolicyEnabled) {
      return createDefaultPolicy();
    }

    if (options?.forceRefresh) {
      return refreshPolicyInternal();
    }

    if (inMemoryPolicy && isPolicyFresh(inMemoryPolicy)) {
      return inMemoryPolicy;
    }

    const storedPolicy = inMemoryPolicy ?? (await readStoredPolicy());

    if (storedPolicy && isPolicyFresh(storedPolicy)) {
      inMemoryPolicy = storedPolicy;
      return storedPolicy;
    }

    if (storedPolicy && options?.allowStale) {
      inMemoryPolicy = storedPolicy;
      void refreshPolicyInternal().catch(() => undefined);
      return storedPolicy;
    }

    return refreshPolicyInternal();
  },

  async refreshPolicy(): Promise<AdPolicySnapshot> {
    return refreshPolicyInternal();
  },

  async clearCache(): Promise<void> {
    inMemoryPolicy = null;

    try {
      await AsyncStorage.removeItem(AD_REMOTE_POLICY_STORAGE_KEY);
    } catch (error) {
      warn('clearCache failed:', error);
    }
  },
};
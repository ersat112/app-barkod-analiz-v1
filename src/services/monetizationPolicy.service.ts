import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc } from 'firebase/firestore';

import { getEnvBoolean, getEnvNumber, getEnvString } from '../config/appRuntime';
import { auth, db } from '../config/firebase';
import {
  FEATURES,
  MONETIZATION_POLICY,
  MONETIZATION_POLICY_DOCUMENT,
  MONETIZATION_POLICY_STORAGE_KEY,
  RUNTIME_CONFIG_COLLECTION,
} from '../config/features';
import type {
  MonetizationPolicySnapshot,
  MonetizationPolicySource,
} from '../types/monetization';

type RemoteMonetizationPolicyDocument = Partial<{
  version: number;
  annualPlanEnabled: boolean;
  annualPriceTry: number;
  annualProductId: string;
  purchaseProviderEnabled: boolean;
  restoreEnabled: boolean;
  paywallEnabled: boolean;
  freeScanLimitEnabled: boolean;
  freeDailyScanLimit: number;
  updatedAt: unknown;
}>;

type StoredMonetizationPolicyState = {
  schemaVersion: number;
  policy: MonetizationPolicySnapshot;
};

const SCHEMA_VERSION = 1;

let inMemoryPolicy: MonetizationPolicySnapshot | null = null;
let refreshPromise: Promise<MonetizationPolicySnapshot> | null = null;

const ENV = process.env as Record<string, string | undefined>;

function log(...args: unknown[]) {
  if (FEATURES.monetization.diagnosticsLoggingEnabled) {
    console.log('[MonetizationPolicy]', ...args);
  }
}

function warn(...args: unknown[]) {
  if (FEATURES.monetization.diagnosticsLoggingEnabled) {
    console.warn('[MonetizationPolicy]', ...args);
  }
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function toNonEmptyString(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim();
  return normalized.length ? normalized : fallback;
}

function normalizeAnnualProductIdValue(value: unknown, fallback: string): string {
  const normalized = toNonEmptyString(value, fallback).trim();
  const fallbackNormalized = fallback.trim();

  if (!normalized) {
    return fallbackNormalized;
  }

  if (normalized.includes(':')) {
    return normalized;
  }

  if (fallbackNormalized.includes(':')) {
    return fallbackNormalized;
  }

  return normalized;
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

function clampPrice(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.round(value * 100) / 100;
}

function hasRuntimeOverride(key: string): boolean {
  return typeof ENV[key] === 'string' && ENV[key]!.trim().length > 0;
}

function applyRuntimeOverrides(
  policy: MonetizationPolicySnapshot
): MonetizationPolicySnapshot {
  let nextPolicy = policy;

  if (hasRuntimeOverride('EXPO_PUBLIC_MONETIZATION_ANNUAL_PLAN_ENABLED')) {
    nextPolicy = {
      ...nextPolicy,
      annualPlanEnabled: getEnvBoolean(
        'EXPO_PUBLIC_MONETIZATION_ANNUAL_PLAN_ENABLED',
        nextPolicy.annualPlanEnabled
      ),
    };
  }

  if (hasRuntimeOverride('EXPO_PUBLIC_MONETIZATION_PURCHASE_PROVIDER_ENABLED')) {
    nextPolicy = {
      ...nextPolicy,
      purchaseProviderEnabled: getEnvBoolean(
        'EXPO_PUBLIC_MONETIZATION_PURCHASE_PROVIDER_ENABLED',
        nextPolicy.purchaseProviderEnabled
      ),
    };
  }

  if (hasRuntimeOverride('EXPO_PUBLIC_MONETIZATION_RESTORE_ENABLED')) {
    nextPolicy = {
      ...nextPolicy,
      restoreEnabled: getEnvBoolean(
        'EXPO_PUBLIC_MONETIZATION_RESTORE_ENABLED',
        nextPolicy.restoreEnabled
      ),
    };
  }

  if (hasRuntimeOverride('EXPO_PUBLIC_MONETIZATION_PAYWALL_ENABLED')) {
    nextPolicy = {
      ...nextPolicy,
      paywallEnabled: getEnvBoolean(
        'EXPO_PUBLIC_MONETIZATION_PAYWALL_ENABLED',
        nextPolicy.paywallEnabled
      ),
    };
  }

  if (hasRuntimeOverride('EXPO_PUBLIC_MONETIZATION_ANNUAL_PRODUCT_ID')) {
    nextPolicy = {
      ...nextPolicy,
      annualProductId: normalizeAnnualProductIdValue(
        getEnvString(
          'EXPO_PUBLIC_MONETIZATION_ANNUAL_PRODUCT_ID',
          nextPolicy.annualProductId
        ).trim(),
        nextPolicy.annualProductId
      ),
    };
  }

  if (hasRuntimeOverride('EXPO_PUBLIC_MONETIZATION_ANNUAL_PRICE_TRY')) {
    nextPolicy = {
      ...nextPolicy,
      annualPriceTry: clampPrice(
        getEnvNumber(
          'EXPO_PUBLIC_MONETIZATION_ANNUAL_PRICE_TRY',
          nextPolicy.annualPriceTry
        ),
        nextPolicy.annualPriceTry
      ),
    };
  }

  return nextPolicy;
}

function createDefaultPolicy(
  overrides?: Partial<MonetizationPolicySnapshot>
): MonetizationPolicySnapshot {
  return {
    source: 'default',
    version: 1,
    fetchedAt: null,
    annualPlanEnabled: MONETIZATION_POLICY.annualPlanEnabled,
    annualPriceTry: MONETIZATION_POLICY.annualPriceTry,
    annualProductId: MONETIZATION_POLICY.annualProductId,
    purchaseProviderEnabled: MONETIZATION_POLICY.purchaseProviderEnabled,
    restoreEnabled: MONETIZATION_POLICY.restoreEnabled,
    paywallEnabled: MONETIZATION_POLICY.paywallEnabled,
    freeScanLimitEnabled: MONETIZATION_POLICY.freeScanLimitEnabled,
    freeDailyScanLimit: MONETIZATION_POLICY.freeDailyScanLimit,
    ...overrides,
  };
}

function normalizePolicy(
  raw: RemoteMonetizationPolicyDocument | null | undefined,
  source: MonetizationPolicySource,
  fetchedAt: number
): MonetizationPolicySnapshot {
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
    annualPlanEnabled: toBoolean(
      raw.annualPlanEnabled,
      fallback.annualPlanEnabled
    ),
    annualPriceTry: clampPrice(raw.annualPriceTry, fallback.annualPriceTry),
    annualProductId: normalizeAnnualProductIdValue(
      raw.annualProductId,
      fallback.annualProductId
    ),
    purchaseProviderEnabled: toBoolean(
      raw.purchaseProviderEnabled,
      fallback.purchaseProviderEnabled
    ),
    restoreEnabled: toBoolean(raw.restoreEnabled, fallback.restoreEnabled),
    paywallEnabled: toBoolean(raw.paywallEnabled, fallback.paywallEnabled),
    freeScanLimitEnabled: toBoolean(
      raw.freeScanLimitEnabled,
      fallback.freeScanLimitEnabled
    ),
    freeDailyScanLimit: clampInteger(
      raw.freeDailyScanLimit,
      fallback.freeDailyScanLimit,
      1,
      500
    ),
  };
}

function isPolicyFresh(policy: MonetizationPolicySnapshot | null): boolean {
  if (!policy?.fetchedAt) {
    return false;
  }

  return Date.now() - policy.fetchedAt < MONETIZATION_POLICY.remoteFetchTtlMs;
}

async function readStoredPolicy(): Promise<MonetizationPolicySnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(MONETIZATION_POLICY_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredMonetizationPolicyState>;
    const policy =
      parsed.policy && typeof parsed.policy === 'object'
        ? (parsed.policy as MonetizationPolicySnapshot)
        : null;

    if (!policy) {
      return null;
    }

    return normalizePolicy(
      {
        version: policy.version,
        annualPlanEnabled: policy.annualPlanEnabled,
        annualPriceTry: policy.annualPriceTry,
        annualProductId: policy.annualProductId,
        purchaseProviderEnabled: policy.purchaseProviderEnabled,
        restoreEnabled: policy.restoreEnabled,
        paywallEnabled: policy.paywallEnabled,
        freeScanLimitEnabled: policy.freeScanLimitEnabled,
        freeDailyScanLimit: policy.freeDailyScanLimit,
      },
      policy.source === 'remote_live' ? 'local_cache' : policy.source,
      policy.fetchedAt ?? Date.now()
    );
  } catch (error) {
    warn('readStoredPolicy failed:', error);
    return null;
  }
}

async function writeStoredPolicy(
  policy: MonetizationPolicySnapshot
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      MONETIZATION_POLICY_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        policy,
      } satisfies StoredMonetizationPolicyState)
    );
  } catch (error) {
    warn('writeStoredPolicy failed:', error);
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`monetization_policy_timeout_${timeoutMs}ms`));
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

async function fetchRemotePolicy(): Promise<MonetizationPolicySnapshot> {
  const currentUser = auth.currentUser;

  if (FEATURES.firebase.authenticatedUserRequired && !currentUser?.uid) {
    return (
      inMemoryPolicy ??
      (await readStoredPolicy()) ??
      createDefaultPolicy({
        fetchedAt: Date.now(),
      })
    );
  }

  const docRef = doc(db, RUNTIME_CONFIG_COLLECTION, MONETIZATION_POLICY_DOCUMENT);
  const snapshot = await withTimeout(
    getDoc(docRef),
    MONETIZATION_POLICY.remoteFetchTimeoutMs
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
    snapshot.data() as RemoteMonetizationPolicyDocument,
    'remote_live',
    fetchedAt
  );

  inMemoryPolicy = policy;
  await writeStoredPolicy(policy);

  log('remote monetization policy loaded:', policy);

  return policy;
}

async function refreshInternal(): Promise<MonetizationPolicySnapshot> {
  if (!FEATURES.monetization.remotePolicyEnabled) {
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

      warn('remote monetization policy refresh failed, using fallback:', error);

      inMemoryPolicy = fallback;
      return fallback;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export const monetizationPolicyService = {
  async getResolvedPolicy(options?: {
    forceRefresh?: boolean;
    allowStale?: boolean;
  }): Promise<MonetizationPolicySnapshot> {
    if (!FEATURES.monetization.remotePolicyEnabled) {
      return applyRuntimeOverrides(createDefaultPolicy());
    }

    if (options?.forceRefresh) {
      return applyRuntimeOverrides(await refreshInternal());
    }

    if (inMemoryPolicy && isPolicyFresh(inMemoryPolicy)) {
      return applyRuntimeOverrides(inMemoryPolicy);
    }

    const storedPolicy = inMemoryPolicy ?? (await readStoredPolicy());

    if (storedPolicy && isPolicyFresh(storedPolicy)) {
      inMemoryPolicy = storedPolicy;
      return applyRuntimeOverrides(storedPolicy);
    }

    if (storedPolicy && options?.allowStale) {
      inMemoryPolicy = storedPolicy;
      void refreshInternal().catch(() => undefined);
      return applyRuntimeOverrides(storedPolicy);
    }

    return applyRuntimeOverrides(await refreshInternal());
  },

  async refreshPolicy(): Promise<MonetizationPolicySnapshot> {
    return refreshInternal();
  },

  async clearCache(): Promise<void> {
    inMemoryPolicy = null;

    try {
      await AsyncStorage.removeItem(MONETIZATION_POLICY_STORAGE_KEY);
    } catch (error) {
      warn('clearCache failed:', error);
    }
  },
};
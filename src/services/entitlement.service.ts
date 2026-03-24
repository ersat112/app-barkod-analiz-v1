import AsyncStorage from '@react-native-async-storage/async-storage';

import { auth } from '../config/firebase';
import {
  ENTITLEMENT_STORAGE_KEY,
  FEATURES,
} from '../config/features';
import type {
  EntitlementSnapshot,
  EntitlementSource,
  MonetizationPlan,
  RestorePurchasesResult,
  StoredEntitlementState,
} from '../types/monetization';
import { monetizationPolicyService } from './monetizationPolicy.service';

const SCHEMA_VERSION = 1;

function log(...args: unknown[]) {
  if (FEATURES.monetization.diagnosticsLoggingEnabled) {
    console.log('[Entitlement]', ...args);
  }
}

function warn(...args: unknown[]) {
  if (FEATURES.monetization.diagnosticsLoggingEnabled) {
    console.warn('[Entitlement]', ...args);
  }
}

function getScopedStorageKey(): string {
  return `${ENTITLEMENT_STORAGE_KEY}:${auth.currentUser?.uid ?? 'anonymous'}`;
}

function normalizePlan(value: unknown): MonetizationPlan {
  return value === 'premium' ? 'premium' : 'free';
}

function normalizeSource(value: unknown): EntitlementSource {
  switch (value) {
    case 'local_cache':
    case 'provider_restore':
    case 'provider_purchase':
    case 'manual_override':
      return value;
    default:
      return 'default';
  }
}

function normalizeNullableDate(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function defaultStoredState(): StoredEntitlementState {
  return {
    schemaVersion: SCHEMA_VERSION,
    plan: 'free',
    source: 'default',
    activatedAt: null,
    expiresAt: null,
    lastValidatedAt: null,
  };
}

function normalizeStoredState(raw: unknown): StoredEntitlementState {
  if (!raw || typeof raw !== 'object') {
    return defaultStoredState();
  }

  const value = raw as Partial<StoredEntitlementState>;

  return {
    schemaVersion: SCHEMA_VERSION,
    plan: normalizePlan(value.plan),
    source: normalizeSource(value.source),
    activatedAt: normalizeNullableDate(value.activatedAt),
    expiresAt: normalizeNullableDate(value.expiresAt),
    lastValidatedAt: normalizeNullableDate(value.lastValidatedAt),
  };
}

async function readStoredState(): Promise<StoredEntitlementState> {
  try {
    const raw = await AsyncStorage.getItem(getScopedStorageKey());

    if (!raw) {
      return defaultStoredState();
    }

    return normalizeStoredState(JSON.parse(raw));
  } catch (error) {
    warn('readStoredState failed:', error);
    return defaultStoredState();
  }
}

async function writeStoredState(state: StoredEntitlementState): Promise<void> {
  try {
    await AsyncStorage.setItem(getScopedStorageKey(), JSON.stringify(state));
  } catch (error) {
    warn('writeStoredState failed:', error);
  }
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) {
    return false;
  }

  const expiresAtMs = new Date(expiresAt).getTime();

  if (Number.isNaN(expiresAtMs)) {
    return false;
  }

  return expiresAtMs <= Date.now();
}

function buildSnapshot(
  state: StoredEntitlementState,
  annualProductId: string,
  purchaseProviderEnabled: boolean,
  restoreEnabled: boolean
): EntitlementSnapshot {
  const premiumActive = state.plan === 'premium' && !isExpired(state.expiresAt);

  return {
    plan: premiumActive ? 'premium' : 'free',
    isPremium: premiumActive,
    adsSuppressed: premiumActive,
    unlimitedScans: premiumActive,
    providerReady: purchaseProviderEnabled,
    purchaseEnabled: purchaseProviderEnabled,
    restoreEnabled,
    annualProductId,
    source: premiumActive ? state.source : 'default',
    activatedAt: premiumActive ? state.activatedAt : null,
    expiresAt: premiumActive ? state.expiresAt : null,
    lastValidatedAt: state.lastValidatedAt,
  };
}

async function resolveSnapshotFromState(
  state: StoredEntitlementState
): Promise<EntitlementSnapshot> {
  const policy = await monetizationPolicyService.getResolvedPolicy({ allowStale: true });

  return buildSnapshot(
    state,
    policy.annualProductId,
    policy.purchaseProviderEnabled,
    policy.restoreEnabled
  );
}

export const entitlementService = {
  async getSnapshot(): Promise<EntitlementSnapshot> {
    const state = await readStoredState();
    return resolveSnapshotFromState(state);
  },

  async applyProviderEntitlement(input: {
    source: Extract<EntitlementSource, 'provider_restore' | 'provider_purchase'>;
    activatedAt?: string | null;
    expiresAt?: string | null;
    lastValidatedAt?: string | null;
  }): Promise<EntitlementSnapshot> {
    const now = new Date().toISOString();

    const nextState: StoredEntitlementState = {
      schemaVersion: SCHEMA_VERSION,
      plan: 'premium',
      source: input.source,
      activatedAt: normalizeNullableDate(input.activatedAt) ?? now,
      expiresAt: normalizeNullableDate(input.expiresAt),
      lastValidatedAt: normalizeNullableDate(input.lastValidatedAt) ?? now,
    };

    await writeStoredState(nextState);
    log('applyProviderEntitlement succeeded:', nextState);

    return resolveSnapshotFromState(nextState);
  },

  async restorePurchases(): Promise<RestorePurchasesResult> {
    const [policy, snapshot] = await Promise.all([
      monetizationPolicyService.getResolvedPolicy({ allowStale: true }),
      this.getSnapshot(),
    ]);

    if (!policy.restoreEnabled) {
      return {
        status: 'not_supported',
        snapshot,
        providerName: 'none',
        message: 'Geri yükleme akışı bu rollout içinde kapalı.',
        transactionId: null,
        customerId: null,
      };
    }

    if (!policy.purchaseProviderEnabled) {
      log('restorePurchases skipped: purchase provider disabled');

      return {
        status: 'not_supported',
        snapshot,
        providerName: 'none',
        message: 'Mağaza satın alma entegrasyonu bu build içinde aktif değil.',
        transactionId: null,
        customerId: null,
      };
    }

    return {
      status: 'no_active_purchase',
      snapshot,
      providerName: 'none',
      message: 'Geri yüklenecek aktif premium satın alma bulunamadı.',
      transactionId: null,
      customerId: null,
    };
  },

  async clearLocalState(): Promise<void> {
    try {
      await AsyncStorage.removeItem(getScopedStorageKey());
    } catch (error) {
      warn('clearLocalState failed:', error);
    }
  },
};
import AsyncStorage from '@react-native-async-storage/async-storage';

import { auth } from '../config/firebase';
import {
  FEATURES,
  FREE_SCAN_POLICY_STORAGE_KEY,
} from '../config/features';
import type {
  FreeScanAccessSnapshot,
  FreeScanPolicyState,
  FreeScanRegistrationResult,
  RewardedScanUnlockResult,
} from '../types/monetization';
import { entitlementService } from './entitlement.service';
import { monetizationPolicyService } from './monetizationPolicy.service';

const SCHEMA_VERSION = 2;
const REWARDED_EXTRA_SCANS_PER_UNLOCK = 2;
const REWARDED_DAILY_UNLOCK_CAP = 2;

function log(...args: unknown[]) {
  if (FEATURES.monetization.diagnosticsLoggingEnabled) {
    console.log('[FreeScanPolicy]', ...args);
  }
}

function warn(...args: unknown[]) {
  if (FEATURES.monetization.diagnosticsLoggingEnabled) {
    console.warn('[FreeScanPolicy]', ...args);
  }
}

function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getScopedStorageKey(): string {
  return `${FREE_SCAN_POLICY_STORAGE_KEY}:${auth.currentUser?.uid ?? 'anonymous'}`;
}

function defaultState(now = new Date()): FreeScanPolicyState {
  return {
    schemaVersion: SCHEMA_VERSION,
    dateKey: getLocalDateKey(now),
    successfulScanCount: 0,
    rewardedUnlockCount: 0,
    rewardedExtraScanCount: 0,
  };
}

function normalizeState(raw: unknown): FreeScanPolicyState {
  if (!raw || typeof raw !== 'object') {
    return defaultState();
  }

  const value = raw as Partial<FreeScanPolicyState>;
  const dateKey =
    typeof value.dateKey === 'string' && value.dateKey.trim()
      ? value.dateKey.trim()
      : getLocalDateKey();

  return {
    schemaVersion: SCHEMA_VERSION,
    dateKey,
    successfulScanCount:
      typeof value.successfulScanCount === 'number' &&
      Number.isFinite(value.successfulScanCount) &&
      value.successfulScanCount > 0
        ? Math.round(value.successfulScanCount)
        : 0,
    rewardedUnlockCount:
      typeof value.rewardedUnlockCount === 'number' &&
      Number.isFinite(value.rewardedUnlockCount) &&
      value.rewardedUnlockCount > 0
        ? Math.round(value.rewardedUnlockCount)
        : 0,
    rewardedExtraScanCount:
      typeof value.rewardedExtraScanCount === 'number' &&
      Number.isFinite(value.rewardedExtraScanCount) &&
      value.rewardedExtraScanCount > 0
        ? Math.round(value.rewardedExtraScanCount)
        : 0,
  };
}

function normalizeDailyState(
  state: FreeScanPolicyState,
  now = new Date()
): FreeScanPolicyState {
  const todayKey = getLocalDateKey(now);

  if (state.dateKey === todayKey) {
    return state;
  }

  return defaultState(now);
}

async function readState(): Promise<FreeScanPolicyState> {
  try {
    const raw = await AsyncStorage.getItem(getScopedStorageKey());

    if (!raw) {
      return defaultState();
    }

    return normalizeState(JSON.parse(raw));
  } catch (error) {
    warn('readState failed:', error);
    return defaultState();
  }
}

async function writeState(state: FreeScanPolicyState): Promise<void> {
  try {
    await AsyncStorage.setItem(getScopedStorageKey(), JSON.stringify(state));
  } catch (error) {
    warn('writeState failed:', error);
  }
}

function buildSnapshot(params: {
  state: FreeScanPolicyState;
  isPremium: boolean;
  plan: 'free' | 'premium';
  paywallEnabled: boolean;
  freeScanLimitEnabled: boolean;
  freeDailyScanLimit: number;
}): FreeScanAccessSnapshot {
  const limitEnabled =
    params.paywallEnabled &&
    params.freeScanLimitEnabled &&
    !params.isPremium;

  const dailyLimit = limitEnabled ? params.freeDailyScanLimit : null;
  const usedCount = params.state.successfulScanCount;
  const rewardedExtraScanCount = limitEnabled ? params.state.rewardedExtraScanCount : 0;
  const totalLimit =
    dailyLimit == null ? null : Math.max(dailyLimit + rewardedExtraScanCount, 0);
  const remainingCount =
    totalLimit == null ? null : Math.max(totalLimit - usedCount, 0);

  return {
    fetchedAt: new Date().toISOString(),
    dateKey: params.state.dateKey,
    limitEnabled,
    dailyLimit,
    usedCount,
    remainingCount,
    hasReachedLimit: Boolean(totalLimit != null && usedCount >= totalLimit),
    entitlementPlan: params.plan,
    paywallEnabled: params.paywallEnabled,
    rewardedUnlockCount: params.state.rewardedUnlockCount,
    rewardedExtraScanCount,
    rewardedExtraScansPerUnlock: REWARDED_EXTRA_SCANS_PER_UNLOCK,
    rewardedDailyUnlockCap: REWARDED_DAILY_UNLOCK_CAP,
  };
}

export const freeScanPolicyService = {
  async getSnapshot(): Promise<FreeScanAccessSnapshot> {
    const [policy, entitlement, rawState] = await Promise.all([
      monetizationPolicyService.getResolvedPolicy({ allowStale: true }),
      entitlementService.getSnapshot(),
      readState(),
    ]);

    const state = normalizeDailyState(rawState);

    if (state.dateKey !== rawState.dateKey) {
      await writeState(state);
    }

    return buildSnapshot({
      state,
      isPremium: entitlement.isPremium,
      plan: entitlement.plan,
      paywallEnabled: policy.paywallEnabled,
      freeScanLimitEnabled: policy.freeScanLimitEnabled,
      freeDailyScanLimit: policy.freeDailyScanLimit,
    });
  },

  async registerSuccessfulScan(): Promise<FreeScanRegistrationResult> {
    const [policy, entitlement, rawState] = await Promise.all([
      monetizationPolicyService.getResolvedPolicy({ allowStale: true }),
      entitlementService.getSnapshot(),
      readState(),
    ]);

    let state = normalizeDailyState(rawState);

    const currentSnapshot = buildSnapshot({
      state,
      isPremium: entitlement.isPremium,
      plan: entitlement.plan,
      paywallEnabled: policy.paywallEnabled,
      freeScanLimitEnabled: policy.freeScanLimitEnabled,
      freeDailyScanLimit: policy.freeDailyScanLimit,
    });

    if (!currentSnapshot.limitEnabled) {
      return {
        allowed: true,
        reason: entitlement.isPremium ? 'premium' : 'limit_disabled',
        snapshot: currentSnapshot,
      };
    }

    if (currentSnapshot.hasReachedLimit) {
      log('scan blocked by free limit:', currentSnapshot);

      return {
        allowed: false,
        reason: 'limit_reached',
        snapshot: currentSnapshot,
      };
    }

    state = {
      ...state,
      successfulScanCount: state.successfulScanCount + 1,
    };

    await writeState(state);

    const nextSnapshot = buildSnapshot({
      state,
      isPremium: entitlement.isPremium,
      plan: entitlement.plan,
      paywallEnabled: policy.paywallEnabled,
      freeScanLimitEnabled: policy.freeScanLimitEnabled,
      freeDailyScanLimit: policy.freeDailyScanLimit,
    });

    return {
      allowed: true,
      reason: 'allowed',
      snapshot: nextSnapshot,
    };
  },

  async revertLastSuccessfulScan(): Promise<FreeScanAccessSnapshot> {
    const [policy, entitlement, rawState] = await Promise.all([
      monetizationPolicyService.getResolvedPolicy({ allowStale: true }),
      entitlementService.getSnapshot(),
      readState(),
    ]);

    let state = normalizeDailyState(rawState);

    if (state.successfulScanCount > 0) {
      state = {
        ...state,
        successfulScanCount: state.successfulScanCount - 1,
      };

      await writeState(state);
    }

    return buildSnapshot({
      state,
      isPremium: entitlement.isPremium,
      plan: entitlement.plan,
      paywallEnabled: policy.paywallEnabled,
      freeScanLimitEnabled: policy.freeScanLimitEnabled,
      freeDailyScanLimit: policy.freeDailyScanLimit,
    });
  },

  async clearLocalState(): Promise<void> {
    try {
      await AsyncStorage.removeItem(getScopedStorageKey());
    } catch (error) {
      warn('clearLocalState failed:', error);
    }
  },

  async grantRewardedExtraScans(): Promise<RewardedScanUnlockResult> {
    const [policy, entitlement, rawState] = await Promise.all([
      monetizationPolicyService.getResolvedPolicy({ allowStale: true }),
      entitlementService.getSnapshot(),
      readState(),
    ]);

    let state = normalizeDailyState(rawState);

    const currentSnapshot = buildSnapshot({
      state,
      isPremium: entitlement.isPremium,
      plan: entitlement.plan,
      paywallEnabled: policy.paywallEnabled,
      freeScanLimitEnabled: policy.freeScanLimitEnabled,
      freeDailyScanLimit: policy.freeDailyScanLimit,
    });

    if (!currentSnapshot.limitEnabled) {
      return {
        granted: false,
        reason: entitlement.isPremium ? 'premium' : 'limit_disabled',
        snapshot: currentSnapshot,
      };
    }

    if (!currentSnapshot.hasReachedLimit) {
      return {
        granted: false,
        reason: 'not_needed',
        snapshot: currentSnapshot,
      };
    }

    if (state.rewardedUnlockCount >= REWARDED_DAILY_UNLOCK_CAP) {
      return {
        granted: false,
        reason: 'daily_cap_reached',
        snapshot: currentSnapshot,
      };
    }

    state = {
      ...state,
      rewardedUnlockCount: state.rewardedUnlockCount + 1,
      rewardedExtraScanCount:
        state.rewardedExtraScanCount + REWARDED_EXTRA_SCANS_PER_UNLOCK,
    };

    await writeState(state);

    return {
      granted: true,
      reason: 'granted',
      snapshot: buildSnapshot({
        state,
        isPremium: entitlement.isPremium,
        plan: entitlement.plan,
        paywallEnabled: policy.paywallEnabled,
        freeScanLimitEnabled: policy.freeScanLimitEnabled,
        freeDailyScanLimit: policy.freeDailyScanLimit,
      }),
    };
  },
};

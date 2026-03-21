import AsyncStorage from '@react-native-async-storage/async-storage';

import { AD_POLICY, FEATURES } from '../config/features';

const STORAGE_KEY = 'erenesal_ad_policy_state_v1';
const STATE_SCHEMA_VERSION = 1;

type StoredAdPolicyState = {
  schemaVersion: number;
  successfulScanCount: number;
  lastInterstitialAt: number | null;
  lastInterstitialSuccessfulScanCount: number | null;
  dailyInterstitialDate: string;
  dailyInterstitialCount: number;
};

export type AdPolicyStats = {
  successfulScanCount: number;
  lastInterstitialAt: number | null;
  lastInterstitialSuccessfulScanCount: number | null;
  dailyInterstitialDate: string;
  dailyInterstitialCount: number;
};

export type InterstitialDecisionReason =
  | 'policy_disabled'
  | 'warmup'
  | 'cadence'
  | 'cooldown'
  | 'daily_cap'
  | 'eligible';

export type InterstitialDecision = {
  shouldShow: boolean;
  reason: InterstitialDecisionReason;
  successfulScanCount: number;
  scansSinceLastInterstitial: number;
  cooldownRemainingMs: number;
  dailyInterstitialCount: number;
  dailyCapRemaining: number;
};

const getLocalDateKey = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const defaultState = (): StoredAdPolicyState => ({
  schemaVersion: STATE_SCHEMA_VERSION,
  successfulScanCount: 0,
  lastInterstitialAt: null,
  lastInterstitialSuccessfulScanCount: null,
  dailyInterstitialDate: getLocalDateKey(),
  dailyInterstitialCount: 0,
});

const toSafeNumber = (value: unknown, fallback = 0): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const normalizeState = (raw: unknown): StoredAdPolicyState => {
  if (!raw || typeof raw !== 'object') {
    return defaultState();
  }

  const value = raw as Partial<StoredAdPolicyState>;
  const normalized: StoredAdPolicyState = {
    schemaVersion: STATE_SCHEMA_VERSION,
    successfulScanCount: Math.max(0, toSafeNumber(value.successfulScanCount, 0)),
    lastInterstitialAt:
      typeof value.lastInterstitialAt === 'number' && value.lastInterstitialAt > 0
        ? value.lastInterstitialAt
        : null,
    lastInterstitialSuccessfulScanCount:
      typeof value.lastInterstitialSuccessfulScanCount === 'number' &&
      value.lastInterstitialSuccessfulScanCount > 0
        ? value.lastInterstitialSuccessfulScanCount
        : null,
    dailyInterstitialDate:
      typeof value.dailyInterstitialDate === 'string' && value.dailyInterstitialDate.trim()
        ? value.dailyInterstitialDate
        : getLocalDateKey(),
    dailyInterstitialCount: Math.max(0, toSafeNumber(value.dailyInterstitialCount, 0)),
  };

  return normalized;
};

const normalizeDailyState = (
  state: StoredAdPolicyState,
  now = new Date()
): StoredAdPolicyState => {
  const todayKey = getLocalDateKey(now);

  if (state.dailyInterstitialDate === todayKey) {
    return state;
  }

  return {
    ...state,
    dailyInterstitialDate: todayKey,
    dailyInterstitialCount: 0,
  };
};

const readState = async (): Promise<StoredAdPolicyState> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return defaultState();
    }

    return normalizeState(JSON.parse(raw));
  } catch (error) {
    console.warn('[AdPolicy] readState failed:', error);
    return defaultState();
  }
};

const writeState = async (state: StoredAdPolicyState): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('[AdPolicy] writeState failed:', error);
  }
};

export const adPolicyService = {
  async getStats(): Promise<AdPolicyStats> {
    const state = normalizeDailyState(await readState());

    return {
      successfulScanCount: state.successfulScanCount,
      lastInterstitialAt: state.lastInterstitialAt,
      lastInterstitialSuccessfulScanCount: state.lastInterstitialSuccessfulScanCount,
      dailyInterstitialDate: state.dailyInterstitialDate,
      dailyInterstitialCount: state.dailyInterstitialCount,
    };
  },

  async reset(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      console.log('[AdPolicy] state reset');
    } catch (error) {
      console.warn('[AdPolicy] reset failed:', error);
    }
  },

  async evaluateSuccessfulScanInterstitial(): Promise<InterstitialDecision> {
    const now = Date.now();
    let state = normalizeDailyState(await readState(), new Date(now));

    state = {
      ...state,
      successfulScanCount: state.successfulScanCount + 1,
    };

    await writeState(state);

    const scansSinceLastInterstitial =
      state.lastInterstitialSuccessfulScanCount == null
        ? state.successfulScanCount
        : state.successfulScanCount - state.lastInterstitialSuccessfulScanCount;

    const cooldownRemainingMs =
      state.lastInterstitialAt == null
        ? 0
        : Math.max(
            AD_POLICY.minInterstitialCooldownMs - (now - state.lastInterstitialAt),
            0
          );

    const dailyCapRemaining = Math.max(
      0,
      AD_POLICY.maxDailyInterstitials - state.dailyInterstitialCount
    );

    if (!FEATURES.scanner.reducedInterstitialEnabled) {
      const shouldShowLegacy = state.successfulScanCount % 2 === 1;

      return {
        shouldShow: shouldShowLegacy,
        reason: shouldShowLegacy ? 'eligible' : 'cadence',
        successfulScanCount: state.successfulScanCount,
        scansSinceLastInterstitial,
        cooldownRemainingMs,
        dailyInterstitialCount: state.dailyInterstitialCount,
        dailyCapRemaining,
      };
    }

    if (state.successfulScanCount <= AD_POLICY.warmupSuccessfulScans) {
      return {
        shouldShow: false,
        reason: 'warmup',
        successfulScanCount: state.successfulScanCount,
        scansSinceLastInterstitial,
        cooldownRemainingMs,
        dailyInterstitialCount: state.dailyInterstitialCount,
        dailyCapRemaining,
      };
    }

    if (state.dailyInterstitialCount >= AD_POLICY.maxDailyInterstitials) {
      return {
        shouldShow: false,
        reason: 'daily_cap',
        successfulScanCount: state.successfulScanCount,
        scansSinceLastInterstitial,
        cooldownRemainingMs,
        dailyInterstitialCount: state.dailyInterstitialCount,
        dailyCapRemaining,
      };
    }

    if (cooldownRemainingMs > 0) {
      return {
        shouldShow: false,
        reason: 'cooldown',
        successfulScanCount: state.successfulScanCount,
        scansSinceLastInterstitial,
        cooldownRemainingMs,
        dailyInterstitialCount: state.dailyInterstitialCount,
        dailyCapRemaining,
      };
    }

    if (scansSinceLastInterstitial < AD_POLICY.scansBetweenInterstitials) {
      return {
        shouldShow: false,
        reason: 'cadence',
        successfulScanCount: state.successfulScanCount,
        scansSinceLastInterstitial,
        cooldownRemainingMs,
        dailyInterstitialCount: state.dailyInterstitialCount,
        dailyCapRemaining,
      };
    }

    return {
      shouldShow: true,
      reason: 'eligible',
      successfulScanCount: state.successfulScanCount,
      scansSinceLastInterstitial,
      cooldownRemainingMs,
      dailyInterstitialCount: state.dailyInterstitialCount,
      dailyCapRemaining,
    };
  },

  async recordInterstitialShown(params?: {
    shownAt?: number;
    successfulScanCount?: number;
  }): Promise<void> {
    const shownAt = params?.shownAt ?? Date.now();
    let state = normalizeDailyState(await readState(), new Date(shownAt));

    state = {
      ...state,
      successfulScanCount: Math.max(
        state.successfulScanCount,
        params?.successfulScanCount ?? state.successfulScanCount
      ),
      lastInterstitialAt: shownAt,
      lastInterstitialSuccessfulScanCount:
        params?.successfulScanCount ?? state.successfulScanCount,
      dailyInterstitialCount: state.dailyInterstitialCount + 1,
    };

    await writeState(state);
  },
};
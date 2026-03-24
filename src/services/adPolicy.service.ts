import AsyncStorage from '@react-native-async-storage/async-storage';

import { FEATURES } from '../config/features';
import type {
  AdPolicySnapshot,
  AdPolicyStats,
  InterstitialDecision,
  InterstitialDecisionReason,
} from '../types/ads';
import { analyticsService } from './analytics.service';
import { adRemotePolicyService } from './adRemotePolicy.service';

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

function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function defaultState(): StoredAdPolicyState {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    successfulScanCount: 0,
    lastInterstitialAt: null,
    lastInterstitialSuccessfulScanCount: null,
    dailyInterstitialDate: getLocalDateKey(),
    dailyInterstitialCount: 0,
  };
}

function toSafeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeState(raw: unknown): StoredAdPolicyState {
  if (!raw || typeof raw !== 'object') {
    return defaultState();
  }

  const value = raw as Partial<StoredAdPolicyState>;

  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    successfulScanCount: Math.max(
      0,
      Math.round(toSafeNumber(value.successfulScanCount, 0))
    ),
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
      typeof value.dailyInterstitialDate === 'string' &&
      value.dailyInterstitialDate.trim()
        ? value.dailyInterstitialDate
        : getLocalDateKey(),
    dailyInterstitialCount: Math.max(
      0,
      Math.round(toSafeNumber(value.dailyInterstitialCount, 0))
    ),
  };
}

function normalizeDailyState(
  state: StoredAdPolicyState,
  now = new Date()
): StoredAdPolicyState {
  const todayKey = getLocalDateKey(now);

  if (state.dailyInterstitialDate === todayKey) {
    return state;
  }

  return {
    ...state,
    dailyInterstitialDate: todayKey,
    dailyInterstitialCount: 0,
  };
}

async function readState(): Promise<StoredAdPolicyState> {
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
}

async function writeState(state: StoredAdPolicyState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('[AdPolicy] writeState failed:', error);
  }
}

function buildDecision(
  state: StoredAdPolicyState,
  policy: AdPolicySnapshot,
  reason: InterstitialDecisionReason
): InterstitialDecision {
  const now = Date.now();

  const scansSinceLastInterstitial =
    state.lastInterstitialSuccessfulScanCount == null
      ? state.successfulScanCount
      : state.successfulScanCount - state.lastInterstitialSuccessfulScanCount;

  const cooldownRemainingMs =
    state.lastInterstitialAt == null
      ? 0
      : Math.max(
          policy.minInterstitialCooldownMs - (now - state.lastInterstitialAt),
          0
        );

  return {
    shouldShow: reason === 'eligible',
    reason,
    successfulScanCount: state.successfulScanCount,
    scansSinceLastInterstitial,
    cooldownRemainingMs,
    dailyInterstitialCount: state.dailyInterstitialCount,
    dailyCapRemaining: Math.max(
      0,
      policy.maxDailyInterstitials - state.dailyInterstitialCount
    ),
    policySource: policy.source,
    policyVersion: policy.version,
  };
}

async function trackDecision(
  policy: AdPolicySnapshot,
  decision: InterstitialDecision
): Promise<void> {
  if (!policy.analyticsEnabled) {
    return;
  }

  await analyticsService.track(
    'ad_interstitial_evaluated',
    {
      reason: decision.reason,
      shouldShow: decision.shouldShow,
      successfulScanCount: decision.successfulScanCount,
      scansSinceLastInterstitial: decision.scansSinceLastInterstitial,
      cooldownRemainingMs: decision.cooldownRemainingMs,
      dailyInterstitialCount: decision.dailyInterstitialCount,
      dailyCapRemaining: decision.dailyCapRemaining,
      policySource: decision.policySource,
      policyVersion: decision.policyVersion,
      policyEnabled: policy.enabled,
      interstitialEnabled: policy.interstitialEnabled,
    },
    { flush: false }
  );
}

export const adPolicyService = {
  async getStats(): Promise<AdPolicyStats> {
    const state = normalizeDailyState(await readState());

    return {
      successfulScanCount: state.successfulScanCount,
      lastInterstitialAt: state.lastInterstitialAt,
      lastInterstitialSuccessfulScanCount:
        state.lastInterstitialSuccessfulScanCount,
      dailyInterstitialDate: state.dailyInterstitialDate,
      dailyInterstitialCount: state.dailyInterstitialCount,
    };
  },

  async getCurrentPolicy(): Promise<AdPolicySnapshot> {
    return adRemotePolicyService.getResolvedPolicy({ allowStale: true });
  },

  async syncRemotePolicy(): Promise<AdPolicySnapshot> {
    return adRemotePolicyService.refreshPolicy();
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

    const policy = await adRemotePolicyService.getResolvedPolicy({
      allowStale: true,
    });

    if (!FEATURES.scanner.reducedInterstitialEnabled) {
      const legacyDecision = buildDecision(
        state,
        policy,
        state.successfulScanCount % 2 === 1 ? 'eligible' : 'cadence'
      );

      await trackDecision(policy, legacyDecision);
      return legacyDecision;
    }

    if (!policy.enabled || !policy.interstitialEnabled) {
      const decision = buildDecision(state, policy, 'policy_disabled');
      await trackDecision(policy, decision);
      return decision;
    }

    if (state.successfulScanCount <= policy.warmupSuccessfulScans) {
      const decision = buildDecision(state, policy, 'warmup');
      await trackDecision(policy, decision);
      return decision;
    }

    if (state.dailyInterstitialCount >= policy.maxDailyInterstitials) {
      const decision = buildDecision(state, policy, 'daily_cap');
      await trackDecision(policy, decision);
      return decision;
    }

    const scansSinceLastInterstitial =
      state.lastInterstitialSuccessfulScanCount == null
        ? state.successfulScanCount
        : state.successfulScanCount - state.lastInterstitialSuccessfulScanCount;

    if (scansSinceLastInterstitial < policy.scansBetweenInterstitials) {
      const decision = buildDecision(state, policy, 'cadence');
      await trackDecision(policy, decision);
      return decision;
    }

    const cooldownRemainingMs =
      state.lastInterstitialAt == null
        ? 0
        : Math.max(
            policy.minInterstitialCooldownMs - (now - state.lastInterstitialAt),
            0
          );

    if (cooldownRemainingMs > 0) {
      const decision = buildDecision(state, policy, 'cooldown');
      await trackDecision(policy, decision);
      return decision;
    }

    const decision = buildDecision(state, policy, 'eligible');
    await trackDecision(policy, decision);
    return decision;
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

    const policy = await adRemotePolicyService.getResolvedPolicy({
      allowStale: true,
    });

    if (!policy.analyticsEnabled) {
      return;
    }

    await analyticsService.track(
      'ad_interstitial_shown',
      {
        shownAt,
        successfulScanCount: state.successfulScanCount,
        dailyInterstitialCount: state.dailyInterstitialCount,
        remainingDailyCap: Math.max(
          0,
          policy.maxDailyInterstitials - state.dailyInterstitialCount
        ),
        policySource: policy.source,
        policyVersion: policy.version,
      },
      { flush: false }
    );
  },
};

export type {
  AdPolicyStats,
  InterstitialDecision,
  InterstitialDecisionReason,
} from '../types/ads';

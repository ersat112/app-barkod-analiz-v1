import { AD_UNIT_ID, GLOBAL_AD_CONFIG } from '../config/admob';
import type {
  AdPolicySnapshot,
  AdPolicyStats,
  AnalyticsEventPayload,
  InterstitialDecision,
} from '../types/ads';
import type { DiagnosticsTimestamp } from '../types/diagnostics';
import { getAdMobModule } from './admobRuntime';
import { analyticsService } from './analytics.service';
import { adPolicyService } from './adPolicy.service';
import { adRemotePolicyService } from './adRemotePolicy.service';

export type AdDiagnosticsSnapshot = {
  fetchedAt: DiagnosticsTimestamp;
  policy: AdPolicySnapshot;
  stats: AdPolicyStats;
  analyticsQueueSize: number;
};

let preparedInterstitial: any = null;
let preparedInterstitialLoaded = false;
let preparedInterstitialSetup = false;
let preparedRewarded: any = null;
let preparedRewardedLoaded = false;
let preparedRewardedSetup = false;
let preparedAppOpen: any = null;
let preparedAppOpenLoaded = false;
let preparedAppOpenSetup = false;
let appOpenShownThisLaunch = false;

function serializeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === 'string' ? error : JSON.stringify(error);
}

function clearPreparedInterstitial() {
  preparedInterstitial = null;
  preparedInterstitialLoaded = false;
  preparedInterstitialSetup = false;
}

function clearPreparedRewarded() {
  preparedRewarded = null;
  preparedRewardedLoaded = false;
  preparedRewardedSetup = false;
}

function clearPreparedAppOpen() {
  preparedAppOpen = null;
  preparedAppOpenLoaded = false;
  preparedAppOpenSetup = false;
}

export const adService = {
  async bootstrap(): Promise<AdPolicySnapshot> {
    const [policy] = await Promise.all([
      adRemotePolicyService.getResolvedPolicy({ allowStale: true }),
      analyticsService.flushPending(),
    ]);

    return policy;
  },

  async getCurrentPolicy(): Promise<AdPolicySnapshot> {
    return adRemotePolicyService.getResolvedPolicy({ allowStale: true });
  },

  async prepareInterstitial(): Promise<boolean> {
    const policy = await adRemotePolicyService.getResolvedPolicy({
      allowStale: true,
    });

    if (!policy.enabled || !policy.interstitialEnabled) {
      clearPreparedInterstitial();
      return false;
    }

    if (preparedInterstitialSetup && preparedInterstitial) {
      return preparedInterstitialLoaded;
    }

    const adsModule = getAdMobModule();

    if (!adsModule?.InterstitialAd || !adsModule?.AdEventType) {
      clearPreparedInterstitial();
      return false;
    }

    const { InterstitialAd, AdEventType } = adsModule;
    const interstitial = InterstitialAd.createForAdRequest(
      AD_UNIT_ID.INTERSTITIAL,
      GLOBAL_AD_CONFIG
    );

    interstitial.addAdEventListener(AdEventType.LOADED, () => {
      console.log('[Interstitial] loaded');
      preparedInterstitialLoaded = true;
    });

    interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      console.log('[Interstitial] closed');
      preparedInterstitialLoaded = false;
      interstitial.load();
    });

    interstitial.addAdEventListener(AdEventType.ERROR, (error: unknown) => {
      console.log('[Interstitial] failed', error);
      preparedInterstitialLoaded = false;
    });

    interstitial.load();

    preparedInterstitial = interstitial;
    preparedInterstitialSetup = true;

    return preparedInterstitialLoaded;
  },

  async prepareRewardedAd(): Promise<boolean> {
    const policy = await adRemotePolicyService.getResolvedPolicy({
      allowStale: true,
    });

    if (!policy.enabled || !policy.interstitialEnabled) {
      clearPreparedRewarded();
      return false;
    }

    if (preparedRewardedSetup && preparedRewarded) {
      return preparedRewardedLoaded;
    }

    const adsModule = getAdMobModule();

    if (
      !adsModule?.RewardedAd ||
      !adsModule?.AdEventType ||
      !adsModule?.RewardedAdEventType
    ) {
      clearPreparedRewarded();
      return false;
    }

    const { RewardedAd, RewardedAdEventType, AdEventType } = adsModule;
    const rewardedAd = RewardedAd.createForAdRequest(
      AD_UNIT_ID.REWARDED,
      GLOBAL_AD_CONFIG
    );

    rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
      console.log('[RewardedAd] loaded');
      preparedRewardedLoaded = true;
    });

    rewardedAd.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward: unknown) => {
      console.log('[RewardedAd] earned reward', reward);
    });

    rewardedAd.addAdEventListener(AdEventType.CLOSED, () => {
      console.log('[RewardedAd] closed');
      preparedRewardedLoaded = false;
      rewardedAd.load();
    });

    rewardedAd.addAdEventListener(AdEventType.ERROR, (error: unknown) => {
      console.log('[RewardedAd] failed', error);
      preparedRewardedLoaded = false;
    });

    rewardedAd.load();

    preparedRewarded = rewardedAd;
    preparedRewardedSetup = true;

    return preparedRewardedLoaded;
  },

  isRewardedAdReady(): boolean {
    return Boolean(preparedRewarded && preparedRewardedLoaded);
  },

  async showPreparedRewardedAd(): Promise<boolean> {
    if (!preparedRewarded || !preparedRewardedLoaded) {
      return false;
    }

    await preparedRewarded.show();
    return true;
  },

  async showRewardedAdForUnlock(): Promise<{ shown: boolean; rewarded: boolean }> {
    if (!preparedRewarded || !preparedRewardedLoaded) {
      return { shown: false, rewarded: false };
    }

    const adsModule = getAdMobModule();

    if (!adsModule?.RewardedAdEventType || !adsModule?.AdEventType) {
      try {
        await preparedRewarded.show();
        return { shown: true, rewarded: false };
      } catch {
        return { shown: false, rewarded: false };
      }
    }

    const { RewardedAdEventType, AdEventType } = adsModule;

    return new Promise((resolve) => {
      let rewardEarned = false;
      let settled = false;

      const cleanup = () => {
        unsubscribeReward?.();
        unsubscribeClosed?.();
        unsubscribeError?.();
      };

      const settle = (result: { shown: boolean; rewarded: boolean }) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        resolve(result);
      };

      const unsubscribeReward = preparedRewarded.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        () => {
          rewardEarned = true;
        }
      );
      const unsubscribeClosed = preparedRewarded.addAdEventListener(
        AdEventType.CLOSED,
        () => {
          settle({ shown: true, rewarded: rewardEarned });
        }
      );
      const unsubscribeError = preparedRewarded.addAdEventListener(
        AdEventType.ERROR,
        () => {
          settle({ shown: false, rewarded: false });
        }
      );

      void preparedRewarded.show().catch(() => {
        settle({ shown: false, rewarded: false });
      });
    });
  },

  async prepareAppOpenAd(): Promise<boolean> {
    const policy = await adRemotePolicyService.getResolvedPolicy({
      allowStale: true,
    });

    if (!policy.enabled || !policy.interstitialEnabled) {
      clearPreparedAppOpen();
      return false;
    }

    if (preparedAppOpenSetup && preparedAppOpen) {
      return preparedAppOpenLoaded;
    }

    const adsModule = getAdMobModule();

    if (!adsModule?.AppOpenAd || !adsModule?.AdEventType) {
      clearPreparedAppOpen();
      return false;
    }

    const { AppOpenAd, AdEventType } = adsModule;
    const appOpenAd = AppOpenAd.createForAdRequest(
      AD_UNIT_ID.APP_OPEN,
      GLOBAL_AD_CONFIG
    );

    appOpenAd.addAdEventListener(AdEventType.LOADED, () => {
      console.log('[AppOpenAd] loaded');
      preparedAppOpenLoaded = true;
    });

    appOpenAd.addAdEventListener(AdEventType.CLOSED, () => {
      console.log('[AppOpenAd] closed');
      preparedAppOpenLoaded = false;
      clearPreparedAppOpen();
    });

    appOpenAd.addAdEventListener(AdEventType.ERROR, (error: unknown) => {
      console.log('[AppOpenAd] failed', error);
      preparedAppOpenLoaded = false;
    });

    appOpenAd.load();

    preparedAppOpen = appOpenAd;
    preparedAppOpenSetup = true;

    return preparedAppOpenLoaded;
  },

  isAppOpenAdReady(): boolean {
    return Boolean(preparedAppOpen && preparedAppOpenLoaded);
  },

  async showAppOpenAdOnce(): Promise<boolean> {
    if (appOpenShownThisLaunch || !preparedAppOpen || !preparedAppOpenLoaded) {
      return false;
    }

    appOpenShownThisLaunch = true;
    await preparedAppOpen.show();
    return true;
  },

  isInterstitialReady(): boolean {
    return Boolean(preparedInterstitial && preparedInterstitialLoaded);
  },

  async showPreparedInterstitial(): Promise<boolean> {
    if (!preparedInterstitial || !preparedInterstitialLoaded) {
      return false;
    }

    await preparedInterstitial.show();
    return true;
  },

  async syncRemotePolicy(forceRefresh = false): Promise<AdPolicySnapshot> {
    return forceRefresh
      ? adRemotePolicyService.refreshPolicy()
      : adRemotePolicyService.getResolvedPolicy({ allowStale: true });
  },

  async getStats(): Promise<AdPolicyStats> {
    return adPolicyService.getStats();
  },

  async getAnalyticsQueueSize(): Promise<number> {
    return analyticsService.getQueueSize();
  },

  async getDiagnosticsSnapshot(options?: {
    forcePolicyRefresh?: boolean;
    flushAnalytics?: boolean;
  }): Promise<AdDiagnosticsSnapshot> {
    if (options?.flushAnalytics) {
      await analyticsService.flushPending();
    }

    const [policy, stats, analyticsQueueSize] = await Promise.all([
      this.syncRemotePolicy(Boolean(options?.forcePolicyRefresh)),
      adPolicyService.getStats(),
      analyticsService.getQueueSize(),
    ]);

    return {
      fetchedAt: new Date().toISOString(),
      policy,
      stats,
      analyticsQueueSize,
    };
  },

  async reset(): Promise<void> {
    clearPreparedInterstitial();
    clearPreparedRewarded();
    clearPreparedAppOpen();
    appOpenShownThisLaunch = false;
    await adPolicyService.reset();
  },

  async evaluateScanInterstitialOpportunity(): Promise<InterstitialDecision> {
    const decision = await adPolicyService.evaluateSuccessfulScanInterstitial();
    console.log('[AdService] evaluateScanInterstitialOpportunity', decision);
    return decision;
  },

  async recordInterstitialShown(params?: {
    shownAt?: number;
    successfulScanCount?: number;
  }): Promise<void> {
    await adPolicyService.recordInterstitialShown(params);
  },

  async trackInterstitialShowFailure(
    error: unknown,
    context?: AnalyticsEventPayload
  ): Promise<void> {
    const policy = await adRemotePolicyService.getResolvedPolicy({
      allowStale: true,
    });

    if (!policy.analyticsEnabled) {
      return;
    }

    await analyticsService.track(
      'ad_interstitial_show_failed',
      {
        message: serializeError(error),
        ...(context ?? {}),
      },
      { flush: false }
    );
  },

  async trackBannerImpression(
    placement: string,
    payload?: AnalyticsEventPayload
  ): Promise<void> {
    const policy = await adRemotePolicyService.getResolvedPolicy({
      allowStale: true,
    });

    if (!policy.analyticsEnabled || !policy.bannerEnabled) {
      return;
    }

    await analyticsService.track(
      'ad_banner_impression',
      {
        placement,
        ...(payload ?? {}),
      },
      { flush: false }
    );
  },

  async flushAnalytics(): Promise<number> {
    return analyticsService.flushPending();
  },
};

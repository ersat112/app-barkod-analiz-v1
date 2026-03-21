import type {
  AdPolicySnapshot,
  AdPolicyStats,
  AnalyticsEventPayload,
  InterstitialDecision,
} from '../types/ads';
import { analyticsService } from './analytics.service';
import { adPolicyService } from './adPolicy.service';
import { adRemotePolicyService } from './adRemotePolicy.service';

function serializeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === 'string' ? error : JSON.stringify(error);
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

  async syncRemotePolicy(forceRefresh = false): Promise<AdPolicySnapshot> {
    return forceRefresh
      ? adRemotePolicyService.refreshPolicy()
      : adRemotePolicyService.getResolvedPolicy({ allowStale: true });
  },

  async getStats(): Promise<AdPolicyStats> {
    return adPolicyService.getStats();
  },

  async reset(): Promise<void> {
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
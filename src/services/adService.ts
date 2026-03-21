import {
  adPolicyService,
  type AdPolicyStats,
  type InterstitialDecision,
} from './adPolicy.service';

export const adService = {
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
};
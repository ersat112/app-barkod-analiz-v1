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

export type AdPolicySource = 'default' | 'local_cache' | 'remote_live';

export type InterstitialDecision = {
  shouldShow: boolean;
  reason: InterstitialDecisionReason;
  successfulScanCount: number;
  scansSinceLastInterstitial: number;
  cooldownRemainingMs: number;
  dailyInterstitialCount: number;
  dailyCapRemaining: number;
  policySource: AdPolicySource;
  policyVersion: number;
};

export type AdPolicySnapshot = {
  source: AdPolicySource;
  version: number;
  fetchedAt: number | null;
  enabled: boolean;
  interstitialEnabled: boolean;
  bannerEnabled: boolean;
  analyticsEnabled: boolean;
  warmupSuccessfulScans: number;
  scansBetweenInterstitials: number;
  minInterstitialCooldownMs: number;
  maxDailyInterstitials: number;
};

export type RemoteAdPolicyDocument = Partial<{
  version: number;
  enabled: boolean;
  interstitialEnabled: boolean;
  bannerEnabled: boolean;
  analyticsEnabled: boolean;
  warmupSuccessfulScans: number;
  scansBetweenInterstitials: number;
  minInterstitialCooldownMs: number;
  maxDailyInterstitials: number;
  updatedAt: unknown;
}>;

export type AnalyticsEventName =
  | 'ad_policy_refresh_succeeded'
  | 'ad_policy_refresh_failed'
  | 'ad_interstitial_evaluated'
  | 'ad_interstitial_shown'
  | 'ad_interstitial_show_failed'
  | 'ad_banner_impression'
  | 'product_not_found_viewed'
  | 'product_not_found_retry_tapped'
  | 'product_not_found_add_product_tapped'
  | 'missing_product_screen_viewed'
  | 'missing_product_draft_saved'
  | 'missing_product_draft_sync_succeeded'
  | 'missing_product_draft_sync_failed'
  | 'product_lookup_resolved'
  | 'product_detail_viewed';

export type AnalyticsEventPayload = Record<string, unknown>;

export type AnalyticsEventRecord = {
  eventId: string;
  eventName: AnalyticsEventName;
  createdAt: number;
  payload: AnalyticsEventPayload;
};

export type AnalyticsQueueState = {
  schemaVersion: number;
  installationId: string;
  sessionId: string;
  items: AnalyticsEventRecord[];
};
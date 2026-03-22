export const PRODUCT_CACHE_TABLE_NAME = 'product_cache' as const;
export const SHARED_PRODUCT_CACHE_COLLECTION = 'shared_product_cache' as const;
export const MISSING_PRODUCT_CONTRIBUTIONS_COLLECTION =
  'missing_product_contributions' as const;
export const MISSING_PRODUCT_DRAFTS_STORAGE_KEY =
  'erenesal_missing_product_drafts' as const;
export const PRODUCT_CACHE_SCHEMA_VERSION = 1 as const;
export const REMOTE_PRODUCT_CACHE_WRITE_QUEUE_STORAGE_KEY =
  'erenesal_remote_product_cache_write_queue_v1' as const;

export const AD_REMOTE_POLICY_COLLECTION = 'runtime_config' as const;
export const AD_REMOTE_POLICY_DOCUMENT = 'ad_policy' as const;
export const AD_REMOTE_POLICY_STORAGE_KEY = 'erenesal_ad_remote_policy_v1' as const;
export const ANALYTICS_EVENTS_COLLECTION = 'analytics_events' as const;
export const ANALYTICS_QUEUE_STORAGE_KEY = 'erenesal_analytics_queue_v1' as const;
export const ANALYTICS_INSTALLATION_ID_STORAGE_KEY =
  'erenesal_analytics_installation_id_v1' as const;

export const FEATURES = Object.freeze({
  productRepository: Object.freeze({
    foundationEnabled: true,
    sqliteCacheEnabled: true,
    sqliteReadEnabled: true,
    sqliteWriteEnabled: true,
    firestoreReadEnabled: false,
    firestoreWriteEnabled: false,
    remoteParallelFetchEnabled: true,
  }),
  firebase: Object.freeze({
    runtimeValidationEnabled: true,
    sharedCacheReadValidationEnabled: true,
    sharedCacheWriteValidationEnabled: true,
    diagnosticsLoggingEnabled: __DEV__,
  }),
  missingProduct: Object.freeze({
    firestoreContributionSyncEnabled: false,
  }),
  productPresentation: Object.freeze({
    gs1OriginLabelFixEnabled: true,
  }),
  scanner: Object.freeze({
    reducedInterstitialEnabled: true,
    removeUnusedPermissionsEnabled: true,
  }),
  ads: Object.freeze({
    remotePolicyEnabled: true,
    firestoreAnalyticsEnabled: true,
    localAnalyticsQueueEnabled: true,
    diagnosticsLoggingEnabled: __DEV__,
  }),
  database: Object.freeze({
    diagnosticsLoggingEnabled: __DEV__,
  }),
  home: Object.freeze({
    singleQueryDashboardEnabled: false,
  }),
  history: Object.freeze({
    paginationEnabled: false,
  }),
  screens: Object.freeze({
    modularizationEnabled: false,
  }),
});

export const CACHE_POLICY = Object.freeze({
  localFoundTtlMs: 1000 * 60 * 60 * 24 * 7,
  localNotFoundTtlMs: 1000 * 60 * 60 * 6,
  sharedFoundTtlMs: 1000 * 60 * 60 * 24 * 14,
  sharedNotFoundTtlMs: 1000 * 60 * 60 * 24,
});

export const AD_POLICY = Object.freeze({
  enabled: true,
  interstitialEnabled: true,
  bannerEnabled: true,
  analyticsEnabled: true,
  warmupSuccessfulScans: 3,
  scansBetweenInterstitials: 4,
  minInterstitialCooldownMs: 1000 * 60 * 2,
  maxDailyInterstitials: 6,
  remoteFetchTtlMs: 1000 * 60 * 10,
  remoteFetchTimeoutMs: 1000 * 6,
});

export type FeatureFlags = typeof FEATURES;
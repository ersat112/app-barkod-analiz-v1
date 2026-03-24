export const PRODUCT_CACHE_TABLE_NAME = 'product_cache' as const;
export const SHARED_PRODUCT_CACHE_COLLECTION = 'shared_product_cache' as const;
export const MISSING_PRODUCT_CONTRIBUTIONS_COLLECTION =
  'missing_product_contributions' as const;
export const MISSING_PRODUCT_DRAFTS_STORAGE_KEY =
  'erenesal_missing_product_drafts' as const;
export const PRODUCT_CACHE_SCHEMA_VERSION = 1 as const;
export const REMOTE_PRODUCT_CACHE_WRITE_QUEUE_STORAGE_KEY =
  'erenesal_remote_product_cache_write_queue_v1' as const;
export const USERS_COLLECTION = 'users' as const;
export const USER_SCAN_HISTORY_SUBCOLLECTION = 'scan_history' as const;
export const REMOTE_HISTORY_SYNC_QUEUE_STORAGE_KEY =
  'erenesal_remote_history_sync_queue_v1' as const;

export const RUNTIME_CONFIG_COLLECTION = 'runtime_config' as const;
export const FIRESTORE_ROLLOUT_DOCUMENT = 'firestore_rollout' as const;
export const FIRESTORE_RUNTIME_CONFIG_STORAGE_KEY =
  'erenesal_firestore_runtime_config_v1' as const;

export const AD_REMOTE_POLICY_COLLECTION = RUNTIME_CONFIG_COLLECTION;
export const AD_REMOTE_POLICY_DOCUMENT = 'ad_policy' as const;
export const AD_REMOTE_POLICY_STORAGE_KEY = 'erenesal_ad_remote_policy_v1' as const;

export const MONETIZATION_POLICY_DOCUMENT = 'monetization_policy' as const;
export const MONETIZATION_POLICY_STORAGE_KEY =
  'erenesal_monetization_policy_v1' as const;
export const ENTITLEMENT_STORAGE_KEY = 'erenesal_entitlement_state_v1' as const;
export const FREE_SCAN_POLICY_STORAGE_KEY =
  'erenesal_free_scan_policy_state_v1' as const;
export const MONETIZATION_FLOW_LOG_STORAGE_KEY =
  'erenesal_monetization_flow_logs_v1' as const;

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
    authenticatedUserRequired: true,
    runtimeConfigRolloutEnabled: true,
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
  monetization: Object.freeze({
    foundationEnabled: true,
    entitlementEnabled: true,
    remotePolicyEnabled: true,
    freeScanLimitEnabled: true,
    paywallEnabled: true,
    restoreEnabled: true,
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
    firestoreSyncEnabled: false,
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

export const MONETIZATION_POLICY = Object.freeze({
  annualPlanEnabled: true,
  annualPriceTry: 39.99,
  annualProductId: 'premium_annual_39_99_try',
  purchaseProviderEnabled: false,
  restoreEnabled: true,
  paywallEnabled: true,
  freeScanLimitEnabled: true,
  freeDailyScanLimit: 20,
  remoteFetchTtlMs: 1000 * 60 * 10,
  remoteFetchTimeoutMs: 1000 * 6,
});

export type FeatureFlags = typeof FEATURES;

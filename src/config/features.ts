export const PRODUCT_CACHE_TABLE_NAME = 'product_cache' as const;
export const SHARED_PRODUCT_CACHE_COLLECTION = 'shared_product_cache' as const;
export const PRODUCT_CACHE_SCHEMA_VERSION = 1 as const;

export const FEATURES = Object.freeze({
  productRepository: Object.freeze({
    foundationEnabled: false,
    sqliteCacheEnabled: true,
    sqliteReadEnabled: true,
    sqliteWriteEnabled: true,
    firestoreReadEnabled: false,
    firestoreWriteEnabled: false,
    remoteParallelFetchEnabled: false,
  }),

  missingProduct: Object.freeze({
    firestoreContributionSyncEnabled: false,
  }),

  productPresentation: Object.freeze({
    gs1OriginLabelFixEnabled: false,
  }),

  scanner: Object.freeze({
    reducedInterstitialEnabled: false,
    removeUnusedPermissionsEnabled: false,
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

export type FeatureFlags = typeof FEATURES;
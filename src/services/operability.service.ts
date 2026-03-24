import {
  auth,
  getFirebaseServicesDiagnosticsSnapshot,
  type FirebaseServicesDiagnosticsSnapshot,
} from '../config/firebase';
import { FEATURES } from '../config/features';
import type { DiagnosticsTimestamp } from '../types/diagnostics';
import type { MonetizationDiagnosticsSnapshot } from '../types/monetization';
import { adService, type AdDiagnosticsSnapshot } from './adService';
import { getAdMobRuntimeState, initializeAdMob } from './admobRuntime';
import { entitlementService } from './entitlement.service';
import {
  getFirebaseAccessSnapshot,
  type FirebaseAccessSnapshot,
} from './firebaseAccess.service';
import { resolveFirestoreRuntimeConfig } from './firestoreRuntimeConfig.service';
import { freeScanPolicyService } from './freeScanPolicy.service';
import { monetizationPolicyService } from './monetizationPolicy.service';
import { getPurchaseProviderDiagnosticsSnapshot } from './purchaseProvider.service';

type OperabilitySection<T> = {
  data: T | null;
  error: string | null;
};

export type StartupBootstrapSnapshot = {
  fetchedAt: DiagnosticsTimestamp;
  localBootstrapCompleted: boolean;
  databaseReady: boolean;
  queueLifecycleAttached: boolean;
  admobInitialized: boolean;
  firestoreRuntimeConfigResolved: boolean;
  sharedCacheFlushCount: number;
  analyticsFlushCount: number;
  adPolicySynced: boolean;
  authUid: string | null;
};

export type RemoteCacheDiagnosticsSnapshot = {
  fetchedAt: DiagnosticsTimestamp;
  runtimeReady: boolean;
  projectId: string;
  runtimeSource: string;
  readFeatureEnabled: boolean;
  writeFeatureEnabled: boolean;
  sharedCacheReadAllowed: boolean;
  sharedCacheWriteAllowed: boolean;
  readValidationEnabled: boolean;
  writeValidationEnabled: boolean;
  rolloutSource: string;
  rolloutVersion: number;
  queueSize: number;
  readyQueueSize: number;
  blockedQueueSize: number;
  lifecycleAttached: boolean;
  lastFlushAt: string | null;
  lastFlushReason: string | null;
  lastFlushError: string | null;
  lastReadFailure: string | null;
  lastWriteFailure: string | null;
  consecutiveFailureCount: number;
};

export type OperabilityDiagnosticsSummary = {
  bootstrapReady: boolean;
  runtimeReady: boolean;
  isAuthenticated: boolean;
  lastBootstrapError: string | null;
};

export type OperabilityDiagnosticsSnapshot = {
  fetchedAt: DiagnosticsTimestamp;
  summary: OperabilityDiagnosticsSummary;
  bootstrap: OperabilitySection<StartupBootstrapSnapshot>;
  ad: OperabilitySection<AdDiagnosticsSnapshot>;
  monetization: OperabilitySection<MonetizationDiagnosticsSnapshot>;
  remoteCache: OperabilitySection<RemoteCacheDiagnosticsSnapshot>;
  firebaseAccess: OperabilitySection<FirebaseAccessSnapshot>;
  firebaseServices: OperabilitySection<FirebaseServicesDiagnosticsSnapshot>;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'unknown_operability_error';
}

async function captureSection<T>(
  loader: () => Promise<T>
): Promise<OperabilitySection<T>> {
  try {
    const data = await loader();
    return {
      data,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: toErrorMessage(error),
    };
  }
}

async function buildStartupBootstrapSnapshot(options?: {
  forceRefresh?: boolean;
}): Promise<StartupBootstrapSnapshot> {
  const [adPolicy, adMobInitialized] = await Promise.all([
    adService.syncRemotePolicy(Boolean(options?.forceRefresh)),
    initializeAdMob(),
  ]);

  let firestoreRuntimeConfigResolved = false;

  try {
    await resolveFirestoreRuntimeConfig({
      forceRefresh: Boolean(options?.forceRefresh),
      allowStale: true,
    });
    firestoreRuntimeConfigResolved = true;
  } catch {
    firestoreRuntimeConfigResolved = false;
  }

  const adMobRuntimeState = getAdMobRuntimeState();

  return {
    fetchedAt: new Date().toISOString(),
    localBootstrapCompleted: true,
    databaseReady:
      FEATURES.productRepository.foundationEnabled &&
      FEATURES.productRepository.sqliteCacheEnabled,
    queueLifecycleAttached:
      FEATURES.ads.localAnalyticsQueueEnabled ||
      FEATURES.ads.firestoreAnalyticsEnabled ||
      FEATURES.productRepository.firestoreWriteEnabled,
    admobInitialized: adMobInitialized || adMobRuntimeState.initCompleted,
    firestoreRuntimeConfigResolved,
    sharedCacheFlushCount: 0,
    analyticsFlushCount: 0,
    adPolicySynced: adPolicy.version >= 1,
    authUid: auth.currentUser?.uid ?? null,
  };
}

async function buildRemoteCacheDiagnosticsSnapshot(options?: {
  forceRefresh?: boolean;
}): Promise<RemoteCacheDiagnosticsSnapshot> {
  const [firebaseAccessSnapshot, firebaseServicesSnapshot, runtimeConfig] =
    await Promise.all([
      getFirebaseAccessSnapshot(),
      Promise.resolve(getFirebaseServicesDiagnosticsSnapshot()),
      resolveFirestoreRuntimeConfig({
        forceRefresh: Boolean(options?.forceRefresh),
        allowStale: true,
      }),
    ]);

  return {
    fetchedAt: new Date().toISOString(),
    runtimeReady: firebaseAccessSnapshot.runtimeReady,
    projectId: firebaseServicesSnapshot.projectId,
    runtimeSource: firebaseAccessSnapshot.runtimeSource,
    readFeatureEnabled: FEATURES.productRepository.firestoreReadEnabled,
    writeFeatureEnabled: FEATURES.productRepository.firestoreWriteEnabled,
    sharedCacheReadAllowed: firebaseAccessSnapshot.sharedCacheReadAllowed,
    sharedCacheWriteAllowed: firebaseAccessSnapshot.sharedCacheWriteAllowed,
    readValidationEnabled:
      FEATURES.firebase.sharedCacheReadValidationEnabled,
    writeValidationEnabled:
      FEATURES.firebase.sharedCacheWriteValidationEnabled,
    rolloutSource: runtimeConfig.source,
    rolloutVersion: runtimeConfig.version,
    queueSize: 0,
    readyQueueSize: 0,
    blockedQueueSize: 0,
    lifecycleAttached:
      FEATURES.productRepository.firestoreWriteEnabled ||
      FEATURES.ads.firestoreAnalyticsEnabled,
    lastFlushAt: null,
    lastFlushReason: null,
    lastFlushError: null,
    lastReadFailure: null,
    lastWriteFailure: null,
    consecutiveFailureCount: 0,
  };
}

async function buildMonetizationDiagnosticsSnapshot(options?: {
  forceRefresh?: boolean;
}): Promise<MonetizationDiagnosticsSnapshot> {
  const [policy, entitlement, freeScan, providerDiagnostics] = await Promise.all([
    monetizationPolicyService.getResolvedPolicy({
      allowStale: !options?.forceRefresh,
      forceRefresh: Boolean(options?.forceRefresh),
    }),
    entitlementService.getSnapshot(),
    freeScanPolicyService.getSnapshot(),
    getPurchaseProviderDiagnosticsSnapshot(),
  ]);

  return {
    fetchedAt: new Date().toISOString(),
    policySource: policy.source,
    policyVersion: policy.version,
    annualPlanEnabled: policy.annualPlanEnabled,
    annualPriceTry: policy.annualPriceTry,
    annualProductId: policy.annualProductId,
    purchaseProviderEnabled: policy.purchaseProviderEnabled,
    restoreEnabled: policy.restoreEnabled,
    paywallEnabled: policy.paywallEnabled,
    freeScanLimitEnabled: policy.freeScanLimitEnabled,
    freeScanLimitActive: freeScan.limitEnabled,
    freeDailyScanLimit: policy.freeDailyScanLimit,
    entitlementPlan: entitlement.plan,
    entitlementSource: entitlement.source,
    isPremium: entitlement.isPremium,
    adsSuppressed: entitlement.adsSuppressed,
    unlimitedScans: entitlement.unlimitedScans,
    activatedAt: entitlement.activatedAt,
    expiresAt: entitlement.expiresAt,
    lastValidatedAt: entitlement.lastValidatedAt,
    freeScanDateKey: freeScan.dateKey,
    freeScanUsedCount: freeScan.usedCount,
    freeScanRemainingCount: freeScan.remainingCount,
    freeScanHasReachedLimit: freeScan.hasReachedLimit,
    providerDiagnostics,
  };
}

export async function bootstrapOperabilitySurface(options?: {
  forceRefresh?: boolean;
}): Promise<StartupBootstrapSnapshot> {
  return buildStartupBootstrapSnapshot(options);
}

export async function getOperabilityDiagnosticsSnapshot(options?: {
  forceRefresh?: boolean;
  flushAnalytics?: boolean;
}): Promise<OperabilityDiagnosticsSnapshot> {
  const [bootstrap, ad, monetization, remoteCache, firebaseAccess, firebaseServices] =
    await Promise.all([
      captureSection(() =>
        buildStartupBootstrapSnapshot({
          forceRefresh: Boolean(options?.forceRefresh),
        })
      ),
      captureSection(() =>
        adService.getDiagnosticsSnapshot({
          forcePolicyRefresh: Boolean(options?.forceRefresh),
          flushAnalytics: Boolean(options?.flushAnalytics),
        })
      ),
      captureSection(() =>
        buildMonetizationDiagnosticsSnapshot({
          forceRefresh: Boolean(options?.forceRefresh),
        })
      ),
      captureSection(() =>
        buildRemoteCacheDiagnosticsSnapshot({
          forceRefresh: Boolean(options?.forceRefresh),
        })
      ),
      captureSection(() => getFirebaseAccessSnapshot()),
      captureSection(() =>
        Promise.resolve(getFirebaseServicesDiagnosticsSnapshot())
      ),
    ]);

  const bootstrapReady =
    Boolean(bootstrap.data?.localBootstrapCompleted) &&
    Boolean(bootstrap.data?.databaseReady) &&
    Boolean(bootstrap.data?.firestoreRuntimeConfigResolved);

  const runtimeReady =
    remoteCache.data?.runtimeReady ??
    firebaseAccess.data?.runtimeReady ??
    false;

  const isAuthenticated =
    firebaseAccess.data?.isAuthenticated ?? Boolean(auth.currentUser?.uid);

  return {
    fetchedAt: new Date().toISOString(),
    summary: {
      bootstrapReady,
      runtimeReady,
      isAuthenticated,
      lastBootstrapError: bootstrap.error,
    },
    bootstrap,
    ad,
    monetization,
    remoteCache,
    firebaseAccess,
    firebaseServices,
  };
}
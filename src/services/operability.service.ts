import {
  auth,
  getFirebaseServicesDiagnosticsSnapshot,
  type FirebaseServicesDiagnosticsSnapshot,
} from '../config/firebase';
import { FEATURES } from '../config/features';
import type { DiagnosticsTimestamp } from '../types/diagnostics';
import type {
  MonetizationDiagnosticsSnapshot,
  MonetizationReadinessSnapshot,
  MonetizationSmokeTestStep,
  PurchaseProviderDiagnosticsSnapshot,
} from '../types/monetization';
import { adService, type AdDiagnosticsSnapshot } from './adService';
import { getAdMobRuntimeState } from './admobRuntime';
import {
  ensureAppBootstrap,
  getLastAppBootstrapSnapshot,
  runAuthenticatedAppBootstrap,
} from './appBootstrap.service';
import { entitlementService } from './entitlement.service';
import {
  getFirebaseAccessSnapshot,
  type FirebaseAccessSnapshot,
} from './firebaseAccess.service';
import { resolveFirestoreRuntimeConfig } from './firestoreRuntimeConfig.service';
import { resolveMarketGelsinRuntimeConfig } from './marketGelsinRuntimeConfig.service';
import { freeScanPolicyService } from './freeScanPolicy.service';
import {
  fetchMarketIntegrationsStatus,
  fetchMarketRuntimeStatus,
} from './marketPricing.service';
import { monetizationPolicyService } from './monetizationPolicy.service';
import { getRecentMonetizationFlowLogs } from './purchaseFlowLog.service';
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
  marketGelsinRuntimeResolved: boolean;
  authUid: string | null;
};

export type MarketPricingDiagnosticsSnapshot = {
  fetchedAt: DiagnosticsTimestamp;
  runtimeSource: string;
  runtimeVersion: number;
  runtimeFetchedAt: string | null;
  runtimeEnabled: boolean;
  baseUrl: string | null;
  timeoutMs: number;
  disableReason: string | null;
  apiReachable: boolean;
  activeMarkets: number | null;
  liveAdapters: number | null;
  sqliteEnabled: boolean | null;
  postgresEnabled: boolean | null;
  firebaseEnabled: boolean | null;
  statusError: string | null;
  integrationsError: string | null;
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
  marketPricing: OperabilitySection<MarketPricingDiagnosticsSnapshot>;
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
  const forceRefresh = Boolean(options?.forceRefresh);
  const authUid = auth.currentUser?.uid ?? null;
  const lastSnapshot = getLastAppBootstrapSnapshot();
  const bootstrapSnapshot =
    authUid == null
      ? forceRefresh || !lastSnapshot?.localBootstrapCompleted
        ? await ensureAppBootstrap()
        : lastSnapshot
      : !forceRefresh &&
          lastSnapshot?.localBootstrapCompleted &&
          lastSnapshot.authUid === authUid &&
          lastSnapshot.firestoreRuntimeConfigResolved
        ? lastSnapshot
        : await runAuthenticatedAppBootstrap({
            forceRefresh,
          });

  const adMobRuntimeState = getAdMobRuntimeState();

  return {
    fetchedAt: new Date().toISOString(),
    localBootstrapCompleted: bootstrapSnapshot.localBootstrapCompleted,
    databaseReady: bootstrapSnapshot.databaseReady,
    queueLifecycleAttached: bootstrapSnapshot.queueLifecycleAttached,
    admobInitialized:
      bootstrapSnapshot.admobInitialized || adMobRuntimeState.initCompleted,
    firestoreRuntimeConfigResolved:
      bootstrapSnapshot.firestoreRuntimeConfigResolved,
    sharedCacheFlushCount: bootstrapSnapshot.sharedCacheFlushCount,
    analyticsFlushCount: bootstrapSnapshot.analyticsFlushCount,
    adPolicySynced: bootstrapSnapshot.adPolicySynced,
    marketGelsinRuntimeResolved:
      bootstrapSnapshot.marketGelsinRuntimeResolved,
    authUid: bootstrapSnapshot.authUid,
  };
}

async function buildMarketPricingDiagnosticsSnapshot(options?: {
  forceRefresh?: boolean;
}): Promise<MarketPricingDiagnosticsSnapshot> {
  const runtime = await resolveMarketGelsinRuntimeConfig({
    forceRefresh: Boolean(options?.forceRefresh),
    allowStale: !options?.forceRefresh,
  });

  if (!runtime.isEnabled) {
    return {
      fetchedAt: new Date().toISOString(),
      runtimeSource: runtime.source,
      runtimeVersion: runtime.version,
      runtimeFetchedAt: runtime.fetchedAt
        ? new Date(runtime.fetchedAt).toISOString()
        : null,
      runtimeEnabled: runtime.isEnabled,
      baseUrl: runtime.baseUrl || null,
      timeoutMs: runtime.timeoutMs,
      disableReason: runtime.disableReason,
      apiReachable: false,
      activeMarkets: null,
      liveAdapters: null,
      sqliteEnabled: null,
      postgresEnabled: null,
      firebaseEnabled: null,
      statusError: null,
      integrationsError: null,
    };
  }

  const [statusResult, integrationsResult] = await Promise.allSettled([
    fetchMarketRuntimeStatus(),
    fetchMarketIntegrationsStatus(),
  ]);

  const status =
    statusResult.status === 'fulfilled' ? statusResult.value : null;
  const integrations =
    integrationsResult.status === 'fulfilled' ? integrationsResult.value : null;

  return {
    fetchedAt: new Date().toISOString(),
    runtimeSource: runtime.source,
    runtimeVersion: runtime.version,
    runtimeFetchedAt: runtime.fetchedAt
      ? new Date(runtime.fetchedAt).toISOString()
      : null,
    runtimeEnabled: runtime.isEnabled,
    baseUrl: runtime.baseUrl || null,
    timeoutMs: runtime.timeoutMs,
    disableReason: runtime.disableReason,
    apiReachable: Boolean(status),
    activeMarkets:
      typeof status?.activeMarkets === 'number' ? status.activeMarkets : null,
    liveAdapters:
      typeof status?.liveAdapters === 'number' ? status.liveAdapters : null,
    sqliteEnabled:
      typeof integrations?.sqlite?.enabled === 'boolean'
        ? integrations.sqlite.enabled
        : null,
    postgresEnabled:
      typeof integrations?.postgres?.enabled === 'boolean'
        ? integrations.postgres.enabled
        : null,
    firebaseEnabled:
      typeof integrations?.firebase?.enabled === 'boolean'
        ? integrations.firebase.enabled
        : null,
    statusError:
      statusResult.status === 'rejected'
        ? toErrorMessage(statusResult.reason)
        : null,
    integrationsError:
      integrationsResult.status === 'rejected'
        ? toErrorMessage(integrationsResult.reason)
        : null,
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

function buildMonetizationReadinessSnapshot(input: {
  annualPlanEnabled: boolean;
  annualProductId: string;
  paywallEnabled: boolean;
  restoreEnabled: boolean;
  purchaseProviderEnabled: boolean;
  providerDiagnostics: PurchaseProviderDiagnosticsSnapshot;
}): MonetizationReadinessSnapshot {
  const blockers: string[] = [];
  const recommendedActions: string[] = [];
  const annualProductId = input.annualProductId.trim();
  const provider = input.providerDiagnostics;

  const addRecommendation = (value: string) => {
    if (!recommendedActions.includes(value)) {
      recommendedActions.push(value);
    }
  };

  if (!input.annualPlanEnabled) {
    blockers.push('Yillik premium plan rollout kapali.');
    addRecommendation('annualPlanEnabled rolloutunu test build icin ac.');
  }

  if (!input.purchaseProviderEnabled) {
    blockers.push('Purchase provider rollout kapali.');
    addRecommendation('purchaseProviderEnabled rolloutunu test build icin ac.');
  }

  if (!input.paywallEnabled) {
    blockers.push('Paywall rollout kapali.');
    addRecommendation('Paywall giris noktasini test build icin etkinlestir.');
  }

  if (provider.isExpoGo || !provider.supportsNativePurchases) {
    blockers.push('Gercek satin alma icin Expo Go yerine dev veya release build gerekli.');
    addRecommendation('Smoke testleri Expo Go yerine native dev build ile calistir.');
  }

  if (!provider.sdkModulePresent) {
    blockers.push('react-native-purchases native modulu yuklenemedi.');
    addRecommendation('Native prebuild ve react-native-purchases baglantisini dogrula.');
  }

  if (provider.missingKeys.length > 0) {
    blockers.push(`Eksik RevenueCat anahtarlari: ${provider.missingKeys.join(', ')}`);
    addRecommendation('EXPO_PUBLIC_REVENUECAT_* ortam degiskenlerini doldur.');
  }

  if (!provider.runtimeReady) {
    blockers.push('RevenueCat runtime hazir degil.');
    addRecommendation('Aktif platform API key, entitlement ve offering ayarlarini kontrol et.');
  }

  if (!provider.isConfigured) {
    blockers.push('Provider configure veya identity sync tamamlanamadi.');
    addRecommendation('Auth acilis akisi ve foreground identity re-sync sonucunu dogrula.');
  }

  if (provider.identityMismatch) {
    blockers.push('Auth UID ile provider app user id eslesmiyor.');
    addRecommendation('Login/logout sonrasi provider kimlik eslesmesini gercek cihazda kontrol et.');
  }

  if (!annualProductId) {
    blockers.push('Annual product id tanimli degil.');
    addRecommendation('Monetization policy icindeki annualProductId degerini doldur.');
  }

  if (!provider.smokeCheckAttempted) {
    blockers.push('Offerings smoke check calismadi.');
    addRecommendation('Dev build uzerinde getOfferings akisinin calistigini dogrula.');
  } else if (!provider.smokeCheckSuccess) {
    blockers.push('Offerings smoke check basarisiz.');
    addRecommendation('RevenueCat dashboard offering ve package konfigurasyonunu kontrol et.');
  } else if (!provider.smokeCheckMatchedAnnualProductId) {
    blockers.push('Offerings smoke check annual product id ile eslesmeyen bir urun cozumledi.');
    addRecommendation('RevenueCat package mapping ile annualProductId degerini eslestir.');
  }

  if (
    provider.smokeCheckAttempted &&
    provider.smokeCheckSuccess &&
    provider.smokeCheckAvailablePackagesCount === 0
  ) {
    blockers.push('Smoke check sirasinda offering icinde paket bulunamadi.');
    addRecommendation('RevenueCat offering icindeki available packages listesini kontrol et.');
  }

  const storeSmokeTestReady = blockers.length === 0;

  if (storeSmokeTestReady) {
    addRecommendation('Gercek cihazda test kullanicisi ile purchase ve restore smoke testini calistir.');
  }

  const smokeTestChecklist: MonetizationSmokeTestStep[] = [
    {
      id: 'native_build',
      title: 'Native build kullan',
      status:
        !provider.isExpoGo && provider.supportsNativePurchases && provider.sdkModulePresent
          ? 'ready'
          : 'blocked',
      detail:
        !provider.isExpoGo && provider.supportsNativePurchases && provider.sdkModulePresent
          ? 'Dev veya release build uzerinden gercek magaza satin alma akisi denenebilir.'
          : 'Expo Go yerine react-native-purchases yuklu native dev veya release build gerekli.',
    },
    {
      id: 'runtime_config',
      title: 'RevenueCat runtime hazir',
      status:
        provider.runtimeReady && provider.missingKeys.length === 0 ? 'ready' : 'blocked',
      detail:
        provider.runtimeReady && provider.missingKeys.length === 0
          ? 'Aktif platform API key, entitlement ve offering degerleri mevcut.'
          : provider.missingKeys.length > 0
            ? `Eksik anahtarlar: ${provider.missingKeys.join(', ')}`
            : 'RevenueCat runtime henüz hazir görünmuyor.',
    },
    {
      id: 'rollout',
      title: 'Rollout ve giris noktalari acik',
      status:
        input.annualPlanEnabled &&
        input.purchaseProviderEnabled &&
        input.paywallEnabled &&
        input.restoreEnabled
          ? 'ready'
          : 'blocked',
      detail:
        input.annualPlanEnabled &&
        input.purchaseProviderEnabled &&
        input.paywallEnabled &&
        input.restoreEnabled
          ? 'Purchase, restore ve paywall akislari test icin acik.'
          : 'annual plan, purchase provider, paywall veya restore rolloutlarindan en az biri kapali.',
    },
    {
      id: 'identity_sync',
      title: 'Auth ve provider kimligi eslesiyor',
      status: provider.isConfigured && !provider.identityMismatch ? 'ready' : 'blocked',
      detail:
        provider.isConfigured && !provider.identityMismatch
          ? 'Mevcut auth kullanicisi ile provider app user id uyumlu.'
          : provider.identityMismatchReason ??
            'Provider configure veya identity sync henüz tamamlanmamis.',
    },
    {
      id: 'offering_match',
      title: 'Offering annual product ile eslesiyor',
      status:
        provider.smokeCheckAttempted &&
        provider.smokeCheckSuccess &&
        provider.smokeCheckMatchedAnnualProductId &&
        provider.smokeCheckAvailablePackagesCount > 0
          ? 'ready'
          : 'blocked',
      detail:
        provider.smokeCheckAttempted &&
        provider.smokeCheckSuccess &&
        provider.smokeCheckMatchedAnnualProductId &&
        provider.smokeCheckAvailablePackagesCount > 0
          ? `Offering ${provider.smokeCheckResolvedOfferingId ?? '-'} icindeki paket ${annualProductId || '-'} ile eslesti.`
          : provider.smokeCheckError ??
            'Offering/package çözümlemesi smoke test icin henüz guvenli degil.',
    },
    {
      id: 'purchase_flow',
      title: 'Paywall uzerinden satin alma dene',
      status: storeSmokeTestReady ? 'manual' : 'blocked',
      detail: storeSmokeTestReady
        ? 'Beklenen sonuc: purchase basarili, entitlement premium, paywall kapanir.'
        : 'Önce blocker listesini kapat, sonra gercek cihazda paywall purchase akisini dene.',
    },
    {
      id: 'restore_flow',
      title: 'Ayni hesapla restore akisini dogrula',
      status: storeSmokeTestReady ? 'manual' : 'blocked',
      detail: storeSmokeTestReady
        ? 'Beklenen sonuc: restore basariliysa entitlement premium döner ve mismatch uyarisi cikmaz.'
        : 'Restore testine gecmeden once runtime ve offering blockerlarini kapat.',
    },
  ];

  const smokeTestScenarios: string[] = [
    'Settings paywall uzerinden annual purchase dene; beklenen sonuc purchased veya already_active.',
    'Purchase ekraninda islemi kullanici olarak iptal et; beklenen sonuc cancelled ve entitlement degismez.',
    'Basarili satin alma sonrasi restore akisini ayni hesapta calistir; beklenen sonuc restored.',
    'Satin alma gecmisi olmayan hesapta restore dene; beklenen sonuc no_active_purchase.',
    'Login, logout ve foreground resume sonrasi provider identity mismatch olusmadigini dogrula.',
  ];

  return {
    state: storeSmokeTestReady ? 'ready_for_store_smoke_test' : 'blocked',
    summary: storeSmokeTestReady
      ? 'RevenueCat store smoke testine hazir.'
      : `${blockers.length} engel nedeniyle RevenueCat store smoke testi hazir degil.`,
    storeSmokeTestReady,
    blockerCount: blockers.length,
    blockers,
    recommendedActions,
    smokeTestChecklist,
    smokeTestScenarios,
  };
}

async function buildMonetizationDiagnosticsSnapshot(options?: {
  forceRefresh?: boolean;
}): Promise<MonetizationDiagnosticsSnapshot> {
  const policy = await monetizationPolicyService.getResolvedPolicy({
    allowStale: !options?.forceRefresh,
    forceRefresh: Boolean(options?.forceRefresh),
  });

  const [entitlement, freeScan, providerDiagnostics, recentFlowLogs] = await Promise.all([
    entitlementService.getSnapshot(),
    freeScanPolicyService.getSnapshot(),
    getPurchaseProviderDiagnosticsSnapshot({
      annualProductId: policy.annualProductId,
    }),
    getRecentMonetizationFlowLogs(),
  ]);
  const readiness = buildMonetizationReadinessSnapshot({
    annualPlanEnabled: policy.annualPlanEnabled,
    annualProductId: policy.annualProductId,
    paywallEnabled: policy.paywallEnabled,
    restoreEnabled: policy.restoreEnabled,
    purchaseProviderEnabled: policy.purchaseProviderEnabled,
    providerDiagnostics,
  });

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
    readiness,
    recentFlowLogs,
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
  const [
    bootstrap,
    marketPricing,
    ad,
    monetization,
    remoteCache,
    firebaseAccess,
    firebaseServices,
  ] =
    await Promise.all([
      captureSection(() =>
        buildStartupBootstrapSnapshot({
          forceRefresh: Boolean(options?.forceRefresh),
        })
      ),
      captureSection(() =>
        buildMarketPricingDiagnosticsSnapshot({
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
    Boolean(bootstrap.data?.firestoreRuntimeConfigResolved) &&
    Boolean(bootstrap.data?.marketGelsinRuntimeResolved);

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
    marketPricing,
    ad,
    monetization,
    remoteCache,
    firebaseAccess,
    firebaseServices,
  };
}

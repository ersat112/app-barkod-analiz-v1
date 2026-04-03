export type MonetizationPlan = 'free' | 'premium';

export type MonetizationPolicySource = 'default' | 'local_cache' | 'remote_live';

export type EntitlementSource =
  | 'default'
  | 'local_cache'
  | 'provider_restore'
  | 'provider_purchase'
  | 'manual_override';

export type PaywallEntrySource = 'scan_limit' | 'settings' | 'unknown';
export type MonetizationFlowSource = PaywallEntrySource | 'service';

export type PurchaseProviderName =
  | 'none'
  | 'adapter_unbound'
  | 'revenuecat'
  | 'native_iap';

export type PurchaseProviderRuntimeSource = 'env_override' | 'fallback';
export type PurchaseProviderRuntimePlatform = 'ios' | 'android' | 'web';
export type PurchaseProviderIdentityMode = 'anonymous' | 'authenticated' | 'unknown';

export type MonetizationPolicySnapshot = {
  source: MonetizationPolicySource;
  version: number;
  fetchedAt: number | null;
  monthlyPlanEnabled: boolean;
  monthlyPriceTry: number;
  monthlyProductId: string;
  annualPlanEnabled: boolean;
  annualPriceTry: number;
  annualProductId: string;
  purchaseProviderEnabled: boolean;
  restoreEnabled: boolean;
  paywallEnabled: boolean;
  freeScanLimitEnabled: boolean;
  freeDailyScanLimit: number;
};

export type EntitlementSnapshot = {
  plan: MonetizationPlan;
  isPremium: boolean;
  adsSuppressed: boolean;
  unlimitedScans: boolean;
  providerReady: boolean;
  purchaseEnabled: boolean;
  restoreEnabled: boolean;
  annualProductId: string;
  source: EntitlementSource;
  activatedAt: string | null;
  expiresAt: string | null;
  lastValidatedAt: string | null;
};

export type StoredEntitlementState = {
  schemaVersion: number;
  plan: MonetizationPlan;
  source: EntitlementSource;
  activatedAt: string | null;
  expiresAt: string | null;
  lastValidatedAt: string | null;
};

export type PurchaseAnnualPlanStatus =
  | 'purchased'
  | 'already_active'
  | 'cancelled'
  | 'not_supported'
  | 'error';

export type PurchaseAnnualPlanResult = {
  status: PurchaseAnnualPlanStatus;
  snapshot: EntitlementSnapshot;
  providerName: PurchaseProviderName;
  message: string;
  transactionId: string | null;
  customerId: string | null;
  identityMismatchWarning: string | null;
};

export type RestorePurchasesStatus =
  | 'restored'
  | 'not_supported'
  | 'no_active_purchase'
  | 'error';

export type RestorePurchasesResult = {
  status: RestorePurchasesStatus;
  snapshot: EntitlementSnapshot;
  providerName: PurchaseProviderName;
  message: string;
  transactionId: string | null;
  customerId: string | null;
  identityMismatchWarning: string | null;
};

export type MonetizationFlowAction = 'purchase' | 'restore';
export type MonetizationFlowLogStage = 'started' | 'result' | 'error';
export type MonetizationFlowLogStatus =
  | PurchaseAnnualPlanStatus
  | RestorePurchasesStatus
  | 'started';

export type MonetizationFlowLogEntry = {
  id: string;
  createdAt: string;
  action: MonetizationFlowAction;
  stage: MonetizationFlowLogStage;
  status: MonetizationFlowLogStatus;
  source: MonetizationFlowSource;
  providerName: PurchaseProviderName;
  annualProductId: string;
  authUid: string | null;
  entitlementPlan: MonetizationPlan;
  isPremium: boolean;
  customerId: string | null;
  transactionId: string | null;
  identityMismatch: boolean;
  identityMismatchWarning: string | null;
  message: string;
};

export type PurchaseProviderPurchaseParams = {
  annualProductId: string;
  authUid: string | null;
};

export type PurchaseProviderRestoreParams = {
  annualProductId: string;
  authUid: string | null;
};

export type PurchaseProviderPurchaseResult = {
  status: PurchaseAnnualPlanStatus;
  providerName: PurchaseProviderName;
  message: string;
  activatedAt: string | null;
  expiresAt: string | null;
  lastValidatedAt: string | null;
  transactionId: string | null;
  customerId: string | null;
};

export type PurchaseProviderRestoreResult = {
  status: RestorePurchasesStatus;
  providerName: PurchaseProviderName;
  message: string;
  activatedAt: string | null;
  expiresAt: string | null;
  lastValidatedAt: string | null;
  transactionId: string | null;
  customerId: string | null;
};

export type PurchaseProviderAdapter = {
  name: PurchaseProviderName;
  isConfigured: () => Promise<boolean>;
  purchaseAnnualPlan: (
    params: PurchaseProviderPurchaseParams
  ) => Promise<PurchaseProviderPurchaseResult>;
  restorePurchases: (
    params: PurchaseProviderRestoreParams
  ) => Promise<PurchaseProviderRestoreResult>;
};

export type PurchaseProviderDiagnosticsSnapshot = {
  fetchedAt: string;
  providerName: PurchaseProviderName;
  runtimeSource: PurchaseProviderRuntimeSource;
  platform: PurchaseProviderRuntimePlatform;
  isExpoGo: boolean;
  supportsNativePurchases: boolean;
  runtimeReady: boolean;
  sdkModulePresent: boolean;
  isConfigured: boolean;
  authUidPresent: boolean;
  configuredAppUserId: string | null;
  authUid: string | null;
  identityMode: PurchaseProviderIdentityMode;
  identitySynced: boolean;
  identityMismatch: boolean;
  identityMismatchReason: string | null;
  iosApiKeyPresent: boolean;
  androidApiKeyPresent: boolean;
  activePlatformApiKeyPresent: boolean;
  entitlementIdentifier: string;
  offeringIdentifier: string;
  missingKeys: string[];
  smokeCheckAttempted: boolean;
  smokeCheckSuccess: boolean;
  smokeCheckSummary: string;
  smokeCheckResolvedOfferingId: string | null;
  smokeCheckResolvedPackageId: string | null;
  smokeCheckResolvedProductId: string | null;
  smokeCheckMatchedAnnualProductId: boolean;
  smokeCheckAvailablePackagesCount: number;
  smokeCheckError: string | null;
};

export type MonetizationReadinessState = 'blocked' | 'ready_for_store_smoke_test';

export type MonetizationSmokeTestStepStatus = 'blocked' | 'ready' | 'manual';

export type MonetizationSmokeTestStep = {
  id: string;
  title: string;
  status: MonetizationSmokeTestStepStatus;
  detail: string;
};

export type MonetizationReadinessSnapshot = {
  state: MonetizationReadinessState;
  summary: string;
  storeSmokeTestReady: boolean;
  blockerCount: number;
  blockers: string[];
  recommendedActions: string[];
  smokeTestChecklist: MonetizationSmokeTestStep[];
  smokeTestScenarios: string[];
};

export type FreeScanPolicyState = {
  schemaVersion: number;
  dateKey: string;
  successfulScanCount: number;
  rewardedUnlockCount: number;
  rewardedExtraScanCount: number;
};

export type FreeScanAccessSnapshot = {
  fetchedAt: string;
  dateKey: string;
  limitEnabled: boolean;
  dailyLimit: number | null;
  usedCount: number;
  remainingCount: number | null;
  hasReachedLimit: boolean;
  entitlementPlan: MonetizationPlan;
  paywallEnabled: boolean;
  rewardedUnlockCount: number;
  rewardedExtraScanCount: number;
  rewardedExtraScansPerUnlock: number;
  rewardedDailyUnlockCap: number;
};

export type FreeScanRegistrationReason =
  | 'allowed'
  | 'premium'
  | 'limit_disabled'
  | 'limit_reached';

export type FreeScanRegistrationResult = {
  allowed: boolean;
  reason: FreeScanRegistrationReason;
  snapshot: FreeScanAccessSnapshot;
};

export type RewardedScanUnlockReason =
  | 'granted'
  | 'premium'
  | 'limit_disabled'
  | 'not_needed'
  | 'daily_cap_reached';

export type RewardedScanUnlockResult = {
  granted: boolean;
  reason: RewardedScanUnlockReason;
  snapshot: FreeScanAccessSnapshot;
};

export type MonetizationDiagnosticsSnapshot = {
  fetchedAt: string;
  policySource: MonetizationPolicySource;
  policyVersion: number;
  annualPlanEnabled: boolean;
  annualPriceTry: number;
  annualProductId: string;
  purchaseProviderEnabled: boolean;
  restoreEnabled: boolean;
  paywallEnabled: boolean;
  freeScanLimitEnabled: boolean;
  freeScanLimitActive: boolean;
  freeDailyScanLimit: number;
  entitlementPlan: MonetizationPlan;
  entitlementSource: EntitlementSource;
  isPremium: boolean;
  adsSuppressed: boolean;
  unlimitedScans: boolean;
  activatedAt: string | null;
  expiresAt: string | null;
  lastValidatedAt: string | null;
  freeScanDateKey: string;
  freeScanUsedCount: number;
  freeScanRemainingCount: number | null;
  freeScanHasReachedLimit: boolean;
  readiness: MonetizationReadinessSnapshot;
  recentFlowLogs: MonetizationFlowLogEntry[];
  providerDiagnostics: PurchaseProviderDiagnosticsSnapshot;
};

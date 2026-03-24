export type MonetizationPlan = 'free' | 'premium';

export type MonetizationPolicySource = 'default' | 'local_cache' | 'remote_live';

export type EntitlementSource =
  | 'default'
  | 'local_cache'
  | 'provider_restore'
  | 'provider_purchase'
  | 'manual_override';

export type PaywallEntrySource = 'scan_limit' | 'settings' | 'unknown';

export type PurchaseProviderName =
  | 'none'
  | 'adapter_unbound'
  | 'revenuecat'
  | 'native_iap';

export type MonetizationPolicySnapshot = {
  source: MonetizationPolicySource;
  version: number;
  fetchedAt: number | null;
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

export type FreeScanPolicyState = {
  schemaVersion: number;
  dateKey: string;
  successfulScanCount: number;
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
};
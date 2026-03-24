import type {
  EntitlementSource,
  MonetizationPlan,
  MonetizationPolicySource,
} from './monetization';

export type UserMonetizationProjection = {
  projectionVersion?: number;
  syncedAt?: string;
  plan?: MonetizationPlan;
  isPremium?: boolean;
  adsSuppressed?: boolean;
  unlimitedScans?: boolean;
  entitlementSource?: EntitlementSource;
  policySource?: MonetizationPolicySource;
  policyVersion?: number;
  annualPlanEnabled?: boolean;
  annualPriceTry?: number;
  annualProductId?: string;
  purchaseProviderEnabled?: boolean;
  restoreEnabled?: boolean;
  paywallEnabled?: boolean;
  freeScanLimitEnabled?: boolean;
  freeScanLimitActive?: boolean;
  freeDailyScanLimit?: number;
  freeScanDateKey?: string;
  freeScanUsedCount?: number;
  freeScanRemainingCount?: number | null;
  freeScanHasReachedLimit?: boolean;
  activatedAt?: string | null;
  expiresAt?: string | null;
  lastValidatedAt?: string | null;
};

export type AppUserProfile = {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  phone?: string;
  city?: string;
  district?: string;
  address?: string;
  email?: string;
  photoURL?: string;
  providerIds?: string[];
  emailVerified?: boolean;
  kvkkAccepted?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
  lastSeenAt?: string;
  monetization?: UserMonetizationProjection;
};

export type UserProfileInput = Partial<AppUserProfile>;
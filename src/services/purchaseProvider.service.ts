import Purchases, { LOG_LEVEL as REVENUECAT_LOG_LEVEL } from 'react-native-purchases';
import { REVENUECAT_RUNTIME, getRevenueCatRuntimeDiagnosticsSnapshot } from '../config/revenueCatRuntime';
import type {
  PurchaseProviderAdapter,
  PurchaseProviderDiagnosticsSnapshot,
  PurchaseProviderIdentityMode,
  PurchaseProviderPurchaseParams,
  PurchaseProviderPurchaseResult,
  PurchaseProviderRestoreParams,
  PurchaseProviderRestoreResult,
} from '../types/monetization';

type RevenueCatPurchasesApi = {
  setLogLevel?: (level: unknown) => void;
  configure?: (params: { apiKey: string }) => void;
  logIn?: (appUserId: string) => Promise<unknown>;
  logOut?: () => Promise<unknown>;
  getOfferings?: () => Promise<RevenueCatOfferings>;
  purchasePackage?: (pkg: unknown) => Promise<RevenueCatPurchaseResponse>;
  restorePurchases?: () => Promise<RevenueCatCustomerInfo>;
};

type RevenueCatPurchaseResponse = {
  customerInfo?: RevenueCatCustomerInfo;
  userCancelled?: boolean;
};

type RevenueCatCustomerInfo = {
  entitlements?: {
    active?: Record<string, RevenueCatEntitlementInfo | undefined>;
  };
  originalAppUserId?: string | null;
};

type RevenueCatEntitlementInfo = {
  latestPurchaseDate?: string | null;
  originalPurchaseDate?: string | null;
  expirationDate?: string | null;
};

type RevenueCatPackage = {
  identifier?: string;
  productIdentifier?: string;
  storeProduct?: {
    identifier?: string;
    productIdentifier?: string;
  };
};

type RevenueCatOffering = {
  identifier?: string;
  annual?: RevenueCatPackage;
  availablePackages?: RevenueCatPackage[];
};

type RevenueCatOfferings = {
  current?: RevenueCatOffering | null;
  all?: Record<string, RevenueCatOffering | undefined>;
};

type OfferingSelectionSource = 'configured' | 'current' | 'none';
type PackageSelectionSource =
  | 'annual_exact'
  | 'available_exact'
  | 'annual_fallback'
  | 'available_fallback'
  | 'none';

type OfferingsSmokeCheckResult = {
  attempted: boolean;
  success: boolean;
  summary: string;
  offeringIdentifier: string | null;
  packageIdentifier: string | null;
  productIdentifier: string | null;
  matchedAnnualProductId: boolean;
  availablePackagesCount: number;
  error: string | null;
};

let providerConfigured = false;
let configuredAppUserId: string | null = null;
let lastKnownAuthUid: string | null = null;
let registeredAdapter: PurchaseProviderAdapter | null = null;
let lastConfigurationError: string | null = null;

type RevenueCatErrorLike = {
  code?: unknown;
  message?: unknown;
  underlyingErrorMessage?: unknown;
  userCancelled?: unknown;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'purchase_provider_unknown_error';
}

function getRevenueCatErrorDetails(error: unknown): {
  code: string | null;
  message: string | null;
  underlyingMessage: string | null;
  userCancelled: boolean;
} {
  if (!error || typeof error !== 'object') {
    return {
      code: null,
      message: toErrorMessage(error),
      underlyingMessage: null,
      userCancelled: false,
    };
  }

  const value = error as RevenueCatErrorLike;

  return {
    code: typeof value.code === 'string' && value.code.trim() ? value.code.trim() : null,
    message:
      typeof value.message === 'string' && value.message.trim()
        ? value.message.trim()
        : null,
    underlyingMessage:
      typeof value.underlyingErrorMessage === 'string' &&
      value.underlyingErrorMessage.trim()
        ? value.underlyingErrorMessage.trim()
        : null,
    userCancelled: value.userCancelled === true,
  };
}

function formatRevenueCatUserMessage(
  error: unknown,
  fallbackMessage: string
): string {
  const details = getRevenueCatErrorDetails(error);
  const joinedDetails = [details.underlyingMessage, details.message]
    .filter((value): value is string => Boolean(value))
    .join(' ');
  const normalized = joinedDetails.toLowerCase();

  if (details.userCancelled) {
    return 'Satın alma işlemi kullanıcı tarafından iptal edildi.';
  }

  if (
    details.code === 'ConfigurationError' &&
    normalized.includes('no products registered') &&
    normalized.includes('offerings')
  ) {
    return 'RevenueCat offering içinde store urunu bagli degil. Dashboard tarafinda offering, package ve product eslesmesini tamamla.';
  }

  if (
    details.code === 'ConfigurationError' &&
    (normalized.includes('issue with your configuration') ||
      normalized.includes('check the underlying error for more details'))
  ) {
    return 'RevenueCat dashboard veya Google Play urun eslesmesi eksik. Offering, annual package, product ve entitlement baglantilarini kontrol et.';
  }

  if (
    details.code === 'PurchaseNotAllowedError' &&
    (normalized.includes('billing is not available in this device') ||
      normalized.includes('billing_unavailable'))
  ) {
    return 'Google Play Billing bu cihazda kullanilamiyor. Smoke test icin Play Store destekli gercek Android cihaz ve tester hesabi kullan.';
  }

  if (details.underlyingMessage) {
    return details.underlyingMessage;
  }

  if (details.message) {
    return details.message;
  }

  return fallbackMessage;
}

function normalizeNullableDate(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function getRevenueCatApi(): {
  api: RevenueCatPurchasesApi | null;
  verboseLogLevel: unknown;
} {
  const api =
    typeof Purchases === 'function' || typeof Purchases === 'object'
      ? (Purchases as RevenueCatPurchasesApi)
      : null;

  return {
    api,
    verboseLogLevel: REVENUECAT_LOG_LEVEL?.VERBOSE,
  };
}

function log(...args: unknown[]) {
  if (__DEV__) {
    console.log('[PurchaseProvider]', ...args);
  }
}

function resolveActiveEntitlement(
  customerInfo: RevenueCatCustomerInfo | null | undefined
): RevenueCatEntitlementInfo | null {
  const activeEntitlements = customerInfo?.entitlements?.active ?? {};
  const preferred = activeEntitlements[REVENUECAT_RUNTIME.entitlementIdentifier];

  if (preferred) {
    return preferred;
  }

  const firstActive = Object.values(activeEntitlements).find(Boolean);
  return firstActive ?? null;
}

function selectOffering(
  offerings: RevenueCatOfferings | null | undefined
): { offering: RevenueCatOffering | null; source: OfferingSelectionSource } {
  if (!offerings) {
    return {
      offering: null,
      source: 'none',
    };
  }

  const configured = offerings.all?.[REVENUECAT_RUNTIME.offeringIdentifier];

  if (configured) {
    return {
      offering: configured,
      source: 'configured',
    };
  }

  if (offerings.current) {
    return {
      offering: offerings.current,
      source: 'current',
    };
  }

  return {
    offering: null,
    source: 'none',
  };
}

function matchesAnnualProductId(
  pkg: RevenueCatPackage,
  annualProductId: string
): boolean {
  const normalizedAnnualProductId = annualProductId.trim();
  const annualProductIdPrefix = normalizedAnnualProductId.split(':')[0];
  const candidateIdentifiers = [
    pkg.productIdentifier,
    pkg.storeProduct?.identifier,
    pkg.storeProduct?.productIdentifier,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim());

  return (
    candidateIdentifiers.includes(normalizedAnnualProductId) ||
    candidateIdentifiers.includes(annualProductIdPrefix) ||
    candidateIdentifiers.some((value) => value.split(':')[0] === annualProductIdPrefix)
  );
}

function selectPackage(
  offering: RevenueCatOffering | null,
  annualProductId: string
): { pkg: RevenueCatPackage | null; source: PackageSelectionSource } {
  if (!offering) {
    return {
      pkg: null,
      source: 'none',
    };
  }

  const availablePackages = Array.isArray(offering.availablePackages)
    ? offering.availablePackages
    : [];

  if (offering.annual && matchesAnnualProductId(offering.annual, annualProductId)) {
    return {
      pkg: offering.annual,
      source: 'annual_exact',
    };
  }

  const exactMatch = availablePackages.find((pkg) =>
    matchesAnnualProductId(pkg, annualProductId)
  );

  if (exactMatch) {
    return {
      pkg: exactMatch,
      source: 'available_exact',
    };
  }

  if (offering.annual) {
    return {
      pkg: offering.annual,
      source: 'annual_fallback',
    };
  }

  if (availablePackages[0]) {
    return {
      pkg: availablePackages[0],
      source: 'available_fallback',
    };
  }

  return {
    pkg: null,
    source: 'none',
  };
}

function resolvePackageProductIdentifier(pkg: RevenueCatPackage | null): string | null {
  if (!pkg) {
    return null;
  }

  return pkg.productIdentifier ?? pkg.storeProduct?.identifier ?? pkg.storeProduct?.productIdentifier ?? null;
}

async function runOfferingsSmokeCheck(
  annualProductId: string
): Promise<OfferingsSmokeCheckResult> {
  const { api } = getRevenueCatApi();

  if (!api?.getOfferings) {
    return {
      attempted: false,
      success: false,
      summary: 'Offerings smoke check atlandı (API hazır değil).',
      offeringIdentifier: null,
      packageIdentifier: null,
      productIdentifier: null,
      matchedAnnualProductId: false,
      availablePackagesCount: 0,
      error: 'offerings_api_unavailable',
    };
  }

  try {
    const offerings = await api.getOfferings();
    const selection = selectOffering(offerings);
    const availablePackagesCount = Array.isArray(selection.offering?.availablePackages)
      ? selection.offering?.availablePackages.length
      : 0;
    const packageSelection = selectPackage(selection.offering, annualProductId);
    const resolvedProductIdentifier = resolvePackageProductIdentifier(packageSelection.pkg);
    const matchedAnnualProductId =
      resolvedProductIdentifier === annualProductId && annualProductId.trim().length > 0;
    const summary =
      selection.offering && packageSelection.pkg
        ? `offering:${selection.source} package:${packageSelection.source}`
        : 'offering/package çözümlenemedi';

    return {
      attempted: true,
      success: Boolean(selection.offering && packageSelection.pkg),
      summary,
      offeringIdentifier: selection.offering?.identifier ?? null,
      packageIdentifier: packageSelection.pkg?.identifier ?? null,
      productIdentifier: resolvedProductIdentifier,
      matchedAnnualProductId,
      availablePackagesCount,
      error: null,
    };
  } catch (error) {
    return {
      attempted: true,
      success: false,
      summary: 'Offerings smoke check hata verdi.',
      offeringIdentifier: null,
      packageIdentifier: null,
      productIdentifier: null,
      matchedAnnualProductId: false,
      availablePackagesCount: 0,
      error: formatRevenueCatUserMessage(
        error,
        'Offerings smoke check hata verdi.'
      ),
    };
  }
}

async function ensureConfigured(authUid: string | null): Promise<boolean> {
  lastKnownAuthUid = authUid;
  lastConfigurationError = null;

  if (!REVENUECAT_RUNTIME.isReady) {
    lastConfigurationError = 'revenuecat_runtime_not_ready';
    return false;
  }

  const { api, verboseLogLevel } = getRevenueCatApi();

  if (!api?.configure) {
    lastConfigurationError = 'revenuecat_configure_api_unavailable';
    return false;
  }

  if (!providerConfigured) {
    try {
      if (__DEV__ && api.setLogLevel && verboseLogLevel !== undefined) {
        api.setLogLevel(verboseLogLevel);
      }

      api.configure({
        apiKey: REVENUECAT_RUNTIME.activePlatformApiKey,
      });

      providerConfigured = true;
      log('configure completed', {
        authUid,
        platform: REVENUECAT_RUNTIME.platform,
      });
    } catch (error) {
      providerConfigured = false;
      lastConfigurationError = `revenuecat_configure_failed:${toErrorMessage(error)}`;
      return false;
    }
  }

  if (!REVENUECAT_RUNTIME.supportsNativePurchases) {
    configuredAppUserId = authUid;
    return true;
  }

  if (authUid && configuredAppUserId !== authUid) {
    if (!api.logIn) {
      lastConfigurationError = 'revenuecat_login_api_unavailable';
      return false;
    }

    try {
      await api.logIn(authUid);
      configuredAppUserId = authUid;
    } catch {
      lastConfigurationError = 'revenuecat_login_failed';
      return false;
    }

    return true;
  }

  if (!authUid && configuredAppUserId) {
    if (!api.logOut) {
      configuredAppUserId = null;
      return true;
    }

    try {
      await api.logOut();
    } catch {
      lastConfigurationError = 'revenuecat_logout_failed';
      return false;
    }

    configuredAppUserId = null;
    return true;
  }

  return true;
}

function buildPurchaseSuccessResult(
  customerInfo: RevenueCatCustomerInfo | null | undefined,
  message: string
): PurchaseProviderPurchaseResult {
  const entitlement = resolveActiveEntitlement(customerInfo);

  return {
    status: entitlement ? 'purchased' : 'error',
    providerName: 'revenuecat',
    message,
    activatedAt:
      normalizeNullableDate(entitlement?.latestPurchaseDate) ??
      normalizeNullableDate(entitlement?.originalPurchaseDate),
    expiresAt: normalizeNullableDate(entitlement?.expirationDate),
    lastValidatedAt: new Date().toISOString(),
    transactionId: null,
    customerId: customerInfo?.originalAppUserId ?? null,
  };
}

function buildRestoreResult(
  customerInfo: RevenueCatCustomerInfo | null | undefined,
  status: 'restored' | 'no_active_purchase',
  message: string
): PurchaseProviderRestoreResult {
  const entitlement = resolveActiveEntitlement(customerInfo);

  return {
    status: entitlement ? 'restored' : status,
    providerName: 'revenuecat',
    message,
    activatedAt:
      normalizeNullableDate(entitlement?.latestPurchaseDate) ??
      normalizeNullableDate(entitlement?.originalPurchaseDate),
    expiresAt: normalizeNullableDate(entitlement?.expirationDate),
    lastValidatedAt: new Date().toISOString(),
    transactionId: null,
    customerId: customerInfo?.originalAppUserId ?? null,
  };
}

function resolveIdentityMode(): PurchaseProviderIdentityMode {
  if (lastKnownAuthUid) {
    return 'authenticated';
  }

  if (configuredAppUserId === null) {
    return 'anonymous';
  }

  return 'unknown';
}

function createRevenueCatAdapter(): PurchaseProviderAdapter {
  return {
    name: 'revenuecat',

    async isConfigured(): Promise<boolean> {
      return ensureConfigured(lastKnownAuthUid);
    },

    async purchaseAnnualPlan(
      params: PurchaseProviderPurchaseParams
    ): Promise<PurchaseProviderPurchaseResult> {
      if (!REVENUECAT_RUNTIME.isReady) {
        return {
          status: 'not_supported',
          providerName: 'revenuecat',
          message: 'RevenueCat runtime hazır değil.',
          activatedAt: null,
          expiresAt: null,
          lastValidatedAt: null,
          transactionId: null,
          customerId: null,
        };
      }

      if (!REVENUECAT_RUNTIME.supportsNativePurchases) {
        return {
          status: 'not_supported',
          providerName: 'revenuecat',
          message: 'Expo Go preview modunda gerçek satın alma desteklenmez.',
          activatedAt: null,
          expiresAt: null,
          lastValidatedAt: null,
          transactionId: null,
          customerId: null,
        };
      }

      const configured = await ensureConfigured(params.authUid);

      if (!configured) {
        return {
          status: 'not_supported',
          providerName: 'revenuecat',
          message: 'RevenueCat SDK kurulu değil veya provider identity senkronu hazır değil.',
          activatedAt: null,
          expiresAt: null,
          lastValidatedAt: null,
          transactionId: null,
          customerId: null,
        };
      }

      const { api } = getRevenueCatApi();

      if (!api?.getOfferings || !api.purchasePackage) {
        return {
          status: 'not_supported',
          providerName: 'revenuecat',
          message: 'RevenueCat purchase API hazır değil.',
          activatedAt: null,
          expiresAt: null,
          lastValidatedAt: null,
          transactionId: null,
          customerId: null,
        };
      }

      try {
        const offerings = await api.getOfferings();
        const offeringSelection = selectOffering(offerings);
        const packageSelection = selectPackage(
          offeringSelection.offering,
          params.annualProductId
        );
        const selectedPackage = packageSelection.pkg;

        if (!selectedPackage) {
          return {
            status: 'error',
            providerName: 'revenuecat',
            message: 'RevenueCat offering/package çözümlenemedi.',
            activatedAt: null,
            expiresAt: null,
            lastValidatedAt: null,
            transactionId: null,
            customerId: null,
          };
        }

        const purchaseResult = await api.purchasePackage(selectedPackage);

        if (purchaseResult?.userCancelled) {
          return {
            status: 'cancelled',
            providerName: 'revenuecat',
            message: 'Satın alma işlemi kullanıcı tarafından iptal edildi.',
            activatedAt: null,
            expiresAt: null,
            lastValidatedAt: null,
            transactionId: null,
            customerId: null,
          };
        }

        return buildPurchaseSuccessResult(
          purchaseResult?.customerInfo,
          'Satın alma işlemi tamamlandı.'
        );
      } catch (error) {
        return {
          status: 'error',
          providerName: 'revenuecat',
          message: formatRevenueCatUserMessage(
            error,
            'RevenueCat satin alma akisi hata verdi.'
          ),
          activatedAt: null,
          expiresAt: null,
          lastValidatedAt: null,
          transactionId: null,
          customerId: null,
        };
      }
    },

    async restorePurchases(
      params: PurchaseProviderRestoreParams
    ): Promise<PurchaseProviderRestoreResult> {
      if (!REVENUECAT_RUNTIME.isReady) {
        return {
          status: 'not_supported',
          providerName: 'revenuecat',
          message: 'RevenueCat runtime hazır değil.',
          activatedAt: null,
          expiresAt: null,
          lastValidatedAt: null,
          transactionId: null,
          customerId: null,
        };
      }

      const configured = await ensureConfigured(params.authUid);

      if (!configured) {
        return {
          status: 'not_supported',
          providerName: 'revenuecat',
          message: 'RevenueCat SDK kurulu değil veya provider identity senkronu hazır değil.',
          activatedAt: null,
          expiresAt: null,
          lastValidatedAt: null,
          transactionId: null,
          customerId: null,
        };
      }

      const { api } = getRevenueCatApi();

      if (!api?.restorePurchases) {
        return {
          status: 'not_supported',
          providerName: 'revenuecat',
          message: 'RevenueCat restore API hazır değil.',
          activatedAt: null,
          expiresAt: null,
          lastValidatedAt: null,
          transactionId: null,
          customerId: null,
        };
      }

      try {
        const customerInfo = await api.restorePurchases();
        const entitlement = resolveActiveEntitlement(customerInfo);

        return buildRestoreResult(
          customerInfo,
          entitlement ? 'restored' : 'no_active_purchase',
          entitlement
            ? 'Satın alma başarıyla geri yüklendi.'
            : 'Aktif premium satın alma bulunamadı.'
        );
      } catch (error) {
        return {
          status: 'error',
          providerName: 'revenuecat',
          message: formatRevenueCatUserMessage(
            error,
            'RevenueCat restore akisi hata verdi.'
          ),
          activatedAt: null,
          expiresAt: null,
          lastValidatedAt: null,
          transactionId: null,
          customerId: null,
        };
      }
    },
  };
}

export async function syncPurchaseProviderIdentity(authUid: string | null): Promise<void> {
  await ensureConfigured(authUid);
}

export function registerPurchaseProviderAdapter(
  adapter: PurchaseProviderAdapter
): void {
  registeredAdapter = adapter;
}

export function resetPurchaseProviderAdapter(): void {
  registeredAdapter = null;
  providerConfigured = false;
  configuredAppUserId = null;
  lastKnownAuthUid = null;
  lastConfigurationError = null;
}

export function getPurchaseProviderAdapter(): PurchaseProviderAdapter {
  return registeredAdapter ?? createRevenueCatAdapter();
}

export function getLastPurchaseProviderConfigurationIssue(): string | null {
  return lastConfigurationError;
}

export async function getPurchaseProviderDiagnosticsSnapshot(
  options?: { annualProductId?: string }
): Promise<PurchaseProviderDiagnosticsSnapshot> {
  const runtimeDiagnostics = getRevenueCatRuntimeDiagnosticsSnapshot();
  const { api } = getRevenueCatApi();
  const annualProductId = options?.annualProductId?.trim() ?? '';
  const smokeCheck = await runOfferingsSmokeCheck(annualProductId);
  const adapter = getPurchaseProviderAdapter();
  const isConfigured = await adapter.isConfigured();
  const authUidPresent = Boolean(lastKnownAuthUid);
  const configuredForCurrentUser = authUidPresent
    ? configuredAppUserId === lastKnownAuthUid
    : configuredAppUserId === null;
  const identityMismatch = !configuredForCurrentUser;
  const identityMismatchReason = identityMismatch
    ? `authUid=${lastKnownAuthUid ?? '-'} configuredAppUserId=${configuredAppUserId ?? '-'}`
    : lastConfigurationError;

  return {
    fetchedAt: new Date().toISOString(),
    providerName: api ? adapter.name : 'adapter_unbound',
    runtimeSource: runtimeDiagnostics.source,
    platform: runtimeDiagnostics.platform,
    isExpoGo: runtimeDiagnostics.isExpoGo,
    supportsNativePurchases: runtimeDiagnostics.supportsNativePurchases,
    runtimeReady: runtimeDiagnostics.isReady,
    sdkModulePresent: Boolean(api),
    isConfigured,
    authUidPresent,
    configuredAppUserId,
    authUid: lastKnownAuthUid,
    identityMode: resolveIdentityMode(),
    identitySynced: configuredForCurrentUser,
    identityMismatch,
    identityMismatchReason,
    iosApiKeyPresent: runtimeDiagnostics.iosApiKeyPresent,
    androidApiKeyPresent: runtimeDiagnostics.androidApiKeyPresent,
    activePlatformApiKeyPresent: runtimeDiagnostics.activePlatformApiKeyPresent,
    entitlementIdentifier: runtimeDiagnostics.entitlementIdentifier,
    offeringIdentifier: runtimeDiagnostics.offeringIdentifier,
    missingKeys: [...runtimeDiagnostics.missingKeys],
    smokeCheckAttempted: smokeCheck.attempted,
    smokeCheckSuccess: smokeCheck.success,
    smokeCheckSummary: smokeCheck.summary,
    smokeCheckResolvedOfferingId: smokeCheck.offeringIdentifier,
    smokeCheckResolvedPackageId: smokeCheck.packageIdentifier,
    smokeCheckResolvedProductId: smokeCheck.productIdentifier,
    smokeCheckMatchedAnnualProductId: smokeCheck.matchedAnnualProductId,
    smokeCheckAvailablePackagesCount: smokeCheck.availablePackagesCount,
    smokeCheckError: smokeCheck.error,
  };
}

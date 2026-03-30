import Purchases, { LOG_LEVEL as REVENUECAT_LOG_LEVEL } from 'react-native-purchases';
import {
  REVENUECAT_RUNTIME,
  getRevenueCatRuntimeDiagnosticsSnapshot,
} from '../config/revenueCatRuntime';
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
  | 'available_annual_hint'
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

type RevenueCatErrorLike = {
  code?: unknown;
  message?: unknown;
  underlyingErrorMessage?: unknown;
  userCancelled?: unknown;
};

const DEFAULT_ANNUAL_PACKAGE_IDENTIFIERS = ['$rc_annual', 'annual'] as const;

let providerConfigured = false;
let configuredAppUserId: string | null = null;
let lastKnownAuthUid: string | null = null;
let registeredAdapter: PurchaseProviderAdapter | null = null;
let lastConfigurationError: string | null = null;

function log(...args: unknown[]) {
  if (__DEV__) {
    console.log('[PurchaseProvider]', ...args);
  }
}

function normalizeIdentifier(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

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
    normalized.includes('no products registered')
  ) {
    return 'RevenueCat offering içinde mağaza ürünü çözümlenemedi. Offering, package ve product eşleşmesini kontrol et.';
  }

  if (
    normalized.includes('could not be fetched from the play store') ||
    normalized.includes('none of the products registered')
  ) {
    return 'RevenueCat ürünleri Google Play tarafından çözümlenemedi. Subscription, base plan, tester hesabı ve closed test opt-in zincirini kontrol et.';
  }

  if (
    details.code === 'PurchaseNotAllowedError' &&
    (normalized.includes('billing is not available in this device') ||
      normalized.includes('billing_unavailable'))
  ) {
    return 'Google Play Billing bu cihazda kullanılamıyor. Gerçek Android cihaz, doğru Play hesabı ve tester kullan.';
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

function setConfigurationIssue(code: string, detail?: string): false {
  lastConfigurationError = detail ? `${code}:${detail}` : code;
  return false;
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

function getPackageIdentifiers(pkg: RevenueCatPackage | null): string[] {
  if (!pkg) {
    return [];
  }

  return [
    normalizeIdentifier(pkg.identifier),
    normalizeIdentifier(pkg.productIdentifier),
    normalizeIdentifier(pkg.storeProduct?.identifier),
    normalizeIdentifier(pkg.storeProduct?.productIdentifier),
  ].filter((value): value is string => Boolean(value));
}

function matchesAnnualProductId(
  pkg: RevenueCatPackage,
  annualProductId: string
): boolean {
  const normalizedAnnualProductId = normalizeIdentifier(annualProductId);

  if (!normalizedAnnualProductId) {
    return false;
  }

  return getPackageIdentifiers(pkg).some(
    (identifier) => identifier === normalizedAnnualProductId
  );
}

function matchesAnnualPackageHint(pkg: RevenueCatPackage): boolean {
  const packageIdentifier = normalizeIdentifier(pkg.identifier)?.toLowerCase();

  if (!packageIdentifier) {
    return false;
  }

  return DEFAULT_ANNUAL_PACKAGE_IDENTIFIERS.includes(
    packageIdentifier as (typeof DEFAULT_ANNUAL_PACKAGE_IDENTIFIERS)[number]
  );
}

function listUniquePackages(offering: RevenueCatOffering | null): RevenueCatPackage[] {
  if (!offering) {
    return [];
  }

  const rawPackages = [
    offering.annual ?? null,
    ...(Array.isArray(offering.availablePackages) ? offering.availablePackages : []),
  ].filter((value): value is RevenueCatPackage => Boolean(value));

  const uniquePackages: RevenueCatPackage[] = [];
  const seenKeys = new Set<string>();

  for (const pkg of rawPackages) {
    const key = getPackageIdentifiers(pkg).join('|');

    if (!key) {
      uniquePackages.push(pkg);
      continue;
    }

    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    uniquePackages.push(pkg);
  }

  return uniquePackages;
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

  const candidates = listUniquePackages(offering);

  if (offering.annual && matchesAnnualProductId(offering.annual, annualProductId)) {
    return {
      pkg: offering.annual,
      source: 'annual_exact',
    };
  }

  const exactMatch = candidates.find((pkg) =>
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

  const hintedAnnualPackage = candidates.find((pkg) => matchesAnnualPackageHint(pkg));

  if (hintedAnnualPackage) {
    return {
      pkg: hintedAnnualPackage,
      source: 'available_annual_hint',
    };
  }

  if (candidates[0]) {
    return {
      pkg: candidates[0],
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

  return (
    normalizeIdentifier(pkg.productIdentifier) ??
    normalizeIdentifier(pkg.storeProduct?.identifier) ??
    normalizeIdentifier(pkg.storeProduct?.productIdentifier) ??
    null
  );
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
      ? selection.offering.availablePackages.length
      : 0;
    const packageSelection = selectPackage(selection.offering, annualProductId);
    const resolvedProductIdentifier = resolvePackageProductIdentifier(packageSelection.pkg);
    const matchedAnnualProductId =
      Boolean(normalizeIdentifier(annualProductId)) &&
      resolvedProductIdentifier === normalizeIdentifier(annualProductId);

    const summary =
      selection.offering && packageSelection.pkg
        ? `offering:${selection.source} package:${packageSelection.source}`
        : 'offering/package çözümlenemedi';

    return {
      attempted: true,
      success: Boolean(selection.offering && packageSelection.pkg),
      summary,
      offeringIdentifier: normalizeIdentifier(selection.offering?.identifier) ?? null,
      packageIdentifier: normalizeIdentifier(packageSelection.pkg?.identifier) ?? null,
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

  if (!REVENUECAT_RUNTIME.supportsNativePurchases) {
    return setConfigurationIssue(
      'revenuecat_native_purchases_not_supported',
      `platform=${REVENUECAT_RUNTIME.platform},expoGo=${String(REVENUECAT_RUNTIME.isExpoGo)}`
    );
  }

  if (!REVENUECAT_RUNTIME.isReady) {
    const missing = REVENUECAT_RUNTIME.missingKeys.join(',');
    return setConfigurationIssue(
      'revenuecat_runtime_not_ready',
      missing || 'missing_runtime_requirements'
    );
  }

  const { api, verboseLogLevel } = getRevenueCatApi();

  if (!api?.configure) {
    return setConfigurationIssue('revenuecat_configure_api_unavailable');
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
      return setConfigurationIssue(
        'revenuecat_configure_failed',
        toErrorMessage(error)
      );
    }
  }

  if (authUid && configuredAppUserId === authUid) {
    return true;
  }

  if (authUid) {
    if (!api.logIn) {
      return setConfigurationIssue('revenuecat_login_api_unavailable');
    }

    try {
      await api.logIn(authUid);
      configuredAppUserId = authUid;
      return true;
    } catch (error) {
      return setConfigurationIssue('revenuecat_login_failed', toErrorMessage(error));
    }
  }

  if (!authUid && configuredAppUserId !== null) {
    if (!api.logOut) {
      configuredAppUserId = null;
      return true;
    }

    try {
      await api.logOut();
      configuredAppUserId = null;
      return true;
    } catch (error) {
      return setConfigurationIssue('revenuecat_logout_failed', toErrorMessage(error));
    }
  }

  configuredAppUserId = null;
  return true;
}

function buildPurchaseSuccessResult(
  customerInfo: RevenueCatCustomerInfo | null | undefined
): PurchaseProviderPurchaseResult {
  const entitlement = resolveActiveEntitlement(customerInfo);

  if (!entitlement) {
    return {
      status: 'error',
      providerName: 'revenuecat',
      message: `Satın alma tamamlandı ancak ${REVENUECAT_RUNTIME.entitlementIdentifier} entitlement aktif görünmüyor.`,
      activatedAt: null,
      expiresAt: null,
      lastValidatedAt: new Date().toISOString(),
      transactionId: null,
      customerId: customerInfo?.originalAppUserId ?? null,
    };
  }

  return {
    status: 'purchased',
    providerName: 'revenuecat',
    message: 'Satın alma işlemi tamamlandı.',
    activatedAt:
      normalizeNullableDate(entitlement.latestPurchaseDate) ??
      normalizeNullableDate(entitlement.originalPurchaseDate),
    expiresAt: normalizeNullableDate(entitlement.expirationDate),
    lastValidatedAt: new Date().toISOString(),
    transactionId: null,
    customerId: customerInfo?.originalAppUserId ?? null,
  };
}

function buildRestoreResult(
  customerInfo: RevenueCatCustomerInfo | null | undefined,
  message: string
): PurchaseProviderRestoreResult {
  const entitlement = resolveActiveEntitlement(customerInfo);

  return {
    status: entitlement ? 'restored' : 'no_active_purchase',
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
      if (!REVENUECAT_RUNTIME.supportsNativePurchases) {
        return {
          status: 'not_supported',
          providerName: 'revenuecat',
          message: 'Expo Go yerine native dev build veya release build kullan.',
          activatedAt: null,
          expiresAt: null,
          lastValidatedAt: null,
          transactionId: null,
          customerId: null,
        };
      }

      if (!REVENUECAT_RUNTIME.isReady) {
        return {
          status: 'not_supported',
          providerName: 'revenuecat',
          message: `RevenueCat runtime hazır değil. Eksik alanlar: ${REVENUECAT_RUNTIME.missingKeys.join(', ') || 'bilinmiyor'}`,
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
          message:
            'RevenueCat SDK kurulu değil veya provider identity senkronu hazır değil.',
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
            message:
              'RevenueCat offering/package çözümlenemedi. Dashboard tarafında annual package ve product mapping kontrol edilmeli.',
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

        return buildPurchaseSuccessResult(purchaseResult?.customerInfo);
      } catch (error) {
        return {
          status: 'error',
          providerName: 'revenuecat',
          message: formatRevenueCatUserMessage(
            error,
            'RevenueCat satın alma akışı hata verdi.'
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
      if (!REVENUECAT_RUNTIME.supportsNativePurchases) {
        return {
          status: 'not_supported',
          providerName: 'revenuecat',
          message: 'Expo Go yerine native dev build veya release build kullan.',
          activatedAt: null,
          expiresAt: null,
          lastValidatedAt: null,
          transactionId: null,
          customerId: null,
        };
      }

      if (!REVENUECAT_RUNTIME.isReady) {
        return {
          status: 'not_supported',
          providerName: 'revenuecat',
          message: `RevenueCat runtime hazır değil. Eksik alanlar: ${REVENUECAT_RUNTIME.missingKeys.join(', ') || 'bilinmiyor'}`,
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
          message:
            'RevenueCat SDK kurulu değil veya provider identity senkronu hazır değil.',
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
            'RevenueCat restore akışı hata verdi.'
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
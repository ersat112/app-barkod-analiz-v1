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

type RevenueCatModule = {
  default?: RevenueCatPurchasesApi;
  LOG_LEVEL?: {
    VERBOSE?: unknown;
  };
};

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

let providerConfigured = false;
let configuredAppUserId: string | null = null;
let lastKnownAuthUid: string | null = null;
let registeredAdapter: PurchaseProviderAdapter | null = null;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'purchase_provider_unknown_error';
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

function getRuntimeRequire(): ((name: string) => unknown) | null {
  try {
    return Function('return require')() as (name: string) => unknown;
  } catch {
    return null;
  }
}

function getRevenueCatModule(): RevenueCatModule | null {
  try {
    const runtimeRequire = getRuntimeRequire();

    if (!runtimeRequire) {
      return null;
    }

    return runtimeRequire('react-native-purchases') as RevenueCatModule;
  } catch {
    return null;
  }
}

function getRevenueCatApi(): {
  api: RevenueCatPurchasesApi | null;
  verboseLogLevel: unknown;
} {
  const module = getRevenueCatModule();
  const api =
    module?.default && typeof module.default === 'object'
      ? module.default
      : null;

  return {
    api,
    verboseLogLevel: module?.LOG_LEVEL?.VERBOSE,
  };
}

function createNoopPurchaseResult(
  params: PurchaseProviderPurchaseParams
): PurchaseProviderPurchaseResult {
  return {
    status: 'not_supported',
    providerName: 'adapter_unbound',
    message: `Satın alma adapter'ı bağlı değil: ${params.annualProductId}`,
    activatedAt: null,
    expiresAt: null,
    lastValidatedAt: null,
    transactionId: null,
    customerId: null,
  };
}

function createNoopRestoreResult(
  params: PurchaseProviderRestoreParams
): PurchaseProviderRestoreResult {
  return {
    status: 'not_supported',
    providerName: 'adapter_unbound',
    message: `Geri yükleme adapter'ı bağlı değil: ${params.annualProductId}`,
    activatedAt: null,
    expiresAt: null,
    lastValidatedAt: null,
    transactionId: null,
    customerId: null,
  };
}

function createNoopPurchaseProviderAdapter(): PurchaseProviderAdapter {
  return {
    name: 'adapter_unbound',
    async isConfigured() {
      return false;
    },
    async purchaseAnnualPlan(params) {
      return createNoopPurchaseResult(params);
    },
    async restorePurchases(params) {
      return createNoopRestoreResult(params);
    },
  };
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
): RevenueCatOffering | null {
  if (!offerings) {
    return null;
  }

  const configured = offerings.all?.[REVENUECAT_RUNTIME.offeringIdentifier];

  if (configured) {
    return configured;
  }

  return offerings.current ?? null;
}

function matchesAnnualProductId(
  pkg: RevenueCatPackage,
  annualProductId: string
): boolean {
  return (
    pkg.productIdentifier === annualProductId ||
    pkg.storeProduct?.identifier === annualProductId ||
    pkg.storeProduct?.productIdentifier === annualProductId
  );
}

function selectPackage(
  offering: RevenueCatOffering | null,
  annualProductId: string
): RevenueCatPackage | null {
  if (!offering) {
    return null;
  }

  const availablePackages = Array.isArray(offering.availablePackages)
    ? offering.availablePackages
    : [];

  if (offering.annual && matchesAnnualProductId(offering.annual, annualProductId)) {
    return offering.annual;
  }

  const exactMatch = availablePackages.find((pkg) =>
    matchesAnnualProductId(pkg, annualProductId)
  );

  if (exactMatch) {
    return exactMatch;
  }

  if (offering.annual) {
    return offering.annual;
  }

  return availablePackages[0] ?? null;
}

async function ensureConfigured(authUid: string | null): Promise<boolean> {
  lastKnownAuthUid = authUid;

  if (!REVENUECAT_RUNTIME.isReady) {
    return false;
  }

  const { api, verboseLogLevel } = getRevenueCatApi();

  if (!api?.configure) {
    return false;
  }

  if (!providerConfigured) {
    if (__DEV__ && api.setLogLevel && verboseLogLevel !== undefined) {
      api.setLogLevel(verboseLogLevel);
    }

    api.configure({
      apiKey: REVENUECAT_RUNTIME.activePlatformApiKey,
    });

    providerConfigured = true;
  }

  if (!REVENUECAT_RUNTIME.supportsNativePurchases) {
    configuredAppUserId = authUid;
    return true;
  }

  if (authUid && configuredAppUserId !== authUid) {
    if (!api.logIn) {
      return false;
    }

    try {
      await api.logIn(authUid);
      configuredAppUserId = authUid;
    } catch {
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
        const offering = selectOffering(offerings);
        const selectedPackage = selectPackage(offering, params.annualProductId);

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
          message: toErrorMessage(error),
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
          message: toErrorMessage(error),
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
}

export function getPurchaseProviderAdapter(): PurchaseProviderAdapter {
  return registeredAdapter ?? createRevenueCatAdapter();
}

export async function getPurchaseProviderDiagnosticsSnapshot(): Promise<PurchaseProviderDiagnosticsSnapshot> {
  const runtimeDiagnostics = getRevenueCatRuntimeDiagnosticsSnapshot();
  const { api } = getRevenueCatApi();
  const adapter = getPurchaseProviderAdapter();
  const isConfigured = await adapter.isConfigured();
  const authUidPresent = Boolean(lastKnownAuthUid);
  const configuredForCurrentUser = authUidPresent
    ? configuredAppUserId === lastKnownAuthUid
    : configuredAppUserId === null;

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
    identityMode: resolveIdentityMode(),
    identitySynced: configuredForCurrentUser,
    iosApiKeyPresent: runtimeDiagnostics.iosApiKeyPresent,
    androidApiKeyPresent: runtimeDiagnostics.androidApiKeyPresent,
    activePlatformApiKeyPresent: runtimeDiagnostics.activePlatformApiKeyPresent,
    entitlementIdentifier: runtimeDiagnostics.entitlementIdentifier,
    offeringIdentifier: runtimeDiagnostics.offeringIdentifier,
    missingKeys: [...runtimeDiagnostics.missingKeys],
  };
}
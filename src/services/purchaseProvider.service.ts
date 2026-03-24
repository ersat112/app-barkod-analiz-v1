import { APP_RUNTIME, getEnvString } from '../config/appRuntime';
import type {
  PurchaseProviderAdapter,
  PurchaseProviderDiagnosticsSnapshot,
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
  purchasePackage?: (
    pkg: unknown
  ) => Promise<RevenueCatPurchaseResponse>;
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

type RevenueCatRuntimeConfig = {
  source: 'env_override' | 'fallback';
  platform: 'ios' | 'android' | 'web';
  isExpoGo: boolean;
  supportsNativePurchases: boolean;
  iosApiKey: string;
  androidApiKey: string;
  activePlatformApiKey: string;
  entitlementIdentifier: string;
  offeringIdentifier: string;
  isReady: boolean;
  missingKeys: string[];
};

const FALLBACK_REVENUECAT_CONFIG = Object.freeze({
  iosApiKey: '',
  androidApiKey: '',
  entitlementIdentifier: 'premium',
  offeringIdentifier: 'default',
});

const hasRuntimeOverrides = [
  'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY',
  'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY',
  'EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID',
  'EXPO_PUBLIC_REVENUECAT_OFFERING_ID',
].some((key) => Boolean(process.env[key]?.trim()));

const runtimePlatform: 'ios' | 'android' | 'web' =
  APP_RUNTIME.platform === 'ios' || APP_RUNTIME.platform === 'android'
    ? APP_RUNTIME.platform
    : 'web';

const runtimeConfig: RevenueCatRuntimeConfig = (() => {
  const iosApiKey = getEnvString(
    'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY',
    FALLBACK_REVENUECAT_CONFIG.iosApiKey
  ).trim();

  const androidApiKey = getEnvString(
    'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY',
    FALLBACK_REVENUECAT_CONFIG.androidApiKey
  ).trim();

  const entitlementIdentifier = getEnvString(
    'EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID',
    FALLBACK_REVENUECAT_CONFIG.entitlementIdentifier
  ).trim();

  const offeringIdentifier = getEnvString(
    'EXPO_PUBLIC_REVENUECAT_OFFERING_ID',
    FALLBACK_REVENUECAT_CONFIG.offeringIdentifier
  ).trim();

  const activePlatformApiKey =
    runtimePlatform === 'ios'
      ? iosApiKey
      : runtimePlatform === 'android'
        ? androidApiKey
        : '';

  const missingKeys: string[] = [];

  if (runtimePlatform === 'ios' && !iosApiKey) {
    missingKeys.push('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY');
  }

  if (runtimePlatform === 'android' && !androidApiKey) {
    missingKeys.push('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY');
  }

  if (!entitlementIdentifier) {
    missingKeys.push('EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID');
  }

  if (!offeringIdentifier) {
    missingKeys.push('EXPO_PUBLIC_REVENUECAT_OFFERING_ID');
  }

  return {
    source: hasRuntimeOverrides ? 'env_override' : 'fallback',
    platform: runtimePlatform,
    isExpoGo: APP_RUNTIME.isExpoGo,
    supportsNativePurchases: APP_RUNTIME.isNativeBuild && runtimePlatform !== 'web',
    iosApiKey,
    androidApiKey,
    activePlatformApiKey,
    entitlementIdentifier,
    offeringIdentifier,
    isReady:
      runtimePlatform !== 'web' &&
      Boolean(activePlatformApiKey) &&
      Boolean(entitlementIdentifier) &&
      Boolean(offeringIdentifier),
    missingKeys,
  };
})();

let providerConfigured = false;
let configuredAppUserId: string | null = null;
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
  const preferred = activeEntitlements[runtimeConfig.entitlementIdentifier];

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

  const configured = offerings.all?.[runtimeConfig.offeringIdentifier];

  if (configured) {
    return configured;
  }

  return offerings.current ?? null;
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

  const matchesAnnualProductId = (pkg: RevenueCatPackage): boolean => {
    return (
      pkg.productIdentifier === annualProductId ||
      pkg.storeProduct?.identifier === annualProductId ||
      pkg.storeProduct?.productIdentifier === annualProductId
    );
  };

  if (offering.annual && matchesAnnualProductId(offering.annual)) {
    return offering.annual;
  }

  const matchedPackage = availablePackages.find(matchesAnnualProductId);

  if (matchedPackage) {
    return matchedPackage;
  }

  return offering.annual ?? availablePackages[0] ?? null;
}

async function ensureConfigured(authUid: string | null): Promise<boolean> {
  if (!runtimeConfig.isReady) {
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
      apiKey: runtimeConfig.activePlatformApiKey,
    });

    providerConfigured = true;
  }

  if (!runtimeConfig.supportsNativePurchases) {
    configuredAppUserId = authUid;
    return true;
  }

  if (authUid && configuredAppUserId !== authUid && api.logIn) {
    try {
      await api.logIn(authUid);
      configuredAppUserId = authUid;
    } catch {
      configuredAppUserId = authUid;
    }
  } else if (!authUid && configuredAppUserId && api.logOut) {
    try {
      await api.logOut();
    } catch {
      // ignore logout error
    } finally {
      configuredAppUserId = null;
    }
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

function createRevenueCatAdapter(): PurchaseProviderAdapter {
  return {
    name: 'revenuecat',

    async isConfigured(): Promise<boolean> {
      return ensureConfigured(configuredAppUserId);
    },

    async purchaseAnnualPlan(
      params: PurchaseProviderPurchaseParams
    ): Promise<PurchaseProviderPurchaseResult> {
      if (!runtimeConfig.isReady) {
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

      if (!runtimeConfig.supportsNativePurchases) {
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
          message: 'RevenueCat SDK kurulu değil veya runtime yüklenemedi.',
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
      if (!runtimeConfig.isReady) {
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
          message: 'RevenueCat SDK kurulu değil veya runtime yüklenemedi.',
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

export function registerPurchaseProviderAdapter(
  adapter: PurchaseProviderAdapter
): void {
  registeredAdapter = adapter;
}

export function resetPurchaseProviderAdapter(): void {
  registeredAdapter = null;
}

export function getPurchaseProviderAdapter(): PurchaseProviderAdapter {
  return registeredAdapter ?? createRevenueCatAdapter();
}

export async function getPurchaseProviderDiagnosticsSnapshot(): Promise<PurchaseProviderDiagnosticsSnapshot> {
  const adapter = getPurchaseProviderAdapter();
  const configured = await adapter.isConfigured();
  const sdkPresent = Boolean(getRevenueCatApi().api);

  return {
    fetchedAt: new Date().toISOString(),
    providerName: sdkPresent ? adapter.name : 'adapter_unbound',
    runtimeSource: runtimeConfig.source,
    platform: runtimeConfig.platform,
    isExpoGo: runtimeConfig.isExpoGo,
    supportsNativePurchases: runtimeConfig.supportsNativePurchases,
    runtimeReady: runtimeConfig.isReady,
    isConfigured: configured,
    iosApiKeyPresent: Boolean(runtimeConfig.iosApiKey),
    androidApiKeyPresent: Boolean(runtimeConfig.androidApiKey),
    activePlatformApiKeyPresent: Boolean(runtimeConfig.activePlatformApiKey),
    entitlementIdentifier: runtimeConfig.entitlementIdentifier,
    offeringIdentifier: runtimeConfig.offeringIdentifier,
    missingKeys: [...runtimeConfig.missingKeys],
  };
}
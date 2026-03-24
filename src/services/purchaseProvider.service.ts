import type {
  PurchaseProviderAdapter,
  PurchaseProviderPurchaseParams,
  PurchaseProviderPurchaseResult,
  PurchaseProviderRestoreParams,
  PurchaseProviderRestoreResult,
} from '../types/monetization';

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

let registeredAdapter: PurchaseProviderAdapter = createNoopPurchaseProviderAdapter();

export function registerPurchaseProviderAdapter(
  adapter: PurchaseProviderAdapter
): void {
  registeredAdapter = adapter;
}

export function resetPurchaseProviderAdapter(): void {
  registeredAdapter = createNoopPurchaseProviderAdapter();
}

export function getPurchaseProviderAdapter(): PurchaseProviderAdapter {
  return registeredAdapter;
}
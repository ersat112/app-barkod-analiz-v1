import { auth } from '../config/firebase';
import { analyticsService } from './analytics.service';
import { entitlementService } from './entitlement.service';
import { monetizationPolicyService } from './monetizationPolicy.service';
import { getPurchaseProviderAdapter } from './purchaseProvider.service';
import type {
  PurchaseAnnualPlanResult,
  RestorePurchasesResult,
} from '../types/monetization';

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'purchase_service_unknown_error';
}

export const purchaseService = {
  async purchaseAnnualPlan(): Promise<PurchaseAnnualPlanResult> {
    const [policy, currentSnapshot] = await Promise.all([
      monetizationPolicyService.getResolvedPolicy({ allowStale: true }),
      entitlementService.getSnapshot(),
    ]);

    if (!policy.annualPlanEnabled) {
      return {
        status: 'not_supported',
        snapshot: currentSnapshot,
        providerName: 'none',
        message: 'Yıllık premium plan bu rollout içinde kapalı.',
        transactionId: null,
        customerId: null,
      };
    }

    if (!policy.purchaseProviderEnabled) {
      return {
        status: 'not_supported',
        snapshot: currentSnapshot,
        providerName: 'none',
        message: 'Satın alma sağlayıcısı bu build içinde aktif değil.',
        transactionId: null,
        customerId: null,
      };
    }

    const adapter = getPurchaseProviderAdapter();
    const isConfigured = await adapter.isConfigured();

    if (!isConfigured) {
      return {
        status: 'not_supported',
        snapshot: currentSnapshot,
        providerName: adapter.name,
        message: 'Satın alma adapter sözleşmesi hazır, fakat gerçek provider bu build içinde bağlı değil.',
        transactionId: null,
        customerId: null,
      };
    }

    await analyticsService.track(
      'monetization_purchase_started',
      {
        annualProductId: policy.annualProductId,
        providerName: adapter.name,
        source: 'paywall',
      },
      { flush: false }
    );

    try {
      const providerResult = await adapter.purchaseAnnualPlan({
        annualProductId: policy.annualProductId,
        authUid: auth.currentUser?.uid ?? null,
      });

      const nextSnapshot =
        providerResult.status === 'purchased' ||
        providerResult.status === 'already_active'
          ? await entitlementService.applyProviderEntitlement({
              source: 'provider_purchase',
              activatedAt: providerResult.activatedAt,
              expiresAt: providerResult.expiresAt,
              lastValidatedAt: providerResult.lastValidatedAt,
            })
          : currentSnapshot;

      await analyticsService.track(
        'monetization_purchase_result',
        {
          annualProductId: policy.annualProductId,
          providerName: providerResult.providerName,
          status: providerResult.status,
          transactionId: providerResult.transactionId,
          customerId: providerResult.customerId,
        },
        { flush: false }
      );

      return {
        status: providerResult.status,
        snapshot: nextSnapshot,
        providerName: providerResult.providerName,
        message: providerResult.message,
        transactionId: providerResult.transactionId,
        customerId: providerResult.customerId,
      };
    } catch (error) {
      const message = toErrorMessage(error);

      await analyticsService.track(
        'monetization_purchase_result',
        {
          annualProductId: policy.annualProductId,
          providerName: adapter.name,
          status: 'error',
          errorMessage: message,
        },
        { flush: false }
      );

      return {
        status: 'error',
        snapshot: currentSnapshot,
        providerName: adapter.name,
        message,
        transactionId: null,
        customerId: null,
      };
    }
  },

  async restorePurchases(): Promise<RestorePurchasesResult> {
    const [policy, currentSnapshot] = await Promise.all([
      monetizationPolicyService.getResolvedPolicy({ allowStale: true }),
      entitlementService.getSnapshot(),
    ]);

    if (!policy.restoreEnabled) {
      return {
        status: 'not_supported',
        snapshot: currentSnapshot,
        providerName: 'none',
        message: 'Geri yükleme akışı bu rollout içinde kapalı.',
        transactionId: null,
        customerId: null,
      };
    }

    if (!policy.purchaseProviderEnabled) {
      return {
        status: 'not_supported',
        snapshot: currentSnapshot,
        providerName: 'none',
        message: 'Satın alma sağlayıcısı bu build içinde aktif değil.',
        transactionId: null,
        customerId: null,
      };
    }

    const adapter = getPurchaseProviderAdapter();
    const isConfigured = await adapter.isConfigured();

    if (!isConfigured) {
      return {
        status: 'not_supported',
        snapshot: currentSnapshot,
        providerName: adapter.name,
        message: 'Geri yükleme adapter sözleşmesi hazır, fakat gerçek provider bu build içinde bağlı değil.',
        transactionId: null,
        customerId: null,
      };
    }

    try {
      const providerResult = await adapter.restorePurchases({
        annualProductId: policy.annualProductId,
        authUid: auth.currentUser?.uid ?? null,
      });

      const nextSnapshot =
        providerResult.status === 'restored'
          ? await entitlementService.applyProviderEntitlement({
              source: 'provider_restore',
              activatedAt: providerResult.activatedAt,
              expiresAt: providerResult.expiresAt,
              lastValidatedAt: providerResult.lastValidatedAt,
            })
          : currentSnapshot;

      await analyticsService.track(
        'monetization_restore_result',
        {
          annualProductId: policy.annualProductId,
          providerName: providerResult.providerName,
          status: providerResult.status,
          transactionId: providerResult.transactionId,
          customerId: providerResult.customerId,
        },
        { flush: false }
      );

      return {
        status: providerResult.status,
        snapshot: nextSnapshot,
        providerName: providerResult.providerName,
        message: providerResult.message,
        transactionId: providerResult.transactionId,
        customerId: providerResult.customerId,
      };
    } catch (error) {
      const message = toErrorMessage(error);

      await analyticsService.track(
        'monetization_restore_result',
        {
          annualProductId: policy.annualProductId,
          providerName: adapter.name,
          status: 'error',
          errorMessage: message,
        },
        { flush: false }
      );

      return {
        status: 'error',
        snapshot: currentSnapshot,
        providerName: adapter.name,
        message,
        transactionId: null,
        customerId: null,
      };
    }
  },
};
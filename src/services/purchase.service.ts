import { auth } from '../config/firebase';
import { analyticsService } from './analytics.service';
import { entitlementService } from './entitlement.service';
import { monetizationPolicyService } from './monetizationPolicy.service';
import { appendMonetizationFlowLog } from './purchaseFlowLog.service';
import {
  getLastPurchaseProviderConfigurationIssue,
  getPurchaseProviderAdapter,
} from './purchaseProvider.service';
import type {
  EntitlementSnapshot,
  MonetizationFlowAction,
  MonetizationFlowSource,
  PaywallEntrySource,
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

function resolveIdentityMismatchWarning(input: {
  authUid: string | null;
  customerId: string | null;
  providerName: string;
}): string | null {
  if (!input.authUid || !input.customerId) {
    return null;
  }

  if (input.authUid === input.customerId) {
    return null;
  }

  return `${input.providerName} identity mismatch: auth uid (${input.authUid}) != provider customer (${input.customerId})`;
}

function getCurrentAuthUid(): string | null {
  return auth.currentUser?.uid ?? null;
}

function buildProviderUnavailableMessage(baseMessage: string): string {
  const issue = getLastPurchaseProviderConfigurationIssue();

  if (!issue) {
    return baseMessage;
  }

  return `${baseMessage} (${issue})`;
}

async function appendStartedFlowLog(input: {
  action: MonetizationFlowAction;
  source: MonetizationFlowSource;
  annualProductId: string;
  providerName: PurchaseAnnualPlanResult['providerName'];
  snapshot: EntitlementSnapshot;
}): Promise<void> {
  await appendMonetizationFlowLog({
    action: input.action,
    stage: 'started',
    status: 'started',
    source: input.source,
    providerName: input.providerName,
    annualProductId: input.annualProductId,
    authUid: getCurrentAuthUid(),
    entitlementPlan: input.snapshot.plan,
    isPremium: input.snapshot.isPremium,
    customerId: null,
    transactionId: null,
    identityMismatchWarning: null,
    message:
      input.action === 'purchase'
        ? 'Purchase akisi baslatildi.'
        : 'Restore akisi baslatildi.',
  });
}

async function appendResultFlowLog(input: {
  action: MonetizationFlowAction;
  source: MonetizationFlowSource;
  annualProductId: string;
  result: PurchaseAnnualPlanResult | RestorePurchasesResult;
}): Promise<void> {
  await appendMonetizationFlowLog({
    action: input.action,
    stage: 'result',
    status: input.result.status,
    source: input.source,
    providerName: input.result.providerName,
    annualProductId: input.annualProductId,
    authUid: getCurrentAuthUid(),
    entitlementPlan: input.result.snapshot.plan,
    isPremium: input.result.snapshot.isPremium,
    customerId: input.result.customerId,
    transactionId: input.result.transactionId,
    identityMismatchWarning: input.result.identityMismatchWarning,
    message: input.result.message,
  });
}

async function appendErrorFlowLog(input: {
  action: MonetizationFlowAction;
  source: MonetizationFlowSource;
  annualProductId: string;
  providerName: PurchaseAnnualPlanResult['providerName'];
  snapshot: EntitlementSnapshot;
  message: string;
}): Promise<void> {
  await appendMonetizationFlowLog({
    action: input.action,
    stage: 'error',
    status: 'error',
    source: input.source,
    providerName: input.providerName,
    annualProductId: input.annualProductId,
    authUid: getCurrentAuthUid(),
    entitlementPlan: input.snapshot.plan,
    isPremium: input.snapshot.isPremium,
    customerId: null,
    transactionId: null,
    identityMismatchWarning: null,
    message: input.message,
  });
}

export const purchaseService = {
  async purchaseAnnualPlan(options?: {
    source?: PaywallEntrySource;
  }): Promise<PurchaseAnnualPlanResult> {
    const [policy, currentSnapshot] = await Promise.all([
      monetizationPolicyService.getResolvedPolicy({ allowStale: true }),
      entitlementService.getSnapshot(),
    ]);
    const source = options?.source ?? 'service';

    if (!policy.annualPlanEnabled) {
      const result: PurchaseAnnualPlanResult = {
        status: 'not_supported',
        snapshot: currentSnapshot,
        providerName: 'none',
        message: 'Yıllık premium plan bu rollout içinde kapalı.',
        transactionId: null,
        customerId: null,
        identityMismatchWarning: null,
      };

      await appendResultFlowLog({
        action: 'purchase',
        source,
        annualProductId: policy.annualProductId,
        result,
      });

      return result;
    }

    if (!policy.purchaseProviderEnabled) {
      const result: PurchaseAnnualPlanResult = {
        status: 'not_supported',
        snapshot: currentSnapshot,
        providerName: 'none',
        message: 'Satın alma sağlayıcısı bu build içinde aktif değil.',
        transactionId: null,
        customerId: null,
        identityMismatchWarning: null,
      };

      await appendResultFlowLog({
        action: 'purchase',
        source,
        annualProductId: policy.annualProductId,
        result,
      });

      return result;
    }

    const adapter = getPurchaseProviderAdapter();
    const isConfigured = await adapter.isConfigured();

    if (!isConfigured) {
      const result: PurchaseAnnualPlanResult = {
        status: 'not_supported',
        snapshot: currentSnapshot,
        providerName: adapter.name,
        message: buildProviderUnavailableMessage(
          'Satın alma adapter sözleşmesi hazır, fakat gerçek provider bu build içinde bağlı değil.'
        ),
        transactionId: null,
        customerId: null,
        identityMismatchWarning: null,
      };

      await appendResultFlowLog({
        action: 'purchase',
        source,
        annualProductId: policy.annualProductId,
        result,
      });

      return result;
    }

    await appendStartedFlowLog({
      action: 'purchase',
      source,
      annualProductId: policy.annualProductId,
      providerName: adapter.name,
      snapshot: currentSnapshot,
    });

    await analyticsService.track(
      'monetization_purchase_started',
      {
        annualProductId: policy.annualProductId,
        providerName: adapter.name,
        source,
      },
      { flush: false }
    );

    try {
      const providerResult = await adapter.purchaseAnnualPlan({
        annualProductId: policy.annualProductId,
        authUid: auth.currentUser?.uid ?? null,
      });
      const identityMismatchWarning = resolveIdentityMismatchWarning({
        authUid: auth.currentUser?.uid ?? null,
        customerId: providerResult.customerId,
        providerName: providerResult.providerName,
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
          identityMismatch: Boolean(identityMismatchWarning),
        },
        { flush: false }
      );

      const result: PurchaseAnnualPlanResult = {
        status: providerResult.status,
        snapshot: nextSnapshot,
        providerName: providerResult.providerName,
        message: providerResult.message,
        transactionId: providerResult.transactionId,
        customerId: providerResult.customerId,
        identityMismatchWarning,
      };

      await appendResultFlowLog({
        action: 'purchase',
        source,
        annualProductId: policy.annualProductId,
        result,
      });

      return result;
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

      const result: PurchaseAnnualPlanResult = {
        status: 'error',
        snapshot: currentSnapshot,
        providerName: adapter.name,
        message,
        transactionId: null,
        customerId: null,
        identityMismatchWarning: null,
      };

      await appendErrorFlowLog({
        action: 'purchase',
        source,
        annualProductId: policy.annualProductId,
        providerName: adapter.name,
        snapshot: currentSnapshot,
        message,
      });

      return result;
    }
  },

  async restorePurchases(options?: {
    source?: PaywallEntrySource;
  }): Promise<RestorePurchasesResult> {
    const [policy, currentSnapshot] = await Promise.all([
      monetizationPolicyService.getResolvedPolicy({ allowStale: true }),
      entitlementService.getSnapshot(),
    ]);
    const source = options?.source ?? 'service';

    if (!policy.restoreEnabled) {
      const result: RestorePurchasesResult = {
        status: 'not_supported',
        snapshot: currentSnapshot,
        providerName: 'none',
        message: 'Geri yükleme akışı bu rollout içinde kapalı.',
        transactionId: null,
        customerId: null,
        identityMismatchWarning: null,
      };

      await appendResultFlowLog({
        action: 'restore',
        source,
        annualProductId: policy.annualProductId,
        result,
      });

      return result;
    }

    if (!policy.purchaseProviderEnabled) {
      const result: RestorePurchasesResult = {
        status: 'not_supported',
        snapshot: currentSnapshot,
        providerName: 'none',
        message: 'Satın alma sağlayıcısı bu build içinde aktif değil.',
        transactionId: null,
        customerId: null,
        identityMismatchWarning: null,
      };

      await appendResultFlowLog({
        action: 'restore',
        source,
        annualProductId: policy.annualProductId,
        result,
      });

      return result;
    }

    const adapter = getPurchaseProviderAdapter();
    const isConfigured = await adapter.isConfigured();

    if (!isConfigured) {
      const result: RestorePurchasesResult = {
        status: 'not_supported',
        snapshot: currentSnapshot,
        providerName: adapter.name,
        message: buildProviderUnavailableMessage(
          'Geri yükleme adapter sözleşmesi hazır, fakat gerçek provider bu build içinde bağlı değil.'
        ),
        transactionId: null,
        customerId: null,
        identityMismatchWarning: null,
      };

      await appendResultFlowLog({
        action: 'restore',
        source,
        annualProductId: policy.annualProductId,
        result,
      });

      return result;
    }

    await appendStartedFlowLog({
      action: 'restore',
      source,
      annualProductId: policy.annualProductId,
      providerName: adapter.name,
      snapshot: currentSnapshot,
    });

    try {
      const providerResult = await adapter.restorePurchases({
        annualProductId: policy.annualProductId,
        authUid: auth.currentUser?.uid ?? null,
      });
      const identityMismatchWarning = resolveIdentityMismatchWarning({
        authUid: auth.currentUser?.uid ?? null,
        customerId: providerResult.customerId,
        providerName: providerResult.providerName,
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
          identityMismatch: Boolean(identityMismatchWarning),
        },
        { flush: false }
      );

      const result: RestorePurchasesResult = {
        status: providerResult.status,
        snapshot: nextSnapshot,
        providerName: providerResult.providerName,
        message: providerResult.message,
        transactionId: providerResult.transactionId,
        customerId: providerResult.customerId,
        identityMismatchWarning,
      };

      await appendResultFlowLog({
        action: 'restore',
        source,
        annualProductId: policy.annualProductId,
        result,
      });

      return result;
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

      const result: RestorePurchasesResult = {
        status: 'error',
        snapshot: currentSnapshot,
        providerName: adapter.name,
        message,
        transactionId: null,
        customerId: null,
        identityMismatchWarning: null,
      };

      await appendErrorFlowLog({
        action: 'restore',
        source,
        annualProductId: policy.annualProductId,
        providerName: adapter.name,
        snapshot: currentSnapshot,
        message,
      });

      return result;
    }
  },
};

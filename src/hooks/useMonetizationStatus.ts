import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import type {
  EntitlementSnapshot,
  MonetizationPolicySnapshot,
} from '../types/monetization';
import { entitlementService } from '../services/entitlement.service';
import { monetizationPolicyService } from '../services/monetizationPolicy.service';

type MonetizationStatusState = {
  loading: boolean;
  refreshing: boolean;
  policy: MonetizationPolicySnapshot | null;
  entitlement: EntitlementSnapshot | null;
  error: string | null;
};

type UseMonetizationStatusResult = MonetizationStatusState & {
  load: (options?: { forceRefresh?: boolean }) => Promise<void>;
  refresh: () => Promise<void>;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'Monetization durumu yüklenemedi';
}

export function useMonetizationStatus(): UseMonetizationStatusResult {
  const [state, setState] = useState<MonetizationStatusState>({
    loading: true,
    refreshing: false,
    policy: null,
    entitlement: null,
    error: null,
  });

  const load = useCallback(async (options?: { forceRefresh?: boolean }) => {
    const isRefresh = Boolean(options?.forceRefresh);

    setState((prev) => ({
      ...prev,
      loading: isRefresh ? prev.loading : true,
      refreshing: isRefresh,
      error: null,
    }));

    try {
      const [policy, entitlement] = await Promise.all([
        monetizationPolicyService.getResolvedPolicy({
          allowStale: !options?.forceRefresh,
          forceRefresh: Boolean(options?.forceRefresh),
        }),
        entitlementService.getSnapshot(),
      ]);

      setState({
        loading: false,
        refreshing: false,
        policy,
        entitlement,
        error: null,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: toErrorMessage(error),
      }));
    }
  }, []);

  const refresh = useCallback(async () => {
    await load({ forceRefresh: true });
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();

      return undefined;
    }, [load])
  );

  return {
    ...state,
    load,
    refresh,
  };
}
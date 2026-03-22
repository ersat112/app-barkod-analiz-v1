import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { adService, type AdDiagnosticsSnapshot } from '../services/adService';

type UseAdDiagnosticsOptions = {
  enabled?: boolean;
};

type UseAdDiagnosticsResult = {
  snapshot: AdDiagnosticsSnapshot | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  load: (options?: { forceRefresh?: boolean; flushAnalytics?: boolean }) => Promise<void>;
  refresh: () => Promise<void>;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'Ad diagnostics yüklenemedi';
}

export function useAdDiagnostics(
  options?: UseAdDiagnosticsOptions
): UseAdDiagnosticsResult {
  const enabled = options?.enabled ?? true;

  const [snapshot, setSnapshot] = useState<AdDiagnosticsSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (loadOptions?: { forceRefresh?: boolean; flushAnalytics?: boolean }) => {
      if (!enabled) {
        setSnapshot(null);
        setLoading(false);
        setRefreshing(false);
        setError(null);
        return;
      }

      const isRefresh = Boolean(loadOptions?.forceRefresh || loadOptions?.flushAnalytics);

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        setError(null);

        const nextSnapshot = await adService.getDiagnosticsSnapshot({
          forcePolicyRefresh: loadOptions?.forceRefresh,
          flushAnalytics: loadOptions?.flushAnalytics,
        });

        setSnapshot(nextSnapshot);
      } catch (nextError) {
        setError(toErrorMessage(nextError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [enabled]
  );

  const refresh = useCallback(async () => {
    await load({
      forceRefresh: true,
      flushAnalytics: true,
    });
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();

      return undefined;
    }, [load])
  );

  return {
    snapshot,
    loading,
    refreshing,
    error,
    load,
    refresh,
  };
}
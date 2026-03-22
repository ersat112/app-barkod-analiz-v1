import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import {
  getRemoteProductCacheDiagnostics,
  type RemoteProductCacheDiagnosticsSnapshot,
} from '../services/productRemoteCache.service';

type UseFirebaseDiagnosticsOptions = {
  enabled?: boolean;
};

type UseFirebaseDiagnosticsResult = {
  snapshot: RemoteProductCacheDiagnosticsSnapshot | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  load: (options?: { force?: boolean }) => Promise<void>;
  refresh: () => Promise<void>;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'Firebase diagnostics yüklenemedi';
}

export function useFirebaseDiagnostics(
  options?: UseFirebaseDiagnosticsOptions
): UseFirebaseDiagnosticsResult {
  const enabled = options?.enabled ?? true;

  const [snapshot, setSnapshot] =
    useState<RemoteProductCacheDiagnosticsSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (loadOptions?: { force?: boolean }) => {
      if (!enabled) {
        setSnapshot(null);
        setLoading(false);
        setRefreshing(false);
        setError(null);
        return;
      }

      if (loadOptions?.force) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        setError(null);
        const nextSnapshot = await getRemoteProductCacheDiagnostics();
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
    await load({ force: true });
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
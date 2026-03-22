import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import {
  getDatabaseDiagnosticsSnapshot,
  type DatabaseDiagnosticsSnapshot,
} from '../services/db';

type UseDbDiagnosticsOptions = {
  enabled?: boolean;
};

type UseDbDiagnosticsResult = {
  snapshot: DatabaseDiagnosticsSnapshot | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'DB diagnostics yüklenemedi';
}

export function useDbDiagnostics(
  options?: UseDbDiagnosticsOptions
): UseDbDiagnosticsResult {
  const enabled = options?.enabled ?? true;

  const [snapshot, setSnapshot] = useState<DatabaseDiagnosticsSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setSnapshot(null);
      setLoading(false);
      setRefreshing(false);
      setError(null);
      return;
    }

    setLoading(true);

    try {
      setError(null);
      const nextSnapshot = getDatabaseDiagnosticsSnapshot();
      setSnapshot(nextSnapshot);
    } catch (nextError) {
      setError(toErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setSnapshot(null);
      setRefreshing(false);
      setError(null);
      return;
    }

    setRefreshing(true);

    try {
      setError(null);
      const nextSnapshot = getDatabaseDiagnosticsSnapshot();
      setSnapshot(nextSnapshot);
    } catch (nextError) {
      setError(toErrorMessage(nextError));
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [enabled]);

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
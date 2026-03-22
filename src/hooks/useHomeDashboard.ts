import { useCallback, useRef, useState } from 'react';
import type { HomeDashboardSnapshot } from '../types/history';
import {
  areHomeDashboardReadModelsEqual,
  EMPTY_HOME_DASHBOARD_READ_MODEL,
  getHomeDashboardReadModel,
} from '../services/homeReadModel.service';

const SNAPSHOT_STALE_MS = 15_000;

export const useHomeDashboard = () => {
  const [snapshot, setSnapshot] = useState<HomeDashboardSnapshot>(
    EMPTY_HOME_DASHBOARD_READ_MODEL
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const lastLoadedAtRef = useRef<number>(0);
  const busyRef = useRef(false);

  const load = useCallback(async (options?: { force?: boolean }) => {
    const force = Boolean(options?.force);
    const now = Date.now();

    if (busyRef.current) {
      return;
    }

    if (
      !force &&
      lastLoadedAtRef.current > 0 &&
      now - lastLoadedAtRef.current < SNAPSHOT_STALE_MS
    ) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      busyRef.current = true;
      setLoadError(null);

      const data = await Promise.resolve(getHomeDashboardReadModel());

      setSnapshot((current) => {
        if (areHomeDashboardReadModelsEqual(current, data)) {
          return current;
        }

        return data;
      });

      lastLoadedAtRef.current = Date.now();
    } catch (error) {
      console.error('[useHomeDashboard] load failed:', error);
      setSnapshot(EMPTY_HOME_DASHBOARD_READ_MODEL);
      setLoadError('dashboard_load_failed');
    } finally {
      setLoading(false);
      setRefreshing(false);
      busyRef.current = false;
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load({ force: true });
  }, [load]);

  return {
    snapshot,
    loading,
    refreshing,
    loadError,
    load,
    refresh,
  };
};
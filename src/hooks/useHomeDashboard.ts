import { useCallback, useState } from 'react';
import {
  getHomeDashboardSnapshot,
  type HomeDashboardSnapshot,
} from '../services/homeDashboard.service';
import { createEmptyHomeDashboardSnapshot } from '../types/history';

const emptySnapshot: HomeDashboardSnapshot = createEmptyHomeDashboardSnapshot();

export const useHomeDashboard = () => {
  const [snapshot, setSnapshot] = useState<HomeDashboardSnapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await Promise.resolve(getHomeDashboardSnapshot());
      setSnapshot(data);
    } catch (error) {
      console.error('[useHomeDashboard] load failed:', error);
      setSnapshot(emptySnapshot);
      setLoadError('dashboard_load_failed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
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
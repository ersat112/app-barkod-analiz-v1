import { useCallback, useRef, useState } from 'react';
import {
  getHomeDashboardSnapshot,
  type HomeDashboardSnapshot,
} from '../services/homeDashboard.service';

const SNAPSHOT_STALE_MS = 15_000;

const emptySnapshot: HomeDashboardSnapshot = {
  todayCount: 0,
  todayUniqueCount: 0,
  totalHistoryCount: 0,
  bestScoreToday: null,
  weeklyScanTotal: 0,
  weeklyActiveDays: 0,
  streakCount: 0,
  lastScannedProduct: null,
  recentProducts: [],
};

function areRecentProductsEqual(
  left: HomeDashboardSnapshot['recentProducts'],
  right: HomeDashboardSnapshot['recentProducts']
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const current = left[index];
    const next = right[index];

    if (
      current.id !== next.id ||
      current.barcode !== next.barcode ||
      current.updated_at !== next.updated_at
    ) {
      return false;
    }
  }

  return true;
}

function areSnapshotsEqual(
  left: HomeDashboardSnapshot,
  right: HomeDashboardSnapshot
): boolean {
  return (
    left.todayCount === right.todayCount &&
    left.todayUniqueCount === right.todayUniqueCount &&
    left.totalHistoryCount === right.totalHistoryCount &&
    left.bestScoreToday === right.bestScoreToday &&
    left.weeklyScanTotal === right.weeklyScanTotal &&
    left.weeklyActiveDays === right.weeklyActiveDays &&
    left.streakCount === right.streakCount &&
    left.lastScannedProduct?.id === right.lastScannedProduct?.id &&
    left.lastScannedProduct?.updated_at === right.lastScannedProduct?.updated_at &&
    areRecentProductsEqual(left.recentProducts, right.recentProducts)
  );
}

export const useHomeDashboard = () => {
  const [snapshot, setSnapshot] = useState<HomeDashboardSnapshot>(emptySnapshot);
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

    if (!force && lastLoadedAtRef.current > 0 && now - lastLoadedAtRef.current < SNAPSHOT_STALE_MS) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      busyRef.current = true;
      setLoadError(null);

      const data = await Promise.resolve(getHomeDashboardSnapshot());

      setSnapshot((current) => {
        if (areSnapshotsEqual(current, data)) {
          return current;
        }

        return data;
      });

      lastLoadedAtRef.current = Date.now();
    } catch (error) {
      console.error('[useHomeDashboard] load failed:', error);
      setSnapshot(emptySnapshot);
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
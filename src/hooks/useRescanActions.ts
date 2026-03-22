import { useCallback, useMemo, useRef, useState } from 'react';
import {
  areRescanReadModelsEqual,
  EMPTY_RESCAN_READ_MODEL,
  getRescanReadModel,
  toggleRescanFavorite,
  type RescanReadModel,
  type RescanShortcutItem,
} from '../services/rescanReadModel.service';

export type { RescanShortcutItem };

const SNAPSHOT_STALE_MS = 15_000;

export const useRescanActions = () => {
  const [snapshot, setSnapshot] = useState<RescanReadModel>(
    EMPTY_RESCAN_READ_MODEL
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const snapshotRef = useRef<RescanReadModel>(EMPTY_RESCAN_READ_MODEL);
  const lastLoadedAtRef = useRef<number>(0);
  const busyRef = useRef(false);

  const favoriteSet = useMemo(
    () => new Set(snapshot.favoriteBarcodes),
    [snapshot.favoriteBarcodes]
  );

  const commitSnapshot = useCallback((nextSnapshot: RescanReadModel) => {
    snapshotRef.current = nextSnapshot;
    setSnapshot((current) => {
      if (areRescanReadModelsEqual(current, nextSnapshot)) {
        return current;
      }

      return nextSnapshot;
    });
  }, []);

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

      const nextSnapshot = await Promise.resolve(getRescanReadModel());
      commitSnapshot(nextSnapshot);
      lastLoadedAtRef.current = Date.now();
    } catch (error) {
      console.error('[useRescanActions] load failed:', error);
      commitSnapshot(EMPTY_RESCAN_READ_MODEL);
      setLoadError('rescan_actions_load_failed');
    } finally {
      setLoading(false);
      setRefreshing(false);
      busyRef.current = false;
    }
  }, [commitSnapshot]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load({ force: true });
  }, [load]);

  const toggleFavorite = useCallback(
    async (barcode: string): Promise<boolean> => {
      const result = await Promise.resolve(toggleRescanFavorite(barcode));
      lastLoadedAtRef.current = 0;
      await load({ force: true });
      return result;
    },
    [load]
  );

  const isFavorite = useCallback(
    (barcode: string): boolean => {
      return favoriteSet.has(barcode);
    },
    [favoriteSet]
  );

  return {
    snapshot,
    loading,
    refreshing,
    loadError,
    load,
    refresh,
    toggleFavorite,
    isFavorite,
  };
};
import { useCallback, useMemo, useState } from 'react';

import {
  getAllFavoriteBarcodes,
  getAllHistory,
  toggleFavoriteBarcode,
  type HistoryEntry,
} from '../services/db';

export type RescanShortcutItem = {
  barcode: string;
  name: string;
  brand: string;
  image_url: string;
  type: HistoryEntry['type'];
  score?: number;
  lastScannedAt: string;
  isFavorite: boolean;
};

type RescanActionsSnapshot = {
  favoriteBarcodes: string[];
  favoriteItems: RescanShortcutItem[];
  recentItems: RescanShortcutItem[];
};

const emptySnapshot: RescanActionsSnapshot = {
  favoriteBarcodes: [],
  favoriteItems: [],
  recentItems: [],
};

function mapHistoryToShortcuts(
  history: HistoryEntry[],
  favoriteBarcodes: string[]
): RescanActionsSnapshot {
  const favoriteSet = new Set(favoriteBarcodes);
  const seen = new Set<string>();
  const uniqueItems: RescanShortcutItem[] = [];

  history.forEach((entry) => {
    if (!entry.barcode || seen.has(entry.barcode)) {
      return;
    }

    seen.add(entry.barcode);

    uniqueItems.push({
      barcode: entry.barcode,
      name: entry.name || '',
      brand: entry.brand || '',
      image_url: entry.image_url || '',
      type: entry.type,
      score: entry.score,
      lastScannedAt: entry.created_at,
      isFavorite: favoriteSet.has(entry.barcode),
    });
  });

  return {
    favoriteBarcodes,
    favoriteItems: uniqueItems.filter((item) => item.isFavorite).slice(0, 8),
    recentItems: uniqueItems.slice(0, 6),
  };
}

export const useRescanActions = () => {
  const [snapshot, setSnapshot] = useState<RescanActionsSnapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const favoriteSet = useMemo(
    () => new Set(snapshot.favoriteBarcodes),
    [snapshot.favoriteBarcodes]
  );

  const load = useCallback(async () => {
    try {
      setLoadError(null);

      const [history, favoriteBarcodes] = await Promise.all([
        Promise.resolve(getAllHistory()),
        Promise.resolve(getAllFavoriteBarcodes()),
      ]);

      setSnapshot(mapHistoryToShortcuts(history, favoriteBarcodes));
    } catch (error) {
      console.error('[useRescanActions] load failed:', error);
      setSnapshot(emptySnapshot);
      setLoadError('rescan_actions_load_failed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
  }, [load]);

  const toggleFavorite = useCallback(
    async (barcode: string): Promise<boolean> => {
      const result = await Promise.resolve(toggleFavoriteBarcode(barcode));
      await load();
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
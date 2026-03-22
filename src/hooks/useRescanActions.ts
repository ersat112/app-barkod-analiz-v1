import { useCallback, useMemo, useRef, useState } from 'react';

import type { HistoryEntry } from '../services/db';
import {
  getLatestHistoryEntriesForBarcodes,
  getRecentUniqueHistoryEntries,
} from '../services/db/history.repository';
import {
  getRecentFavoriteBarcodes,
  toggleFavoriteBarcode,
} from '../services/db/favorites.repository';

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

const SNAPSHOT_STALE_MS = 15_000;

const emptySnapshot: RescanActionsSnapshot = {
  favoriteBarcodes: [],
  favoriteItems: [],
  recentItems: [],
};

function mapEntryToShortcutItem(
  entry: HistoryEntry,
  favoriteSet: Set<string>
): RescanShortcutItem {
  return {
    barcode: entry.barcode,
    name: entry.name || '',
    brand: entry.brand || '',
    image_url: entry.image_url || '',
    type: entry.type,
    score: entry.score,
    lastScannedAt: entry.created_at,
    isFavorite: favoriteSet.has(entry.barcode),
  };
}

function createSnapshot(
  favoriteBarcodes: string[],
  favoriteEntries: HistoryEntry[],
  recentEntries: HistoryEntry[]
): RescanActionsSnapshot {
  const favoriteSet = new Set(favoriteBarcodes);

  return {
    favoriteBarcodes,
    favoriteItems: favoriteEntries.map((entry) =>
      mapEntryToShortcutItem(entry, favoriteSet)
    ),
    recentItems: recentEntries.map((entry) =>
      mapEntryToShortcutItem(entry, favoriteSet)
    ),
  };
}

function areShortcutItemsEqual(
  left: RescanShortcutItem[],
  right: RescanShortcutItem[]
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const current = left[index];
    const next = right[index];

    if (
      current.barcode !== next.barcode ||
      current.name !== next.name ||
      current.brand !== next.brand ||
      current.image_url !== next.image_url ||
      current.type !== next.type ||
      current.score !== next.score ||
      current.lastScannedAt !== next.lastScannedAt ||
      current.isFavorite !== next.isFavorite
    ) {
      return false;
    }
  }

  return true;
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function areSnapshotsEqual(
  left: RescanActionsSnapshot,
  right: RescanActionsSnapshot
): boolean {
  return (
    areStringArraysEqual(left.favoriteBarcodes, right.favoriteBarcodes) &&
    areShortcutItemsEqual(left.favoriteItems, right.favoriteItems) &&
    areShortcutItemsEqual(left.recentItems, right.recentItems)
  );
}

export const useRescanActions = () => {
  const [snapshot, setSnapshot] = useState<RescanActionsSnapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const snapshotRef = useRef<RescanActionsSnapshot>(emptySnapshot);
  const lastLoadedAtRef = useRef<number>(0);
  const busyRef = useRef(false);

  const favoriteSet = useMemo(
    () => new Set(snapshot.favoriteBarcodes),
    [snapshot.favoriteBarcodes]
  );

  const commitSnapshot = useCallback((nextSnapshot: RescanActionsSnapshot) => {
    snapshotRef.current = nextSnapshot;
    setSnapshot((current) => {
      if (areSnapshotsEqual(current, nextSnapshot)) {
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

    if (!force && lastLoadedAtRef.current > 0 && now - lastLoadedAtRef.current < SNAPSHOT_STALE_MS) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      busyRef.current = true;
      setLoadError(null);

      const favoriteBarcodes = await Promise.resolve(getRecentFavoriteBarcodes(8));
      const [favoriteEntries, recentEntries] = await Promise.all([
        Promise.resolve(getLatestHistoryEntriesForBarcodes(favoriteBarcodes)),
        Promise.resolve(getRecentUniqueHistoryEntries(6)),
      ]);

      const nextSnapshot = createSnapshot(
        favoriteBarcodes,
        favoriteEntries,
        recentEntries
      );

      commitSnapshot(nextSnapshot);
      lastLoadedAtRef.current = Date.now();
    } catch (error) {
      console.error('[useRescanActions] load failed:', error);
      commitSnapshot(emptySnapshot);
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
      const result = await Promise.resolve(toggleFavoriteBarcode(barcode));
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
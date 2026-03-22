import type { HistoryEntry } from '../services/db';
import {
  getLatestHistoryEntriesForBarcodes,
  getRecentUniqueHistoryEntries,
} from './db/history.repository';
import {
  getRecentFavoriteBarcodes,
  isFavoriteBarcode,
  toggleFavoriteBarcode,
} from './db/favorites.repository';

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

export type RescanActionsSnapshot = {
  favoriteBarcodes: string[];
  favoriteItems: RescanShortcutItem[];
  recentItems: RescanShortcutItem[];
};

const mapEntryToShortcutItem = (
  entry: HistoryEntry,
  favoriteSet: Set<string>
): RescanShortcutItem => {
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
};

const createSnapshot = (
  favoriteBarcodes: string[],
  favoriteEntries: HistoryEntry[],
  recentEntries: HistoryEntry[]
): RescanActionsSnapshot => {
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
};

export const getRescanActionsSnapshot = (params?: {
  favoriteLimit?: number;
  recentLimit?: number;
}): RescanActionsSnapshot => {
  const favoriteLimit =
    typeof params?.favoriteLimit === 'number' && Number.isFinite(params.favoriteLimit)
      ? Math.max(1, Math.min(Math.round(params.favoriteLimit), 20))
      : 8;

  const recentLimit =
    typeof params?.recentLimit === 'number' && Number.isFinite(params.recentLimit)
      ? Math.max(1, Math.min(Math.round(params.recentLimit), 20))
      : 6;

  const favoriteBarcodes = getRecentFavoriteBarcodes(favoriteLimit);
  const favoriteEntries = getLatestHistoryEntriesForBarcodes(favoriteBarcodes);
  const recentEntries = getRecentUniqueHistoryEntries(recentLimit);

  return createSnapshot(favoriteBarcodes, favoriteEntries, recentEntries);
};

export const toggleRescanFavorite = (barcode: string): boolean => {
  return toggleFavoriteBarcode(barcode);
};

export const isRescanFavorite = (barcode: string): boolean => {
  return isFavoriteBarcode(barcode);
};
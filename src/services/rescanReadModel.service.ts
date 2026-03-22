import type { HistoryEntry } from './db';
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

export type RescanReadModel = {
  favoriteBarcodes: string[];
  favoriteItems: RescanShortcutItem[];
  recentItems: RescanShortcutItem[];
};

export const EMPTY_RESCAN_READ_MODEL: RescanReadModel = {
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

export function createRescanReadModel(
  favoriteBarcodes: string[],
  favoriteEntries: HistoryEntry[],
  recentEntries: HistoryEntry[]
): RescanReadModel {
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

export function areRescanShortcutItemsEqual(
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

export function areRescanReadModelsEqual(
  left: RescanReadModel,
  right: RescanReadModel
): boolean {
  return (
    areStringArraysEqual(left.favoriteBarcodes, right.favoriteBarcodes) &&
    areRescanShortcutItemsEqual(left.favoriteItems, right.favoriteItems) &&
    areRescanShortcutItemsEqual(left.recentItems, right.recentItems)
  );
}

export function getRescanReadModel(params?: {
  favoriteLimit?: number;
  recentLimit?: number;
}): RescanReadModel {
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

  return createRescanReadModel(favoriteBarcodes, favoriteEntries, recentEntries);
}

export function toggleRescanFavorite(barcode: string): boolean {
  return toggleFavoriteBarcode(barcode);
}

export function isRescanFavoriteBarcode(barcode: string): boolean {
  return isFavoriteBarcode(barcode);
}
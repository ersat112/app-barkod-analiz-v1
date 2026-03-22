import { TABLES, getDatabase, safeText } from './core';
import { initDatabase } from './migrations';

type FavoriteRow = {
  barcode: string;
};

const db = getDatabase();

export const ensureFavoritesTableReady = (): void => {
  initDatabase();
};

export const getAllFavoriteBarcodes = (limit?: number): string[] => {
  try {
    const safeLimit =
      typeof limit === 'number' && Number.isFinite(limit) && limit > 0
        ? Math.min(Math.round(limit), 100)
        : null;

    const rows = safeLimit
      ? db.getAllSync<FavoriteRow>(
          `SELECT barcode
           FROM ${TABLES.FAVORITES}
           ORDER BY datetime(updated_at) DESC, barcode ASC
           LIMIT ?`,
          [safeLimit]
        )
      : db.getAllSync<FavoriteRow>(
          `SELECT barcode
           FROM ${TABLES.FAVORITES}
           ORDER BY datetime(updated_at) DESC, barcode ASC`
        );

    return rows.map((row) => row.barcode);
  } catch (error) {
    console.error('Favorites read error:', error);
    return [];
  }
};

export const getRecentFavoriteBarcodes = (limit = 8): string[] => {
  return getAllFavoriteBarcodes(limit);
};

export const isFavoriteBarcode = (barcode: string): boolean => {
  try {
    const normalizedBarcode = safeText(barcode);

    if (!normalizedBarcode) {
      return false;
    }

    const row = db.getFirstSync<FavoriteRow>(
      `SELECT barcode
       FROM ${TABLES.FAVORITES}
       WHERE barcode = ?
       LIMIT 1`,
      [normalizedBarcode]
    );

    return Boolean(row?.barcode);
  } catch (error) {
    console.error('Favorite lookup error:', error);
    return false;
  }
};

export const addFavoriteBarcode = (barcode: string): void => {
  try {
    const normalizedBarcode = safeText(barcode);

    if (!normalizedBarcode) {
      return;
    }

    db.runSync(
      `INSERT INTO ${TABLES.FAVORITES} (
        barcode,
        created_at,
        updated_at
      ) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(barcode) DO UPDATE SET
        updated_at = CURRENT_TIMESTAMP;`,
      [normalizedBarcode]
    );
  } catch (error) {
    console.error('Favorite add error:', error);
  }
};

export const removeFavoriteBarcode = (barcode: string): void => {
  try {
    const normalizedBarcode = safeText(barcode);

    if (!normalizedBarcode) {
      return;
    }

    db.runSync(`DELETE FROM ${TABLES.FAVORITES} WHERE barcode = ?`, [normalizedBarcode]);
  } catch (error) {
    console.error('Favorite remove error:', error);
  }
};

export const toggleFavoriteBarcode = (barcode: string): boolean => {
  const normalizedBarcode = safeText(barcode);

  if (!normalizedBarcode) {
    return false;
  }

  const currentlyFavorite = isFavoriteBarcode(normalizedBarcode);

  if (currentlyFavorite) {
    removeFavoriteBarcode(normalizedBarcode);
    return false;
  }

  addFavoriteBarcode(normalizedBarcode);
  return true;
};

export const getFavoriteCount = (): number => {
  try {
    const row = db.getFirstSync<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${TABLES.FAVORITES}`
    );

    return row?.count ?? 0;
  } catch (error) {
    console.error('Favorite count error:', error);
    return 0;
  }
};

export const clearAllFavorites = (): void => {
  try {
    db.runSync(`DELETE FROM ${TABLES.FAVORITES}`);
  } catch (error) {
    console.error('Favorites clear error:', error);
  }
};
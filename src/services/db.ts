export { getDatabase, TABLES } from './db/core';
export {
  DATABASE_SCHEMA_VERSION,
  getDatabaseDiagnosticsSnapshot,
  initDatabase,
} from './db/migrations';
export {
  clearAllHistory,
  deleteHistoryEntryById,
  deleteHistoryItem,
  getAllHistory,
  getBestScoreToday,
  getCurrentStreakDays,
  getHistoryByBarcode,
  getHistoryCount,
  getHistoryPage,
  getHomeDashboardSnapshot,
  getLastScannedProduct,
  getLatestHistoryEntriesForBarcodes,
  getRecentUniqueHistoryEntries,
  getTodayScanCount,
  getTodayUniqueProductCount,
  getWeeklyActiveDayCount,
  getWeeklyScanCount,
  normalizeHistoryRow,
  saveProductToHistory,
} from './db/history.repository';
export {
  clearAllProductCache,
  clearExpiredProductCache,
  deleteProductCacheByBarcode,
  getProductCacheByBarcode,
  getProductCacheCount,
  markProductCacheAccessed,
  resolveProductCacheExpiry,
  upsertProductCache,
} from './db/productCache.repository';
export {
  addFavoriteBarcode,
  clearAllFavorites,
  ensureFavoritesTableReady,
  getAllFavoriteBarcodes,
  getFavoriteCount,
  getRecentFavoriteBarcodes,
  isFavoriteBarcode,
  removeFavoriteBarcode,
  toggleFavoriteBarcode,
} from './db/favorites.repository';

export type {
  BestScoreRow,
  CachePayload,
  ColumnInfo,
  CountRow,
  DayRow,
  HistoryEntry,
  ProductCacheRecord,
  ProductCacheStatus,
  ProductCacheUpsertInput,
} from './db/types';
export type { DatabaseDiagnosticsSnapshot } from './db/migrations';
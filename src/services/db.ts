export { getDatabase, TABLES } from './db/core';
export { initDatabase } from './db/migrations';
export {
  clearAllHistory,
  deleteHistoryEntryById,
  deleteHistoryItem,
  getAllHistory,
  getBestScoreToday,
  getCurrentStreakDays,
  getHistoryByBarcode,
  getHistoryCount,
  getLastScannedProduct,
  getTodayScanCount,
  getTodayUniqueProductCount,
  getWeeklyActiveDayCount,
  getWeeklyScanCount,
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
  getAllFavoriteBarcodes,
  getFavoriteCount,
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
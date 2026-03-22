import type { Product } from '../utils/analysis';
import {
  clearAllProductCache,
  clearExpiredProductCache,
  getCachedProduct,
  getLocalProductCacheHit,
  getProductCacheByBarcode,
  getProductCacheCount,
  invalidateLocalProductCacheBarcode,
  invalidateProductCacheBarcode,
  isProductCacheBarcodeValid,
  isValidBarcode,
  markProductCacheAccessed,
  normalizeBarcode,
  normalizeProductCacheBarcode,
  resolveProductCacheExpiry,
  setCachedProductFound,
  setCachedProductNotFound,
  setLocalProductCacheFound,
  setLocalProductCacheNotFound,
  upsertProductCache,
  type LocalProductCacheHit,
} from './db/productCache.repository';

export type { LocalProductCacheHit };

export {
  clearAllProductCache,
  clearExpiredProductCache,
  getCachedProduct,
  getLocalProductCacheHit,
  getProductCacheByBarcode,
  getProductCacheCount,
  invalidateLocalProductCacheBarcode,
  invalidateProductCacheBarcode,
  isProductCacheBarcodeValid,
  isValidBarcode,
  markProductCacheAccessed,
  normalizeBarcode,
  normalizeProductCacheBarcode,
  resolveProductCacheExpiry,
  setCachedProductFound,
  setCachedProductNotFound,
  setLocalProductCacheFound,
  setLocalProductCacheNotFound,
  upsertProductCache,
};

export const readCachedProduct = (
  barcode: string,
  now = Date.now()
): LocalProductCacheHit | null => {
  return getLocalProductCacheHit(barcode, now);
};

export const writeCachedProductFound = ({
  barcode,
  product,
  ttlMs,
  now,
}: {
  barcode: string;
  product: Product;
  ttlMs?: number;
  now?: number;
}): void => {
  setLocalProductCacheFound({
    barcode,
    product,
    ttlMs,
    now,
  });
};

export const writeCachedProductNotFound = ({
  barcode,
  ttlMs,
  now,
}: {
  barcode: string;
  ttlMs?: number;
  now?: number;
}): void => {
  setLocalProductCacheNotFound({
    barcode,
    ttlMs,
    now,
  });
};
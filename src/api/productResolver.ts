import type { Product } from '../utils/analysis';
import { fetchFoodProduct } from './foodApi';
import { fetchBeautyProduct } from './beautyApi';

export type ProductLookupResult =
  | {
      found: true;
      barcode: string;
      product: Product;
      source: 'food' | 'beauty' | 'cache';
    }
  | {
      found: false;
      barcode: string;
      reason: 'invalid_barcode' | 'not_found';
    };

type CacheEntry = {
  result: ProductLookupResult;
  createdAt: number;
};

const SUCCESS_CACHE_TTL = 1000 * 60 * 10;
const NOT_FOUND_CACHE_TTL = 1000 * 60 * 3;

const inFlightRequests = new Map<string, Promise<ProductLookupResult>>();
const resultCache = new Map<string, CacheEntry>();

const normalizeBarcode = (barcode: string): string => {
  return String(barcode || '').replace(/[^\d]/g, '').trim();
};

const isValidBarcode = (barcode: string): boolean => {
  return [8, 12, 13, 14].includes(barcode.length);
};

const getCacheTtl = (result: ProductLookupResult): number => {
  return result.found ? SUCCESS_CACHE_TTL : NOT_FOUND_CACHE_TTL;
};

const getCachedResult = (barcode: string): ProductLookupResult | null => {
  const entry = resultCache.get(barcode);

  if (!entry) return null;

  const ttl = getCacheTtl(entry.result);
  const isExpired = Date.now() - entry.createdAt > ttl;

  if (isExpired) {
    resultCache.delete(barcode);
    return null;
  }

  if (entry.result.found) {
    return {
      ...entry.result,
      source: 'cache',
    };
  }

  return entry.result;
};

const setCachedResult = (barcode: string, result: ProductLookupResult): void => {
  resultCache.set(barcode, {
    result,
    createdAt: Date.now(),
  });
};

const tryFetchProduct = async (barcode: string): Promise<ProductLookupResult> => {
  const normalizedBarcode = normalizeBarcode(barcode);

  if (!isValidBarcode(normalizedBarcode)) {
    console.warn('[ProductResolver] invalid barcode:', normalizedBarcode);
    return {
      found: false,
      barcode: normalizedBarcode,
      reason: 'invalid_barcode',
    };
  }

  const cachedResult = getCachedResult(normalizedBarcode);
  if (cachedResult) {
    console.log('[ProductResolver] cache hit:', normalizedBarcode, cachedResult.found ? 'found' : 'not-found');
    return cachedResult;
  }

  const existingRequest = inFlightRequests.get(normalizedBarcode);
  if (existingRequest) {
    console.log('[ProductResolver] reusing in-flight request:', normalizedBarcode);
    return existingRequest;
  }

  const requestPromise = (async (): Promise<ProductLookupResult> => {
    try {
      console.log('[ProductResolver] lookup started:', normalizedBarcode);

      const foodProduct = await fetchFoodProduct(normalizedBarcode);

      if (foodProduct) {
        const result: ProductLookupResult = {
          found: true,
          barcode: normalizedBarcode,
          product: foodProduct,
          source: 'food',
        };

        setCachedResult(normalizedBarcode, result);
        return result;
      }

      const beautyProduct = await fetchBeautyProduct(normalizedBarcode);

      if (beautyProduct) {
        const result: ProductLookupResult = {
          found: true,
          barcode: normalizedBarcode,
          product: beautyProduct,
          source: 'beauty',
        };

        setCachedResult(normalizedBarcode, result);
        return result;
      }

      const notFoundResult: ProductLookupResult = {
        found: false,
        barcode: normalizedBarcode,
        reason: 'not_found',
      };

      console.warn('[ProductResolver] product not found in any source:', normalizedBarcode);
      setCachedResult(normalizedBarcode, notFoundResult);
      return notFoundResult;
    } finally {
      inFlightRequests.delete(normalizedBarcode);
    }
  })();

  inFlightRequests.set(normalizedBarcode, requestPromise);
  return requestPromise;
};

export const fetchProductByBarcode = async (
  barcode: string
): Promise<ProductLookupResult> => {
  return tryFetchProduct(barcode);
};

export const clearProductResolverCache = (): void => {
  resultCache.clear();
  inFlightRequests.clear();
};

export const invalidateProductResolverBarcode = (barcode: string): void => {
  const normalizedBarcode = normalizeBarcode(barcode);
  resultCache.delete(normalizedBarcode);
  inFlightRequests.delete(normalizedBarcode);
};
import type { Product } from '../utils/analysis';
import { FEATURES } from '../config/features';
import { fetchFoodProduct } from './foodApi';
import { fetchBeautyProduct } from './beautyApi';
import {
  clearProductRepositoryRuntimeState,
  invalidateProductRepositoryBarcode,
  resolveProductFromRepository,
  type ProductRepositoryRemoteFetchResult,
  type ProductRepositoryResolveResult,
} from '../services/productRepository';

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

type RemoteCandidate = {
  source: 'food' | 'beauty';
  product: Product;
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

const safeTextLength = (value?: string | null): number => {
  if (typeof value !== 'string') return 0;
  return value.trim().length;
};

const safeObjectKeyCount = (value?: Record<string, unknown> | null): number => {
  if (!value || typeof value !== 'object') return 0;
  return Object.keys(value).length;
};

const getProductRichnessScore = (product: Product): number => {
  let score = 0;

  score += Math.min(safeTextLength(product.name), 80);
  score += Math.min(safeTextLength(product.brand), 40);
  score += Math.min(safeTextLength(product.image_url), 20);
  score += Math.min(safeTextLength(product.ingredients_text), 120);
  score += Math.min(safeTextLength(product.country), 20);
  score += Math.min(safeTextLength(product.origin), 20);
  score += Math.min(safeTextLength(product.usage_instructions), 60);

  if (typeof product.score === 'number' && Number.isFinite(product.score)) {
    score += 30;
  }

  if (safeTextLength(product.grade) > 0) {
    score += 20;
  }

  if (Array.isArray(product.additives) && product.additives.length > 0) {
    score += Math.min(product.additives.length * 4, 20);
  }

  if (Array.isArray(product.countries_tags) && product.countries_tags.length > 0) {
    score += Math.min(product.countries_tags.length * 2, 10);
  }

  if (Array.isArray(product.origins_tags) && product.origins_tags.length > 0) {
    score += Math.min(product.origins_tags.length * 2, 10);
  }

  score += Math.min(safeObjectKeyCount(product.nutriments), 20);
  score += Math.min(safeObjectKeyCount(product.nutrient_levels), 10);

  if (product.type === 'food') {
    score += 8;
  }

  if (product.type === 'beauty' && safeTextLength(product.usage_instructions) > 0) {
    score += 8;
  }

  return score;
};

const selectBestRemoteCandidate = (
  candidates: RemoteCandidate[]
): RemoteCandidate | null => {
  if (!candidates.length) {
    return null;
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  const sorted = [...candidates].sort((left, right) => {
    const scoreDiff =
      getProductRichnessScore(right.product) - getProductRichnessScore(left.product);

    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    if (left.source === right.source) {
      return 0;
    }

    return left.source === 'food' ? -1 : 1;
  });

  return sorted[0] ?? null;
};

const fetchRemoteSourcesSequential = async (
  barcode: string
): Promise<ProductRepositoryRemoteFetchResult> => {
  const foodProduct = await fetchFoodProduct(barcode);

  if (foodProduct) {
    return {
      found: true,
      barcode,
      product: foodProduct,
      source: 'food',
    };
  }

  const beautyProduct = await fetchBeautyProduct(barcode);

  if (beautyProduct) {
    return {
      found: true,
      barcode,
      product: beautyProduct,
      source: 'beauty',
    };
  }

  return {
    found: false,
    barcode,
    reason: 'not_found',
  };
};

const fetchRemoteSourcesParallel = async (
  barcode: string
): Promise<ProductRepositoryRemoteFetchResult> => {
  const [foodResult, beautyResult] = await Promise.allSettled([
    fetchFoodProduct(barcode),
    fetchBeautyProduct(barcode),
  ]);

  const candidates: RemoteCandidate[] = [];

  if (foodResult.status === 'fulfilled' && foodResult.value) {
    candidates.push({
      source: 'food',
      product: foodResult.value,
    });
  }

  if (beautyResult.status === 'fulfilled' && beautyResult.value) {
    candidates.push({
      source: 'beauty',
      product: beautyResult.value,
    });
  }

  if (!candidates.length) {
    return {
      found: false,
      barcode,
      reason: 'not_found',
    };
  }

  const selected = selectBestRemoteCandidate(candidates);

  if (!selected) {
    return {
      found: false,
      barcode,
      reason: 'not_found',
    };
  }

  if (candidates.length > 1) {
    console.log('[ProductResolver] parallel conflict resolved:', {
      barcode,
      selectedSource: selected.source,
      candidates: candidates.map((item) => ({
        source: item.source,
        type: item.product.type,
        richnessScore: getProductRichnessScore(item.product),
      })),
    });
  }

  return {
    found: true,
    barcode,
    product: selected.product,
    source: selected.source,
  };
};

const repositoryRemoteFetch = async (
  barcode: string
): Promise<ProductRepositoryRemoteFetchResult> => {
  if (FEATURES.productRepository.remoteParallelFetchEnabled) {
    return fetchRemoteSourcesParallel(barcode);
  }

  return fetchRemoteSourcesSequential(barcode);
};

const mapRepositoryResultToLookupResult = (
  result: ProductRepositoryResolveResult
): ProductLookupResult => {
  if (result.found) {
    return {
      found: true,
      barcode: result.barcode,
      product: result.product,
      source:
        result.source === 'local_cache' || result.source === 'shared_cache'
          ? 'cache'
          : result.source,
    };
  }

  return {
    found: false,
    barcode: result.barcode,
    reason: result.reason,
  };
};

const tryFetchProductLegacy = async (
  barcode: string
): Promise<ProductLookupResult> => {
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
    console.log(
      '[ProductResolver] cache hit:',
      normalizedBarcode,
      cachedResult.found ? 'found' : 'not-found'
    );
    return cachedResult;
  }

  const existingRequest = inFlightRequests.get(normalizedBarcode);
  if (existingRequest) {
    console.log('[ProductResolver] reusing in-flight request:', normalizedBarcode);
    return existingRequest;
  }

  const requestPromise = (async (): Promise<ProductLookupResult> => {
    try {
      console.log('[ProductResolver] legacy lookup started:', normalizedBarcode);

      const result = await fetchRemoteSourcesSequential(normalizedBarcode);

      if (result.found) {
        const lookupResult: ProductLookupResult = {
          found: true,
          barcode: normalizedBarcode,
          product: result.product,
          source: result.source,
        };

        setCachedResult(normalizedBarcode, lookupResult);
        return lookupResult;
      }

      const notFoundResult: ProductLookupResult = {
        found: false,
        barcode: normalizedBarcode,
        reason: 'not_found',
      };

      console.warn(
        '[ProductResolver] legacy product not found in any source:',
        normalizedBarcode
      );
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
  if (!FEATURES.productRepository.foundationEnabled) {
    return tryFetchProductLegacy(barcode);
  }

  const repositoryResult = await resolveProductFromRepository(barcode, {
    remoteFetch: repositoryRemoteFetch,
  });

  return mapRepositoryResultToLookupResult(repositoryResult);
};

export const clearProductResolverCache = (): void => {
  resultCache.clear();
  inFlightRequests.clear();
  clearProductRepositoryRuntimeState();
};

export const invalidateProductResolverBarcode = (barcode: string): void => {
  const normalizedBarcode = normalizeBarcode(barcode);
  resultCache.delete(normalizedBarcode);
  inFlightRequests.delete(normalizedBarcode);
  invalidateProductRepositoryBarcode(normalizedBarcode);
};

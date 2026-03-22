import { CACHE_POLICY, FEATURES } from '../config/features';
import type { Product } from '../utils/analysis';
import { fetchBeautyProduct } from '../api/beautyApi';
import { fetchFoodProduct } from '../api/foodApi';
import {
  getLocalProductCacheHit,
  invalidateLocalProductCacheBarcode,
  isProductCacheBarcodeValid,
  normalizeProductCacheBarcode,
  setLocalProductCacheFound,
  setLocalProductCacheNotFound,
  type LocalProductCacheHit,
} from './db/productCache.repository';
import {
  getRemoteCachedProduct,
  setRemoteCachedProductFound,
  setRemoteCachedProductNotFound,
  type RemoteProductCacheHit,
} from './productRemoteCache.service';
import { analyticsService } from './analytics.service';
import type {
  ProductRepositoryDiagnostics,
  ProductRepositoryLookupMeta,
  ProductRepositoryRemoteFetchResult,
  ProductRepositoryResolveResult,
  ProductRepositoryRemoteMode,
} from '../types/productRepository';

type RemoteCandidate = {
  source: 'food' | 'beauty';
  product: Product;
};

export type ProductRepositoryServiceResolveOptions = {
  now?: number;
  remoteFetch?: (barcode: string) => Promise<ProductRepositoryRemoteFetchResult>;
};

const inFlightRequests = new Map<string, Promise<ProductRepositoryResolveResult>>();

const createLookupId = (): string => {
  return `lookup_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
};

const safeTextLength = (value?: string | null): number => {
  if (typeof value !== 'string') {
    return 0;
  }

  return value.trim().length;
};

const safeObjectKeyCount = (value?: Record<string, unknown> | null): number => {
  if (!value || typeof value !== 'object') {
    return 0;
  }

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
    console.log('[ProductRepositoryService] parallel conflict resolved:', {
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

const getDefaultRemoteMode = (): ProductRepositoryRemoteMode => {
  return FEATURES.productRepository.remoteParallelFetchEnabled
    ? 'parallel'
    : 'sequential';
};

const defaultRemoteFetch = async (
  barcode: string
): Promise<ProductRepositoryRemoteFetchResult> => {
  if (FEATURES.productRepository.remoteParallelFetchEnabled) {
    return fetchRemoteSourcesParallel(barcode);
  }

  return fetchRemoteSourcesSequential(barcode);
};

const createLookupMeta = ({
  lookupId,
  startedAt,
  normalizedBarcode,
  remoteMode,
  resolvedSource,
  cacheTier,
}: {
  lookupId: string;
  startedAt: number;
  normalizedBarcode: string;
  remoteMode: ProductRepositoryRemoteMode;
  resolvedSource?: ProductRepositoryResolveResult extends infer _T ? never : never;
  cacheTier?: 'local' | 'remote' | 'network';
}): ProductRepositoryLookupMeta => {
  return {
    lookupId,
    durationMs: Math.max(0, Date.now() - startedAt),
    normalizedBarcode,
    resolvedSource: resolvedSource as never,
    cacheTier,
    remoteMode,
  };
};

const mapLocalHit = (
  hit: LocalProductCacheHit,
  lookupMeta: ProductRepositoryLookupMeta
): ProductRepositoryResolveResult => {
  if (hit.kind === 'found') {
    return {
      found: true,
      barcode: hit.barcode,
      product: hit.product,
      source: 'local_cache',
      cacheTier: 'local',
      lookupMeta: {
        ...lookupMeta,
        resolvedSource: 'local_cache',
        cacheTier: 'local',
      },
    };
  }

  return {
    found: false,
    barcode: hit.barcode,
    reason: 'not_found',
    source: 'local_cache',
    cacheTier: 'local',
    lookupMeta: {
      ...lookupMeta,
      resolvedSource: 'local_cache',
      cacheTier: 'local',
    },
  };
};

const mapRemoteHit = (
  hit: RemoteProductCacheHit,
  lookupMeta: ProductRepositoryLookupMeta
): ProductRepositoryResolveResult => {
  if (hit.kind === 'found') {
    return {
      found: true,
      barcode: hit.barcode,
      product: hit.product,
      source: 'shared_cache',
      cacheTier: 'remote',
      lookupMeta: {
        ...lookupMeta,
        resolvedSource: 'shared_cache',
        cacheTier: 'remote',
      },
    };
  }

  return {
    found: false,
    barcode: hit.barcode,
    reason: 'not_found',
    source: 'shared_cache',
    cacheTier: 'remote',
    lookupMeta: {
      ...lookupMeta,
      resolvedSource: 'shared_cache',
      cacheTier: 'remote',
    },
  };
};

const getRemainingTtlMs = (
  expiresAt: number,
  now: number,
  fallbackTtlMs: number
): number => {
  const remainingTtlMs = expiresAt - now;

  if (remainingTtlMs > 0) {
    return remainingTtlMs;
  }

  return fallbackTtlMs;
};

const backfillLocalCacheFromRemoteHit = (
  hit: RemoteProductCacheHit,
  now: number
): void => {
  const ttlMs =
    hit.kind === 'found'
      ? getRemainingTtlMs(hit.expiresAt, now, CACHE_POLICY.localFoundTtlMs)
      : getRemainingTtlMs(hit.expiresAt, now, CACHE_POLICY.localNotFoundTtlMs);

  if (hit.kind === 'found') {
    setLocalProductCacheFound({
      barcode: hit.barcode,
      product: hit.product,
      ttlMs,
      now,
    });
    return;
  }

  setLocalProductCacheNotFound({
    barcode: hit.barcode,
    ttlMs,
    now,
  });
};

const trackResolvedLookup = (result: ProductRepositoryResolveResult): void => {
  void analyticsService.trackProductLookupResolved({
    barcode: result.barcode,
    found: result.found,
    reason: result.found ? undefined : result.reason,
    source: result.found ? result.source : result.source,
    cacheTier: result.cacheTier,
    lookupMeta: result.lookupMeta,
    productType: result.found ? result.product.type : undefined,
    productScore:
      result.found && typeof result.product.score === 'number'
        ? result.product.score
        : undefined,
  });
};

export const resolveProductFromRepository = async (
  barcode: string,
  options?: ProductRepositoryServiceResolveOptions
): Promise<ProductRepositoryResolveResult> => {
  const normalizedBarcode = normalizeProductCacheBarcode(barcode);
  const lookupId = createLookupId();
  const startedAt = Date.now();
  const remoteMode = getDefaultRemoteMode();

  if (!isProductCacheBarcodeValid(normalizedBarcode)) {
    const invalidResult: ProductRepositoryResolveResult = {
      found: false,
      barcode: normalizedBarcode,
      reason: 'invalid_barcode',
      lookupMeta: {
        lookupId,
        durationMs: Math.max(0, Date.now() - startedAt),
        normalizedBarcode,
        remoteMode,
      },
    };

    trackResolvedLookup(invalidResult);
    return invalidResult;
  }

  const existingRequest = inFlightRequests.get(normalizedBarcode);

  if (existingRequest) {
    return existingRequest;
  }

  const requestPromise = (async (): Promise<ProductRepositoryResolveResult> => {
    const now = options?.now ?? Date.now();

    if (
      FEATURES.productRepository.sqliteCacheEnabled &&
      FEATURES.productRepository.sqliteReadEnabled
    ) {
      const localHit = getLocalProductCacheHit(normalizedBarcode, now);

      if (localHit) {
        const result = mapLocalHit(
          localHit,
          createLookupMeta({
            lookupId,
            startedAt,
            normalizedBarcode,
            remoteMode,
            cacheTier: 'local',
            resolvedSource: 'local_cache' as never,
          })
        );
        trackResolvedLookup(result);
        return result;
      }
    }

    if (FEATURES.productRepository.firestoreReadEnabled) {
      const remoteHit = await getRemoteCachedProduct(normalizedBarcode, now);

      if (remoteHit) {
        backfillLocalCacheFromRemoteHit(remoteHit, now);
        const result = mapRemoteHit(
          remoteHit,
          createLookupMeta({
            lookupId,
            startedAt,
            normalizedBarcode,
            remoteMode,
            cacheTier: 'remote',
            resolvedSource: 'shared_cache' as never,
          })
        );
        trackResolvedLookup(result);
        return result;
      }
    }

    let remoteResult: ProductRepositoryRemoteFetchResult;

    try {
      remoteResult = await (options?.remoteFetch ?? defaultRemoteFetch)(normalizedBarcode);
    } catch (error) {
      console.error('[ProductRepositoryService] remote fetch failed:', error);

      const failedResult: ProductRepositoryResolveResult = {
        found: false,
        barcode: normalizedBarcode,
        reason: 'not_found',
        cacheTier: 'network',
        lookupMeta: {
          lookupId,
          durationMs: Math.max(0, Date.now() - startedAt),
          normalizedBarcode,
          cacheTier: 'network',
          remoteMode,
        },
      };

      trackResolvedLookup(failedResult);
      return failedResult;
    }

    if (remoteResult.found) {
      setLocalProductCacheFound({
        barcode: normalizedBarcode,
        product: remoteResult.product,
        ttlMs: CACHE_POLICY.localFoundTtlMs,
        now,
      });

      void setRemoteCachedProductFound({
        barcode: normalizedBarcode,
        product: remoteResult.product,
        ttlMs: CACHE_POLICY.sharedFoundTtlMs,
        now,
      });

      const foundResult: ProductRepositoryResolveResult = {
        found: true,
        barcode: normalizedBarcode,
        product: remoteResult.product,
        source: remoteResult.source,
        cacheTier: 'network',
        lookupMeta: {
          lookupId,
          durationMs: Math.max(0, Date.now() - startedAt),
          normalizedBarcode,
          resolvedSource: remoteResult.source,
          cacheTier: 'network',
          remoteMode,
        },
      };

      trackResolvedLookup(foundResult);
      return foundResult;
    }

    setLocalProductCacheNotFound({
      barcode: normalizedBarcode,
      ttlMs: CACHE_POLICY.localNotFoundTtlMs,
      now,
    });

    void setRemoteCachedProductNotFound({
      barcode: normalizedBarcode,
      ttlMs: CACHE_POLICY.sharedNotFoundTtlMs,
      now,
    });

    const notFoundResult: ProductRepositoryResolveResult = {
      found: false,
      barcode: normalizedBarcode,
      reason: 'not_found',
      cacheTier: 'network',
      lookupMeta: {
        lookupId,
        durationMs: Math.max(0, Date.now() - startedAt),
        normalizedBarcode,
        cacheTier: 'network',
        remoteMode,
      },
    };

    trackResolvedLookup(notFoundResult);
    return notFoundResult;
  })();

  inFlightRequests.set(normalizedBarcode, requestPromise);

  try {
    return await requestPromise;
  } finally {
    inFlightRequests.delete(normalizedBarcode);
  }
};

export const clearProductRepositoryRuntimeState = (): void => {
  inFlightRequests.clear();
};

export const invalidateProductRepositoryBarcode = (barcode: string): void => {
  const normalizedBarcode = normalizeProductCacheBarcode(barcode);

  if (!normalizedBarcode) {
    return;
  }

  inFlightRequests.delete(normalizedBarcode);
  invalidateLocalProductCacheBarcode(normalizedBarcode);
};

export const getProductRepositoryDiagnostics = (): ProductRepositoryDiagnostics => {
  return {
    inflightCount: inFlightRequests.size,
  };
};
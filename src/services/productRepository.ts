import { CACHE_POLICY } from '../config/features';
import type { Product } from '../utils/analysis';
import {
  getCachedProduct,
  invalidateProductCacheBarcode,
  isValidBarcode,
  normalizeBarcode,
  setCachedProductFound,
  setCachedProductNotFound,
  type LocalProductCacheHit,
} from './productCache.service';
import {
  getRemoteCachedProduct,
  setRemoteCachedProductFound,
  setRemoteCachedProductNotFound,
  type RemoteProductCacheHit,
} from './productRemoteCache.service';

export type ProductRepositorySource =
  | 'local_cache'
  | 'shared_cache'
  | 'food'
  | 'beauty';

export type ProductRepositoryResolveResult =
  | {
      found: true;
      barcode: string;
      product: Product;
      source: ProductRepositorySource;
      cacheTier: 'local' | 'remote' | 'network';
    }
  | {
      found: false;
      barcode: string;
      reason: 'invalid_barcode' | 'not_found';
      source?: ProductRepositorySource;
      cacheTier?: 'local' | 'remote' | 'network';
    };

export type ProductRepositoryRemoteFetchResult =
  | {
      found: true;
      barcode: string;
      product: Product;
      source: 'food' | 'beauty';
    }
  | {
      found: false;
      barcode: string;
      reason: 'not_found';
    };

export type ProductRepositoryResolveOptions = {
  remoteFetch: (barcode: string) => Promise<ProductRepositoryRemoteFetchResult>;
  now?: number;
};

const inFlightRequests = new Map<string, Promise<ProductRepositoryResolveResult>>();

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

const mapLocalHit = (
  hit: LocalProductCacheHit
): ProductRepositoryResolveResult => {
  if (hit.kind === 'found') {
    return {
      found: true,
      barcode: hit.barcode,
      product: hit.product,
      source: 'local_cache',
      cacheTier: 'local',
    };
  }

  return {
    found: false,
    barcode: hit.barcode,
    reason: 'not_found',
    source: 'local_cache',
    cacheTier: 'local',
  };
};

const mapRemoteHit = (
  hit: RemoteProductCacheHit
): ProductRepositoryResolveResult => {
  if (hit.kind === 'found') {
    return {
      found: true,
      barcode: hit.barcode,
      product: hit.product,
      source: 'shared_cache',
      cacheTier: 'remote',
    };
  }

  return {
    found: false,
    barcode: hit.barcode,
    reason: 'not_found',
    source: 'shared_cache',
    cacheTier: 'remote',
  };
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
    setCachedProductFound({
      barcode: hit.barcode,
      product: hit.product,
      ttlMs,
      now,
    });
    return;
  }

  setCachedProductNotFound({
    barcode: hit.barcode,
    ttlMs,
    now,
  });
};

export const resolveProductFromRepository = async (
  barcode: string,
  options: ProductRepositoryResolveOptions
): Promise<ProductRepositoryResolveResult> => {
  const normalizedBarcode = normalizeBarcode(barcode);

  if (!isValidBarcode(normalizedBarcode)) {
    return {
      found: false,
      barcode: normalizedBarcode,
      reason: 'invalid_barcode',
    };
  }

  const existingRequest = inFlightRequests.get(normalizedBarcode);

  if (existingRequest) {
    return existingRequest;
  }

  const requestPromise = (async (): Promise<ProductRepositoryResolveResult> => {
    const now = options.now ?? Date.now();

    const localHit = getCachedProduct(normalizedBarcode, now);

    if (localHit) {
      return mapLocalHit(localHit);
    }

    const remoteHit = await getRemoteCachedProduct(normalizedBarcode, now);

    if (remoteHit) {
      backfillLocalCacheFromRemoteHit(remoteHit, now);
      return mapRemoteHit(remoteHit);
    }

    let remoteResult: ProductRepositoryRemoteFetchResult;

    try {
      remoteResult = await options.remoteFetch(normalizedBarcode);
    } catch (error) {
      console.error('[ProductRepository] remote fetch failed:', error);

      return {
        found: false,
        barcode: normalizedBarcode,
        reason: 'not_found',
        cacheTier: 'network',
      };
    }

    if (remoteResult.found) {
      setCachedProductFound({
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

      return {
        found: true,
        barcode: normalizedBarcode,
        product: remoteResult.product,
        source: remoteResult.source,
        cacheTier: 'network',
      };
    }

    setCachedProductNotFound({
      barcode: normalizedBarcode,
      ttlMs: CACHE_POLICY.localNotFoundTtlMs,
      now,
    });

    void setRemoteCachedProductNotFound({
      barcode: normalizedBarcode,
      ttlMs: CACHE_POLICY.sharedNotFoundTtlMs,
      now,
    });

    return {
      found: false,
      barcode: normalizedBarcode,
      reason: 'not_found',
      cacheTier: 'network',
    };
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
  const normalizedBarcode = normalizeBarcode(barcode);

  if (!normalizedBarcode) {
    return;
  }

  inFlightRequests.delete(normalizedBarcode);
  invalidateProductCacheBarcode(normalizedBarcode);
};
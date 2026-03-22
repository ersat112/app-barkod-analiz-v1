import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';

import {
  CACHE_POLICY,
  FEATURES,
  PRODUCT_CACHE_SCHEMA_VERSION,
  SHARED_PRODUCT_CACHE_COLLECTION,
} from '../config/features';
import { db as firestoreDb } from '../config/firebase';
import type { Product, ProductSource, ProductType } from '../utils/analysis';
import {
  isProductCacheBarcodeValid,
  normalizeProductCacheBarcode,
} from './db/productCache.repository';

type FirestoreProductCacheDocument = {
  barcode?: string;
  cacheStatus?: string;
  sourceName?: ProductSource | null;
  productType?: ProductType | null;
  productPayload?: Product | null;
  schemaVersion?: number | null;
  fetchedAt?: number | null;
  expiresAt?: number | null;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type RemoteProductCacheHit =
  | {
      kind: 'found';
      barcode: string;
      product: Product;
      source: 'shared_cache';
      sourceName?: ProductSource;
      fetchedAt: number;
      expiresAt: number;
    }
  | {
      kind: 'not_found';
      barcode: string;
      source: 'shared_cache';
      fetchedAt: number;
      expiresAt: number;
    };

const stripUndefinedDeep = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as T;
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};

    Object.entries(value as Record<string, unknown>).forEach(([key, entryValue]) => {
      if (entryValue !== undefined) {
        result[key] = stripUndefinedDeep(entryValue);
      }
    });

    return result as T;
  }

  return value;
};

const toEpochMs = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  if (value instanceof Timestamp) {
    return value.toMillis();
  }

  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { toMillis?: () => number }).toMillis === 'function'
  ) {
    try {
      return (value as { toMillis: () => number }).toMillis();
    } catch {
      return 0;
    }
  }

  return 0;
};

const toProduct = (barcode: string, payload: unknown): Product | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  return {
    ...(payload as Product),
    barcode,
  };
};

export const getRemoteCachedProduct = async (
  barcode: string,
  now = Date.now()
): Promise<RemoteProductCacheHit | null> => {
  if (!FEATURES.productRepository.firestoreReadEnabled) {
    return null;
  }

  const normalizedBarcode = normalizeProductCacheBarcode(barcode);

  if (!isProductCacheBarcodeValid(normalizedBarcode)) {
    return null;
  }

  try {
    const ref = doc(
      firestoreDb,
      SHARED_PRODUCT_CACHE_COLLECTION,
      normalizedBarcode
    );

    const snapshot = await getDoc(ref);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data() as FirestoreProductCacheDocument;
    const fetchedAt = toEpochMs(data.fetchedAt);
    const expiresAt = toEpochMs(data.expiresAt);

    if (expiresAt > 0 && expiresAt <= now) {
      return null;
    }

    if (data.cacheStatus === 'not_found') {
      return {
        kind: 'not_found',
        barcode: normalizedBarcode,
        source: 'shared_cache',
        fetchedAt,
        expiresAt,
      };
    }

    const product = toProduct(normalizedBarcode, data.productPayload);

    if (!product) {
      return null;
    }

    return {
      kind: 'found',
      barcode: normalizedBarcode,
      product,
      source: 'shared_cache',
      sourceName: data.sourceName ?? product.sourceName ?? undefined,
      fetchedAt,
      expiresAt,
    };
  } catch (error) {
    console.warn('[ProductRemoteCache] read failed:', error);
    return null;
  }
};

export const setRemoteCachedProductFound = async ({
  barcode,
  product,
  ttlMs = CACHE_POLICY.sharedFoundTtlMs,
  now = Date.now(),
}: {
  barcode: string;
  product: Product;
  ttlMs?: number;
  now?: number;
}): Promise<boolean> => {
  if (!FEATURES.productRepository.firestoreWriteEnabled) {
    return false;
  }

  const normalizedBarcode = normalizeProductCacheBarcode(barcode);

  if (!isProductCacheBarcodeValid(normalizedBarcode)) {
    return false;
  }

  const expiresAt = now + Math.max(1, ttlMs);
  const productPayload = stripUndefinedDeep<Product>({
    ...product,
    barcode: normalizedBarcode,
  });

  try {
    const ref = doc(
      firestoreDb,
      SHARED_PRODUCT_CACHE_COLLECTION,
      normalizedBarcode
    );

    await setDoc(
      ref,
      {
        barcode: normalizedBarcode,
        cacheStatus: 'found',
        sourceName: product.sourceName ?? null,
        productType: product.type ?? null,
        productPayload,
        schemaVersion: PRODUCT_CACHE_SCHEMA_VERSION,
        fetchedAt: now,
        expiresAt,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return true;
  } catch (error) {
    console.warn('[ProductRemoteCache] write(found) failed:', error);
    return false;
  }
};

export const setRemoteCachedProductNotFound = async ({
  barcode,
  ttlMs = CACHE_POLICY.sharedNotFoundTtlMs,
  now = Date.now(),
}: {
  barcode: string;
  ttlMs?: number;
  now?: number;
}): Promise<boolean> => {
  if (!FEATURES.productRepository.firestoreWriteEnabled) {
    return false;
  }

  const normalizedBarcode = normalizeProductCacheBarcode(barcode);

  if (!isProductCacheBarcodeValid(normalizedBarcode)) {
    return false;
  }

  const expiresAt = now + Math.max(1, ttlMs);

  try {
    const ref = doc(
      firestoreDb,
      SHARED_PRODUCT_CACHE_COLLECTION,
      normalizedBarcode
    );

    await setDoc(
      ref,
      {
        barcode: normalizedBarcode,
        cacheStatus: 'not_found',
        sourceName: null,
        productType: null,
        productPayload: null,
        schemaVersion: PRODUCT_CACHE_SCHEMA_VERSION,
        fetchedAt: now,
        expiresAt,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return true;
  } catch (error) {
    console.warn('[ProductRemoteCache] write(not_found) failed:', error);
    return false;
  }
};
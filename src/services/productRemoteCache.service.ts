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
import {
  db as firestoreDb,
  getFirebaseServicesDiagnosticsSnapshot,
  isFirebaseServicesReady,
} from '../config/firebase';
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

export type RemoteProductCacheDiagnosticsSnapshot = {
  fetchedAt: string;
  runtimeReady: boolean;
  projectId: string;
  effectiveSource: string;
  readFeatureEnabled: boolean;
  writeFeatureEnabled: boolean;
  readValidationEnabled: boolean;
  writeValidationEnabled: boolean;
  lastReadFailure: string | null;
  lastWriteFailure: string | null;
};

let lastReadFailure: string | null = null;
let lastWriteFailure: string | null = null;
let hasLoggedReadValidationFailure = false;
let hasLoggedWriteValidationFailure = false;

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

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'unknown_remote_cache_error';
};

const canUseRemoteRead = (): boolean => {
  if (!FEATURES.productRepository.firestoreReadEnabled) {
    return false;
  }

  if (!FEATURES.firebase.runtimeValidationEnabled) {
    return true;
  }

  if (!FEATURES.firebase.sharedCacheReadValidationEnabled) {
    return true;
  }

  const ready = isFirebaseServicesReady();

  if (!ready && !hasLoggedReadValidationFailure) {
    hasLoggedReadValidationFailure = true;
    console.warn('[ProductRemoteCache] firestore read disabled by runtime validation', {
      diagnostics: getFirebaseServicesDiagnosticsSnapshot(),
    });
  }

  return ready;
};

const canUseRemoteWrite = (): boolean => {
  if (!FEATURES.productRepository.firestoreWriteEnabled) {
    return false;
  }

  if (!FEATURES.firebase.runtimeValidationEnabled) {
    return true;
  }

  if (!FEATURES.firebase.sharedCacheWriteValidationEnabled) {
    return true;
  }

  const ready = isFirebaseServicesReady();

  if (!ready && !hasLoggedWriteValidationFailure) {
    hasLoggedWriteValidationFailure = true;
    console.warn('[ProductRemoteCache] firestore write disabled by runtime validation', {
      diagnostics: getFirebaseServicesDiagnosticsSnapshot(),
    });
  }

  return ready;
};

export const getRemoteProductCacheDiagnostics =
  (): RemoteProductCacheDiagnosticsSnapshot => {
    const firebaseDiagnostics = getFirebaseServicesDiagnosticsSnapshot();

    return {
      fetchedAt: new Date().toISOString(),
      runtimeReady: isFirebaseServicesReady(),
      projectId: firebaseDiagnostics.projectId,
      effectiveSource: firebaseDiagnostics.effectiveSource,
      readFeatureEnabled: FEATURES.productRepository.firestoreReadEnabled,
      writeFeatureEnabled: FEATURES.productRepository.firestoreWriteEnabled,
      readValidationEnabled:
        FEATURES.firebase.runtimeValidationEnabled &&
        FEATURES.firebase.sharedCacheReadValidationEnabled,
      writeValidationEnabled:
        FEATURES.firebase.runtimeValidationEnabled &&
        FEATURES.firebase.sharedCacheWriteValidationEnabled,
      lastReadFailure,
      lastWriteFailure,
    };
  };

export const resetRemoteProductCacheDiagnostics = (): void => {
  lastReadFailure = null;
  lastWriteFailure = null;
  hasLoggedReadValidationFailure = false;
  hasLoggedWriteValidationFailure = false;
};

export const getRemoteCachedProduct = async (
  barcode: string,
  now = Date.now()
): Promise<RemoteProductCacheHit | null> => {
  if (!canUseRemoteRead()) {
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
      lastReadFailure = null;
      return null;
    }

    const data = snapshot.data() as FirestoreProductCacheDocument;
    const fetchedAt = toEpochMs(data.fetchedAt);
    const expiresAt = toEpochMs(data.expiresAt);

    if (expiresAt > 0 && expiresAt <= now) {
      lastReadFailure = null;
      return null;
    }

    if (data.cacheStatus === 'not_found') {
      lastReadFailure = null;

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
      lastReadFailure = 'invalid_remote_product_payload';
      return null;
    }

    lastReadFailure = null;

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
    lastReadFailure = toErrorMessage(error);
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
  if (!canUseRemoteWrite()) {
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

    lastWriteFailure = null;
    return true;
  } catch (error) {
    lastWriteFailure = toErrorMessage(error);
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
  if (!canUseRemoteWrite()) {
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

    lastWriteFailure = null;
    return true;
  } catch (error) {
    lastWriteFailure = toErrorMessage(error);
    console.warn('[ProductRemoteCache] write(not_found) failed:', error);
    return false;
  }
};
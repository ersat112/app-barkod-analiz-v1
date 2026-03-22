import { doc, getDoc, Timestamp } from 'firebase/firestore';

import {
  FEATURES,
  SHARED_PRODUCT_CACHE_COLLECTION,
} from '../config/features';
import { db as firestoreDb } from '../config/firebase';
import type { Product, ProductSource, ProductType } from '../utils/analysis';
import {
  isProductCacheBarcodeValid,
  normalizeProductCacheBarcode,
} from './db/productCache.repository';
import {
  enqueueRemoteProductCacheFoundWrite,
  enqueueRemoteProductCacheNotFoundWrite,
  getRemoteProductCacheWriteQueueDiagnostics,
} from './productRemoteWriteQueue.service';
import {
  canReadSharedProductCache,
  canWriteSharedProductCache,
  getFirebaseAccessSnapshot,
} from './firebaseAccess.service';

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
  writerUid?: string | null;
  writerPlatform?: string | null;
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
  runtimeSource: string;
  projectId: string;
  isAuthenticated: boolean;
  authUid: string | null;
  readFeatureEnabled: boolean;
  writeFeatureEnabled: boolean;
  readValidationEnabled: boolean;
  writeValidationEnabled: boolean;
  sharedCacheReadAllowed: boolean;
  sharedCacheWriteAllowed: boolean;
  rolloutSource: string;
  rolloutVersion: number;
  queueSize: number;
  readyQueueSize: number;
  blockedQueueSize: number;
  lifecycleAttached: boolean;
  lastFlushAt: string | null;
  lastFlushReason: string | null;
  lastFlushError: string | null;
  consecutiveFailureCount: number;
  lastReadFailure: string | null;
  lastWriteFailure: string | null;
};

let lastReadFailure: string | null = null;
let lastWriteFailure: string | null = null;

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

export const resetRemoteProductCacheDiagnostics = (): void => {
  lastReadFailure = null;
  lastWriteFailure = null;
};

export const getRemoteProductCacheDiagnostics =
  async (): Promise<RemoteProductCacheDiagnosticsSnapshot> => {
    const queueDiagnostics = await getRemoteProductCacheWriteQueueDiagnostics();
    const accessSnapshot = await getFirebaseAccessSnapshot();

    return {
      fetchedAt: new Date().toISOString(),
      runtimeReady: accessSnapshot.runtimeReady,
      runtimeSource: accessSnapshot.runtimeSource,
      projectId: accessSnapshot.projectId,
      isAuthenticated: accessSnapshot.isAuthenticated,
      authUid: accessSnapshot.authUid,
      readFeatureEnabled: FEATURES.productRepository.firestoreReadEnabled,
      writeFeatureEnabled: FEATURES.productRepository.firestoreWriteEnabled,
      readValidationEnabled:
        FEATURES.firebase.runtimeValidationEnabled &&
        FEATURES.firebase.sharedCacheReadValidationEnabled,
      writeValidationEnabled:
        FEATURES.firebase.runtimeValidationEnabled &&
        FEATURES.firebase.sharedCacheWriteValidationEnabled,
      sharedCacheReadAllowed: accessSnapshot.sharedCacheReadAllowed,
      sharedCacheWriteAllowed: accessSnapshot.sharedCacheWriteAllowed,
      rolloutSource: accessSnapshot.firestoreRuntimeConfigSource,
      rolloutVersion: accessSnapshot.firestoreRuntimeConfigVersion,
      queueSize: queueDiagnostics.queueSize,
      readyQueueSize: queueDiagnostics.readyQueueSize,
      blockedQueueSize: queueDiagnostics.blockedQueueSize,
      lifecycleAttached: queueDiagnostics.lifecycleAttached,
      lastFlushAt: queueDiagnostics.lastFlushAt,
      lastFlushReason: queueDiagnostics.lastFlushReason,
      lastFlushError: queueDiagnostics.lastFlushError,
      consecutiveFailureCount: queueDiagnostics.consecutiveFailureCount,
      lastReadFailure,
      lastWriteFailure,
    };
  };

export const getRemoteCachedProduct = async (
  barcode: string,
  now = Date.now()
): Promise<RemoteProductCacheHit | null> => {
  const canRead = await canReadSharedProductCache();

  if (!canRead) {
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
  ttlMs,
}: {
  barcode: string;
  product: Product;
  ttlMs?: number;
  now?: number;
}): Promise<boolean> => {
  const canWrite = await canWriteSharedProductCache();

  if (!FEATURES.productRepository.firestoreWriteEnabled || !canWrite) {
    return false;
  }

  const normalizedBarcode = normalizeProductCacheBarcode(barcode);

  if (!isProductCacheBarcodeValid(normalizedBarcode)) {
    return false;
  }

  try {
    const accepted = await enqueueRemoteProductCacheFoundWrite({
      barcode: normalizedBarcode,
      product,
      ttlMs,
    });

    lastWriteFailure = accepted ? null : 'remote_write_queue_rejected';
    return accepted;
  } catch (error) {
    lastWriteFailure = toErrorMessage(error);
    console.warn('[ProductRemoteCache] enqueue(found) failed:', error);
    return false;
  }
};

export const setRemoteCachedProductNotFound = async ({
  barcode,
  ttlMs,
}: {
  barcode: string;
  ttlMs?: number;
  now?: number;
}): Promise<boolean> => {
  const canWrite = await canWriteSharedProductCache();

  if (!FEATURES.productRepository.firestoreWriteEnabled || !canWrite) {
    return false;
  }

  const normalizedBarcode = normalizeProductCacheBarcode(barcode);

  if (!isProductCacheBarcodeValid(normalizedBarcode)) {
    return false;
  }

  try {
    const accepted = await enqueueRemoteProductCacheNotFoundWrite({
      barcode: normalizedBarcode,
      ttlMs,
    });

    lastWriteFailure = accepted ? null : 'remote_write_queue_rejected';
    return accepted;
  } catch (error) {
    lastWriteFailure = toErrorMessage(error);
    console.warn('[ProductRemoteCache] enqueue(not_found) failed:', error);
    return false;
  }
};
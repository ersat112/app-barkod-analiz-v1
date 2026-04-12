import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppState,
  Platform,
  type AppStateStatus,
  type NativeEventSubscription,
} from 'react-native';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import {
  CACHE_POLICY,
  FEATURES,
  PRODUCT_CACHE_SCHEMA_VERSION,
  REMOTE_PRODUCT_CACHE_WRITE_QUEUE_STORAGE_KEY,
  SHARED_PRODUCT_CACHE_COLLECTION,
} from '../config/features';
import { db as firestoreDb } from '../config/firebase';
import { analyticsService } from './analytics.service';
import {
  canWriteSharedProductCache,
  getFirebaseAccessSnapshot,
} from './firebaseAccess.service';
import type { Product } from '../utils/analysis';

type QueueFlushReason =
  | 'enqueue'
  | 'app_boot'
  | 'app_active'
  | 'app_inactive'
  | 'app_background'
  | 'manual';

type QueueItemBase = {
  id: string;
  barcode: string;
  kind: 'found' | 'not_found';
  enqueuedAt: string;
  updatedAt: string;
  attemptCount: number;
  nextAttemptAt: number;
  lastAttemptAt: string | null;
  lastError: string | null;
  ttlMs: number;
};

type QueueFoundItem = QueueItemBase & {
  kind: 'found';
  product: Product;
};

type QueueNotFoundItem = QueueItemBase & {
  kind: 'not_found';
};

type RemoteWriteQueueItem = QueueFoundItem | QueueNotFoundItem;

type PersistedQueueState = {
  version: 1;
  items: RemoteWriteQueueItem[];
};

export type RemoteWriteQueueDiagnostics = {
  fetchedAt: string;
  queueSize: number;
  readyQueueSize: number;
  blockedQueueSize: number;
  lifecycleAttached: boolean;
  runtimeReady: boolean;
  runtimeSource: string;
  projectId: string;
  isAuthenticated: boolean;
  authUid: string | null;
  sharedCacheWriteAllowed: boolean;
  rolloutSource: string;
  rolloutVersion: number;
  lastFlushAt: string | null;
  lastFlushReason: QueueFlushReason | null;
  lastFlushError: string | null;
  consecutiveFailureCount: number;
};

const QUEUE_VERSION = 1;
const MAX_BATCH_SIZE = 10;
const BASE_RETRY_DELAY_MS = 5_000;
const MAX_RETRY_DELAY_MS = 15 * 60 * 1000;
const ENQUEUE_FLUSH_DELAY_MS = 12_000;
const ACTIVE_FLUSH_DELAY_MS = 4_000;

let hydrationPromise: Promise<RemoteWriteQueueItem[]> | null = null;
let flushPromise: Promise<number> | null = null;
let inMemoryQueue: RemoteWriteQueueItem[] | null = null;
let appStateSubscription: NativeEventSubscription | null = null;
let scheduledFlushTimeout: ReturnType<typeof setTimeout> | null = null;
let lifecycleAttached = false;

let lastFlushAt: string | null = null;
let lastFlushReason: QueueFlushReason | null = null;
let lastFlushError: string | null = null;
let consecutiveFailureCount = 0;

const nowIso = (): string => new Date().toISOString();

const createQueueId = (): string => {
  return `rwq_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'remote_write_queue_error';
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

const getRetryDelayMs = (attemptCount: number): number => {
  const safeAttempts = Math.max(1, attemptCount);
  return Math.min(BASE_RETRY_DELAY_MS * 2 ** (safeAttempts - 1), MAX_RETRY_DELAY_MS);
};

const clearScheduledFlush = (): void => {
  if (!scheduledFlushTimeout) {
    return;
  }

  clearTimeout(scheduledFlushTimeout);
  scheduledFlushTimeout = null;
};

const scheduleFlush = (reason: QueueFlushReason, delayMs: number): void => {
  if (scheduledFlushTimeout) {
    return;
  }

  scheduledFlushTimeout = setTimeout(() => {
    scheduledFlushTimeout = null;
    void flushRemoteProductCacheWriteQueue({ reason });
  }, delayMs);
};

const persistQueue = async (items: RemoteWriteQueueItem[]): Promise<void> => {
  inMemoryQueue = items;

  const payload: PersistedQueueState = {
    version: QUEUE_VERSION,
    items,
  };

  await AsyncStorage.setItem(
    REMOTE_PRODUCT_CACHE_WRITE_QUEUE_STORAGE_KEY,
    JSON.stringify(payload)
  );
};

const hydrateQueue = async (): Promise<RemoteWriteQueueItem[]> => {
  if (inMemoryQueue) {
    return inMemoryQueue;
  }

  if (hydrationPromise) {
    return hydrationPromise;
  }

  hydrationPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(
        REMOTE_PRODUCT_CACHE_WRITE_QUEUE_STORAGE_KEY
      );

      if (!raw) {
        inMemoryQueue = [];
        return inMemoryQueue;
      }

      const parsed = JSON.parse(raw) as Partial<PersistedQueueState>;

      if (!Array.isArray(parsed.items)) {
        inMemoryQueue = [];
        return inMemoryQueue;
      }

      inMemoryQueue = parsed.items.filter(
        (item): item is RemoteWriteQueueItem =>
          Boolean(
            item &&
              typeof item === 'object' &&
              typeof item.id === 'string' &&
              typeof item.barcode === 'string' &&
              (item.kind === 'found' || item.kind === 'not_found')
          )
      );

      return inMemoryQueue;
    } catch (error) {
      console.warn('[RemoteWriteQueue] hydrate failed:', error);
      inMemoryQueue = [];
      return inMemoryQueue;
    } finally {
      hydrationPromise = null;
    }
  })();

  return hydrationPromise;
};

const upsertQueueItem = (
  items: RemoteWriteQueueItem[],
  nextItem: RemoteWriteQueueItem
): RemoteWriteQueueItem[] => {
  const filtered = items.filter((item) => item.barcode !== nextItem.barcode);

  return [nextItem, ...filtered].sort((left, right) => {
    return left.nextAttemptAt - right.nextAttemptAt;
  });
};

const trackEnqueued = (item: RemoteWriteQueueItem): void => {
  void analyticsService.track(
    'remote_cache_write_queue_enqueued',
    {
      barcode: item.barcode,
      kind: item.kind,
      attemptCount: item.attemptCount,
      ttlMs: item.ttlMs,
    },
    { flush: false }
  );
};

const trackFlushSucceeded = (params: {
  reason: QueueFlushReason;
  flushedCount: number;
  queueSizeAfterFlush: number;
}): void => {
  void analyticsService.track(
    'remote_cache_write_queue_flush_succeeded',
    {
      reason: params.reason,
      flushedCount: params.flushedCount,
      queueSizeAfterFlush: params.queueSizeAfterFlush,
    },
    { flush: false }
  );
};

const trackFlushFailed = (params: {
  reason: QueueFlushReason;
  queueSize: number;
  error: string;
}): void => {
  void analyticsService.track(
    'remote_cache_write_queue_flush_failed',
    {
      reason: params.reason,
      queueSize: params.queueSize,
      error: params.error,
    },
    { flush: false }
  );
};

const trackItemFailed = (item: RemoteWriteQueueItem, error: string): void => {
  void analyticsService.track(
    'remote_cache_write_queue_item_failed',
    {
      barcode: item.barcode,
      kind: item.kind,
      attemptCount: item.attemptCount,
      error,
    },
    { flush: false }
  );
};

const writeFoundItem = async (
  item: QueueFoundItem,
  now: number,
  authUid: string
): Promise<void> => {
  const expiresAt = now + Math.max(1, item.ttlMs);

  const productPayload = stripUndefinedDeep<Product>({
    ...item.product,
    barcode: item.barcode,
  });

  const ref = doc(firestoreDb, SHARED_PRODUCT_CACHE_COLLECTION, item.barcode);

  await setDoc(
    ref,
    {
      barcode: item.barcode,
      cacheStatus: 'found',
      sourceName: item.product.sourceName ?? null,
      productType: item.product.type ?? null,
      productPayload,
      schemaVersion: PRODUCT_CACHE_SCHEMA_VERSION,
      fetchedAt: now,
      expiresAt,
      updatedAt: serverTimestamp(),
      writerUid: authUid,
      writerPlatform: Platform.OS,
    },
    { merge: true }
  );
};

const writeNotFoundItem = async (
  item: QueueNotFoundItem,
  now: number,
  authUid: string
): Promise<void> => {
  const expiresAt = now + Math.max(1, item.ttlMs);
  const ref = doc(firestoreDb, SHARED_PRODUCT_CACHE_COLLECTION, item.barcode);

  await setDoc(
    ref,
    {
      barcode: item.barcode,
      cacheStatus: 'not_found',
      sourceName: null,
      productType: null,
      productPayload: null,
      schemaVersion: PRODUCT_CACHE_SCHEMA_VERSION,
      fetchedAt: now,
      expiresAt,
      updatedAt: serverTimestamp(),
      writerUid: authUid,
      writerPlatform: Platform.OS,
    },
    { merge: true }
  );
};

const flushInternal = async (reason: QueueFlushReason): Promise<number> => {
  const queue = await hydrateQueue();

  lastFlushReason = reason;

  if (!queue.length) {
    lastFlushAt = nowIso();
    lastFlushError = null;
    consecutiveFailureCount = 0;
    return 0;
  }

  const accessSnapshot = await getFirebaseAccessSnapshot();

  if (!accessSnapshot.sharedCacheWriteAllowed) {
    lastFlushAt = nowIso();
    lastFlushError = 'shared_cache_write_not_allowed';
    trackFlushFailed({
      reason,
      queueSize: queue.length,
      error: lastFlushError,
    });
    return 0;
  }

  if (!accessSnapshot.authUid) {
    lastFlushAt = nowIso();
    lastFlushError = 'firebase_auth_uid_missing';
    trackFlushFailed({
      reason,
      queueSize: queue.length,
      error: lastFlushError,
    });
    return 0;
  }

  const now = Date.now();
  const eligible = queue
    .filter((item) => item.nextAttemptAt <= now)
    .slice(0, MAX_BATCH_SIZE);

  if (!eligible.length) {
    lastFlushAt = nowIso();
    lastFlushError = null;
    return 0;
  }

  let nextQueue = [...queue];
  let flushedCount = 0;

  for (const item of eligible) {
    try {
      if (item.kind === 'found') {
        await writeFoundItem(item, now, accessSnapshot.authUid);
      } else {
        await writeNotFoundItem(item, now, accessSnapshot.authUid);
      }

      nextQueue = nextQueue.filter((queued) => queued.id !== item.id);
      flushedCount += 1;
      lastFlushError = null;
      consecutiveFailureCount = 0;
    } catch (error) {
      const message = toErrorMessage(error);
      const nextAttemptAt = now + getRetryDelayMs(item.attemptCount + 1);

      const updatedItem: RemoteWriteQueueItem =
        item.kind === 'found'
          ? {
              ...item,
              attemptCount: item.attemptCount + 1,
              nextAttemptAt,
              lastAttemptAt: nowIso(),
              lastError: message,
              updatedAt: nowIso(),
            }
          : {
              ...item,
              attemptCount: item.attemptCount + 1,
              nextAttemptAt,
              lastAttemptAt: nowIso(),
              lastError: message,
              updatedAt: nowIso(),
            };

      nextQueue = nextQueue.map((queued) =>
        queued.id === item.id ? updatedItem : queued
      );

      lastFlushError = message;
      consecutiveFailureCount += 1;
      trackItemFailed(item, message);
      trackFlushFailed({
        reason,
        queueSize: nextQueue.length,
        error: message,
      });
      break;
    }
  }

  await persistQueue(nextQueue);
  lastFlushAt = nowIso();

  if (flushedCount > 0) {
    trackFlushSucceeded({
      reason,
      flushedCount,
      queueSizeAfterFlush: nextQueue.length,
    });
  }

  return flushedCount;
};

const onAppStateChange = (nextState: AppStateStatus): void => {
  if (nextState === 'active') {
    scheduleFlush('app_active', ACTIVE_FLUSH_DELAY_MS);
    return;
  }

  if (nextState === 'background') {
    clearScheduledFlush();
    void flushRemoteProductCacheWriteQueue({ reason: 'app_background' });
  }
};

export const initializeRemoteProductCacheWriteQueue = (): void => {
  if (lifecycleAttached) {
    return;
  }

  lifecycleAttached = true;
  void hydrateQueue();
  appStateSubscription = AppState.addEventListener('change', onAppStateChange);
};

export const teardownRemoteProductCacheWriteQueue = (): void => {
  clearScheduledFlush();

  if (!appStateSubscription) {
    lifecycleAttached = false;
    return;
  }

  appStateSubscription.remove();
  appStateSubscription = null;
  lifecycleAttached = false;
};

export const enqueueRemoteProductCacheFoundWrite = async ({
  barcode,
  product,
  ttlMs = CACHE_POLICY.sharedFoundTtlMs,
}: {
  barcode: string;
  product: Product;
  ttlMs?: number;
}): Promise<boolean> => {
  const canWrite = await canWriteSharedProductCache();

  if (!FEATURES.productRepository.firestoreWriteEnabled || !canWrite) {
    return false;
  }

  const queue = await hydrateQueue();

  const item: QueueFoundItem = {
    id: createQueueId(),
    barcode,
    kind: 'found',
    product,
    ttlMs,
    enqueuedAt: nowIso(),
    updatedAt: nowIso(),
    attemptCount: 0,
    nextAttemptAt: 0,
    lastAttemptAt: null,
    lastError: null,
  };

  await persistQueue(upsertQueueItem(queue, item));
  trackEnqueued(item);
  scheduleFlush('enqueue', ENQUEUE_FLUSH_DELAY_MS);
  return true;
};

export const enqueueRemoteProductCacheNotFoundWrite = async ({
  barcode,
  ttlMs = CACHE_POLICY.sharedNotFoundTtlMs,
}: {
  barcode: string;
  ttlMs?: number;
}): Promise<boolean> => {
  const canWrite = await canWriteSharedProductCache();

  if (!FEATURES.productRepository.firestoreWriteEnabled || !canWrite) {
    return false;
  }

  const queue = await hydrateQueue();

  const item: QueueNotFoundItem = {
    id: createQueueId(),
    barcode,
    kind: 'not_found',
    ttlMs,
    enqueuedAt: nowIso(),
    updatedAt: nowIso(),
    attemptCount: 0,
    nextAttemptAt: 0,
    lastAttemptAt: null,
    lastError: null,
  };

  await persistQueue(upsertQueueItem(queue, item));
  trackEnqueued(item);
  scheduleFlush('enqueue', ENQUEUE_FLUSH_DELAY_MS);
  return true;
};

export const flushRemoteProductCacheWriteQueue = async ({
  reason = 'manual',
}: {
  reason?: QueueFlushReason;
} = {}): Promise<number> => {
  clearScheduledFlush();

  if (flushPromise) {
    return flushPromise;
  }

  flushPromise = flushInternal(reason);

  try {
    return await flushPromise;
  } finally {
    flushPromise = null;
  }
};

export const getRemoteProductCacheWriteQueueDiagnostics =
  async (): Promise<RemoteWriteQueueDiagnostics> => {
    const queue = await hydrateQueue();
    const now = Date.now();
    const readyQueueSize = queue.filter((item) => item.nextAttemptAt <= now).length;
    const blockedQueueSize = Math.max(0, queue.length - readyQueueSize);
    const accessSnapshot = await getFirebaseAccessSnapshot();

    return {
      fetchedAt: nowIso(),
      queueSize: queue.length,
      readyQueueSize,
      blockedQueueSize,
      lifecycleAttached,
      runtimeReady: accessSnapshot.runtimeReady,
      runtimeSource: accessSnapshot.runtimeSource,
      projectId: accessSnapshot.projectId,
      isAuthenticated: accessSnapshot.isAuthenticated,
      authUid: accessSnapshot.authUid,
      sharedCacheWriteAllowed: accessSnapshot.sharedCacheWriteAllowed,
      rolloutSource: accessSnapshot.firestoreRuntimeConfigSource,
      rolloutVersion: accessSnapshot.firestoreRuntimeConfigVersion,
      lastFlushAt,
      lastFlushReason,
      lastFlushError,
      consecutiveFailureCount,
    };
  };

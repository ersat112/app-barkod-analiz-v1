import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppState,
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
import {
  db as firestoreDb,
  getFirebaseServicesDiagnosticsSnapshot,
  isFirebaseServicesReady,
} from '../config/firebase';
import type { Product } from '../utils/analysis';

type QueueFlushReason =
  | 'enqueue'
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

type FoundQueueItem = QueueItemBase & {
  kind: 'found';
  product: Product;
};

type NotFoundQueueItem = QueueItemBase & {
  kind: 'not_found';
};

type RemoteProductCacheWriteQueueItem = FoundQueueItem | NotFoundQueueItem;

type PersistedQueueShape = {
  version: 1;
  items: RemoteProductCacheWriteQueueItem[];
};

export type RemoteProductCacheWriteQueueDiagnostics = {
  fetchedAt: string;
  queueSize: number;
  readyQueueSize: number;
  blockedQueueSize: number;
  lifecycleAttached: boolean;
  runtimeReady: boolean;
  projectId: string;
  effectiveSource: string;
  lastFlushAt: string | null;
  lastFlushReason: QueueFlushReason | null;
  lastFlushError: string | null;
  consecutiveFailureCount: number;
};

const MAX_QUEUE_BATCH_SIZE = 10;
const BASE_RETRY_DELAY_MS = 5_000;
const MAX_RETRY_DELAY_MS = 15 * 60 * 1000;

let queueState: RemoteProductCacheWriteQueueItem[] | null = null;
let hydratePromise: Promise<RemoteProductCacheWriteQueueItem[]> | null = null;
let flushPromise: Promise<number> | null = null;
let appStateSubscription: NativeEventSubscription | null = null;
let lifecycleAttached = false;
let lastFlushAt: string | null = null;
let lastFlushReason: QueueFlushReason | null = null;
let lastFlushError: string | null = null;
let consecutiveFailureCount = 0;

const nowIso = (): string => new Date().toISOString();

const createQueueItemId = (): string => {
  return `rpcw_${Date.now().toString(36)}_${Math.random()
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
  const exponent = Math.max(0, attemptCount - 1);
  return Math.min(BASE_RETRY_DELAY_MS * 2 ** exponent, MAX_RETRY_DELAY_MS);
};

const canAcceptWrites = (): boolean => {
  return FEATURES.productRepository.firestoreWriteEnabled;
};

const canFlushWrites = (): boolean => {
  if (!canAcceptWrites()) {
    return false;
  }

  if (!FEATURES.firebase.runtimeValidationEnabled) {
    return true;
  }

  if (!FEATURES.firebase.sharedCacheWriteValidationEnabled) {
    return true;
  }

  return isFirebaseServicesReady();
};

const persistQueue = async (
  items: RemoteProductCacheWriteQueueItem[]
): Promise<void> => {
  queueState = items;

  const payload: PersistedQueueShape = {
    version: 1,
    items,
  };

  await AsyncStorage.setItem(
    REMOTE_PRODUCT_CACHE_WRITE_QUEUE_STORAGE_KEY,
    JSON.stringify(payload)
  );
};

const hydrateQueue = async (): Promise<RemoteProductCacheWriteQueueItem[]> => {
  if (queueState) {
    return queueState;
  }

  if (hydratePromise) {
    return hydratePromise;
  }

  hydratePromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(
        REMOTE_PRODUCT_CACHE_WRITE_QUEUE_STORAGE_KEY
      );

      if (!raw) {
        queueState = [];
        return queueState;
      }

      const parsed = JSON.parse(raw) as Partial<PersistedQueueShape>;

      if (!Array.isArray(parsed.items)) {
        queueState = [];
        return queueState;
      }

      queueState = parsed.items.filter(
        (item): item is RemoteProductCacheWriteQueueItem =>
          Boolean(
            item &&
              typeof item === 'object' &&
              typeof item.id === 'string' &&
              typeof item.barcode === 'string' &&
              (item.kind === 'found' || item.kind === 'not_found')
          )
      );

      return queueState;
    } catch (error) {
      console.warn('[RemoteWriteQueue] hydrate failed:', error);
      queueState = [];
      return queueState;
    } finally {
      hydratePromise = null;
    }
  })();

  return hydratePromise;
};

const upsertQueueItem = (
  items: RemoteProductCacheWriteQueueItem[],
  nextItem: RemoteProductCacheWriteQueueItem
): RemoteProductCacheWriteQueueItem[] => {
  const filtered = items.filter((item) => item.barcode !== nextItem.barcode);
  return [nextItem, ...filtered].sort((left, right) => {
    return left.nextAttemptAt - right.nextAttemptAt;
  });
};

const writeFoundItem = async (
  item: FoundQueueItem,
  now: number
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
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

const writeNotFoundItem = async (
  item: NotFoundQueueItem,
  now: number
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
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

const flushInternal = async (reason: QueueFlushReason): Promise<number> => {
  const items = await hydrateQueue();

  lastFlushReason = reason;

  if (!items.length) {
    lastFlushAt = nowIso();
    lastFlushError = null;
    consecutiveFailureCount = 0;
    return 0;
  }

  if (!canFlushWrites()) {
    lastFlushAt = nowIso();
    lastFlushError = 'firebase_runtime_not_ready';
    return 0;
  }

  const now = Date.now();
  const eligibleItems = items
    .filter((item) => item.nextAttemptAt <= now)
    .slice(0, MAX_QUEUE_BATCH_SIZE);

  if (!eligibleItems.length) {
    lastFlushAt = nowIso();
    lastFlushError = null;
    return 0;
  }

  let nextQueue = [...items];
  let flushedCount = 0;

  for (const item of eligibleItems) {
    try {
      if (item.kind === 'found') {
        await writeFoundItem(item, now);
      } else {
        await writeNotFoundItem(item, now);
      }

      nextQueue = nextQueue.filter((queued) => queued.id !== item.id);
      flushedCount += 1;
      lastFlushError = null;
      consecutiveFailureCount = 0;
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      const updatedItem: RemoteProductCacheWriteQueueItem =
        item.kind === 'found'
          ? {
              ...item,
              attemptCount: item.attemptCount + 1,
              nextAttemptAt: now + getRetryDelayMs(item.attemptCount + 1),
              lastAttemptAt: nowIso(),
              lastError: errorMessage,
              updatedAt: nowIso(),
            }
          : {
              ...item,
              attemptCount: item.attemptCount + 1,
              nextAttemptAt: now + getRetryDelayMs(item.attemptCount + 1),
              lastAttemptAt: nowIso(),
              lastError: errorMessage,
              updatedAt: nowIso(),
            };

      nextQueue = nextQueue.map((queued) =>
        queued.id === item.id ? updatedItem : queued
      );
      lastFlushError = errorMessage;
      consecutiveFailureCount += 1;
      console.warn('[RemoteWriteQueue] flush item failed:', error);
      break;
    }
  }

  await persistQueue(nextQueue);
  lastFlushAt = nowIso();

  return flushedCount;
};

const handleAppStateChange = (nextState: AppStateStatus): void => {
  if (nextState === 'active') {
    void flushRemoteProductCacheWriteQueue({ reason: 'app_active' });
    return;
  }

  if (nextState === 'inactive') {
    void flushRemoteProductCacheWriteQueue({ reason: 'app_inactive' });
    return;
  }

  if (nextState === 'background') {
    void flushRemoteProductCacheWriteQueue({ reason: 'app_background' });
  }
};

export const initializeRemoteProductCacheWriteQueue = (): void => {
  if (lifecycleAttached) {
    return;
  }

  lifecycleAttached = true;
  void hydrateQueue();
  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
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
  if (!canAcceptWrites()) {
    return false;
  }

  const items = await hydrateQueue();
  const nextItem: FoundQueueItem = {
    id: createQueueItemId(),
    kind: 'found',
    barcode,
    product,
    ttlMs,
    enqueuedAt: nowIso(),
    updatedAt: nowIso(),
    attemptCount: 0,
    nextAttemptAt: 0,
    lastAttemptAt: null,
    lastError: null,
  };

  await persistQueue(upsertQueueItem(items, nextItem));
  void flushRemoteProductCacheWriteQueue({ reason: 'enqueue' });
  return true;
};

export const enqueueRemoteProductCacheNotFoundWrite = async ({
  barcode,
  ttlMs = CACHE_POLICY.sharedNotFoundTtlMs,
}: {
  barcode: string;
  ttlMs?: number;
}): Promise<boolean> => {
  if (!canAcceptWrites()) {
    return false;
  }

  const items = await hydrateQueue();
  const nextItem: NotFoundQueueItem = {
    id: createQueueItemId(),
    kind: 'not_found',
    barcode,
    ttlMs,
    enqueuedAt: nowIso(),
    updatedAt: nowIso(),
    attemptCount: 0,
    nextAttemptAt: 0,
    lastAttemptAt: null,
    lastError: null,
  };

  await persistQueue(upsertQueueItem(items, nextItem));
  void flushRemoteProductCacheWriteQueue({ reason: 'enqueue' });
  return true;
};

export const flushRemoteProductCacheWriteQueue = async ({
  reason = 'manual',
}: {
  reason?: QueueFlushReason;
} = {}): Promise<number> => {
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
  async (): Promise<RemoteProductCacheWriteQueueDiagnostics> => {
    const items = await hydrateQueue();
    const now = Date.now();
    const readyQueueSize = items.filter((item) => item.nextAttemptAt <= now).length;
    const blockedQueueSize = Math.max(0, items.length - readyQueueSize);
    const firebaseDiagnostics = getFirebaseServicesDiagnosticsSnapshot();

    return {
      fetchedAt: nowIso(),
      queueSize: items.length,
      readyQueueSize,
      blockedQueueSize,
      lifecycleAttached,
      runtimeReady: isFirebaseServicesReady(),
      projectId: firebaseDiagnostics.projectId,
      effectiveSource: firebaseDiagnostics.effectiveSource,
      lastFlushAt,
      lastFlushReason,
      lastFlushError,
      consecutiveFailureCount,
    };
  };

initializeRemoteProductCacheWriteQueue();
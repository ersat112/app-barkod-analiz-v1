import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppState,
  type AppStateStatus,
  type NativeEventSubscription,
} from 'react-native';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { auth, db as firestoreDb } from '../config/firebase';
import {
  FEATURES,
  REMOTE_HISTORY_SYNC_QUEUE_STORAGE_KEY,
  USER_SCAN_HISTORY_SUBCOLLECTION,
  USERS_COLLECTION,
} from '../config/features';
import { canWriteUserScanHistory } from './firebaseAccess.service';
import type { Product } from '../utils/analysis';

type CanonicalRiskLevel = 'low' | 'medium' | 'high';
type FlushReason = 'enqueue' | 'app_boot' | 'app_active' | 'app_background' | 'manual';

type HistoryRemoteSyncItem = {
  id: string;
  barcode: string;
  name: string;
  brand: string;
  imageUrl: string;
  productType: Product['type'];
  productSource: Product['sourceName'] | null;
  score: number;
  grade: string | null;
  riskLevel: CanonicalRiskLevel;
  country: string | null;
  origin: string | null;
  scannedAt: string;
  enqueuedAt: string;
  lastError: string | null;
};

type PersistedQueueState = {
  version: 1;
  items: HistoryRemoteSyncItem[];
};

const QUEUE_VERSION = 1;
const ENQUEUE_FLUSH_DELAY_MS = 15_000;
const ACTIVE_FLUSH_DELAY_MS = 5_000;

let inMemoryQueue: HistoryRemoteSyncItem[] | null = null;
let hydrationPromise: Promise<HistoryRemoteSyncItem[]> | null = null;
let flushPromise: Promise<number> | null = null;
let appStateSubscription: NativeEventSubscription | null = null;
let scheduledFlushTimeout: ReturnType<typeof setTimeout> | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function createQueueId(): string {
  return `hsq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function clearScheduledFlush(): void {
  if (!scheduledFlushTimeout) {
    return;
  }

  clearTimeout(scheduledFlushTimeout);
  scheduledFlushTimeout = null;
}

function scheduleFlush(reason: FlushReason, delayMs: number): void {
  if (scheduledFlushTimeout) {
    return;
  }

  scheduledFlushTimeout = setTimeout(() => {
    scheduledFlushTimeout = null;
    void flushHistoryRemoteSyncQueue({ reason });
  }, delayMs);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'history_remote_sync_error';
}

function normalizeRiskLevel(value?: string | null): CanonicalRiskLevel {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  if (normalized === 'yüksek' || normalized === 'high') {
    return 'high';
  }

  if (normalized === 'orta' || normalized === 'medium') {
    return 'medium';
  }

  return 'low';
}

async function persistQueue(items: HistoryRemoteSyncItem[]): Promise<void> {
  inMemoryQueue = items;

  const payload: PersistedQueueState = {
    version: QUEUE_VERSION,
    items,
  };

  await AsyncStorage.setItem(
    REMOTE_HISTORY_SYNC_QUEUE_STORAGE_KEY,
    JSON.stringify(payload)
  );
}

async function hydrateQueue(): Promise<HistoryRemoteSyncItem[]> {
  if (inMemoryQueue) {
    return inMemoryQueue;
  }

  if (hydrationPromise) {
    return hydrationPromise;
  }

  hydrationPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(REMOTE_HISTORY_SYNC_QUEUE_STORAGE_KEY);

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
        (item): item is HistoryRemoteSyncItem =>
          Boolean(
            item &&
              typeof item === 'object' &&
              typeof item.id === 'string' &&
              typeof item.barcode === 'string' &&
              typeof item.scannedAt === 'string'
          )
      );

      return inMemoryQueue;
    } catch (error) {
      console.warn('[HistoryRemoteSync] hydrate failed:', error);
      inMemoryQueue = [];
      return inMemoryQueue;
    } finally {
      hydrationPromise = null;
    }
  })();

  return hydrationPromise;
}

async function writeRemoteHistoryItem(item: HistoryRemoteSyncItem): Promise<void> {
  const uid = auth.currentUser?.uid;

  if (!uid) {
    throw new Error('history_remote_sync_auth_required');
  }

  const ref = doc(
    firestoreDb,
    USERS_COLLECTION,
    uid,
    USER_SCAN_HISTORY_SUBCOLLECTION,
    item.id
  );

  await setDoc(
    ref,
    {
      barcode: item.barcode,
      name: item.name,
      brand: item.brand,
      image_url: item.imageUrl,
      type: item.productType,
      source_name: item.productSource,
      score: item.score,
      grade: item.grade,
      risk_level: item.riskLevel,
      country: item.country,
      origin: item.origin,
      scanned_at: item.scannedAt,
      synced_at: serverTimestamp(),
      client_enqueued_at: item.enqueuedAt,
    },
    { merge: true }
  );
}

export async function flushHistoryRemoteSyncQueue(options?: {
  reason?: FlushReason;
}): Promise<number> {
  if (!FEATURES.history.firestoreSyncEnabled) {
    return 0;
  }

  clearScheduledFlush();

  if (flushPromise) {
    return flushPromise;
  }

  flushPromise = (async () => {
    const canWrite = await canWriteUserScanHistory();

    if (!canWrite) {
      return 0;
    }

    const queue = await hydrateQueue();

    if (!queue.length) {
      return 0;
    }

    const remaining: HistoryRemoteSyncItem[] = [];
    let flushedCount = 0;

    for (const item of queue) {
      try {
        await writeRemoteHistoryItem(item);
        flushedCount += 1;
      } catch (error) {
        remaining.push({
          ...item,
          lastError: `[${options?.reason ?? 'manual'}] ${toErrorMessage(error)}`,
        });
      }
    }

    await persistQueue(remaining);
    return flushedCount;
  })();

  try {
    return await flushPromise;
  } finally {
    flushPromise = null;
  }
}

export async function enqueueRemoteHistorySync(params: {
  product: Product;
  score: number;
  riskLevel?: string | null;
  scannedAt?: string;
}): Promise<boolean> {
  if (!FEATURES.history.firestoreSyncEnabled) {
    return false;
  }

  const queue = await hydrateQueue();

  const item: HistoryRemoteSyncItem = {
    id: createQueueId(),
    barcode: String(params.product.barcode || '').trim(),
    name: String(params.product.name || '').trim(),
    brand: String(params.product.brand || '').trim(),
    imageUrl: String(params.product.image_url || '').trim(),
    productType: params.product.type,
    productSource: params.product.sourceName ?? null,
    score: Number.isFinite(params.score) ? Math.round(params.score) : 0,
    grade:
      typeof params.product.grade === 'string' && params.product.grade.trim()
        ? params.product.grade.trim()
        : null,
    riskLevel: normalizeRiskLevel(params.riskLevel),
    country:
      typeof params.product.country === 'string' && params.product.country.trim()
        ? params.product.country.trim()
        : null,
    origin:
      typeof params.product.origin === 'string' && params.product.origin.trim()
        ? params.product.origin.trim()
        : null,
    scannedAt: params.scannedAt ?? nowIso(),
    enqueuedAt: nowIso(),
    lastError: null,
  };

  await persistQueue([...queue, item]);
  scheduleFlush('enqueue', ENQUEUE_FLUSH_DELAY_MS);
  return true;
}

export function initializeHistoryRemoteSyncQueue(): void {
  if (appStateSubscription) {
    return;
  }

  appStateSubscription = AppState.addEventListener(
    'change',
    (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        scheduleFlush('app_active', ACTIVE_FLUSH_DELAY_MS);
      }

      if (nextState === 'background') {
        clearScheduledFlush();
        void flushHistoryRemoteSyncQueue({ reason: 'app_background' });
      }
    }
  );
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

import { db } from '../config/firebase';
import {
  ANALYTICS_EVENTS_COLLECTION,
  ANALYTICS_INSTALLATION_ID_STORAGE_KEY,
  ANALYTICS_QUEUE_STORAGE_KEY,
  FEATURES,
} from '../config/features';
import type {
  AnalyticsEventName,
  AnalyticsEventPayload,
  AnalyticsEventRecord,
  AnalyticsQueueState,
} from '../types/ads';
import type {
  ProductRepositoryCacheTier,
  ProductRepositoryLookupMeta,
  ProductRepositorySource,
} from '../types/productRepository';

const QUEUE_SCHEMA_VERSION = 1;
const MAX_QUEUE_LENGTH = 100;

let flushPromise: Promise<number> | null = null;
let installationIdPromise: Promise<string> | null = null;

const sessionId = createId('session');

function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function log(...args: unknown[]) {
  if (FEATURES.ads.diagnosticsLoggingEnabled) {
    console.log('[Analytics]', ...args);
  }
}

function warn(...args: unknown[]) {
  if (FEATURES.ads.diagnosticsLoggingEnabled) {
    console.warn('[Analytics]', ...args);
  }
}

function normalizeRecord(raw: unknown): AnalyticsEventRecord | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const value = raw as Partial<AnalyticsEventRecord>;

  if (
    typeof value.eventId !== 'string' ||
    !value.eventId.trim() ||
    typeof value.eventName !== 'string' ||
    !value.eventName.trim() ||
    typeof value.createdAt !== 'number' ||
    !Number.isFinite(value.createdAt)
  ) {
    return null;
  }

  return {
    eventId: value.eventId,
    eventName: value.eventName as AnalyticsEventName,
    createdAt: value.createdAt,
    payload:
      value.payload && typeof value.payload === 'object'
        ? value.payload
        : {},
  };
}

async function getOrCreateInstallationId(): Promise<string> {
  if (installationIdPromise) {
    return installationIdPromise;
  }

  installationIdPromise = (async () => {
    try {
      const existing = await AsyncStorage.getItem(
        ANALYTICS_INSTALLATION_ID_STORAGE_KEY
      );

      if (existing && existing.trim()) {
        return existing.trim();
      }

      const nextId = createId('installation');
      await AsyncStorage.setItem(ANALYTICS_INSTALLATION_ID_STORAGE_KEY, nextId);
      return nextId;
    } catch (error) {
      warn('getOrCreateInstallationId failed, using ephemeral id:', error);
      return createId('installation_ephemeral');
    }
  })();

  return installationIdPromise;
}

async function readQueueState(): Promise<AnalyticsQueueState> {
  const installationId = await getOrCreateInstallationId();

  try {
    const raw = await AsyncStorage.getItem(ANALYTICS_QUEUE_STORAGE_KEY);

    if (!raw) {
      return {
        schemaVersion: QUEUE_SCHEMA_VERSION,
        installationId,
        sessionId,
        items: [],
      };
    }

    const parsed = JSON.parse(raw) as Partial<AnalyticsQueueState>;

    const items = Array.isArray(parsed.items)
      ? parsed.items
          .map((item) => normalizeRecord(item))
          .filter((item): item is AnalyticsEventRecord => item != null)
      : [];

    return {
      schemaVersion: QUEUE_SCHEMA_VERSION,
      installationId:
        typeof parsed.installationId === 'string' && parsed.installationId.trim()
          ? parsed.installationId.trim()
          : installationId,
      sessionId,
      items: items.slice(-MAX_QUEUE_LENGTH),
    };
  } catch (error) {
    warn('readQueueState failed, queue reset:', error);
    return {
      schemaVersion: QUEUE_SCHEMA_VERSION,
      installationId,
      sessionId,
      items: [],
    };
  }
}

async function writeQueueState(state: AnalyticsQueueState): Promise<void> {
  try {
    await AsyncStorage.setItem(
      ANALYTICS_QUEUE_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: QUEUE_SCHEMA_VERSION,
        installationId: state.installationId,
        sessionId,
        items: state.items.slice(-MAX_QUEUE_LENGTH),
      })
    );
  } catch (error) {
    warn('writeQueueState failed:', error);
  }
}

async function enqueueEvent(record: AnalyticsEventRecord): Promise<void> {
  const state = await readQueueState();

  const nextState: AnalyticsQueueState = {
    ...state,
    sessionId,
    items: [...state.items, record].slice(-MAX_QUEUE_LENGTH),
  };

  await writeQueueState(nextState);
}

function getEnvironmentLabel(): 'development' | 'production' {
  return __DEV__ ? 'development' : 'production';
}

export const analyticsService = {
  async track(
    eventName: AnalyticsEventName,
    payload: AnalyticsEventPayload = {},
    options?: { flush?: boolean }
  ): Promise<string> {
    if (
      !FEATURES.ads.localAnalyticsQueueEnabled &&
      !FEATURES.ads.firestoreAnalyticsEnabled
    ) {
      return '';
    }

    const installationId = await getOrCreateInstallationId();

    const record: AnalyticsEventRecord = {
      eventId: createId('evt'),
      eventName,
      createdAt: Date.now(),
      payload: {
        ...payload,
        installationId,
        sessionId,
        platform: Platform.OS,
        environment: getEnvironmentLabel(),
      },
    };

    await enqueueEvent(record);

    if (options?.flush !== false) {
      await this.flushPending();
    }

    return record.eventId;
  },

  async trackProductLookupResolved(payload: {
    barcode: string;
    found: boolean;
    reason?: 'invalid_barcode' | 'not_found';
    source?: ProductRepositorySource;
    cacheTier?: ProductRepositoryCacheTier;
    lookupMeta: ProductRepositoryLookupMeta;
    productType?: string;
    productScore?: number;
  }): Promise<string> {
    return this.track(
      'product_lookup_resolved',
      {
        barcode: payload.barcode,
        found: payload.found,
        reason: payload.reason,
        source: payload.source,
        cacheTier: payload.cacheTier,
        lookupId: payload.lookupMeta.lookupId,
        durationMs: payload.lookupMeta.durationMs,
        normalizedBarcode: payload.lookupMeta.normalizedBarcode,
        resolvedSource: payload.lookupMeta.resolvedSource,
        remoteMode: payload.lookupMeta.remoteMode,
        productType: payload.productType,
        productScore: payload.productScore,
      },
      { flush: false }
    );
  },

  async trackProductDetailViewed(payload: {
    barcode: string;
    source?: 'food' | 'beauty' | 'cache';
    cacheTier?: ProductRepositoryCacheTier;
    lookupMeta?: ProductRepositoryLookupMeta;
    productType?: string;
    productScore?: number;
  }): Promise<string> {
    return this.track(
      'product_detail_viewed',
      {
        barcode: payload.barcode,
        source: payload.source,
        cacheTier: payload.cacheTier,
        lookupId: payload.lookupMeta?.lookupId,
        durationMs: payload.lookupMeta?.durationMs,
        normalizedBarcode: payload.lookupMeta?.normalizedBarcode,
        resolvedSource: payload.lookupMeta?.resolvedSource,
        remoteMode: payload.lookupMeta?.remoteMode,
        productType: payload.productType,
        productScore: payload.productScore,
      },
      { flush: false }
    );
  },

  async flushPending(): Promise<number> {
    if (!FEATURES.ads.firestoreAnalyticsEnabled) {
      return 0;
    }

    if (flushPromise) {
      return flushPromise;
    }

    flushPromise = (async () => {
      const state = await readQueueState();

      if (!state.items.length) {
        return 0;
      }

      let sentCount = 0;
      let remainingItems: AnalyticsEventRecord[] = [];

      for (let index = 0; index < state.items.length; index += 1) {
        const item = state.items[index];

        try {
          await addDoc(collection(db, ANALYTICS_EVENTS_COLLECTION), {
            eventId: item.eventId,
            eventName: item.eventName,
            installationId: state.installationId,
            sessionId: state.sessionId,
            platform: Platform.OS,
            environment: getEnvironmentLabel(),
            clientCreatedAt: item.createdAt,
            receivedAt: serverTimestamp(),
            payload: item.payload,
          });

          sentCount += 1;
        } catch (error) {
          remainingItems = state.items.slice(index);
          warn('flushPending failed, preserving remaining queue:', error);
          break;
        }
      }

      await writeQueueState({
        ...state,
        sessionId,
        items: remainingItems,
      });

      if (sentCount > 0) {
        log(`flushPending sent ${sentCount} event(s)`);
      }

      return sentCount;
    })();

    try {
      return await flushPromise;
    } finally {
      flushPromise = null;
    }
  },

  async getQueueSize(): Promise<number> {
    const state = await readQueueState();
    return state.items.length;
  },

  async resetQueue(): Promise<void> {
    try {
      await AsyncStorage.removeItem(ANALYTICS_QUEUE_STORAGE_KEY);
    } catch (error) {
      warn('resetQueue failed:', error);
    }
  },
};
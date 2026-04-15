import { initializeAdMob } from './admobRuntime';
import { adService } from './adService';
import { analyticsService } from './analytics.service';
import { auth } from '../config/firebase';
import { initDatabase } from './db';
import { getFirebaseAccessSnapshot } from './firebaseAccess.service';
import { resolveFirestoreRuntimeConfig } from './firestoreRuntimeConfig.service';
import { resolveMarketGelsinRuntimeConfig } from './marketGelsinRuntimeConfig.service';
import {
  flushHistoryRemoteSyncQueue,
  initializeHistoryRemoteSyncQueue,
} from './historyRemoteSync.service';
import {
  flushPendingMissingProductDrafts,
  initializeMissingProductDraftSync,
} from './missingProductSync.service';
import {
  flushRemoteProductCacheWriteQueue,
  initializeRemoteProductCacheWriteQueue,
} from './productRemoteWriteQueue.service';
import { prewarmPriceCompareRootCategories } from './priceCompareWarmup.service';

export type AppBootstrapSnapshot = {
  fetchedAt: string;
  localBootstrapCompleted: boolean;
  databaseReady: boolean;
  queueLifecycleAttached: boolean;
  admobInitialized: boolean;
  isAuthenticated: boolean;
  authUid: string | null;
  firestoreRuntimeConfigResolved: boolean;
  sharedCacheFlushCount: number;
  analyticsFlushCount: number;
  adPolicySynced: boolean;
  marketGelsinRuntimeResolved: boolean;
  lastError: string | null;
};

let localBootstrapCompleted = false;
let localBootstrapPromise: Promise<AppBootstrapSnapshot> | null = null;
let authBootstrapPromise: Promise<AppBootstrapSnapshot> | null = null;
let lastSnapshot: AppBootstrapSnapshot | null = null;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'unknown_app_bootstrap_error';
}

function createSnapshot(
  overrides?: Partial<AppBootstrapSnapshot>
): AppBootstrapSnapshot {
  return {
    fetchedAt: new Date().toISOString(),
    localBootstrapCompleted,
    databaseReady: localBootstrapCompleted,
    queueLifecycleAttached: localBootstrapCompleted,
    admobInitialized: false,
    isAuthenticated: Boolean(auth.currentUser?.uid),
    authUid: auth.currentUser?.uid ?? null,
    firestoreRuntimeConfigResolved: false,
    sharedCacheFlushCount: 0,
    analyticsFlushCount: 0,
    adPolicySynced: false,
    marketGelsinRuntimeResolved: false,
    lastError: null,
    ...overrides,
  };
}

export const ensureAppBootstrap = async (): Promise<AppBootstrapSnapshot> => {
  if (localBootstrapCompleted && lastSnapshot) {
    return {
      ...lastSnapshot,
      fetchedAt: new Date().toISOString(),
    };
  }

  if (localBootstrapPromise) {
    return localBootstrapPromise;
  }

  localBootstrapPromise = (async () => {
    try {
      initDatabase();
      initializeRemoteProductCacheWriteQueue();
      initializeHistoryRemoteSyncQueue();
      initializeMissingProductDraftSync();
      const admobInitialized = await initializeAdMob();
      await resolveMarketGelsinRuntimeConfig({
        allowStale: true,
      });
      void prewarmPriceCompareRootCategories({
        allowStale: true,
      });

      localBootstrapCompleted = true;
      lastSnapshot = createSnapshot({
        localBootstrapCompleted: true,
        databaseReady: true,
        queueLifecycleAttached: true,
        admobInitialized,
        marketGelsinRuntimeResolved: true,
      });

      console.log('[AppBootstrap] local bootstrap completed', lastSnapshot);

      return lastSnapshot;
    } catch (error) {
      localBootstrapCompleted = false;
      lastSnapshot = createSnapshot({
        localBootstrapCompleted: false,
        databaseReady: false,
        queueLifecycleAttached: false,
        lastError: toErrorMessage(error),
      });

      console.log('[AppBootstrap] local bootstrap failed', error);

      return lastSnapshot;
    } finally {
      localBootstrapPromise = null;
    }
  })();

  return localBootstrapPromise;
};

export const runAuthenticatedAppBootstrap = async (options?: {
  forceRefresh?: boolean;
}): Promise<AppBootstrapSnapshot> => {
  if (authBootstrapPromise) {
    return authBootstrapPromise;
  }

  authBootstrapPromise = (async () => {
    const baseSnapshot = await ensureAppBootstrap();

    try {
      const isAuthenticated = Boolean(auth.currentUser?.uid);

      if (!isAuthenticated) {
        lastSnapshot = {
          ...baseSnapshot,
          fetchedAt: new Date().toISOString(),
          isAuthenticated: false,
        authUid: null,
        firestoreRuntimeConfigResolved: false,
        sharedCacheFlushCount: 0,
        analyticsFlushCount: 0,
        adPolicySynced: false,
        marketGelsinRuntimeResolved: baseSnapshot.marketGelsinRuntimeResolved,
        lastError: null,
      };

        return lastSnapshot;
      }

      await resolveFirestoreRuntimeConfig({
        forceRefresh: Boolean(options?.forceRefresh),
        allowStale: !options?.forceRefresh,
      });
      await resolveMarketGelsinRuntimeConfig({
        forceRefresh: Boolean(options?.forceRefresh),
        allowStale: !options?.forceRefresh,
      });

      const accessSnapshot = await getFirebaseAccessSnapshot();

      const sharedCacheFlushCount = accessSnapshot.sharedCacheWriteAllowed
        ? await flushRemoteProductCacheWriteQueue({
            reason: 'app_boot',
          })
        : 0;

      if (accessSnapshot.historyWriteAllowed) {
        await flushHistoryRemoteSyncQueue({
          reason: 'app_boot',
        });
      }

      if (accessSnapshot.missingProductContributionWriteAllowed) {
        await flushPendingMissingProductDrafts({
          reason: 'app_boot',
        });
      }

      const analyticsFlushCount = await analyticsService.flushPending();

      let adPolicySynced = false;

      if (accessSnapshot.adPolicyReadAllowed) {
        await adService.syncRemotePolicy(Boolean(options?.forceRefresh));
        adPolicySynced = true;
      }

      lastSnapshot = {
        ...baseSnapshot,
        fetchedAt: new Date().toISOString(),
        isAuthenticated: true,
        authUid: auth.currentUser?.uid ?? null,
        firestoreRuntimeConfigResolved: true,
        sharedCacheFlushCount,
        analyticsFlushCount,
        adPolicySynced,
        marketGelsinRuntimeResolved: true,
        lastError: null,
      };

      console.log('[AppBootstrap] authenticated bootstrap completed', lastSnapshot);

      return lastSnapshot;
    } catch (error) {
      lastSnapshot = {
        ...baseSnapshot,
        fetchedAt: new Date().toISOString(),
        isAuthenticated: Boolean(auth.currentUser?.uid),
        authUid: auth.currentUser?.uid ?? null,
        lastError: toErrorMessage(error),
      };

      console.log('[AppBootstrap] authenticated bootstrap failed', error);

      return lastSnapshot;
    } finally {
      authBootstrapPromise = null;
    }
  })();

  return authBootstrapPromise;
};

export const getLastAppBootstrapSnapshot = (): AppBootstrapSnapshot | null => {
  return lastSnapshot;
};

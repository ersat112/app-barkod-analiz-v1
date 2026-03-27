import {
  AppState,
  type AppStateStatus,
  type NativeEventSubscription,
} from 'react-native';

import { auth } from '../config/firebase';
import { FEATURES } from '../config/features';
import { canWriteMissingProductContributions } from './firebaseAccess.service';
import { syncMissingProductDraftToFirestore } from './missingProductContribution.service';
import { getMissingProductDrafts } from './missingProductDraft.service';

type FlushReason = 'app_boot' | 'app_active' | 'app_background' | 'manual';

let flushPromise: Promise<number> | null = null;
let appStateSubscription: NativeEventSubscription | null = null;
let scheduledFlushTimeout: ReturnType<typeof setTimeout> | null = null;

const ACTIVE_FLUSH_DELAY_MS = 8_000;

const clearScheduledFlush = (): void => {
  if (!scheduledFlushTimeout) {
    return;
  }

  clearTimeout(scheduledFlushTimeout);
  scheduledFlushTimeout = null;
};

const scheduleFlush = (reason: FlushReason, delayMs: number): void => {
  if (scheduledFlushTimeout) {
    return;
  }

  scheduledFlushTimeout = setTimeout(() => {
    scheduledFlushTimeout = null;
    void flushPendingMissingProductDrafts({ reason });
  }, delayMs);
};

const shouldSyncDraft = (status?: string, queueStatus?: string): boolean => {
  return status !== 'synced' || queueStatus !== 'synced_remote';
};

export async function flushPendingMissingProductDrafts(options?: {
  reason?: FlushReason;
}): Promise<number> {
  if (!FEATURES.missingProduct.firestoreContributionSyncEnabled) {
    return 0;
  }

  clearScheduledFlush();

  if (flushPromise) {
    return flushPromise;
  }

  flushPromise = (async () => {
    if (!auth.currentUser?.uid) {
      return 0;
    }

    const canWrite = await canWriteMissingProductContributions();

    if (!canWrite) {
      return 0;
    }

    const drafts = await getMissingProductDrafts();
    const pendingDrafts = drafts
      .filter((draft) =>
        shouldSyncDraft(draft.status, draft.review_queue_status)
      )
      .sort(
        (left, right) =>
          new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
      );

    if (!pendingDrafts.length) {
      return 0;
    }

    let syncedCount = 0;

    for (const draft of pendingDrafts) {
      try {
        const result = await syncMissingProductDraftToFirestore(draft);

        if (result.status === 'synced') {
          syncedCount += 1;
        }
      } catch (error) {
        console.warn(
          `[MissingProductSync] flush failed (${options?.reason ?? 'manual'}):`,
          error
        );
        break;
      }
    }

    return syncedCount;
  })();

  try {
    return await flushPromise;
  } finally {
    flushPromise = null;
  }
}

export function initializeMissingProductDraftSync(): void {
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
        void flushPendingMissingProductDrafts({ reason: 'app_background' });
      }
    }
  );
}

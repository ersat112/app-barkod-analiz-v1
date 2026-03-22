import { Platform } from 'react-native';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import {
  FEATURES,
  MISSING_PRODUCT_CONTRIBUTIONS_COLLECTION,
} from '../config/features';
import { db as firestoreDb } from '../config/firebase';
import { analyticsService } from './analytics.service';
import {
  normalizeMissingProductBarcode,
  updateMissingProductDraft,
  type MissingProductDraft,
} from './missingProductDraft.service';

export type MissingProductSyncResult =
  | {
      status: 'synced';
      docId: string;
    }
  | {
      status: 'queued';
      docId?: string;
      error?: string;
    };

const safeText = (value?: string | null): string => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
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

const buildFirestoreDocId = (draft: MissingProductDraft): string => {
  const normalizedBarcode = normalizeMissingProductBarcode(draft.barcode);
  return safeText(draft.firestore_doc_id) || `${normalizedBarcode}_${draft.localId}`;
};

export const syncMissingProductDraftToFirestore = async (
  draft: MissingProductDraft
): Promise<MissingProductSyncResult> => {
  const syncAttemptAt = new Date().toISOString();
  const docId = buildFirestoreDocId(draft);

  if (!FEATURES.missingProduct.firestoreContributionSyncEnabled) {
    await updateMissingProductDraft(draft.localId, {
      status: 'queued',
      firestore_doc_id: docId,
      last_sync_attempt_at: syncAttemptAt,
      sync_error: 'sync_disabled',
      review_status: 'pending',
      review_queue_status: 'local_draft',
    });

    await analyticsService.track(
      'missing_product_draft_sync_failed',
      {
        barcode: normalizeMissingProductBarcode(draft.barcode),
        localId: draft.localId,
        docId,
        type: draft.type,
        entryPoint: draft.entry_point,
        reviewStatus: 'pending',
        reviewQueueStatus: 'local_draft',
        error: 'sync_disabled',
      },
      { flush: false }
    );

    return {
      status: 'queued',
      docId,
      error: 'sync_disabled',
    };
  }

  try {
    const ref = doc(
      firestoreDb,
      MISSING_PRODUCT_CONTRIBUTIONS_COLLECTION,
      docId
    );

    const payload = stripUndefinedDeep({
      localId: draft.localId,
      barcode: normalizeMissingProductBarcode(draft.barcode),
      name: safeText(draft.name),
      brand: safeText(draft.brand),
      country: safeText(draft.country),
      origin: safeText(draft.origin),
      ingredients_text: safeText(draft.ingredients_text),
      notes: safeText(draft.notes),
      type: draft.type,
      source: 'mobile_app',
      source_screen: draft.source_screen,
      entry_point: draft.entry_point,
      review_status: 'pending',
      review_queue_status: 'queued_remote',
      moderation_state: 'pending_review',
      moderation_version: 1,
      contribution_version: 1,
      platform: Platform.OS,
      client_created_at: draft.created_at,
      client_updated_at: draft.updated_at,
      client_last_sync_attempt_at: syncAttemptAt,
      local_status: draft.status,
      submitted_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    await setDoc(ref, payload, { merge: true });

    await updateMissingProductDraft(draft.localId, {
      status: 'synced',
      firestore_doc_id: docId,
      last_sync_attempt_at: syncAttemptAt,
      last_synced_at: new Date().toISOString(),
      sync_error: '',
      review_status: 'pending',
      review_queue_status: 'synced_remote',
    });

    await analyticsService.track(
      'missing_product_draft_sync_succeeded',
      {
        barcode: normalizeMissingProductBarcode(draft.barcode),
        localId: draft.localId,
        docId,
        type: draft.type,
        entryPoint: draft.entry_point,
        reviewStatus: 'pending',
        reviewQueueStatus: 'synced_remote',
      },
      { flush: false }
    );

    return {
      status: 'synced',
      docId,
    };
  } catch (error: any) {
    const errorMessage =
      typeof error?.message === 'string' && error.message.trim()
        ? error.message
        : 'firestore_sync_failed';

    console.warn('[MissingProductContribution] sync failed:', error);

    await updateMissingProductDraft(draft.localId, {
      status: 'queued',
      firestore_doc_id: docId,
      last_sync_attempt_at: syncAttemptAt,
      sync_error: errorMessage,
      review_status: 'pending',
      review_queue_status: 'local_draft',
    });

    await analyticsService.track(
      'missing_product_draft_sync_failed',
      {
        barcode: normalizeMissingProductBarcode(draft.barcode),
        localId: draft.localId,
        docId,
        type: draft.type,
        entryPoint: draft.entry_point,
        reviewStatus: 'pending',
        reviewQueueStatus: 'local_draft',
        error: errorMessage,
      },
      { flush: false }
    );

    return {
      status: 'queued',
      docId,
      error: errorMessage,
    };
  }
};
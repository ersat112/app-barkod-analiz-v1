import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import {
  FEATURES,
  MISSING_PRODUCT_CONTRIBUTIONS_COLLECTION,
} from '../config/features';
import { db as firestoreDb } from '../config/firebase';
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
    });

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
      client_created_at: draft.created_at,
      client_updated_at: draft.updated_at,
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
    });

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
    });

    return {
      status: 'queued',
      docId,
      error: errorMessage,
    };
  }
};
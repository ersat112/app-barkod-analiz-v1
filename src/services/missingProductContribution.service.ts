import { Platform } from 'react-native';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import {
  FEATURES,
  MISSING_PRODUCT_CONTRIBUTIONS_COLLECTION,
} from '../config/features';
import { auth, db as firestoreDb } from '../config/firebase';
import { analyticsService } from './analytics.service';
import { canWriteMissingProductContributions } from './firebaseAccess.service';
import {
  normalizeMissingProductBarcode,
  updateMissingProductDraft,
  type MissingProductDraft,
} from './missingProductDraft.service';
import { storageService } from './storageService';

export type MissingProductSyncResult =
  | {
      status: 'synced';
      docId: string;
      imageStatus: 'none' | 'uploaded';
    }
  | {
      status: 'queued';
      docId?: string;
      error?: string;
      imageStatus?: 'none' | 'pending_upload' | 'upload_failed';
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

const resolveDraftImageSync = async (draft: MissingProductDraft): Promise<{
  imageUrl?: string;
  imageStatus: 'none' | 'pending_upload' | 'uploaded' | 'upload_failed';
  imageError?: string;
}> => {
  const existingImageUrl = safeText(draft.image_url);

  if (existingImageUrl) {
    return {
      imageUrl: existingImageUrl,
      imageStatus: 'uploaded',
    };
  }

  const localImageUri = safeText(draft.image_local_uri);

  if (!localImageUri) {
    return {
      imageStatus: 'none',
    };
  }

  const uploadedImageUrl = await storageService.uploadMissingProductImage(
    localImageUri,
    normalizeMissingProductBarcode(draft.barcode)
  );

  if (!uploadedImageUrl) {
    return {
      imageStatus: 'upload_failed',
      imageError: 'missing_product_image_upload_failed',
    };
  }

  return {
    imageUrl: uploadedImageUrl,
    imageStatus: 'uploaded',
  };
};

const markDraftQueued = async (params: {
  draft: MissingProductDraft;
  docId: string;
  syncAttemptAt: string;
  error: string;
  imageUrl?: string;
  imageStatus?: 'none' | 'pending_upload' | 'uploaded' | 'upload_failed';
  imageError?: string;
}): Promise<MissingProductSyncResult> => {
  await updateMissingProductDraft(params.draft.localId, {
    status: 'queued',
    firestore_doc_id: params.docId,
    last_sync_attempt_at: params.syncAttemptAt,
    sync_error: params.error,
    review_status: 'pending',
    review_queue_status: 'local_draft',
    image_url: params.imageUrl,
    image_status: params.imageStatus,
    image_upload_error: params.imageError,
  });

  await analyticsService.track(
    'missing_product_draft_sync_failed',
    {
      barcode: normalizeMissingProductBarcode(params.draft.barcode),
      localId: params.draft.localId,
      docId: params.docId,
      type: params.draft.type,
      entryPoint: params.draft.entry_point,
      reviewStatus: 'pending',
      reviewQueueStatus: 'local_draft',
      error: params.error,
    },
    { flush: false }
  );

  return {
    status: 'queued',
    docId: params.docId,
    error: params.error,
    imageStatus:
      params.imageStatus === 'pending_upload' || params.imageStatus === 'upload_failed'
        ? params.imageStatus
        : 'none',
  };
};

export const syncMissingProductDraftToFirestore = async (
  draft: MissingProductDraft
): Promise<MissingProductSyncResult> => {
  const syncAttemptAt = new Date().toISOString();
  const docId = buildFirestoreDocId(draft);

  if (!FEATURES.missingProduct.firestoreContributionSyncEnabled) {
    return markDraftQueued({
      draft,
      docId,
      syncAttemptAt,
      error: 'sync_disabled',
    });
  }

  const authorUid = auth.currentUser?.uid ?? null;

  if (!authorUid) {
    return markDraftQueued({
      draft,
      docId,
      syncAttemptAt,
      error: 'auth_required',
    });
  }

  const canWrite = await canWriteMissingProductContributions();

  if (!canWrite) {
    return markDraftQueued({
      draft,
      docId,
      syncAttemptAt,
      error: 'missing_product_write_not_allowed',
    });
  }

  try {
    const imageSync = await resolveDraftImageSync(draft);
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
      image_url: safeText(imageSync.imageUrl),
      image_status:
        imageSync.imageStatus === 'upload_failed'
          ? 'pending_upload'
          : imageSync.imageStatus,
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
      authorUid,
      submitted_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    await setDoc(ref, payload, { merge: true });

    if (imageSync.imageStatus === 'upload_failed') {
      await updateMissingProductDraft(draft.localId, {
        status: 'queued',
        firestore_doc_id: docId,
        last_sync_attempt_at: syncAttemptAt,
        last_synced_at: new Date().toISOString(),
        sync_error: imageSync.imageError ?? 'image_upload_pending',
        review_status: 'pending',
        review_queue_status: 'queued_remote',
        image_status: 'upload_failed',
        image_upload_error: imageSync.imageError ?? 'image_upload_pending',
      });

      return {
        status: 'queued',
        docId,
        error: imageSync.imageError ?? 'image_upload_pending',
        imageStatus: 'upload_failed',
      };
    }

    await updateMissingProductDraft(draft.localId, {
      status: 'synced',
      firestore_doc_id: docId,
      last_sync_attempt_at: syncAttemptAt,
      last_synced_at: new Date().toISOString(),
      sync_error: '',
      review_status: 'pending',
      review_queue_status: 'synced_remote',
      image_url: imageSync.imageUrl,
      image_status: imageSync.imageStatus,
      image_upload_error: '',
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
      imageStatus: imageSync.imageStatus === 'uploaded' ? 'uploaded' : 'none',
    };
  } catch (error: any) {
    const errorMessage =
      typeof error?.message === 'string' && error.message.trim()
        ? error.message
        : 'firestore_sync_failed';

    console.warn('[MissingProductContribution] sync failed:', error);

    return markDraftQueued({
      draft,
      docId,
      syncAttemptAt,
      error: errorMessage,
    });
  }
};

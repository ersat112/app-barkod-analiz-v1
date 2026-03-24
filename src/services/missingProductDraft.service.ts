import AsyncStorage from '@react-native-async-storage/async-storage';

import { MISSING_PRODUCT_DRAFTS_STORAGE_KEY } from '../config/features';

export type MissingProductType = 'food' | 'beauty' | 'unknown';
export type MissingProductImageStatus =
  | 'none'
  | 'pending_upload'
  | 'uploaded'
  | 'upload_failed';
export type MissingProductDraftStatus =
  | 'draft'
  | 'queued'
  | 'synced'
  | 'sync_failed';

export type MissingProductEntryPoint = 'detail_not_found' | 'manual';
export type MissingProductReviewStatus =
  | 'pending'
  | 'approved'
  | 'rejected';
export type MissingProductReviewQueueStatus =
  | 'local_draft'
  | 'queued_remote'
  | 'synced_remote';

export type MissingProductDraft = {
  localId: string;
  barcode: string;
  name: string;
  brand: string;
  country: string;
  origin: string;
  ingredients_text: string;
  notes: string;
  type: MissingProductType;
  image_local_uri?: string;
  image_url?: string;
  image_status: MissingProductImageStatus;
  image_upload_error?: string;
  created_at: string;
  updated_at: string;
  status: MissingProductDraftStatus;
  firestore_doc_id?: string;
  last_sync_attempt_at?: string;
  last_synced_at?: string;
  sync_error?: string;
  entry_point: MissingProductEntryPoint;
  source_screen: string;
  review_status: MissingProductReviewStatus;
  review_queue_status: MissingProductReviewQueueStatus;
};

export type CreateMissingProductDraftInput = {
  barcode: string;
  name: string;
  brand: string;
  country: string;
  origin: string;
  ingredients_text: string;
  notes: string;
  type: MissingProductType;
  image_local_uri?: string;
  entry_point?: MissingProductEntryPoint;
  source_screen?: string;
};

const safeText = (value?: string | null): string => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
};

export const normalizeMissingProductBarcode = (barcode: string): string => {
  return String(barcode || '').replace(/[^\d]/g, '').trim();
};

const createLocalDraftId = (barcode: string): string => {
  const normalizedBarcode = normalizeMissingProductBarcode(barcode);
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${normalizedBarcode}_${Date.now()}_${randomPart}`;
};

const normalizeDraft = (value: unknown): MissingProductDraft | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Partial<MissingProductDraft>;
  const barcode = normalizeMissingProductBarcode(String(raw.barcode || ''));

  if (!barcode) {
    return null;
  }

  const createdAt =
    typeof raw.created_at === 'string' && raw.created_at.trim()
      ? raw.created_at
      : new Date().toISOString();

  const updatedAt =
    typeof raw.updated_at === 'string' && raw.updated_at.trim()
      ? raw.updated_at
      : createdAt;

  const rawStatus =
    typeof raw.status === 'string' ? raw.status.trim() : 'draft';

  const status: MissingProductDraftStatus =
    rawStatus === 'queued' ||
    rawStatus === 'synced' ||
    rawStatus === 'sync_failed'
      ? rawStatus
      : 'draft';

  const typeValue =
    raw.type === 'food' || raw.type === 'beauty' || raw.type === 'unknown'
      ? raw.type
      : 'unknown';

  const entryPoint: MissingProductEntryPoint =
    raw.entry_point === 'manual' ? 'manual' : 'detail_not_found';

  const reviewStatus: MissingProductReviewStatus =
    raw.review_status === 'approved' || raw.review_status === 'rejected'
      ? raw.review_status
      : 'pending';

  const reviewQueueStatus: MissingProductReviewQueueStatus =
    raw.review_queue_status === 'queued_remote' ||
    raw.review_queue_status === 'synced_remote'
      ? raw.review_queue_status
      : 'local_draft';

  const imageStatus: MissingProductImageStatus =
    raw.image_status === 'pending_upload' ||
    raw.image_status === 'uploaded' ||
    raw.image_status === 'upload_failed'
      ? raw.image_status
      : 'none';

  return {
    localId:
      typeof raw.localId === 'string' && raw.localId.trim()
        ? raw.localId
        : createLocalDraftId(barcode),
    barcode,
    name: safeText(raw.name),
    brand: safeText(raw.brand),
    country: safeText(raw.country),
    origin: safeText(raw.origin),
    ingredients_text: safeText(raw.ingredients_text),
    notes: safeText(raw.notes),
    type: typeValue,
    image_local_uri: safeText(raw.image_local_uri) || undefined,
    image_url: safeText(raw.image_url) || undefined,
    image_status: imageStatus,
    image_upload_error: safeText(raw.image_upload_error) || undefined,
    created_at: createdAt,
    updated_at: updatedAt,
    status,
    firestore_doc_id: safeText(raw.firestore_doc_id) || undefined,
    last_sync_attempt_at: safeText(raw.last_sync_attempt_at) || undefined,
    last_synced_at: safeText(raw.last_synced_at) || undefined,
    sync_error: safeText(raw.sync_error) || undefined,
    entry_point: entryPoint,
    source_screen: safeText(raw.source_screen) || 'MissingProductScreen',
    review_status: reviewStatus,
    review_queue_status: reviewQueueStatus,
  };
};

const writeDrafts = async (drafts: MissingProductDraft[]): Promise<void> => {
  await AsyncStorage.setItem(
    MISSING_PRODUCT_DRAFTS_STORAGE_KEY,
    JSON.stringify(drafts)
  );
};

export const getMissingProductDrafts = async (): Promise<MissingProductDraft[]> => {
  try {
    const raw = await AsyncStorage.getItem(MISSING_PRODUCT_DRAFTS_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    const list = Array.isArray(parsed) ? parsed : [];

    const normalized = list
      .map((item) => normalizeDraft(item))
      .filter((item): item is MissingProductDraft => item !== null)
      .sort(
        (left, right) =>
          new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
      );

    await writeDrafts(normalized);
    return normalized;
  } catch (error) {
    console.error('[MissingProductDraft] read failed:', error);
    return [];
  }
};

export const saveMissingProductDraft = async (
  input: CreateMissingProductDraftInput
): Promise<MissingProductDraft> => {
  const now = new Date().toISOString();

  const draft: MissingProductDraft = {
    localId: createLocalDraftId(input.barcode),
    barcode: normalizeMissingProductBarcode(input.barcode),
    name: safeText(input.name),
    brand: safeText(input.brand),
    country: safeText(input.country),
    origin: safeText(input.origin),
    ingredients_text: safeText(input.ingredients_text),
    notes: safeText(input.notes),
    type: input.type,
    image_local_uri: safeText(input.image_local_uri) || undefined,
    image_status: safeText(input.image_local_uri) ? 'pending_upload' : 'none',
    created_at: now,
    updated_at: now,
    status: 'draft',
    entry_point: input.entry_point === 'manual' ? 'manual' : 'detail_not_found',
    source_screen: safeText(input.source_screen) || 'MissingProductScreen',
    review_status: 'pending',
    review_queue_status: 'local_draft',
  };

  const drafts = await getMissingProductDrafts();
  const nextDrafts = [draft, ...drafts];
  await writeDrafts(nextDrafts);

  return draft;
};

export const updateMissingProductDraft = async (
  localId: string,
  patch: Partial<MissingProductDraft>
): Promise<MissingProductDraft | null> => {
  const drafts = await getMissingProductDrafts();
  const index = drafts.findIndex((item) => item.localId === localId);

  if (index < 0) {
    return null;
  }

  const current = drafts[index];
  const next: MissingProductDraft = {
    ...current,
    ...patch,
    barcode: normalizeMissingProductBarcode(
      typeof patch.barcode === 'string' ? patch.barcode : current.barcode
    ),
    entry_point: patch.entry_point === 'manual' ? 'manual' : current.entry_point,
    source_screen:
      typeof patch.source_screen === 'string' && patch.source_screen.trim()
        ? patch.source_screen.trim()
        : current.source_screen,
    review_status:
      patch.review_status === 'approved' || patch.review_status === 'rejected'
        ? patch.review_status
        : patch.review_status === 'pending'
          ? 'pending'
          : current.review_status,
    review_queue_status:
      patch.review_queue_status === 'queued_remote' ||
      patch.review_queue_status === 'synced_remote' ||
      patch.review_queue_status === 'local_draft'
        ? patch.review_queue_status
        : current.review_queue_status,
    image_local_uri:
      typeof patch.image_local_uri === 'string'
        ? safeText(patch.image_local_uri) || undefined
        : current.image_local_uri,
    image_url:
      typeof patch.image_url === 'string'
        ? safeText(patch.image_url) || undefined
        : current.image_url,
    image_status:
      patch.image_status === 'none' ||
      patch.image_status === 'pending_upload' ||
      patch.image_status === 'uploaded' ||
      patch.image_status === 'upload_failed'
        ? patch.image_status
        : current.image_status,
    image_upload_error:
      typeof patch.image_upload_error === 'string'
        ? safeText(patch.image_upload_error) || undefined
        : current.image_upload_error,
    updated_at: new Date().toISOString(),
  };

  drafts[index] = next;
  await writeDrafts(drafts);

  return next;
};

export const deleteMissingProductDraft = async (localId: string): Promise<void> => {
  const drafts = await getMissingProductDrafts();
  const nextDrafts = drafts.filter((item) => item.localId !== localId);
  await writeDrafts(nextDrafts);
};

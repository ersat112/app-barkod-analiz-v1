import AsyncStorage from '@react-native-async-storage/async-storage';

import { MISSING_PRODUCT_DRAFTS_STORAGE_KEY } from '../config/features';

export type MissingProductType = 'food' | 'beauty' | 'unknown';
export type MissingProductDraftStatus =
  | 'draft'
  | 'queued'
  | 'synced'
  | 'sync_failed';

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
  created_at: string;
  updated_at: string;
  status: MissingProductDraftStatus;
  firestore_doc_id?: string;
  last_sync_attempt_at?: string;
  last_synced_at?: string;
  sync_error?: string;
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
    created_at: createdAt,
    updated_at: updatedAt,
    status,
    firestore_doc_id: safeText(raw.firestore_doc_id) || undefined,
    last_sync_attempt_at: safeText(raw.last_sync_attempt_at) || undefined,
    last_synced_at: safeText(raw.last_synced_at) || undefined,
    sync_error: safeText(raw.sync_error) || undefined,
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
    created_at: now,
    updated_at: now,
    status: 'draft',
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
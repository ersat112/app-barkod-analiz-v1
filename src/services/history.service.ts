import { deleteHistoryEntryById, getDatabase, type HistoryEntry } from './db';

export const HISTORY_PAGE_SIZE = 20;

type HistoryRow = {
  id: number;
  barcode: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  type: string | null;
  score: number | null;
  grade: string | null;
  ingredients_text: string | null;
  country: string | null;
  origin: string | null;
  sourceName: string | null;
  created_at: string;
  updated_at: string;
};

export type HistoryPageResult = {
  items: HistoryEntry[];
  hasMore: boolean;
  nextOffset: number;
};

const db = getDatabase();

const normalizeHistoryRow = (row: HistoryRow): HistoryEntry => {
  return {
    id: row.id,
    barcode: row.barcode,
    name: row.name,
    brand: row.brand ?? '',
    image_url: row.image_url ?? '',
    type: row.type === 'beauty' ? 'beauty' : 'food',
    score: typeof row.score === 'number' ? row.score : undefined,
    grade: row.grade ?? undefined,
    ingredients_text: row.ingredients_text ?? undefined,
    country: row.country ?? undefined,
    origin: row.origin ?? undefined,
    sourceName:
      row.sourceName === 'openfoodfacts' || row.sourceName === 'openbeautyfacts'
        ? row.sourceName
        : undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

export const getHistoryPage = ({
  limit = HISTORY_PAGE_SIZE,
  offset = 0,
}: {
  limit?: number;
  offset?: number;
}): HistoryPageResult => {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const safeOffset = Math.max(0, offset);

  const rows = db.getAllSync<HistoryRow>(
    `SELECT
      id,
      barcode,
      name,
      brand,
      image_url,
      type,
      score,
      grade,
      ingredients_text,
      country,
      origin,
      source_name as sourceName,
      created_at,
      updated_at
     FROM history
     ORDER BY datetime(created_at) DESC, id DESC
     LIMIT ? OFFSET ?`,
    [safeLimit + 1, safeOffset]
  );

  const hasMore = rows.length > safeLimit;
  const sliced = hasMore ? rows.slice(0, safeLimit) : rows;

  return {
    items: sliced.map(normalizeHistoryRow),
    hasMore,
    nextOffset: safeOffset + sliced.length,
  };
};

export const removeHistoryEntry = (id: number): void => {
  deleteHistoryEntryById(id);
};
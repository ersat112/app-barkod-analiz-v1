import { deleteHistoryEntryById, getDatabase, TABLES, type HistoryEntry } from './db';

export const HISTORY_PAGE_SIZE = 20;
export type HistoryFilterType = 'all' | 'food' | 'beauty';

export type HistoryRow = {
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

export const normalizeHistoryRow = (row: HistoryRow): HistoryEntry => {
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
  query = '',
  type = 'all',
}: {
  limit?: number;
  offset?: number;
  query?: string;
  type?: HistoryFilterType;
}): HistoryPageResult => {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const safeOffset = Math.max(0, offset);
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const normalizedDigits = normalizedQuery.replace(/[^\d]/g, '');

  const whereClauses: string[] = [];
  const params: Array<string | number> = [];

  if (type === 'food' || type === 'beauty') {
    whereClauses.push(`type = ?`);
    params.push(type);
  }

  if (normalizedQuery) {
    const likeQuery = `%${normalizedQuery}%`;

    if (normalizedDigits) {
      whereClauses.push(
        `(LOWER(name) LIKE ? OR LOWER(brand) LIKE ? OR barcode LIKE ?)`
      );
      params.push(likeQuery, likeQuery, `%${normalizedDigits}%`);
    } else {
      whereClauses.push(`(LOWER(name) LIKE ? OR LOWER(brand) LIKE ?)`);
      params.push(likeQuery, likeQuery);
    }
  }

  const whereSql =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

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
     FROM ${TABLES.HISTORY}
     ${whereSql}
     ORDER BY datetime(created_at) DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit + 1, safeOffset]
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
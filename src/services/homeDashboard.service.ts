import { getDatabase, TABLES, type HistoryEntry } from './db';
import { normalizeHistoryRow, type HistoryRow } from './history.service';

type DashboardRow = {
  today_scan_count: number | null;
  today_unique_product_count: number | null;
  total_history_count: number | null;
  best_score_today: number | null;
  weekly_scan_count: number | null;
  weekly_active_day_count: number | null;
  streak_count: number | null;

  last_scanned_id: number | null;
  last_scanned_barcode: string | null;
  last_scanned_name: string | null;
  last_scanned_brand: string | null;
  last_scanned_image_url: string | null;
  last_scanned_type: string | null;
  last_scanned_score: number | null;
  last_scanned_grade: string | null;
  last_scanned_ingredients_text: string | null;
  last_scanned_country: string | null;
  last_scanned_origin: string | null;
  last_scanned_source_name: string | null;
  last_scanned_created_at: string | null;
  last_scanned_updated_at: string | null;
};

export type HomeDashboardSnapshot = {
  todayCount: number;
  todayUniqueCount: number;
  totalHistoryCount: number;
  bestScoreToday: number | null;
  weeklyScanTotal: number;
  weeklyActiveDays: number;
  streakCount: number;
  lastScannedProduct: HistoryEntry | null;
  recentProducts: HistoryEntry[];
};

const db = getDatabase();

const safeNumber = (value?: number | null, fallback = 0): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const toNullableNumber = (value?: number | null): number | null => {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const toHistoryEntry = (row: DashboardRow): HistoryEntry | null => {
  if (typeof row.last_scanned_id !== 'number') {
    return null;
  }

  return {
    id: row.last_scanned_id,
    barcode: row.last_scanned_barcode ?? '',
    name: row.last_scanned_name ?? '',
    brand: row.last_scanned_brand ?? '',
    image_url: row.last_scanned_image_url ?? '',
    type: row.last_scanned_type === 'beauty' ? 'beauty' : 'food',
    score: toNullableNumber(row.last_scanned_score) ?? undefined,
    grade: row.last_scanned_grade ?? undefined,
    ingredients_text: row.last_scanned_ingredients_text ?? undefined,
    country: row.last_scanned_country ?? undefined,
    origin: row.last_scanned_origin ?? undefined,
    sourceName:
      row.last_scanned_source_name === 'openfoodfacts' ||
      row.last_scanned_source_name === 'openbeautyfacts'
        ? row.last_scanned_source_name
        : undefined,
    created_at: row.last_scanned_created_at ?? '',
    updated_at: row.last_scanned_updated_at ?? '',
  };
};

export const getHomeDashboardSnapshot = (): HomeDashboardSnapshot => {
  const row = db.getFirstSync<DashboardRow>(`
    SELECT
      (SELECT COUNT(*) FROM ${TABLES.HISTORY} WHERE date(created_at) = date('now', 'localtime')) AS today_scan_count,
      (SELECT COUNT(DISTINCT barcode) FROM ${TABLES.HISTORY} WHERE date(created_at) = date('now', 'localtime')) AS today_unique_product_count,
      (SELECT COUNT(*) FROM ${TABLES.HISTORY}) AS total_history_count,
      (SELECT MAX(score) FROM ${TABLES.HISTORY} WHERE date(created_at) = date('now', 'localtime')) AS best_score_today,
      (SELECT COUNT(*) FROM ${TABLES.HISTORY} WHERE date(created_at) >= date('now', 'localtime', '-6 days')) AS weekly_scan_count,
      (SELECT COUNT(DISTINCT date(created_at)) FROM ${TABLES.HISTORY} WHERE date(created_at) >= date('now', 'localtime', '-6 days')) AS weekly_active_day_count,
      (
        WITH RECURSIVE streak(day, count) AS (
          SELECT date('now', 'localtime'), 1
          WHERE EXISTS (
            SELECT 1 FROM ${TABLES.HISTORY} WHERE date(created_at) = date('now', 'localtime')
          )
          UNION ALL
          SELECT date(day, '-1 day'), count + 1
          FROM streak
          WHERE EXISTS (
            SELECT 1 FROM ${TABLES.HISTORY} WHERE date(created_at) = date(day, '-1 day')
          )
        )
        SELECT COALESCE(MAX(count), 0) FROM streak
      ) AS streak_count,

      (SELECT id FROM ${TABLES.HISTORY} ORDER BY datetime(created_at) DESC, id DESC LIMIT 1) AS last_scanned_id,
      (SELECT barcode FROM ${TABLES.HISTORY} ORDER BY datetime(created_at) DESC, id DESC LIMIT 1) AS last_scanned_barcode,
      (SELECT name FROM ${TABLES.HISTORY} ORDER BY datetime(created_at) DESC, id DESC LIMIT 1) AS last_scanned_name,
      (SELECT brand FROM ${TABLES.HISTORY} ORDER BY datetime(created_at) DESC, id DESC LIMIT 1) AS last_scanned_brand,
      (SELECT image_url FROM ${TABLES.HISTORY} ORDER BY datetime(created_at) DESC, id DESC LIMIT 1) AS last_scanned_image_url,
      (SELECT type FROM ${TABLES.HISTORY} ORDER BY datetime(created_at) DESC, id DESC LIMIT 1) AS last_scanned_type,
      (SELECT score FROM ${TABLES.HISTORY} ORDER BY datetime(created_at) DESC, id DESC LIMIT 1) AS last_scanned_score,
      (SELECT grade FROM ${TABLES.HISTORY} ORDER BY datetime(created_at) DESC, id DESC LIMIT 1) AS last_scanned_grade,
      (SELECT ingredients_text FROM ${TABLES.HISTORY} ORDER BY datetime(created_at) DESC, id DESC LIMIT 1) AS last_scanned_ingredients_text,
      (SELECT country FROM ${TABLES.HISTORY} ORDER BY datetime(created_at) DESC, id DESC LIMIT 1) AS last_scanned_country,
      (SELECT origin FROM ${TABLES.HISTORY} ORDER BY datetime(created_at) DESC, id DESC LIMIT 1) AS last_scanned_origin,
      (SELECT source_name FROM ${TABLES.HISTORY} ORDER BY datetime(created_at) DESC, id DESC LIMIT 1) AS last_scanned_source_name,
      (SELECT created_at FROM ${TABLES.HISTORY} ORDER BY datetime(created_at) DESC, id DESC LIMIT 1) AS last_scanned_created_at,
      (SELECT updated_at FROM ${TABLES.HISTORY} ORDER BY datetime(created_at) DESC, id DESC LIMIT 1) AS last_scanned_updated_at
  `);

  const recentRows = db.getAllSync<HistoryRow>(
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
     ORDER BY datetime(created_at) DESC, id DESC
     LIMIT 8`
  );

  if (!row) {
    return {
      todayCount: 0,
      todayUniqueCount: 0,
      totalHistoryCount: 0,
      bestScoreToday: null,
      weeklyScanTotal: 0,
      weeklyActiveDays: 0,
      streakCount: 0,
      lastScannedProduct: null,
      recentProducts: [],
    };
  }

  return {
    todayCount: safeNumber(row.today_scan_count, 0),
    todayUniqueCount: safeNumber(row.today_unique_product_count, 0),
    totalHistoryCount: safeNumber(row.total_history_count, 0),
    bestScoreToday: toNullableNumber(row.best_score_today),
    weeklyScanTotal: safeNumber(row.weekly_scan_count, 0),
    weeklyActiveDays: safeNumber(row.weekly_active_day_count, 0),
    streakCount: safeNumber(row.streak_count, 0),
    lastScannedProduct: toHistoryEntry(row),
    recentProducts: recentRows.map(normalizeHistoryRow),
  };
};
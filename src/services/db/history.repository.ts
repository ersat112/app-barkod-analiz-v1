import type { Product } from '../../utils/analysis';
import { TABLES, getDatabase, safeNumber, safeText } from './core';
import type { BestScoreRow, CountRow, DayRow, HistoryEntry } from './types';
import type {
  HistoryFilterType,
  HistoryPageResult,
  HistoryRow,
  HomeDashboardSnapshot,
} from '../../types/history';
import {
  HISTORY_PAGE_SIZE,
  createEmptyHomeDashboardSnapshot,
} from '../../types/history';

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

const db = getDatabase();

const HISTORY_SELECT_SQL = `
  SELECT
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
`;

const toNullableNumber = (value?: number | null): number | null => {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const normalizeBarcodeList = (barcodes: string[]): string[] => {
  return Array.from(
    new Set(
      barcodes
        .map((barcode) => safeText(barcode))
        .filter((barcode) => barcode.length > 0)
    )
  );
};

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

const toLastScannedHistoryEntry = (row: DashboardRow): HistoryEntry | null => {
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

/**
 * Bugün yapılan toplam tarama sayısı.
 */
export const getTodayScanCount = (): number => {
  try {
    const result = db.getFirstSync<CountRow>(
      `SELECT COUNT(*) as count
       FROM ${TABLES.HISTORY}
       WHERE date(created_at) = date('now', 'localtime')`
    );

    return result?.count ?? 0;
  } catch (error) {
    console.error('Günlük Sayaç Hatası:', error);
    return 0;
  }
};

/**
 * Bugünkü benzersiz barkod sayısı.
 */
export const getTodayUniqueProductCount = (): number => {
  try {
    const result = db.getFirstSync<CountRow>(
      `SELECT COUNT(DISTINCT barcode) as count
       FROM ${TABLES.HISTORY}
       WHERE date(created_at) = date('now', 'localtime')`
    );

    return result?.count ?? 0;
  } catch (error) {
    console.error('Günlük Benzersiz Ürün Sayaç Hatası:', error);
    return 0;
  }
};

/**
 * Her taramayı ayrı kayıt olarak history'ye ekler.
 */
export const saveProductToHistory = (product: Product, score = 0): void => {
  try {
    db.runSync(
      `INSERT INTO ${TABLES.HISTORY} (
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
        source_name,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      [
        safeText(product.barcode),
        safeText(product.name, 'İsimsiz Ürün'),
        safeText(product.brand, 'Markasız'),
        safeText(product.image_url),
        safeText(product.type, 'food'),
        safeNumber(score, safeNumber(product.score, 0)),
        safeText(product.grade),
        safeText(product.ingredients_text),
        safeText(product.country),
        safeText(product.origin),
        safeText(product.sourceName),
      ]
    );
  } catch (error) {
    console.error('Kayıt Hatası:', error);
  }
};

/**
 * Tüm geçmiş kayıtları.
 */
export const getAllHistory = (): HistoryEntry[] => {
  try {
    const rows = db.getAllSync<HistoryRow>(
      `${HISTORY_SELECT_SQL}
       ORDER BY datetime(created_at) DESC, id DESC`
    );

    return rows.map(normalizeHistoryRow);
  } catch (error) {
    console.error('Geçmiş Okuma Hatası:', error);
    return [];
  }
};

/**
 * Barkoda ait tüm geçmiş kayıtları.
 */
export const getHistoryByBarcode = (barcode: string): HistoryEntry[] => {
  try {
    const rows = db.getAllSync<HistoryRow>(
      `${HISTORY_SELECT_SQL}
       WHERE barcode = ?
       ORDER BY datetime(created_at) DESC, id DESC`,
      [barcode]
    );

    return rows.map(normalizeHistoryRow);
  } catch (error) {
    console.error('Barkoda Göre Geçmiş Okuma Hatası:', error);
    return [];
  }
};

/**
 * Son taranan ürün.
 */
export const getLastScannedProduct = (): HistoryEntry | null => {
  try {
    const row = db.getFirstSync<HistoryRow>(
      `${HISTORY_SELECT_SQL}
       ORDER BY datetime(created_at) DESC, id DESC
       LIMIT 1`
    );

    return row ? normalizeHistoryRow(row) : null;
  } catch (error) {
    console.error('Last scanned product read error:', error);
    return null;
  }
};

/**
 * Son benzersiz ürünleri döner.
 * Aynı barkoddan sadece en son kayıt gelir.
 */
export const getRecentUniqueHistoryEntries = (limit = 6): HistoryEntry[] => {
  try {
    const safeLimit = Math.max(1, Math.min(limit, 50));

    const rows = db.getAllSync<HistoryRow>(
      `${HISTORY_SELECT_SQL}
       WHERE id IN (
         SELECT MAX(id)
         FROM ${TABLES.HISTORY}
         GROUP BY barcode
       )
       ORDER BY datetime(created_at) DESC, id DESC
       LIMIT ?`,
      [safeLimit]
    );

    return rows.map(normalizeHistoryRow);
  } catch (error) {
    console.error('Recent unique history read error:', error);
    return [];
  }
};

/**
 * Verilen barkod listesi için her barkodun en son history kaydını döner.
 * Giriş sırasını korur.
 */
export const getLatestHistoryEntriesForBarcodes = (
  barcodes: string[]
): HistoryEntry[] => {
  try {
    const normalizedBarcodes = normalizeBarcodeList(barcodes);

    if (!normalizedBarcodes.length) {
      return [];
    }

    const placeholders = normalizedBarcodes.map(() => '?').join(', ');

    const rows = db.getAllSync<HistoryRow>(
      `${HISTORY_SELECT_SQL}
       WHERE id IN (
         SELECT MAX(id)
         FROM ${TABLES.HISTORY}
         WHERE barcode IN (${placeholders})
         GROUP BY barcode
       )
       ORDER BY datetime(created_at) DESC, id DESC`,
      normalizedBarcodes
    );

    const mapped = new Map(
      rows.map((row) => {
        const entry = normalizeHistoryRow(row);
        return [entry.barcode, entry] as const;
      })
    );

    return normalizedBarcodes
      .map((barcode) => mapped.get(barcode))
      .filter((entry): entry is HistoryEntry => Boolean(entry));
  } catch (error) {
    console.error('Latest history entries for barcodes read error:', error);
    return [];
  }
};

/**
 * History list pagination/filter query
 */
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
    `${HISTORY_SELECT_SQL}
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

/**
 * Home dashboard aggregate snapshot
 */
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
    `${HISTORY_SELECT_SQL}
     ORDER BY datetime(created_at) DESC, id DESC
     LIMIT 8`
  );

  if (!row) {
    return createEmptyHomeDashboardSnapshot();
  }

  return {
    todayCount: safeNumber(row.today_scan_count, 0),
    todayUniqueCount: safeNumber(row.today_unique_product_count, 0),
    totalHistoryCount: safeNumber(row.total_history_count, 0),
    bestScoreToday: toNullableNumber(row.best_score_today),
    weeklyScanTotal: safeNumber(row.weekly_scan_count, 0),
    weeklyActiveDays: safeNumber(row.weekly_active_day_count, 0),
    streakCount: safeNumber(row.streak_count, 0),
    lastScannedProduct: toLastScannedHistoryEntry(row),
    recentProducts: recentRows.map(normalizeHistoryRow),
  };
};

/**
 * Bugünün en iyi skoru.
 */
export const getBestScoreToday = (): number | null => {
  try {
    const row = db.getFirstSync<BestScoreRow>(
      `SELECT MAX(score) as bestScore
       FROM ${TABLES.HISTORY}
       WHERE date(created_at) = date('now', 'localtime')`
    );

    return typeof row?.bestScore === 'number' ? row.bestScore : null;
  } catch (error) {
    console.error('Best score today error:', error);
    return null;
  }
};

/**
 * Son 7 gündeki toplam tarama.
 */
export const getWeeklyScanCount = (): number => {
  try {
    const row = db.getFirstSync<CountRow>(
      `SELECT COUNT(*) as count
       FROM ${TABLES.HISTORY}
       WHERE date(created_at) >= date('now', 'localtime', '-6 days')`
    );

    return row?.count ?? 0;
  } catch (error) {
    console.error('Weekly scan count error:', error);
    return 0;
  }
};

/**
 * Son 7 gündeki aktif gün sayısı.
 */
export const getWeeklyActiveDayCount = (): number => {
  try {
    const row = db.getFirstSync<CountRow>(
      `SELECT COUNT(DISTINCT date(created_at)) as count
       FROM ${TABLES.HISTORY}
       WHERE date(created_at) >= date('now', 'localtime', '-6 days')`
    );

    return row?.count ?? 0;
  } catch (error) {
    console.error('Weekly active day count error:', error);
    return 0;
  }
};

/**
 * Aralıksız günlük seri sayısı.
 */
export const getCurrentStreakDays = (): number => {
  try {
    const rows = db.getAllSync<DayRow>(
      `SELECT DISTINCT date(created_at) as day
       FROM ${TABLES.HISTORY}
       ORDER BY day DESC`
    );

    if (!rows.length) {
      return 0;
    }

    const daySet = new Set(rows.map((row) => row.day));
    let streak = 0;

    for (let index = 0; index < 365; index += 1) {
      const date = new Date();
      date.setDate(date.getDate() - index);

      const day = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;

      if (daySet.has(day)) {
        streak += 1;
      } else {
        break;
      }
    }

    return streak;
  } catch (error) {
    console.error('Current streak error:', error);
    return 0;
  }
};

/**
 * Toplam history kayıt sayısı.
 */
export const getHistoryCount = (): number => {
  try {
    const result = db.getFirstSync<CountRow>(
      `SELECT COUNT(*) as count FROM ${TABLES.HISTORY}`
    );

    return result?.count ?? 0;
  } catch (error) {
    console.error('History Count Hatası:', error);
    return 0;
  }
};

/**
 * Barkoda ait tüm kayıtları siler.
 */
export const deleteHistoryItem = (barcode: string): void => {
  try {
    db.runSync(`DELETE FROM ${TABLES.HISTORY} WHERE barcode = ?`, [barcode]);
    console.log(`${barcode} başarıyla silindi.`);
  } catch (error) {
    console.error('Silme Hatası:', error);
  }
};

/**
 * Tek bir kayıt silme.
 */
export const deleteHistoryEntryById = (id: number): void => {
  try {
    db.runSync(`DELETE FROM ${TABLES.HISTORY} WHERE id = ?`, [id]);
  } catch (error) {
    console.error('Tekil Kayıt Silme Hatası:', error);
  }
};

/**
 * Tüm geçmişi temizler.
 */
export const clearAllHistory = (): void => {
  try {
    db.runSync(`DELETE FROM ${TABLES.HISTORY}`);
  } catch (error) {
    console.error('Temizleme Hatası:', error);
  }
};
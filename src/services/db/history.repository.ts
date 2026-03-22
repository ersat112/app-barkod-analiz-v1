import type { Product } from '../../utils/analysis';
import { TABLES, getDatabase, safeNumber, safeText } from './core';
import type { BestScoreRow, CountRow, DayRow, HistoryEntry } from './types';

const db = getDatabase();

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
    return db.getAllSync<HistoryEntry>(
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
       ORDER BY datetime(created_at) DESC, id DESC`
    );
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
    return db.getAllSync<HistoryEntry>(
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
       WHERE barcode = ?
       ORDER BY datetime(created_at) DESC, id DESC`,
      [barcode]
    );
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
    const row = db.getFirstSync<HistoryEntry>(
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
       LIMIT 1`
    );

    return row ?? null;
  } catch (error) {
    console.error('Last scanned product read error:', error);
    return null;
  }
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

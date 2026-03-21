import * as SQLite from 'expo-sqlite';
import { Product } from '../utils/analysis';

/**
 * ErEnesAl® v1 - Yerel SQLite Veritabanı Yönetimi
 *
 * Not:
 * - Her tarama ayrı kayıt olarak tutulur.
 * - Aynı barkod tekrar tarandığında geçmiş ezilmez.
 * - Eski şema varsa otomatik migrate edilir.
 */

const db = SQLite.openDatabaseSync('erenesal_v1.db');

type ColumnInfo = {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

type CountRow = {
  count: number;
};

type BestScoreRow = {
  bestScore: number | null;
};

type DayRow = {
  day: string;
};

export interface HistoryEntry extends Product {
  id: number;
  created_at: string;
  updated_at: string;
}

const HISTORY_TABLE = 'history';

const safeText = (value?: string | null, fallback = ''): string =>
  typeof value === 'string' ? value.trim() || fallback : fallback;

const safeNumber = (value?: number | null, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;

const tableExists = (tableName: string): boolean => {
  const row = db.getFirstSync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [tableName]
  );

  return !!row?.name;
};

const getTableColumns = (tableName: string): ColumnInfo[] => {
  try {
    return db.getAllSync<ColumnInfo>(`PRAGMA table_info(${tableName})`);
  } catch {
    return [];
  }
};

const createHistoryTable = (): void => {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS ${HISTORY_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT NOT NULL,
      name TEXT NOT NULL,
      brand TEXT,
      image_url TEXT,
      type TEXT,
      score INTEGER,
      grade TEXT,
      ingredients_text TEXT,
      country TEXT,
      origin TEXT,
      source_name TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_history_barcode
    ON ${HISTORY_TABLE}(barcode);
  `);

  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_history_created_at
    ON ${HISTORY_TABLE}(created_at DESC);
  `);

  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_history_score
    ON ${HISTORY_TABLE}(score);
  `);
};

const migrateLegacyHistoryIfNeeded = (): void => {
  if (!tableExists(HISTORY_TABLE)) {
    createHistoryTable();
    return;
  }

  const columns = getTableColumns(HISTORY_TABLE);
  const hasId = columns.some((col) => col.name === 'id');
  const barcodeIsPrimaryKey = columns.some(
    (col) => col.name === 'barcode' && col.pk === 1
  );

  if (hasId && !barcodeIsPrimaryKey) {
    const neededColumns = [
      'ingredients_text',
      'country',
      'origin',
      'source_name',
      'updated_at',
    ];

    neededColumns.forEach((column) => {
      const exists = columns.some((col) => col.name === column);

      if (!exists) {
        switch (column) {
          case 'updated_at':
            db.execSync(
              `ALTER TABLE ${HISTORY_TABLE} ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;`
            );
            break;

          default:
            db.execSync(
              `ALTER TABLE ${HISTORY_TABLE} ADD COLUMN ${column} TEXT;`
            );
            break;
        }
      }
    });

    return;
  }

  const legacyTableName = `${HISTORY_TABLE}_legacy_${Date.now()}`;

  db.execSync(`
    ALTER TABLE ${HISTORY_TABLE} RENAME TO ${legacyTableName};
  `);

  createHistoryTable();

  const legacyColumns = getTableColumns(legacyTableName).map((col) => col.name);

  const selectParts = [
    legacyColumns.includes('barcode') ? 'barcode' : "'' AS barcode",
    legacyColumns.includes('name') ? 'name' : "'İsimsiz Ürün' AS name",
    legacyColumns.includes('brand') ? 'brand' : "'' AS brand",
    legacyColumns.includes('image_url') ? 'image_url' : "'' AS image_url",
    legacyColumns.includes('type') ? 'type' : "'food' AS type",
    legacyColumns.includes('score') ? 'score' : '0 AS score',
    legacyColumns.includes('grade') ? 'grade' : "'' AS grade",
    legacyColumns.includes('ingredients_text')
      ? 'ingredients_text'
      : "'' AS ingredients_text",
    legacyColumns.includes('country') ? 'country' : "'' AS country",
    legacyColumns.includes('origin') ? 'origin' : "'' AS origin",
    legacyColumns.includes('source_name') ? 'source_name' : "'' AS source_name",
    legacyColumns.includes('created_at')
      ? 'created_at'
      : 'CURRENT_TIMESTAMP AS created_at',
    legacyColumns.includes('updated_at')
      ? 'updated_at'
      : 'CURRENT_TIMESTAMP AS updated_at',
  ].join(', ');

  db.execSync(`
    INSERT INTO ${HISTORY_TABLE} (
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
    )
    SELECT ${selectParts}
    FROM ${legacyTableName};
  `);

  db.execSync(`DROP TABLE IF EXISTS ${legacyTableName};`);
};

/**
 * Veritabanını başlatır ve gerekiyorsa migration yapar.
 */
export const initDatabase = (): void => {
  try {
    db.execSync(`PRAGMA journal_mode = WAL;`);
    migrateLegacyHistoryIfNeeded();
    console.log('SQLite: Hazır.');
  } catch (error) {
    console.error('SQLite Başlatma Hatası:', error);
  }
};

/**
 * Bugün yapılan toplam tarama sayısı.
 */
export const getTodayScanCount = (): number => {
  try {
    const result = db.getFirstSync<CountRow>(
      `SELECT COUNT(*) as count
       FROM ${HISTORY_TABLE}
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
       FROM ${HISTORY_TABLE}
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
      `INSERT INTO ${HISTORY_TABLE} (
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
       FROM ${HISTORY_TABLE}
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
       FROM ${HISTORY_TABLE}
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
       FROM ${HISTORY_TABLE}
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
       FROM ${HISTORY_TABLE}
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
       FROM ${HISTORY_TABLE}
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
       FROM ${HISTORY_TABLE}
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
       FROM ${HISTORY_TABLE}
       ORDER BY day DESC`
    );

    if (!rows.length) return 0;

    const daySet = new Set(rows.map((row) => row.day));
    let streak = 0;

    for (let i = 0; i < 365; i += 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);

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
      `SELECT COUNT(*) as count FROM ${HISTORY_TABLE}`
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
    db.runSync(`DELETE FROM ${HISTORY_TABLE} WHERE barcode = ?`, [barcode]);
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
    db.runSync(`DELETE FROM ${HISTORY_TABLE} WHERE id = ?`, [id]);
  } catch (error) {
    console.error('Tekil Kayıt Silme Hatası:', error);
  }
};

/**
 * Tüm geçmişi temizler.
 */
export const clearAllHistory = (): void => {
  try {
    db.runSync(`DELETE FROM ${HISTORY_TABLE}`);
  } catch (error) {
    console.error('Temizleme Hatası:', error);
  }
};
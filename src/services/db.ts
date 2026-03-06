import * as SQLite from 'expo-sqlite';
import { Product } from '../utils/analysis';

/**
 * ErEnesAl® v1 - Yerel SQLite Veritabanı Yönetimi
 */

const db = SQLite.openDatabaseSync('erenesal_v1.db');

export interface HistoryEntry extends Product {
  created_at: string;
}

/**
 * 🛠️ Veritabanı Başlatma
 */
export const initDatabase = (): void => {
  try {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS history (
        barcode TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        brand TEXT,
        image_url TEXT,
        type TEXT,
        score INTEGER,
        grade TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    db.execSync(`CREATE INDEX IF NOT EXISTS idx_history_date ON history(created_at);`);
    console.log("SQLite: Hazır.");
  } catch (error) {
    console.error("SQLite Başlatma Hatası:", error);
  }
};

/**
 * 📈 Günlük Sayaç
 */
export const getTodayScanCount = (): number => {
  try {
    const result: any = db.getFirstSync(
      'SELECT COUNT(*) as count FROM history WHERE date(created_at) = date("now", "localtime")'
    );
    return result?.count || 0;
  } catch (error) {
    return 0;
  }
};

/**
 * 💾 Kaydetme (Upsert)
 */
export const saveProductToHistory = (product: Product, score: number = 0): void => {
  try {
    db.runSync(
      `INSERT OR REPLACE INTO history (barcode, name, brand, image_url, type, score, grade, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);`,
      [
        product.barcode,
        product.name || 'İsimsiz Ürün',
        product.brand || 'Markasız',
        product.image_url || '',
        product.type || 'food',
        score,
        product.grade || ''
      ]
    );
  } catch (error) {
    console.error("Kayıt Hatası:", error);
  }
};

/**
 * 📜 Tüm Geçmiş
 */
export const getAllHistory = (): HistoryEntry[] => {
  try {
    return db.getAllSync<HistoryEntry>('SELECT * FROM history ORDER BY created_at DESC');
  } catch (error) {
    return [];
  }
};

/**
 * 🗑️ Tekil Ürün Silme (Hata Veren Fonksiyon Düzeltildi)
 * HistoryScreen'deki 'deleteHistoryItem' çağrısı ile artık tam uyumlu.
 */
export const deleteHistoryItem = (barcode: string): void => {
  try {
    db.runSync('DELETE FROM history WHERE barcode = ?', [barcode]);
    console.log(`${barcode} başarıyla silindi.`);
  } catch (error) {
    console.error("Silme Hatası:", error);
  }
};

/**
 * 🧹 Tümünü Temizle
 */
export const clearAllHistory = (): void => {
  try {
    db.runSync('DELETE FROM history');
  } catch (error) {
    console.error("Temizleme Hatası:", error);
  }
};
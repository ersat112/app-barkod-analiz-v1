import * as SQLite from 'expo-sqlite';

import { PRODUCT_CACHE_TABLE_NAME } from '../../config/features';
import type { ColumnInfo } from './types';

const DATABASE_NAME = 'erenesal_v1.db';

const db = SQLite.openDatabaseSync(DATABASE_NAME);

export const TABLES = Object.freeze({
  HISTORY: 'history',
  FAVORITES: 'favorites',
  PRODUCT_CACHE: PRODUCT_CACHE_TABLE_NAME,
});

export const getDatabase = (): SQLite.SQLiteDatabase => db;

export const safeText = (value?: string | null, fallback = ''): string =>
  typeof value === 'string' ? value.trim() || fallback : fallback;

export const safeNumber = (value?: number | null, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;

export const tableExists = (tableName: string): boolean => {
  const row = db.getFirstSync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [tableName]
  );

  return Boolean(row?.name);
};

export const getTableColumns = (tableName: string): ColumnInfo[] => {
  try {
    return db.getAllSync<ColumnInfo>(`PRAGMA table_info(${tableName})`);
  } catch {
    return [];
  }
};

export const ensureColumn = (
  tableName: string,
  currentColumns: ColumnInfo[],
  columnName: string,
  alterSql: string
): ColumnInfo[] => {
  if (currentColumns.some((column) => column.name === columnName)) {
    return currentColumns;
  }

  db.execSync(alterSql);
  return getTableColumns(tableName);
};

export const applyDatabasePragmas = (): void => {
  db.execSync(`PRAGMA journal_mode = WAL;`);
  db.execSync(`PRAGMA foreign_keys = ON;`);
};
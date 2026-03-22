import type { DiagnosticsTimestamp } from '../../types/diagnostics';
import {
  TABLES,
  applyDatabasePragmas,
  ensureColumn,
  getDatabase,
  getTableColumns,
  tableExists,
} from './core';

type UserVersionRow = {
  user_version?: number | null;
};

type MigrationDefinition = {
  version: number;
  key: 'history_foundation' | 'favorites_foundation' | 'product_cache_foundation';
  label: string;
  run: () => void;
};

type TableDiagnosticsSnapshot = {
  exists: boolean;
  columnCount: number;
  columns: string[];
};

export type DatabaseDiagnosticsSnapshot = {
  fetchedAt: DiagnosticsTimestamp;
  initialized: boolean;
  targetVersion: number;
  userVersion: number;
  pendingMigrationCount: number;
  pendingMigrationVersions: number[];
  lastAppliedMigrationVersions: number[];
  lastInitializedAt: DiagnosticsTimestamp | null;
  lastError: string | null;
  tables: {
    history: TableDiagnosticsSnapshot;
    favorites: TableDiagnosticsSnapshot;
    productCache: TableDiagnosticsSnapshot;
  };
  migrations: Array<{
    version: number;
    key: MigrationDefinition['key'];
    label: string;
    applied: boolean;
  }>;
};

const db = getDatabase();

let initialized = false;
let lastInitializedAt: DiagnosticsTimestamp | null = null;
let lastError: string | null = null;
let lastAppliedMigrationVersions: number[] = [];

const createHistoryTable = (): void => {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS ${TABLES.HISTORY} (
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
    ON ${TABLES.HISTORY}(barcode);
  `);

  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_history_created_at
    ON ${TABLES.HISTORY}(created_at DESC);
  `);

  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_history_score
    ON ${TABLES.HISTORY}(score);
  `);

  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_history_barcode_created_at
    ON ${TABLES.HISTORY}(barcode, created_at DESC, id DESC);
  `);

  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_history_type_created_at
    ON ${TABLES.HISTORY}(type, created_at DESC, id DESC);
  `);
};

const createFavoritesTable = (): void => {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS ${TABLES.FAVORITES} (
      barcode TEXT PRIMARY KEY NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_favorites_updated_at
    ON ${TABLES.FAVORITES}(updated_at DESC);
  `);

  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_favorites_created_at
    ON ${TABLES.FAVORITES}(created_at DESC);
  `);
};

const createProductCacheTable = (): void => {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS ${TABLES.PRODUCT_CACHE} (
      barcode TEXT PRIMARY KEY NOT NULL,
      cache_status TEXT NOT NULL DEFAULT 'found',
      source_name TEXT,
      product_type TEXT,
      payload_json TEXT,
      schema_version INTEGER NOT NULL DEFAULT 1,
      fetched_at INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER NOT NULL DEFAULT 0,
      last_accessed_at INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_product_cache_expires_at
    ON ${TABLES.PRODUCT_CACHE}(expires_at);
  `);

  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_product_cache_cache_status
    ON ${TABLES.PRODUCT_CACHE}(cache_status);
  `);

  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_product_cache_updated_at
    ON ${TABLES.PRODUCT_CACHE}(updated_at DESC);
  `);
};

const migrateLegacyHistoryIfNeeded = (): void => {
  if (!tableExists(TABLES.HISTORY)) {
    createHistoryTable();
    return;
  }

  const columns = getTableColumns(TABLES.HISTORY);
  const hasId = columns.some((column) => column.name === 'id');
  const barcodeIsPrimaryKey = columns.some(
    (column) => column.name === 'barcode' && column.pk === 1
  );

  if (hasId && !barcodeIsPrimaryKey) {
    const neededColumns = [
      'ingredients_text',
      'country',
      'origin',
      'source_name',
      'updated_at',
    ] as const;

    neededColumns.forEach((column) => {
      const exists = columns.some((item) => item.name === column);

      if (exists) {
        return;
      }

      switch (column) {
        case 'updated_at':
          db.execSync(
            `ALTER TABLE ${TABLES.HISTORY} ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;`
          );
          break;

        default:
          db.execSync(`ALTER TABLE ${TABLES.HISTORY} ADD COLUMN ${column} TEXT;`);
          break;
      }
    });

    createHistoryTable();
    return;
  }

  const legacyTableName = `${TABLES.HISTORY}_legacy_${Date.now()}`;

  db.execSync(`
    ALTER TABLE ${TABLES.HISTORY} RENAME TO ${legacyTableName};
  `);

  createHistoryTable();

  const legacyColumns = getTableColumns(legacyTableName).map((column) => column.name);

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
    INSERT INTO ${TABLES.HISTORY} (
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

const migrateFavoritesIfNeeded = (): void => {
  if (!tableExists(TABLES.FAVORITES)) {
    createFavoritesTable();
    return;
  }

  createFavoritesTable();

  let columns = getTableColumns(TABLES.FAVORITES);

  columns = ensureColumn(
    TABLES.FAVORITES,
    columns,
    'created_at',
    `ALTER TABLE ${TABLES.FAVORITES} ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;`
  );

  ensureColumn(
    TABLES.FAVORITES,
    columns,
    'updated_at',
    `ALTER TABLE ${TABLES.FAVORITES} ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;`
  );

  db.execSync(`
    UPDATE ${TABLES.FAVORITES}
    SET
      created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
      updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP);
  `);
};

const migrateProductCacheIfNeeded = (): void => {
  if (!tableExists(TABLES.PRODUCT_CACHE)) {
    createProductCacheTable();
    return;
  }

  createProductCacheTable();

  let columns = getTableColumns(TABLES.PRODUCT_CACHE);

  columns = ensureColumn(
    TABLES.PRODUCT_CACHE,
    columns,
    'cache_status',
    `ALTER TABLE ${TABLES.PRODUCT_CACHE} ADD COLUMN cache_status TEXT NOT NULL DEFAULT 'found';`
  );

  columns = ensureColumn(
    TABLES.PRODUCT_CACHE,
    columns,
    'source_name',
    `ALTER TABLE ${TABLES.PRODUCT_CACHE} ADD COLUMN source_name TEXT;`
  );

  columns = ensureColumn(
    TABLES.PRODUCT_CACHE,
    columns,
    'product_type',
    `ALTER TABLE ${TABLES.PRODUCT_CACHE} ADD COLUMN product_type TEXT;`
  );

  columns = ensureColumn(
    TABLES.PRODUCT_CACHE,
    columns,
    'payload_json',
    `ALTER TABLE ${TABLES.PRODUCT_CACHE} ADD COLUMN payload_json TEXT;`
  );

  columns = ensureColumn(
    TABLES.PRODUCT_CACHE,
    columns,
    'schema_version',
    `ALTER TABLE ${TABLES.PRODUCT_CACHE} ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1;`
  );

  columns = ensureColumn(
    TABLES.PRODUCT_CACHE,
    columns,
    'fetched_at',
    `ALTER TABLE ${TABLES.PRODUCT_CACHE} ADD COLUMN fetched_at INTEGER NOT NULL DEFAULT 0;`
  );

  columns = ensureColumn(
    TABLES.PRODUCT_CACHE,
    columns,
    'expires_at',
    `ALTER TABLE ${TABLES.PRODUCT_CACHE} ADD COLUMN expires_at INTEGER NOT NULL DEFAULT 0;`
  );

  columns = ensureColumn(
    TABLES.PRODUCT_CACHE,
    columns,
    'last_accessed_at',
    `ALTER TABLE ${TABLES.PRODUCT_CACHE} ADD COLUMN last_accessed_at INTEGER NOT NULL DEFAULT 0;`
  );

  columns = ensureColumn(
    TABLES.PRODUCT_CACHE,
    columns,
    'created_at',
    `ALTER TABLE ${TABLES.PRODUCT_CACHE} ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;`
  );

  ensureColumn(
    TABLES.PRODUCT_CACHE,
    columns,
    'updated_at',
    `ALTER TABLE ${TABLES.PRODUCT_CACHE} ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;`
  );

  db.execSync(`
    UPDATE ${TABLES.PRODUCT_CACHE}
    SET
      cache_status = COALESCE(cache_status, 'found'),
      schema_version = COALESCE(schema_version, 1),
      fetched_at = COALESCE(fetched_at, 0),
      expires_at = COALESCE(expires_at, 0),
      last_accessed_at = COALESCE(last_accessed_at, 0);
  `);
};

const MIGRATIONS: readonly MigrationDefinition[] = Object.freeze([
  {
    version: 1,
    key: 'history_foundation',
    label: 'History foundation',
    run: migrateLegacyHistoryIfNeeded,
  },
  {
    version: 2,
    key: 'favorites_foundation',
    label: 'Favorites foundation',
    run: migrateFavoritesIfNeeded,
  },
  {
    version: 3,
    key: 'product_cache_foundation',
    label: 'Product cache foundation',
    run: migrateProductCacheIfNeeded,
  },
]);

export const DATABASE_SCHEMA_VERSION =
  MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'Bilinmeyen migration hatası';
};

const getUserVersion = (): number => {
  try {
    const row = db.getFirstSync<UserVersionRow>('PRAGMA user_version');
    const value = row?.user_version;

    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, Math.floor(value));
    }

    return 0;
  } catch {
    return 0;
  }
};

const setUserVersion = (version: number): void => {
  const safeVersion = Math.max(0, Math.floor(version));
  db.execSync(`PRAGMA user_version = ${safeVersion};`);
};

const getPendingMigrationVersions = (userVersion: number): number[] => {
  return MIGRATIONS.filter((migration) => migration.version > userVersion).map(
    (migration) => migration.version
  );
};

const getTableDiagnostics = (tableName: string): TableDiagnosticsSnapshot => {
  const exists = tableExists(tableName);
  const columns = exists ? getTableColumns(tableName).map((column) => column.name) : [];

  return {
    exists,
    columnCount: columns.length,
    columns,
  };
};

export const initDatabase = (): void => {
  if (initialized && getUserVersion() >= DATABASE_SCHEMA_VERSION) {
    return;
  }

  try {
    applyDatabasePragmas();

    let currentVersion = getUserVersion();
    const appliedVersions: number[] = [];

    MIGRATIONS.forEach((migration) => {
      if (migration.version <= currentVersion) {
        return;
      }

      migration.run();
      setUserVersion(migration.version);
      currentVersion = migration.version;
      appliedVersions.push(migration.version);
    });

    initialized = true;
    lastInitializedAt = new Date().toISOString();
    lastAppliedMigrationVersions = appliedVersions;
    lastError = null;

    console.log('SQLite: Hazır.', {
      userVersion: currentVersion,
      targetVersion: DATABASE_SCHEMA_VERSION,
      appliedMigrations: appliedVersions,
    });
  } catch (error) {
    initialized = false;
    lastError = toErrorMessage(error);
    console.error('SQLite Başlatma Hatası:', error);
    throw error;
  }
};

export const getDatabaseDiagnosticsSnapshot = (): DatabaseDiagnosticsSnapshot => {
  try {
    initDatabase();
  } catch {
    // Hata bilgisi lastError içine yazılıyor; snapshot yine de üretilecek.
  }

  const userVersion = getUserVersion();
  const pendingMigrationVersions = getPendingMigrationVersions(userVersion);

  return {
    fetchedAt: new Date().toISOString(),
    initialized,
    targetVersion: DATABASE_SCHEMA_VERSION,
    userVersion,
    pendingMigrationCount: pendingMigrationVersions.length,
    pendingMigrationVersions,
    lastAppliedMigrationVersions: [...lastAppliedMigrationVersions],
    lastInitializedAt,
    lastError,
    tables: {
      history: getTableDiagnostics(TABLES.HISTORY),
      favorites: getTableDiagnostics(TABLES.FAVORITES),
      productCache: getTableDiagnostics(TABLES.PRODUCT_CACHE),
    },
    migrations: MIGRATIONS.map((migration) => ({
      version: migration.version,
      key: migration.key,
      label: migration.label,
      applied: userVersion >= migration.version,
    })),
  };
};
import { TABLES, applyDatabasePragmas, ensureColumn, getDatabase, getTableColumns, tableExists } from './core';

const db = getDatabase();

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

export const initDatabase = (): void => {
  try {
    applyDatabasePragmas();
    migrateLegacyHistoryIfNeeded();
    migrateProductCacheIfNeeded();
    console.log('SQLite: Hazır.');
  } catch (error) {
    console.error('SQLite Başlatma Hatası:', error);
  }
};
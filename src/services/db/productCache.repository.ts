import { CACHE_POLICY, PRODUCT_CACHE_SCHEMA_VERSION } from '../../config/features';
import type { Product } from '../../utils/analysis';
import { TABLES, getDatabase, safeNumber, safeText } from './core';
import { initDatabase } from './migrations';
import type { ProductCacheRecord, ProductCacheStatus, ProductCacheUpsertInput } from './types';

export type LocalProductCacheHit =
  | {
      kind: 'found';
      barcode: string;
      product: Product;
      source: 'local_cache';
      fetchedAt: number;
      expiresAt: number;
    }
  | {
      kind: 'not_found';
      barcode: string;
      source: 'local_cache';
      fetchedAt: number;
      expiresAt: number;
    };

const db = getDatabase();

export function normalizeProductCacheBarcode(barcode: string): string {
  return String(barcode || '').replace(/[^\d]/g, '').trim();
}

export function isProductCacheBarcodeValid(barcode: string): boolean {
  return [8, 12, 13, 14].includes(barcode.length);
}

function safeTimestamp(value?: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : Date.now();
}

function parsePayload(payloadJson: string | null): Product | null {
  if (!payloadJson) {
    return null;
  }

  try {
    return JSON.parse(payloadJson) as Product;
  } catch (error) {
    console.error('Product cache payload parse error:', error);
    return null;
  }
}

export const resolveProductCacheExpiry = (
  cacheStatus: ProductCacheStatus,
  fetchedAt = Date.now()
): number => {
  const ttlMs =
    cacheStatus === 'not_found'
      ? CACHE_POLICY.localNotFoundTtlMs
      : CACHE_POLICY.localFoundTtlMs;

  return fetchedAt + ttlMs;
};

export const getProductCacheByBarcode = (
  barcode: string
): { record: ProductCacheRecord; product: Product | null } | null => {
  try {
    initDatabase();

    const normalizedBarcode = normalizeProductCacheBarcode(barcode);

    if (!isProductCacheBarcodeValid(normalizedBarcode)) {
      return null;
    }

    const record = db.getFirstSync<ProductCacheRecord>(
      `SELECT
        barcode,
        cache_status,
        source_name,
        product_type,
        payload_json,
        schema_version,
        fetched_at,
        expires_at,
        last_accessed_at,
        created_at,
        updated_at
       FROM ${TABLES.PRODUCT_CACHE}
       WHERE barcode = ?
       LIMIT 1`,
      [normalizedBarcode]
    );

    if (!record) {
      return null;
    }

    return {
      record,
      product: parsePayload(record.payload_json),
    };
  } catch (error) {
    console.error('Product cache read error:', error);
    return null;
  }
};

export const getLocalProductCacheHit = (
  barcode: string,
  now = Date.now()
): LocalProductCacheHit | null => {
  const cached = getProductCacheByBarcode(barcode);

  if (!cached) {
    return null;
  }

  const normalizedBarcode = normalizeProductCacheBarcode(barcode);
  const fetchedAt = safeNumber(cached.record.fetched_at, 0);
  const expiresAt = safeNumber(cached.record.expires_at, 0);

  if (expiresAt > 0 && expiresAt <= now) {
    deleteProductCacheByBarcode(normalizedBarcode);
    return null;
  }

  markProductCacheAccessed(normalizedBarcode, now);

  if (cached.record.cache_status === 'not_found') {
    return {
      kind: 'not_found',
      barcode: normalizedBarcode,
      source: 'local_cache',
      fetchedAt,
      expiresAt,
    };
  }

  if (!cached.product) {
    deleteProductCacheByBarcode(normalizedBarcode);
    return null;
  }

  return {
    kind: 'found',
    barcode: normalizedBarcode,
    product: {
      ...cached.product,
      barcode: normalizedBarcode,
    },
    source: 'local_cache',
    fetchedAt,
    expiresAt,
  };
};

export const upsertProductCache = (input: ProductCacheUpsertInput): void => {
  try {
    initDatabase();

    const normalizedBarcode = normalizeProductCacheBarcode(input.barcode);

    if (!isProductCacheBarcodeValid(normalizedBarcode)) {
      return;
    }

    const fetchedAt = safeTimestamp(input.fetchedAt);
    const lastAccessedAt = safeTimestamp(input.lastAccessedAt ?? fetchedAt);
    const expiresAt =
      typeof input.expiresAt === 'number' && Number.isFinite(input.expiresAt)
        ? Math.round(input.expiresAt)
        : resolveProductCacheExpiry(input.cacheStatus, fetchedAt);

    const payloadJson =
      input.product == null
        ? null
        : JSON.stringify({
            ...input.product,
            barcode: normalizedBarcode,
          });

    const sourceName = safeText(
      input.sourceName ?? input.product?.sourceName ?? '',
      ''
    );

    const productType = safeText(
      input.productType ?? input.product?.type ?? '',
      ''
    );

    db.runSync(
      `INSERT INTO ${TABLES.PRODUCT_CACHE} (
        barcode,
        cache_status,
        source_name,
        product_type,
        payload_json,
        schema_version,
        fetched_at,
        expires_at,
        last_accessed_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(barcode) DO UPDATE SET
        cache_status = excluded.cache_status,
        source_name = excluded.source_name,
        product_type = excluded.product_type,
        payload_json = excluded.payload_json,
        schema_version = excluded.schema_version,
        fetched_at = excluded.fetched_at,
        expires_at = excluded.expires_at,
        last_accessed_at = excluded.last_accessed_at,
        updated_at = CURRENT_TIMESTAMP;`,
      [
        normalizedBarcode,
        input.cacheStatus,
        sourceName,
        productType,
        payloadJson,
        safeNumber(input.schemaVersion, PRODUCT_CACHE_SCHEMA_VERSION),
        fetchedAt,
        expiresAt,
        lastAccessedAt,
      ]
    );
  } catch (error) {
    console.error('Product cache upsert error:', error);
  }
};

export const setLocalProductCacheFound = ({
  barcode,
  product,
  ttlMs = CACHE_POLICY.localFoundTtlMs,
  now = Date.now(),
}: {
  barcode: string;
  product: Product;
  ttlMs?: number;
  now?: number;
}): void => {
  const normalizedBarcode = normalizeProductCacheBarcode(barcode);

  if (!isProductCacheBarcodeValid(normalizedBarcode)) {
    return;
  }

  upsertProductCache({
    barcode: normalizedBarcode,
    cacheStatus: 'found',
    product: {
      ...product,
      barcode: normalizedBarcode,
    },
    sourceName: product.sourceName,
    productType: product.type,
    fetchedAt: now,
    expiresAt: now + Math.max(1, ttlMs),
    lastAccessedAt: now,
    schemaVersion: PRODUCT_CACHE_SCHEMA_VERSION,
  });
};

export const setLocalProductCacheNotFound = ({
  barcode,
  ttlMs = CACHE_POLICY.localNotFoundTtlMs,
  now = Date.now(),
}: {
  barcode: string;
  ttlMs?: number;
  now?: number;
}): void => {
  const normalizedBarcode = normalizeProductCacheBarcode(barcode);

  if (!isProductCacheBarcodeValid(normalizedBarcode)) {
    return;
  }

  upsertProductCache({
    barcode: normalizedBarcode,
    cacheStatus: 'not_found',
    fetchedAt: now,
    expiresAt: now + Math.max(1, ttlMs),
    lastAccessedAt: now,
    schemaVersion: PRODUCT_CACHE_SCHEMA_VERSION,
  });
};

export const markProductCacheAccessed = (
  barcode: string,
  accessedAt = Date.now()
): void => {
  try {
    initDatabase();

    const normalizedBarcode = normalizeProductCacheBarcode(barcode);

    if (!isProductCacheBarcodeValid(normalizedBarcode)) {
      return;
    }

    db.runSync(
      `UPDATE ${TABLES.PRODUCT_CACHE}
       SET
         last_accessed_at = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE barcode = ?`,
      [safeTimestamp(accessedAt), normalizedBarcode]
    );
  } catch (error) {
    console.error('Product cache access update error:', error);
  }
};

export const deleteProductCacheByBarcode = (barcode: string): void => {
  try {
    initDatabase();

    const normalizedBarcode = normalizeProductCacheBarcode(barcode);

    if (!normalizedBarcode) {
      return;
    }

    db.runSync(`DELETE FROM ${TABLES.PRODUCT_CACHE} WHERE barcode = ?`, [normalizedBarcode]);
  } catch (error) {
    console.error('Product cache delete error:', error);
  }
};

export const invalidateLocalProductCacheBarcode = (barcode: string): void => {
  deleteProductCacheByBarcode(barcode);
};

export const clearExpiredProductCache = (now = Date.now()): void => {
  try {
    initDatabase();

    db.runSync(
      `DELETE FROM ${TABLES.PRODUCT_CACHE}
       WHERE expires_at > 0 AND expires_at <= ?`,
      [safeTimestamp(now)]
    );
  } catch (error) {
    console.error('Expired product cache clear error:', error);
  }
};

export const clearAllProductCache = (): void => {
  try {
    initDatabase();

    db.runSync(`DELETE FROM ${TABLES.PRODUCT_CACHE}`);
  } catch (error) {
    console.error('Clear all product cache error:', error);
  }
};

export const getProductCacheCount = (): number => {
  try {
    initDatabase();

    const row = db.getFirstSync<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${TABLES.PRODUCT_CACHE}`
    );

    return row?.count ?? 0;
  } catch (error) {
    console.error('Product cache count error:', error);
    return 0;
  }
};

export const normalizeBarcode = normalizeProductCacheBarcode;
export const isValidBarcode = isProductCacheBarcodeValid;
export const getCachedProduct = getLocalProductCacheHit;
export const setCachedProductFound = setLocalProductCacheFound;
export const setCachedProductNotFound = setLocalProductCacheNotFound;
export const invalidateProductCacheBarcode = invalidateLocalProductCacheBarcode;

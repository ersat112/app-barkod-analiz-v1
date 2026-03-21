import {
  CACHE_POLICY,
  FEATURES,
  PRODUCT_CACHE_SCHEMA_VERSION,
  PRODUCT_CACHE_TABLE_NAME,
} from '../config/features';
import type { Product, ProductSource, ProductType } from '../utils/analysis';
import { getDatabase } from './db';

type SQLiteProductCacheRow = {
  barcode: string;
  cache_status: string;
  source_name: ProductSource | null;
  product_type: ProductType | null;
  payload_json: string | null;
  schema_version: number | null;
  fetched_at: number | null;
  expires_at: number | null;
  last_accessed_at: number | null;
  created_at: string | null;
  updated_at: string | null;
};

export type LocalProductCacheHit =
  | {
      kind: 'found';
      barcode: string;
      product: Product;
      source: 'local_cache';
      sourceName?: ProductSource;
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

export const normalizeBarcode = (barcode: string): string => {
  return String(barcode || '').replace(/[^\d]/g, '').trim();
};

export const isValidBarcode = (barcode: string): boolean => {
  return [8, 12, 13, 14].includes(barcode.length);
};

const toEpochMs = (value?: number | null): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
};

const deserializeProduct = (
  barcode: string,
  payloadJson: string | null
): Product | null => {
  if (!payloadJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(payloadJson) as Product;

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return {
      ...parsed,
      barcode,
    };
  } catch (error) {
    console.warn('[ProductCache] payload parse failed:', error);
    return null;
  }
};

const serializeProduct = (barcode: string, product: Product): string => {
  return JSON.stringify({
    ...product,
    barcode,
  });
};

export const getCachedProduct = (
  barcode: string,
  now = Date.now()
): LocalProductCacheHit | null => {
  if (
    !FEATURES.productRepository.sqliteCacheEnabled ||
    !FEATURES.productRepository.sqliteReadEnabled
  ) {
    return null;
  }

  const normalizedBarcode = normalizeBarcode(barcode);

  if (!isValidBarcode(normalizedBarcode)) {
    return null;
  }

  try {
    const row = db.getFirstSync<SQLiteProductCacheRow>(
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
       FROM ${PRODUCT_CACHE_TABLE_NAME}
       WHERE barcode = ?
       LIMIT 1`,
      [normalizedBarcode]
    );

    if (!row) {
      return null;
    }

    const fetchedAt = toEpochMs(row.fetched_at);
    const expiresAt = toEpochMs(row.expires_at);

    if (expiresAt > 0 && expiresAt <= now) {
      invalidateProductCacheBarcode(normalizedBarcode);
      return null;
    }

    db.runSync(
      `UPDATE ${PRODUCT_CACHE_TABLE_NAME}
       SET last_accessed_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE barcode = ?`,
      [now, normalizedBarcode]
    );

    if (row.cache_status === 'not_found') {
      return {
        kind: 'not_found',
        barcode: normalizedBarcode,
        source: 'local_cache',
        fetchedAt,
        expiresAt,
      };
    }

    const product = deserializeProduct(normalizedBarcode, row.payload_json);

    if (!product) {
      invalidateProductCacheBarcode(normalizedBarcode);
      return null;
    }

    return {
      kind: 'found',
      barcode: normalizedBarcode,
      product,
      source: 'local_cache',
      sourceName: row.source_name ?? product.sourceName ?? undefined,
      fetchedAt,
      expiresAt,
    };
  } catch (error) {
    console.error('[ProductCache] read failed:', error);
    return null;
  }
};

export const setCachedProductFound = ({
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
  if (
    !FEATURES.productRepository.sqliteCacheEnabled ||
    !FEATURES.productRepository.sqliteWriteEnabled
  ) {
    return;
  }

  const normalizedBarcode = normalizeBarcode(barcode);

  if (!isValidBarcode(normalizedBarcode)) {
    return;
  }

  const expiresAt = now + Math.max(1, ttlMs);
  const payloadJson = serializeProduct(normalizedBarcode, product);

  try {
    db.runSync(
      `INSERT INTO ${PRODUCT_CACHE_TABLE_NAME} (
        barcode,
        cache_status,
        source_name,
        product_type,
        payload_json,
        schema_version,
        fetched_at,
        expires_at,
        last_accessed_at
      ) VALUES (?, 'found', ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(barcode) DO UPDATE SET
        cache_status = excluded.cache_status,
        source_name = excluded.source_name,
        product_type = excluded.product_type,
        payload_json = excluded.payload_json,
        schema_version = excluded.schema_version,
        fetched_at = excluded.fetched_at,
        expires_at = excluded.expires_at,
        last_accessed_at = excluded.last_accessed_at,
        updated_at = CURRENT_TIMESTAMP`,
      [
        normalizedBarcode,
        product.sourceName ?? null,
        product.type ?? null,
        payloadJson,
        PRODUCT_CACHE_SCHEMA_VERSION,
        now,
        expiresAt,
        now,
      ]
    );
  } catch (error) {
    console.error('[ProductCache] write(found) failed:', error);
  }
};

export const setCachedProductNotFound = ({
  barcode,
  ttlMs = CACHE_POLICY.localNotFoundTtlMs,
  now = Date.now(),
}: {
  barcode: string;
  ttlMs?: number;
  now?: number;
}): void => {
  if (
    !FEATURES.productRepository.sqliteCacheEnabled ||
    !FEATURES.productRepository.sqliteWriteEnabled
  ) {
    return;
  }

  const normalizedBarcode = normalizeBarcode(barcode);

  if (!isValidBarcode(normalizedBarcode)) {
    return;
  }

  const expiresAt = now + Math.max(1, ttlMs);

  try {
    db.runSync(
      `INSERT INTO ${PRODUCT_CACHE_TABLE_NAME} (
        barcode,
        cache_status,
        source_name,
        product_type,
        payload_json,
        schema_version,
        fetched_at,
        expires_at,
        last_accessed_at
      ) VALUES (?, 'not_found', NULL, NULL, NULL, ?, ?, ?, ?)
      ON CONFLICT(barcode) DO UPDATE SET
        cache_status = excluded.cache_status,
        source_name = excluded.source_name,
        product_type = excluded.product_type,
        payload_json = excluded.payload_json,
        schema_version = excluded.schema_version,
        fetched_at = excluded.fetched_at,
        expires_at = excluded.expires_at,
        last_accessed_at = excluded.last_accessed_at,
        updated_at = CURRENT_TIMESTAMP`,
      [
        normalizedBarcode,
        PRODUCT_CACHE_SCHEMA_VERSION,
        now,
        expiresAt,
        now,
      ]
    );
  } catch (error) {
    console.error('[ProductCache] write(not_found) failed:', error);
  }
};

export const invalidateProductCacheBarcode = (barcode: string): void => {
  const normalizedBarcode = normalizeBarcode(barcode);

  if (!normalizedBarcode) {
    return;
  }

  try {
    db.runSync(
      `DELETE FROM ${PRODUCT_CACHE_TABLE_NAME} WHERE barcode = ?`,
      [normalizedBarcode]
    );
  } catch (error) {
    console.error('[ProductCache] invalidate failed:', error);
  }
};

export const clearExpiredProductCache = (now = Date.now()): void => {
  try {
    db.runSync(
      `DELETE FROM ${PRODUCT_CACHE_TABLE_NAME}
       WHERE expires_at > 0 AND expires_at <= ?`,
      [now]
    );
  } catch (error) {
    console.error('[ProductCache] clearExpired failed:', error);
  }
};
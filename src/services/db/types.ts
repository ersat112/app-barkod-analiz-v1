import type { Product, ProductSource, ProductType } from '../../utils/analysis';

export type ColumnInfo = {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

export type CountRow = {
  count: number;
};

export type BestScoreRow = {
  bestScore: number | null;
};

export type DayRow = {
  day: string;
};

export interface HistoryEntry extends Product {
  id: number;
  created_at: string;
  updated_at: string;
}

export type ProductCacheStatus = 'found' | 'not_found';

export type CachePayload = Product | null;

export type ProductCacheRecord = {
  barcode: string;
  cache_status: ProductCacheStatus;
  source_name: ProductSource | string;
  product_type: ProductType | string;
  payload_json: string | null;
  schema_version: number;
  fetched_at: number;
  expires_at: number;
  last_accessed_at: number;
  created_at: string;
  updated_at: string;
};

export type ProductCacheUpsertInput = {
  barcode: string;
  cacheStatus: ProductCacheStatus;
  product?: Product | null;
  sourceName?: ProductSource | string | null;
  productType?: ProductType | string | null;
  fetchedAt?: number;
  expiresAt?: number;
  lastAccessedAt?: number;
  schemaVersion?: number;
};
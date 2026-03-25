import type { Product } from '../utils/analysis';

export type ProductRepositorySource =
  | 'local_cache'
  | 'shared_cache'
  | 'food'
  | 'beauty'
  | 'medicine';

export type ProductRepositoryCacheTier = 'local' | 'remote' | 'network';

export type ProductRepositoryRemoteMode = 'parallel' | 'sequential';

export type ProductRepositoryLookupMeta = {
  lookupId: string;
  durationMs: number;
  normalizedBarcode: string;
  resolvedSource?: ProductRepositorySource;
  cacheTier?: ProductRepositoryCacheTier;
  remoteMode: ProductRepositoryRemoteMode;
};

export type ProductRepositoryResolveResult =
  | {
      found: true;
      barcode: string;
      product: Product;
      source: ProductRepositorySource;
      cacheTier: ProductRepositoryCacheTier;
      lookupMeta: ProductRepositoryLookupMeta;
    }
  | {
      found: false;
      barcode: string;
      reason: 'invalid_barcode' | 'not_found';
      source?: ProductRepositorySource;
      cacheTier?: ProductRepositoryCacheTier;
      lookupMeta: ProductRepositoryLookupMeta;
    };

export type ProductRepositoryRemoteFetchResult =
  | {
      found: true;
      barcode: string;
      product: Product;
      source: 'food' | 'beauty' | 'medicine';
    }
  | {
      found: false;
      barcode: string;
      reason: 'not_found';
    };

export type ProductRepositoryLookupResult =
  | {
      found: true;
      barcode: string;
      product: Product;
      source: 'food' | 'beauty' | 'medicine' | 'cache';
      lookupMeta?: ProductRepositoryLookupMeta;
    }
  | {
      found: false;
      barcode: string;
      reason: 'invalid_barcode' | 'not_found';
      lookupMeta?: ProductRepositoryLookupMeta;
    };

export type ProductRepositoryDiagnostics = {
  inflightCount: number;
};

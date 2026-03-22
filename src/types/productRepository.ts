import type { Product } from '../utils/analysis';

export type ProductRepositorySource =
  | 'local_cache'
  | 'shared_cache'
  | 'food'
  | 'beauty';

export type ProductRepositoryCacheTier = 'local' | 'remote' | 'network';

export type ProductRepositoryResolveResult =
  | {
      found: true;
      barcode: string;
      product: Product;
      source: ProductRepositorySource;
      cacheTier: ProductRepositoryCacheTier;
    }
  | {
      found: false;
      barcode: string;
      reason: 'invalid_barcode' | 'not_found';
      source?: ProductRepositorySource;
      cacheTier?: ProductRepositoryCacheTier;
    };

export type ProductRepositoryRemoteFetchResult =
  | {
      found: true;
      barcode: string;
      product: Product;
      source: 'food' | 'beauty';
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
      source: 'food' | 'beauty' | 'cache';
    }
  | {
      found: false;
      barcode: string;
      reason: 'invalid_barcode' | 'not_found';
    };

export type ProductRepositoryDiagnostics = {
  inflightCount: number;
};
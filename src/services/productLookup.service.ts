import {
  clearProductRepositoryRuntimeState,
  invalidateProductRepositoryBarcode,
  resolveProductFromRepository,
} from './productRepository';
import type {
  ProductRepositoryLookupResult,
  ProductRepositoryResolveResult,
} from '../types/productRepository';

export type ProductLookupResult = ProductRepositoryLookupResult;

const mapRepositoryResultToLookupResult = (
  result: ProductRepositoryResolveResult
): ProductLookupResult => {
  if (result.found) {
    return {
      found: true,
      barcode: result.barcode,
      product: result.product,
      source:
        result.source === 'local_cache' || result.source === 'shared_cache'
          ? 'cache'
          : result.source,
      lookupMeta: result.lookupMeta,
    };
  }

  return {
    found: false,
    barcode: result.barcode,
    reason: result.reason,
    lookupMeta: result.lookupMeta,
  };
};

export const lookupProductByBarcode = async (
  barcode: string
): Promise<ProductLookupResult> => {
  const repositoryResult = await resolveProductFromRepository(barcode, {});
  return mapRepositoryResultToLookupResult(repositoryResult);
};

export const clearProductLookupRuntimeState = (): void => {
  clearProductRepositoryRuntimeState();
};

export const invalidateProductLookupBarcode = (barcode: string): void => {
  invalidateProductRepositoryBarcode(barcode);
};
import {
  clearProductRepositoryRuntimeState,
  getProductRepositoryDiagnostics,
  invalidateProductRepositoryBarcode,
  resolveProductFromRepository as resolveProductFromRepositoryService,
  type ProductRepositoryServiceResolveOptions,
} from './productRepository.service';
import type {
  ProductRepositoryDiagnostics,
  ProductRepositoryRemoteFetchResult,
  ProductRepositoryResolveResult,
  ProductRepositorySource,
} from '../types/productRepository';

export type {
  ProductRepositoryDiagnostics,
  ProductRepositoryRemoteFetchResult,
  ProductRepositoryResolveResult,
  ProductRepositorySource,
};

export type ProductRepositoryResolveOptions = ProductRepositoryServiceResolveOptions;

export const resolveProductFromRepository = async (
  barcode: string,
  options?: ProductRepositoryResolveOptions
): Promise<ProductRepositoryResolveResult> => {
  return resolveProductFromRepositoryService(barcode, options);
};

export {
  clearProductRepositoryRuntimeState,
  getProductRepositoryDiagnostics,
  invalidateProductRepositoryBarcode,
};
import type {
  ProductRepositoryLookupResult,
  ProductRepositoryResolveResult,
} from '../types/productRepository';
import { FEATURES } from '../config/features';
import { fetchFoodProduct } from './foodApi';
import { fetchBeautyProduct } from './beautyApi';
import {
  clearProductRepositoryRuntimeState,
  invalidateProductRepositoryBarcode,
  resolveProductFromRepository,
} from '../services/productRepository';

export type ProductLookupResult = ProductRepositoryLookupResult;

const normalizeBarcode = (barcode: string): string => {
  return String(barcode || '').replace(/[^\d]/g, '').trim();
};

const isValidBarcode = (barcode: string): boolean => {
  return [8, 12, 13, 14].includes(barcode.length);
};

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
    };
  }

  return {
    found: false,
    barcode: result.barcode,
    reason: result.reason,
  };
};

const tryFetchProductLegacy = async (
  barcode: string
): Promise<ProductLookupResult> => {
  const normalizedBarcode = normalizeBarcode(barcode);

  if (!isValidBarcode(normalizedBarcode)) {
    console.warn('[ProductResolver] invalid barcode:', normalizedBarcode);
    return {
      found: false,
      barcode: normalizedBarcode,
      reason: 'invalid_barcode',
    };
  }

  const foodProduct = await fetchFoodProduct(normalizedBarcode);

  if (foodProduct) {
    return {
      found: true,
      barcode: normalizedBarcode,
      product: foodProduct,
      source: 'food',
    };
  }

  const beautyProduct = await fetchBeautyProduct(normalizedBarcode);

  if (beautyProduct) {
    return {
      found: true,
      barcode: normalizedBarcode,
      product: beautyProduct,
      source: 'beauty',
    };
  }

  return {
    found: false,
    barcode: normalizedBarcode,
    reason: 'not_found',
  };
};

export const fetchProductByBarcode = async (
  barcode: string
): Promise<ProductLookupResult> => {
  if (!FEATURES.productRepository.foundationEnabled) {
    return tryFetchProductLegacy(barcode);
  }

  const repositoryResult = await resolveProductFromRepository(barcode, {});
  return mapRepositoryResultToLookupResult(repositoryResult);
};

export const clearProductResolverCache = (): void => {
  clearProductRepositoryRuntimeState();
};

export const invalidateProductResolverBarcode = (barcode: string): void => {
  invalidateProductRepositoryBarcode(barcode);
};
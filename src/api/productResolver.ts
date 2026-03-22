import {
  clearProductLookupRuntimeState,
  invalidateProductLookupBarcode,
  lookupProductByBarcode,
  type ProductLookupResult,
} from '../services/productLookup.service';

export type { ProductLookupResult };

export const fetchProductByBarcode = async (
  barcode: string
): Promise<ProductLookupResult> => {
  return lookupProductByBarcode(barcode);
};

export const clearProductResolverCache = (): void => {
  clearProductLookupRuntimeState();
};

export const invalidateProductResolverBarcode = (barcode: string): void => {
  invalidateProductLookupBarcode(barcode);
};
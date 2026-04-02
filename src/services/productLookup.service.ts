import {
  clearProductRepositoryRuntimeState,
  invalidateProductRepositoryBarcode,
  resolveProductFromRepository,
} from './productRepository';
import { fetchBeautyProduct } from '../api/beautyApi';
import { fetchFoodProduct } from '../api/foodApi';
import { fetchMedicineProduct } from './titckMedicine.service';
import type {
  ProductRepositoryLookupResult,
  ProductRepositoryRemoteFetchResult,
  ProductRepositoryResolveResult,
} from '../types/productRepository';
import type { Product } from '../utils/analysis';

export type ProductLookupResult = ProductRepositoryLookupResult;
export type ProductLookupMode = 'auto' | 'food' | 'beauty' | 'medicine';
export type ProductLookupOptions = {
  lookupMode?: ProductLookupMode;
};

type ConsumerLookupCandidate = {
  source: 'food' | 'beauty';
  product: Product;
};

const getLookupProductRichnessScore = (product: Product): number => {
  let score = 0;

  if (product.name) {
    score += Math.min(product.name.trim().length, 80);
  }

  if (product.brand) {
    score += Math.min(product.brand.trim().length, 40);
  }

  if (product.image_url) {
    score += 20;
  }

  if (product.ingredients_text) {
    score += Math.min(product.ingredients_text.trim().length, 120);
  }

  if (typeof product.score === 'number' && Number.isFinite(product.score)) {
    score += 30;
  }

  if (product.grade) {
    score += 18;
  }

  if (Array.isArray(product.additives)) {
    score += Math.min(product.additives.length * 4, 20);
  }

  if (product.type === 'food') {
    score += 8;
  }

  return score;
};

const selectBestConsumerCandidate = (
  candidates: ConsumerLookupCandidate[]
): ConsumerLookupCandidate | null => {
  if (!candidates.length) {
    return null;
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  return [...candidates].sort((left, right) => {
    const richnessDelta =
      getLookupProductRichnessScore(right.product) -
      getLookupProductRichnessScore(left.product);

    if (richnessDelta !== 0) {
      return richnessDelta;
    }

    return left.source === 'food' ? -1 : 1;
  })[0] ?? null;
};

const fetchConsumerProduct = async (
  barcode: string
): Promise<ProductRepositoryRemoteFetchResult> => {
  console.log('[ProductLookup] consumer lookup started:', { barcode });
  return await new Promise((resolve) => {
    const candidates: ConsumerLookupCandidate[] = [];
    let settledCount = 0;
    let finalized = false;
    let finalizeTimer: ReturnType<typeof setTimeout> | null = null;

    const finalize = () => {
      if (finalized) {
        return;
      }

      finalized = true;

      if (finalizeTimer) {
        clearTimeout(finalizeTimer);
      }

      const selected = selectBestConsumerCandidate(candidates);

      if (!selected) {
        resolve({
          found: false,
          barcode,
          reason: 'not_found',
        });
        return;
      }

      resolve({
        found: true,
        barcode,
        product: selected.product,
        source: selected.source,
      });
    };

    const scheduleFastFinalize = () => {
      if (finalized || finalizeTimer) {
        return;
      }

      finalizeTimer = setTimeout(() => {
        finalize();
      }, 180);
    };

    const registerSettlement = () => {
      settledCount += 1;

      if (settledCount >= 2) {
        finalize();
      }
    };

    const runSourceLookup = async (
      source: ConsumerLookupCandidate['source'],
      resolver: (value: string) => Promise<Product | null>
    ) => {
      try {
        const product = await resolver(barcode);

        if (product) {
          candidates.push({
            source,
            product,
          });

          scheduleFastFinalize();
        }
      } catch (error) {
        console.warn('[ProductLookup] consumer source failed:', {
          barcode,
          source,
          error,
        });
      } finally {
        registerSettlement();
      }
    };

    void runSourceLookup('food', fetchFoodProduct);
    void runSourceLookup('beauty', fetchBeautyProduct);
  });
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
  barcode: string,
  options?: ProductLookupOptions
): Promise<ProductLookupResult> => {
  console.log('[ProductLookup] resolve started:', {
    barcode,
    lookupMode: options?.lookupMode ?? 'auto',
  });

  const repositoryResult = await resolveProductFromRepository(barcode, {
    remoteFetch:
      options?.lookupMode === 'medicine'
        ? async (normalizedBarcode) => {
            console.log('[ProductLookup] medicine lookup started:', {
              barcode: normalizedBarcode,
            });

            const medicineProduct = await fetchMedicineProduct(normalizedBarcode);

            if (medicineProduct) {
              return {
                found: true,
                barcode: normalizedBarcode,
                product: medicineProduct,
                source: 'medicine',
              };
            }

            return {
              found: false,
              barcode: normalizedBarcode,
              reason: 'not_found',
            };
          }
        : options?.lookupMode === 'food'
          ? async (normalizedBarcode) => {
              const foodProduct = await fetchFoodProduct(normalizedBarcode);

              if (!foodProduct) {
                return {
                  found: false,
                  barcode: normalizedBarcode,
                  reason: 'not_found',
                };
              }

              return {
                found: true,
                barcode: normalizedBarcode,
                product: foodProduct,
                source: 'food',
              };
            }
          : options?.lookupMode === 'beauty'
            ? async (normalizedBarcode) => {
                const beautyProduct = await fetchBeautyProduct(normalizedBarcode);

                if (!beautyProduct) {
                  return {
                    found: false,
                    barcode: normalizedBarcode,
                    reason: 'not_found',
                  };
                }

                return {
                  found: true,
                  barcode: normalizedBarcode,
                  product: beautyProduct,
                  source: 'beauty',
                };
              }
            : fetchConsumerProduct,
  });
  return mapRepositoryResultToLookupResult(repositoryResult);
};

export const clearProductLookupRuntimeState = (): void => {
  clearProductRepositoryRuntimeState();
};

export const invalidateProductLookupBarcode = (barcode: string): void => {
  invalidateProductRepositoryBarcode(barcode);
};

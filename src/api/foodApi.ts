import axios from 'axios';
import type { Product } from '../utils/analysis';
import {
  resolveBrandOwner,
  resolveBrand,
  resolveCategories,
  resolveCountry,
  resolveIngredients,
  resolveLocalizedName,
  resolveManufacturingPlace,
  safeArray,
  safeObject,
  resolveOrigin,
} from './factsShared';

const foodClient = axios.create({
  baseURL: 'https://world.openfoodfacts.org/api/v2',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const foodSearchClient = axios.create({
  baseURL: 'https://world.openfoodfacts.org',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'ErEnesAl/1.0 (Barcode Analysis App)',
  },
});

const FOOD_FIELDS =
  'code,product_name,product_name_tr,product_name_en,product_name_de,product_name_fr,generic_name,generic_name_tr,generic_name_en,generic_name_de,generic_name_fr,brands,brand_owner,brands_owner,owners,image_url,image_front_url,ingredients_text,ingredients_text_tr,ingredients_text_en,ingredients_text_de,ingredients_text_fr,nutriscore_grade,nutriscore_score,ecoscore_grade,nova_group,nutrient_levels,nutriments,additives_tags,labels_tags,categories,categories_tags,allergens_tags,traces_tags,ingredients_analysis_tags,countries,countries_tags,origins,origins_tags,manufacturing_places,manufacturing_places_tags';

const mapFoodFactsProduct = (barcode: string, rawProduct: any): Product => {
  const p = rawProduct;
  const resolvedName = resolveLocalizedName(
    safeObject(p),
    'Bilinmeyen Ürün'
  );

  const resolvedScore =
    typeof p?.nutriscore_score === 'number'
      ? p.nutriscore_score
      : typeof p?.nutriments?.['nutrition-score-fr'] === 'number'
        ? p.nutriments['nutrition-score-fr']
        : undefined;
  const safeProduct = safeObject(p);

  return {
    barcode,
    name: resolvedName,
    brand: resolveBrand(safeProduct, 'Markasız'),
    image_url: String(p?.image_front_url || p?.image_url || '').trim(),
    type: 'food',
    score: resolvedScore,
    grade: String(p?.nutriscore_grade || p?.ecoscore_grade || 'unknown').trim(),
    nova_group:
      typeof p?.nova_group === 'number'
        ? p.nova_group
        : Number.isFinite(Number(p?.nova_group))
          ? Number(p.nova_group)
          : undefined,
    ingredients_text: resolveIngredients(safeProduct),
    additives: Array.isArray(p?.additives_tags) ? p.additives_tags : [],
    labels_tags: Array.isArray(p?.labels_tags) ? p.labels_tags : [],
    categories: resolveCategories(safeProduct),
    categories_tags: safeArray(p?.categories_tags),
    allergens_tags: Array.isArray(p?.allergens_tags) ? p.allergens_tags : [],
    traces_tags: Array.isArray(p?.traces_tags) ? p.traces_tags : [],
    ingredients_analysis_tags: Array.isArray(p?.ingredients_analysis_tags)
      ? p.ingredients_analysis_tags
      : [],
    nutriments: p?.nutriments || {},
    nutrient_levels: p?.nutrient_levels || {},
    sourceName: 'openfoodfacts',
    country: resolveCountry(safeProduct),
    countries_tags: safeArray(p?.countries_tags),
    origin: resolveOrigin(safeProduct),
    origins_tags: safeArray(p?.origins_tags),
    manufacturingPlace: resolveManufacturingPlace(safeProduct),
    brandOwner: resolveBrandOwner(safeProduct),
  };
};

/**
 * OpenFoodFacts üzerinden gıda ürünü sorgular.
 * 404 / status 0 gibi "ürün yok" durumları hata değil, normal null dönüşüdür.
 */
export const fetchFoodProduct = async (barcode: string): Promise<Product | null> => {
  try {
    console.log('[OpenFoodFacts] request started:', barcode);

    const response = await foodClient.get(`/product/${barcode}.json`, {
      params: {
        fields: FOOD_FIELDS,
      },
    });

    if (response.data?.status === 1) {
      const product = mapFoodFactsProduct(barcode, response.data.product);

      console.log('[OpenFoodFacts] success:', {
        barcode,
        name: product.name,
        grade: product.grade,
        score: product.score,
      });

      return product;
    }

    console.warn('[OpenFoodFacts] product not found in dataset:', barcode);
    return null;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const responseProductType = error.response?.data?.product_type;
      const responseBody = error.response?.data;

      const isNotFound =
        status === 404 ||
        responseBody?.status === 0 ||
        String(error.message || '').toLowerCase().includes('404');

      if (isNotFound) {
        console.warn('[OpenFoodFacts] product not found:', {
          barcode,
          status,
          productType: responseProductType,
        });
        return null;
      }

      console.error('[OpenFoodFacts] request failed:', {
        barcode,
        message: error.message,
        code: error.code,
        status,
        data: responseBody,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        timeout: error.config?.timeout,
      });
    } else {
      console.error('[OpenFoodFacts] unknown error:', error);
    }

    return null;
  }
};

export const searchFoodProductsByText = async (
  query: string,
  limit = 5
): Promise<Product[]> => {
  const trimmedQuery = String(query || '').replace(/\s+/g, ' ').trim();

  if (trimmedQuery.length < 3) {
    return [];
  }

  try {
    const response = await foodSearchClient.get('/cgi/search.pl', {
      params: {
        search_terms: trimmedQuery,
        search_simple: 1,
        action: 'process',
        json: 1,
        page_size: Math.max(1, Math.min(limit, 8)),
        fields: FOOD_FIELDS,
      },
    });

    const products = Array.isArray(response.data?.products)
      ? response.data.products
      : [];

    return products
      .map((item: any) => {
        const barcode = String(item?.code || '').trim();
        if (!barcode) {
          return null;
        }

        return mapFoodFactsProduct(barcode, item);
      })
      .filter((item: Product | null): item is Product => Boolean(item));
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.warn('[OpenFoodFacts] text search failed:', {
        query: trimmedQuery,
        message: error.message,
        status: error.response?.status,
      });
    } else {
      console.warn('[OpenFoodFacts] text search failed with unknown error:', error);
    }

    return [];
  }
};

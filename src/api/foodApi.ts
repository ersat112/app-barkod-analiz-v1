import axios from 'axios';
import type { Product } from '../utils/analysis';

const foodClient = axios.create({
  baseURL: 'https://world.openfoodfacts.org/api/v2',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const safeText = (value?: string | null, fallback = ''): string => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

const resolveCountry = (product: any): string => {
  return safeText(
    product?.countries ||
      product?.countries_tags?.[0] ||
      product?.manufacturing_places ||
      ''
  );
};

const resolveOrigin = (product: any): string => {
  return safeText(
    product?.origins ||
      product?.origins_tags?.[0] ||
      product?.countries ||
      ''
  );
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
        fields:
          'code,product_name,product_name_tr,product_name_en,generic_name,generic_name_tr,generic_name_en,brands,image_url,image_front_url,ingredients_text,ingredients_text_tr,ingredients_text_en,nutriscore_grade,nutriscore_score,ecoscore_grade,nova_group,nutrient_levels,nutriments,additives_tags,countries,countries_tags,origins,origins_tags,manufacturing_places',
      },
    });

    if (response.data?.status === 1) {
      const p = response.data.product;

      const resolvedName =
        safeText(p?.product_name) ||
        safeText(p?.product_name_tr) ||
        safeText(p?.product_name_en) ||
        safeText(p?.generic_name) ||
        safeText(p?.generic_name_tr) ||
        safeText(p?.generic_name_en) ||
        'Bilinmeyen Ürün';

      const resolvedScore =
        typeof p?.nutriscore_score === 'number'
          ? p.nutriscore_score
          : typeof p?.nutriments?.['nutrition-score-fr'] === 'number'
            ? p.nutriments['nutrition-score-fr']
            : undefined;

      const product: Product = {
        barcode,
        name: resolvedName,
        brand: safeText(p?.brands, 'Markasız'),
        image_url: safeText(p?.image_front_url || p?.image_url),
        type: 'food',
        score: resolvedScore,
        grade: safeText(p?.nutriscore_grade || p?.ecoscore_grade || 'unknown'),
        ingredients_text:
          safeText(p?.ingredients_text) ||
          safeText(p?.ingredients_text_tr) ||
          safeText(p?.ingredients_text_en),
        additives: Array.isArray(p?.additives_tags) ? p.additives_tags : [],
        nutriments: p?.nutriments || {},
        nutrient_levels: p?.nutrient_levels || {},
        sourceName: 'openfoodfacts',
        country: resolveCountry(p),
        origin: resolveOrigin(p),
      };

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
import axios from 'axios';
import type { Product } from '../utils/analysis';
import {
  resolveBrand,
  resolveLocalizedName,
  safeObject,
  sanitizeFactsText,
} from './factsShared';

/**
 * Merkezi kozmetik API servisi
 * OpenBeautyFacts API üzerinden kozmetik ve kişisel bakım ürünlerini çeker.
 */

const beautyClient = axios.create({
  baseURL: 'https://world.openbeautyfacts.org/api/v2',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const beautySearchClient = axios.create({
  baseURL: 'https://world.openbeautyfacts.org',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'ErEnesAl/1.0 (Barcode Analysis App)',
  },
});

const BEAUTY_FIELDS =
  'code,product_name,product_name_tr,product_name_en,generic_name,generic_name_tr,generic_name_en,brands,image_url,image_front_url,ingredients_text,ingredients_text_tr,ingredients_text_en,ecoscore_grade,nutriscore_grade,score,usage,instructions,countries,countries_tags,origins,origins_tags,manufacturing_places';

const safeText = (value?: string | null, fallback = ''): string => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

const resolveCountry = (product: any): string => {
  return sanitizeFactsText(
    product?.countries ||
      product?.countries_tags?.[0] ||
      product?.manufacturing_places ||
      ''
  );
};

const resolveOrigin = (product: any): string => {
  return sanitizeFactsText(
    product?.origins ||
      product?.origins_tags?.[0] ||
      product?.countries ||
      ''
  );
};

const mapBeautyFactsProduct = (barcode: string, rawProduct: any): Product => {
  const p = rawProduct;
  const resolvedName = resolveLocalizedName(
    safeObject(p),
    'İsimsiz Kozmetik'
  );

  return {
    barcode,
    name: resolvedName,
    brand: resolveBrand(safeObject(p), 'Bilinmeyen Marka'),
    image_url: safeText(p?.image_front_url || p?.image_url),
    type: 'beauty',
    score: typeof p?.score === 'number' ? p.score : undefined,
    grade: safeText(p?.ecoscore_grade || p?.nutriscore_grade || 'unknown'),
    ingredients_text:
      safeText(p?.ingredients_text) ||
      safeText(p?.ingredients_text_tr) ||
      safeText(p?.ingredients_text_en),
    usage_instructions:
      safeText(p?.usage) ||
      safeText(p?.instructions) ||
      'Kullanım talimatı belirtilmemiş.',
    sourceName: 'openbeautyfacts',
    country: resolveCountry(p),
    origin: resolveOrigin(p),
  };
};

export const fetchBeautyProduct = async (barcode: string): Promise<Product | null> => {
  try {
    console.log('[OpenBeautyFacts] request started:', barcode);

    const response = await beautyClient.get(`/product/${barcode}.json`, {
      params: {
        fields: BEAUTY_FIELDS,
      },
    });

    if (response.data?.status === 1) {
      const product = mapBeautyFactsProduct(barcode, response.data.product);

      console.log('[OpenBeautyFacts] success:', {
        barcode,
        name: product.name,
        grade: product.grade,
        score: product.score,
      });

      return product;
    }

    console.warn('[OpenBeautyFacts] product not found in dataset:', barcode);
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
        console.warn('[OpenBeautyFacts] product not found:', {
          barcode,
          status,
          productType: responseProductType,
        });
        return null;
      }

      console.error('[OpenBeautyFacts] request failed:', {
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
      console.error('[OpenBeautyFacts] unknown error:', error);
    }

    return null;
  }
};

export const searchBeautyProductsByText = async (
  query: string,
  limit = 5
): Promise<Product[]> => {
  const trimmedQuery = String(query || '').replace(/\s+/g, ' ').trim();

  if (trimmedQuery.length < 3) {
    return [];
  }

  try {
    const response = await beautySearchClient.get('/cgi/search.pl', {
      params: {
        search_terms: trimmedQuery,
        search_simple: 1,
        action: 'process',
        json: 1,
        page_size: Math.max(1, Math.min(limit, 8)),
        fields: BEAUTY_FIELDS,
      },
    });

    const products = Array.isArray(response.data?.products)
      ? response.data.products
      : [];

    return products
      .map((item: any) => {
        const barcode = safeText(item?.code);
        if (!barcode) {
          return null;
        }

        return mapBeautyFactsProduct(barcode, item);
      })
      .filter((item: Product | null): item is Product => Boolean(item));
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.warn('[OpenBeautyFacts] text search failed:', {
        query: trimmedQuery,
        message: error.message,
        status: error.response?.status,
      });
    } else {
      console.warn('[OpenBeautyFacts] text search failed with unknown error:', error);
    }

    return [];
  }
};

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

export const fetchBeautyProduct = async (barcode: string): Promise<Product | null> => {
  try {
    console.log('[OpenBeautyFacts] request started:', barcode);

    const response = await beautyClient.get(`/product/${barcode}.json`, {
      params: {
        fields:
          'code,product_name,product_name_tr,product_name_en,generic_name,generic_name_tr,generic_name_en,brands,image_url,image_front_url,ingredients_text,ingredients_text_tr,ingredients_text_en,ecoscore_grade,nutriscore_grade,score,usage,instructions,countries,countries_tags,origins,origins_tags,manufacturing_places',
      },
    });

    if (response.data?.status === 1) {
      const p = response.data.product;

      const resolvedName = resolveLocalizedName(
        safeObject(p),
        'İsimsiz Kozmetik'
      );

      const product: Product = {
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

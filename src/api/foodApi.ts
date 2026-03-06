import axios from 'axios';
import { Product } from '../utils/analysis'; // cite: 1

const OFF_BASE_URL = 'https://world.openfoodfacts.org/api/v2/product/';

/**
 * 🍎 OpenFoodFacts üzerinden gıda ürünü sorgular.
 */
export const fetchFoodProduct = async (barcode: string): Promise<Product | null> => {
  try {
    const response = await axios.get(`${OFF_BASE_URL}${barcode}.json`, {
      params: {
        fields: 'product_name,product_name_tr,product_name_en,generic_name,generic_name_tr,generic_name_en,brands,image_url,ingredients_text,nutriscore_grade,nutriscore_score,ecoscore_grade,nova_group,nutrient_levels,nutriments,additives_tags'
      }
    });

    if (response.data.status === 1) {
      const p = response.data.product;
      const resolvedName =
        p.product_name ||
        p.product_name_tr ||
        p.product_name_en ||
        p.generic_name ||
        p.generic_name_tr ||
        p.generic_name_en ||
        'Bilinmeyen Ürün';

      return {
        barcode,
        name: resolvedName,
        brand: p.brands || 'Markasız',
        image_url: p.image_url || '',
        type: 'food',
        score: typeof p.nutriscore_score === 'number' ? p.nutriscore_score : undefined,
        grade: p.nutriscore_grade || 'unknown',
        ingredients_text: p.ingredients_text || '',
        additives: p.additives_tags || [],
        nutriments: p.nutriments || {},
        nutrient_levels: p.nutrient_levels || {}
      };
    }
    return null;
  } catch (error) {
    console.error("Gıda API Hatası:", error);
    return null;
  }
};

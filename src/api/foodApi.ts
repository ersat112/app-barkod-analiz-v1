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
        fields: 'product_name,brands,image_url,ingredients_text,nutriscore_grade,ecoscore_grade,nova_group,nutrient_levels,nutriments,additives_tags'
      }
    });

    if (response.data.status === 1) {
      const p = response.data.product;
      return {
        barcode,
        name: p.product_name || 'Bilinmeyen Ürün',
        brand: p.brands || 'Markasız',
        image_url: p.image_url || '',
        type: 'food',
        score: p.nutriscore_score || 0, // cite: 1
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
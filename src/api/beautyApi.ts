import axios from 'axios';
import { Product } from '../utils/analysis';

/**
 * ErEnesAl® v1 - Merkezi Kozmetik API Servisi
 * OpenBeautyFacts API üzerinden kozmetik ve kişisel bakım ürünlerini çeker.
 */

const beautyClient = axios.create({
  baseURL: 'https://world.openbeautyfacts.org/api/v2',
  timeout: 12000,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'ErEnesAl - BeautyTracker/1.0'
  }
});

export const fetchBeautyProduct = async (barcode: string): Promise<Product | null> => {
  try {
    console.log(`📡 Kozmetik API İsteği: ${barcode}`);
    
    const response = await beautyClient.get(`/product/${barcode}.json`);

    if (response.data.status === 1) {
      const p = response.data.product;
      
      return {
        barcode: barcode,
        name: p.product_name || p.product_name_tr || 'İsimsiz Kozmetik',
        brand: p.brands || 'Bilinmeyen Marka',
        image_url: p.image_front_url || p.image_url || '',
        type: 'beauty',
        // Kozmetiklerde Nutri-Score yerine bazen Nova veya Eco-Score gelir, güvenli bir değer atıyoruz
        grade: p.ecoscore_grade || 'c',
        ingredients_text: p.ingredients_text || p.ingredients_text_tr || '',
        // 🧴 Hata veren alan artık güvenli:
        usage_instructions: p.usage || p.instructions || 'Kullanım talimatı belirtilmemiş.'
      };
    }

    return null;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Kozmetik API Hatası:", error.message);
    }
    return null;
  }
};
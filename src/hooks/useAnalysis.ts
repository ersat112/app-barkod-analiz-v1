import { useState, useCallback } from 'react';
import { fetchFoodProduct } from '../api/foodApi';
import { analyzeProduct, Product, AnalysisResult } from '../utils/analysis';
import { saveProductToHistory } from '../services/db';
import { useTranslation } from 'react-i18next';

/**
 * ErEnesAl® v1 - Merkezi Analiz Hook'u
 * Ürün verisini çekme, analiz etme ve kaydetme süreçlerini tek merkezden yönetir.
 */
export const useAnalysis = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const startAnalysis = useCallback(async (barcode: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // 1. Veri Çekme
      const data = await fetchFoodProduct(barcode);
      
      if (!data) {
        setError(t('product_not_found'));
        return null;
      }

      // 2. Analiz
      const analysisResult = analyzeProduct(data);
      
      // 3. Yerel SQLite Kaydı (Asenkron)
      await saveProductToHistory(data, data.score || 0);

      return { product: data, analysis: analysisResult };

    } catch (err) {
      console.error("Analysis Hook Error:", err);
      setError(t('error_generic'));
      return null;
    } finally {
      setLoading(false);
    }
  }, [t]);

  return { startAnalysis, loading, error };
};
import { create } from 'zustand';
import { Product, AnalysisResult } from '../utils/analysis';

/**
 * ErEnesAl® v1 - Tarama Durum Yönetimi
 * Uygulama genelinde taranan ürünlerin ve analiz sonuçlarının senkronize kalmasını sağlar.
 */

interface ScanState {
  currentProduct: Product | null;
  currentAnalysis: AnalysisResult | null;
  isAnalyzing: boolean;
  setAnalysis: (product: Product, analysis: AnalysisResult) => void;
  resetScan: () => void;
  setAnalyzing: (status: boolean) => void;
}

export const useScanStore = create<ScanState>((set) => ({
  currentProduct: null,
  currentAnalysis: null,
  isAnalyzing: false,

  /**
   * Yeni bir analiz sonucu geldiğinde tüm bileşenleri günceller.
   */
  setAnalysis: (product, analysis) => set({ 
    currentProduct: product, 
    currentAnalysis: analysis,
    isAnalyzing: false 
  }),

  /**
   * Yeni bir tarama öncesi hafızayı temizler.
   */
  resetScan: () => set({ currentProduct: null, currentAnalysis: null }),

  /**
   * Analiz sürecinin (loading) durumunu kontrol eder.
   */
  setAnalyzing: (status) => set({ isAnalyzing: status }),
}));
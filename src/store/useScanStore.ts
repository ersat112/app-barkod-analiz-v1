import { create } from 'zustand';
import type { AnalysisResult, Product } from '../utils/analysis';

type LookupSource = 'openfoodfacts' | 'openbeautyfacts' | 'manual' | 'unknown';

type ScanStoreState = {
  currentBarcode: string | null;
  currentProduct: Product | null;
  currentAnalysis: AnalysisResult | null;

  lastResolvedSource: LookupSource;
  lastScanAt: string | null;

  notFoundBarcode: string | null;
  pendingDraftBarcode: string | null;

  setCurrentBarcode: (barcode: string | null) => void;

  setAnalysis: (product: Product, analysis: AnalysisResult) => void;

  setScanResult: (params: {
    barcode: string;
    product: Product;
    analysis: AnalysisResult;
    source?: LookupSource;
  }) => void;

  markNotFound: (barcode: string) => void;
  setPendingDraftBarcode: (barcode: string | null) => void;

  clearCurrentProduct: () => void;
  clearNotFoundState: () => void;
  resetScanState: () => void;
};

export const useScanStore = create<ScanStoreState>((set) => ({
  currentBarcode: null,
  currentProduct: null,
  currentAnalysis: null,

  lastResolvedSource: 'unknown',
  lastScanAt: null,

  notFoundBarcode: null,
  pendingDraftBarcode: null,

  setCurrentBarcode: (barcode) =>
    set({
      currentBarcode: barcode,
    }),

  setAnalysis: (product, analysis) =>
    set({
      currentBarcode: product.barcode,
      currentProduct: product,
      currentAnalysis: analysis,
      lastResolvedSource: product.sourceName ?? 'unknown',
      lastScanAt: new Date().toISOString(),
      notFoundBarcode: null,
    }),

  setScanResult: ({ barcode, product, analysis, source = 'unknown' }) =>
    set({
      currentBarcode: barcode,
      currentProduct: product,
      currentAnalysis: analysis,
      lastResolvedSource: source,
      lastScanAt: new Date().toISOString(),
      notFoundBarcode: null,
    }),

  markNotFound: (barcode) =>
    set({
      currentBarcode: barcode,
      currentProduct: null,
      currentAnalysis: null,
      notFoundBarcode: barcode,
      pendingDraftBarcode: barcode,
      lastResolvedSource: 'unknown',
      lastScanAt: new Date().toISOString(),
    }),

  setPendingDraftBarcode: (barcode) =>
    set({
      pendingDraftBarcode: barcode,
    }),

  clearCurrentProduct: () =>
    set({
      currentBarcode: null,
      currentProduct: null,
      currentAnalysis: null,
    }),

  clearNotFoundState: () =>
    set({
      notFoundBarcode: null,
      pendingDraftBarcode: null,
    }),

  resetScanState: () =>
    set({
      currentBarcode: null,
      currentProduct: null,
      currentAnalysis: null,
      lastResolvedSource: 'unknown',
      lastScanAt: null,
      notFoundBarcode: null,
      pendingDraftBarcode: null,
    }),
}));
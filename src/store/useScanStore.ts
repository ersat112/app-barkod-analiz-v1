import { create } from 'zustand';
import type { AnalysisResult, Product } from '../utils/analysis';

type LookupSource =
  | 'openfoodfacts'
  | 'openbeautyfacts'
  | 'titck'
  | 'manual'
  | 'unknown';

type ScanPreviewCacheEntry = {
  product: Product;
  analysis: AnalysisResult;
  cachedAt: string;
};

type ScanStoreState = {
  currentBarcode: string | null;
  currentProduct: Product | null;
  currentAnalysis: AnalysisResult | null;
  previewCacheByBarcode: Record<string, ScanPreviewCacheEntry>;

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

const MAX_PREVIEW_CACHE_ITEMS = 24;

const buildPreviewCacheState = (
  currentCache: Record<string, ScanPreviewCacheEntry>,
  product: Product,
  analysis: AnalysisResult
): Record<string, ScanPreviewCacheEntry> => {
  const nextCache: Record<string, ScanPreviewCacheEntry> = {
    ...currentCache,
    [product.barcode]: {
      product,
      analysis,
      cachedAt: new Date().toISOString(),
    },
  };

  const entries = Object.entries(nextCache);

  if (entries.length <= MAX_PREVIEW_CACHE_ITEMS) {
    return nextCache;
  }

  const sortedEntries = entries.sort(
    (left, right) =>
      new Date(right[1].cachedAt).getTime() - new Date(left[1].cachedAt).getTime()
  );

  return Object.fromEntries(sortedEntries.slice(0, MAX_PREVIEW_CACHE_ITEMS));
};

export const useScanStore = create<ScanStoreState>((set) => ({
  currentBarcode: null,
  currentProduct: null,
  currentAnalysis: null,
  previewCacheByBarcode: {},

  lastResolvedSource: 'unknown',
  lastScanAt: null,

  notFoundBarcode: null,
  pendingDraftBarcode: null,

  setCurrentBarcode: (barcode) =>
    set({
      currentBarcode: barcode,
    }),

  setAnalysis: (product, analysis) =>
    set((state) => ({
      currentBarcode: product.barcode,
      currentProduct: product,
      currentAnalysis: analysis,
      previewCacheByBarcode: buildPreviewCacheState(
        state.previewCacheByBarcode,
        product,
        analysis
      ),
      lastResolvedSource: product.sourceName ?? 'unknown',
      lastScanAt: new Date().toISOString(),
      notFoundBarcode: null,
    })),

  setScanResult: ({ barcode, product, analysis, source = 'unknown' }) =>
    set((state) => ({
      currentBarcode: barcode,
      currentProduct: product,
      currentAnalysis: analysis,
      previewCacheByBarcode: buildPreviewCacheState(
        state.previewCacheByBarcode,
        product,
        analysis
      ),
      lastResolvedSource: source,
      lastScanAt: new Date().toISOString(),
      notFoundBarcode: null,
    })),

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
      previewCacheByBarcode: {},
      lastResolvedSource: 'unknown',
      lastScanAt: null,
      notFoundBarcode: null,
      pendingDraftBarcode: null,
    }),
}));

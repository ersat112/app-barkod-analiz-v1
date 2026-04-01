export type MarketScope = 'local' | 'national_chain' | string;

export type MarketDataFreshnessMode = 'weekly_crawl' | 'hot_refresh' | 'mixed';

export type MarketPriceSourceType =
  | 'national_reference_price'
  | 'local_market_price'
  | string;

export type MarketCoverageScope =
  | 'national'
  | 'city'
  | 'district'
  | 'live_controlled_local'
  | 'verified_local_needs_adapter'
  | 'discovery_pending_national_fallback'
  | string;

export type MarketPricingScope =
  | 'national_reference'
  | 'local_city_offer'
  | 'district_offer'
  | 'mixed'
  | string;

export type MarketOffer = {
  marketKey?: string | null;
  marketName: string;
  marketLogoUrl?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  marketType: MarketScope;
  coverageScope?: MarketCoverageScope | null;
  pricingScope?: MarketPricingScope | null;
  priceSourceType?: MarketPriceSourceType | null;
  cityCode: string;
  cityName: string;
  districtName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceMeters?: number | null;
  price: number;
  currency: 'TRY' | string;
  unitPrice?: number | null;
  unitPriceUnit?: string | null;
  inStock: boolean;
  imageUrl?: string | null;
  capturedAt: string;
  sourceUrl: string;
  sourceConfidence?: number | null;
};

export type MarketPriceHistoryPoint = {
  capturedAt: string;
  price: number;
  currency: 'TRY' | string;
  inStock: boolean;
};

export type MarketDataFreshness = {
  mode: MarketDataFreshnessMode;
  lastFullRefreshAt?: string | null;
  lastHotRefreshAt?: string | null;
};

export type MarketRuntimeStatusResponse = {
  cities: number;
  activeMarkets: number;
  cityTargets: number;
  verifiedCities: number;
  localCandidates: number;
  scrapeRuns: number;
  offers: number;
  currentOffers: number;
  canonicalProducts: number;
  barcodes: number;
  liveAdapters: number;
  plannedAdapters: number;
  metroCities: number;
  v1LocalProgramCities: number;
  v2LocalProgramCities: number;
  v1NationalCoreMarkets: number;
  scanSignals: number;
};

export type MarketProgramCoverageResponse = {
  [key: string]: unknown;
};

export type MarketIntegrationStatusSection = {
  enabled?: boolean;
  available?: boolean;
  [key: string]: unknown;
};

export type MarketIntegrationsStatusResponse = {
  sqlite?: MarketIntegrationStatusSection | null;
  postgres?: MarketIntegrationStatusSection | null;
  firebase?: MarketIntegrationStatusSection | null;
  [key: string]: unknown;
};

export type MarketProductOffersResponse = {
  barcode: string;
  fetchedAt: string;
  requestId?: string | null;
  partial?: boolean;
  warnings?: string[];
  city?: {
    code: string;
    name: string;
  } | null;
  dataFreshness?: MarketDataFreshness | null;
  offers: MarketOffer[];
};

export type MarketSearchProduct = {
  barcode: string;
  productName: string;
  brand?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  marketLogoUrl?: string | null;
  bestOffer?: MarketOffer | null;
  marketCount: number;
  inStockMarketCount: number;
  dataFreshness?: MarketDataFreshness | null;
};

export type MarketProductSearchResponse = {
  query: string;
  fetchedAt: string;
  requestId?: string | null;
  partial?: boolean;
  warnings?: string[];
  results: MarketSearchProduct[];
};

export type MarketPriceHistoryResponse = {
  barcode: string;
  marketName: string;
  days: number;
  fetchedAt: string;
  requestId?: string | null;
  partial?: boolean;
  warnings?: string[];
  history: MarketPriceHistoryPoint[];
};

export type MarketBasketCompareItemRequest = {
  barcode: string;
  quantity: number;
};

export type MarketBasketCompareItem = {
  barcode: string;
  quantity: number;
  bestOffer?: MarketOffer | null;
  offers: MarketOffer[];
  availableMarketCount: number;
};

export type MarketBasketMarketTotal = {
  marketKey: string;
  marketName: string;
  marketLogoUrl?: string | null;
  distanceMeters?: number | null;
  branchId?: string | null;
  branchName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  basketTotal: number;
  availableItemCount: number;
  missingItemCount: number;
};

export type MarketBasketMissingItem = {
  barcode: string;
  quantity: number;
};

export type MarketBasketCompareResponse = {
  fetchedAt: string;
  requestId?: string | null;
  partial?: boolean;
  warnings?: string[];
  city?: {
    code: string;
    name: string;
  } | null;
  district?: string | null;
  mixedCheapestTotal: number;
  bestSingleMarketTotal?: number | null;
  nearestMarketTotal?: number | null;
  items: MarketBasketCompareItem[];
  marketTotals: MarketBasketMarketTotal[];
  missingItems: MarketBasketMissingItem[];
};

export type MarketAlternativePricingRequest = {
  barcode: string;
  cityCode: string;
  districtName?: string | null;
  candidateBarcodes: string[];
};

export type MarketAlternativePricingEntry = {
  barcode: string;
  bestOffer?: MarketOffer | null;
  marketCount: number;
  inStockMarketCount: number;
  dataFreshness?: MarketDataFreshness | null;
};

export type MarketAlternativePricingResponse = {
  barcode: string;
  cityCode: string;
  fetchedAt: string;
  requestId?: string | null;
  partial?: boolean;
  warnings?: string[];
  entries: MarketAlternativePricingEntry[];
};

export type MarketOpportunityScoreInput = {
  healthDelta: number;
  preferenceMatch: boolean;
  priceAdvantageRatio: number;
  availabilityRatio: number;
  freshnessRatio: number;
};

export type MarketOpportunityBreakdown = {
  finalScore: number;
  healthContribution: number;
  preferenceContribution: number;
  priceContribution: number;
  availabilityContribution: number;
  freshnessContribution: number;
};

export type MarketScanEventRequest = {
  barcode: string;
  cityCode?: string | null;
  districtName?: string | null;
  platform?: 'android' | 'ios' | 'web' | string;
  scannedAt: string;
  appVersion?: string | null;
  requestId?: string | null;
};

export type MarketScanEventResponse = {
  acceptedCount?: number;
  writtenCount?: number;
  signalCount?: number;
  [key: string]: unknown;
};

export type MarketBatchScanEventResponse = {
  acceptedCount?: number;
  writtenCount?: number;
  signalCount?: number;
  [key: string]: unknown;
};

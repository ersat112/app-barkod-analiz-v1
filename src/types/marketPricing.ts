export type MarketScope = 'local' | 'national_chain';

export type MarketDataFreshnessMode = 'weekly_crawl' | 'hot_refresh' | 'mixed';

export type MarketOffer = {
  marketName: string;
  marketType: MarketScope;
  cityCode: string;
  cityName: string;
  districtName?: string | null;
  price: number;
  currency: 'TRY' | string;
  unitPrice?: number | null;
  unitPriceUnit?: string | null;
  inStock: boolean;
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

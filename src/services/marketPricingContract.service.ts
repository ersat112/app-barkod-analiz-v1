import type {
  MarketAlternativePricingRequest,
  MarketDataFreshness,
  MarketOffer,
  MarketOpportunityBreakdown,
  MarketOpportunityScoreInput,
  MarketScanEventRequest,
} from '../types/marketPricing';

function clamp(value: number, min = 0, max = 1): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

export function buildMarketGelsinOffersEndpoint(
  barcode: string,
  params?: {
    cityCode?: string;
    districtName?: string;
    limit?: number;
    includeOutOfStock?: boolean;
  }
): string {
  const query = new URLSearchParams();

  if (params?.cityCode) {
    query.set('city_code', params.cityCode);
  }

  if (params?.districtName) {
    query.set('district', params.districtName);
  }

  if (typeof params?.limit === 'number' && Number.isFinite(params.limit)) {
    query.set('limit', String(params.limit));
  }

  if (typeof params?.includeOutOfStock === 'boolean') {
    query.set('include_out_of_stock', String(params.includeOutOfStock));
  }

  const suffix = query.toString();
  return `/v1/products/${encodeURIComponent(barcode)}/offers${suffix ? `?${suffix}` : ''}`;
}

export function buildMarketGelsinOffersByProductIdEndpoint(
  productId: string,
  params?: {
    cityCode?: string;
    districtName?: string;
    limit?: number;
    includeOutOfStock?: boolean;
  }
): string {
  const query = new URLSearchParams();

  if (params?.cityCode) {
    query.set('city_code', params.cityCode);
  }

  if (params?.districtName) {
    query.set('district', params.districtName);
  }

  if (typeof params?.limit === 'number' && Number.isFinite(params.limit)) {
    query.set('limit', String(params.limit));
  }

  if (typeof params?.includeOutOfStock === 'boolean') {
    query.set('include_out_of_stock', String(params.includeOutOfStock));
  }

  const suffix = query.toString();
  return `/v1/product-ids/${encodeURIComponent(productId)}/offers${suffix ? `?${suffix}` : ''}`;
}

export function buildMarketGelsinHistoryEndpoint(
  barcode: string,
  params?: {
    cityCode?: string;
    marketName?: string;
    days?: number;
  }
): string {
  const query = new URLSearchParams();

  if (params?.cityCode) {
    query.set('city_code', params.cityCode);
  }

  if (params?.marketName) {
    query.set('market_name', params.marketName);
  }

  if (typeof params?.days === 'number' && Number.isFinite(params.days)) {
    query.set('days', String(params.days));
  }

  const suffix = query.toString();
  return `/v1/products/${encodeURIComponent(barcode)}/price-history${suffix ? `?${suffix}` : ''}`;
}

export function buildMarketGelsinAlternativesEndpoint(): string {
  return '/v1/pricing/alternatives';
}

export function buildMarketGelsinBarcodeLookupEndpoint(barcode: string): string {
  return `/api/v1/barcode/${encodeURIComponent(barcode)}`;
}

export function buildMarketGelsinSearchEndpoint(params?: {
  query?: string;
  cityCode?: string;
  category?: string;
  categoryId?: string;
  brand?: string;
  limit?: number;
}): string {
  const query = new URLSearchParams();

  if (params?.query) {
    query.set('q', params.query);
  }

  if (params?.cityCode) {
    query.set('city_code', params.cityCode);
  }

  if (params?.category) {
    query.set('category', params.category);
  }

  if (params?.categoryId) {
    query.set('category_id', params.categoryId);
  }

  if (params?.brand) {
    query.set('brand', params.brand);
  }

  if (typeof params?.limit === 'number' && Number.isFinite(params.limit)) {
    query.set('limit', String(params.limit));
  }

  const suffix = query.toString();
  return `/v1/search/products${suffix ? `?${suffix}` : ''}`;
}

export function buildMarketGelsinCategoryTreeEndpoint(params?: {
  cityCode?: string;
  rootCategoryId?: string;
  depthLimit?: number;
  query?: string;
  includeCounts?: boolean;
  onlyActive?: boolean;
}): string {
  const query = new URLSearchParams();

  if (params?.cityCode) {
    query.set('city_code', params.cityCode);
  }

  if (params?.rootCategoryId) {
    query.set('root_category_id', params.rootCategoryId);
  }

  if (typeof params?.depthLimit === 'number' && Number.isFinite(params.depthLimit)) {
    query.set('depth_limit', String(params.depthLimit));
  }

  if (params?.query) {
    query.set('q', params.query);
  }

  if (typeof params?.includeCounts === 'boolean') {
    query.set('include_counts', String(params.includeCounts));
  }

  if (typeof params?.onlyActive === 'boolean') {
    query.set('only_active', String(params.onlyActive));
  }

  const suffix = query.toString();
  return `/v1/categories/tree${suffix ? `?${suffix}` : ''}`;
}

export function buildMarketGelsinLegacyOffersSearchEndpoint(params?: {
  citySlug?: string;
  query?: string;
  marketKey?: string;
  barcode?: string;
  limit?: number;
}): string {
  const query = new URLSearchParams();

  if (params?.citySlug) {
    query.set('city', params.citySlug);
  }

  if (params?.query) {
    query.set('q', params.query);
  }

  if (params?.marketKey) {
    query.set('market_key', params.marketKey);
  }

  if (params?.barcode) {
    query.set('barcode', params.barcode);
  }

  if (typeof params?.limit === 'number' && Number.isFinite(params.limit)) {
    query.set('limit', String(params.limit));
  }

  const suffix = query.toString();
  return `/api/v1/offers${suffix ? `?${suffix}` : ''}`;
}

export function buildMarketGelsinStatusEndpoint(): string {
  return '/api/v1/status';
}

export function buildMarketGelsinProgramCoverageEndpoint(): string {
  return '/api/v1/program/coverage';
}

export function buildMarketGelsinIntegrationsStatusEndpoint(): string {
  return '/api/v1/integrations/status';
}

export function buildMarketGelsinScanEventEndpoint(): string {
  return '/api/v1/barcode/scans';
}

export function buildMarketGelsinBatchScanEventEndpoint(): string {
  return '/api/v1/barcode/scans/batch';
}

export function buildMarketGelsinBasketCompareEndpoint(): string {
  return '/api/v1/basket/compare';
}

export function buildMarketGelsinAlternativesRequest(
  barcode: string,
  cityCode: string,
  candidateBarcodes: string[],
  districtName?: string | null
): MarketAlternativePricingRequest {
  return {
    barcode,
    cityCode,
    districtName: districtName ?? null,
    candidateBarcodes: candidateBarcodes.filter((value) => value.trim().length > 0),
  };
}

export function buildMarketGelsinScanEventRequest(
  input: MarketScanEventRequest
): MarketScanEventRequest {
  return {
    barcode: input.barcode.trim(),
    cityCode: input.cityCode?.trim() || null,
    districtName: input.districtName?.trim() || null,
    platform: input.platform ?? 'android',
    scannedAt: input.scannedAt,
    appVersion: input.appVersion?.trim() || null,
    requestId: input.requestId?.trim() || null,
  };
}

const normalizeMarketIdentity = (value?: string | null): string =>
  String(value || '')
    .trim()
    .toLocaleLowerCase('tr')
    .replace(/[ıİ]/g, 'i')
    .replace(/[şŞ]/g, 's')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function getMarketOfferIdentity(offer: MarketOffer): string {
  return (
    normalizeMarketIdentity(offer.marketKey) ||
    normalizeMarketIdentity(offer.marketName) ||
    `${offer.marketName}-${offer.branchName || ''}`.trim()
  );
}

export function countUniqueMarkets(
  offers: MarketOffer[],
  options?: {
    inStockOnly?: boolean;
  }
): number {
  const identities = new Set<string>();

  offers.forEach((offer) => {
    if (options?.inStockOnly && !offer.inStock) {
      return;
    }

    const identity = getMarketOfferIdentity(offer);

    if (identity) {
      identities.add(identity);
    }
  });

  return identities.size;
}

export function getBestInStockOffer(offers: MarketOffer[]): MarketOffer | null {
  const inStockOffers = offers.filter((offer) => offer.inStock);

  if (!inStockOffers.length) {
    return null;
  }

  return [...inStockOffers].sort((left, right) => left.price - right.price)[0] ?? null;
}

export function partitionOffersByPriceSourceType(offers: MarketOffer[]): {
  localMarketOffers: MarketOffer[];
  nationalReferenceOffers: MarketOffer[];
  otherOffers: MarketOffer[];
} {
  return offers.reduce(
    (accumulator, offer) => {
      if (offer.priceSourceType === 'local_market_price') {
        accumulator.localMarketOffers.push(offer);
      } else if (offer.priceSourceType === 'national_reference_price') {
        accumulator.nationalReferenceOffers.push(offer);
      } else {
        accumulator.otherOffers.push(offer);
      }

      return accumulator;
    },
    {
      localMarketOffers: [] as MarketOffer[],
      nationalReferenceOffers: [] as MarketOffer[],
      otherOffers: [] as MarketOffer[],
    }
  );
}

export function computeFreshnessRatio(
  freshness: MarketDataFreshness | null | undefined,
  now = Date.now()
): number {
  const candidateTimestamps = [
    freshness?.lastHotRefreshAt,
    freshness?.lastFullRefreshAt,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  if (!candidateTimestamps.length) {
    return 0;
  }

  const newest = Math.max(...candidateTimestamps);
  const ageHours = Math.max(0, now - newest) / (1000 * 60 * 60);

  if (ageHours <= 24) {
    return 1;
  }

  if (ageHours <= 72) {
    return 0.8;
  }

  if (ageHours <= 7 * 24) {
    return 0.55;
  }

  return 0.25;
}

export function computePriceAdvantageRatio(
  currentPrice: number | null | undefined,
  candidatePrice: number | null | undefined
): number {
  if (
    typeof currentPrice !== 'number' ||
    !Number.isFinite(currentPrice) ||
    currentPrice <= 0 ||
    typeof candidatePrice !== 'number' ||
    !Number.isFinite(candidatePrice) ||
    candidatePrice <= 0
  ) {
    return 0;
  }

  const ratio = (currentPrice - candidatePrice) / currentPrice;
  return clamp(ratio, -1, 1);
}

export function computeMarketOpportunityScore(
  input: MarketOpportunityScoreInput
): MarketOpportunityBreakdown {
  const healthContribution = clamp(input.healthDelta / 40) * 0.45;
  const preferenceContribution = input.preferenceMatch ? 0.2 : 0;
  const priceContribution = clamp(Math.max(input.priceAdvantageRatio, 0)) * 0.2;
  const availabilityContribution = clamp(input.availabilityRatio) * 0.1;
  const freshnessContribution = clamp(input.freshnessRatio) * 0.05;

  const finalScore = Number(
    (
      healthContribution +
      preferenceContribution +
      priceContribution +
      availabilityContribution +
      freshnessContribution
    ).toFixed(4)
  );

  return {
    finalScore,
    healthContribution,
    preferenceContribution,
    priceContribution,
    availabilityContribution,
    freshnessContribution,
  };
}

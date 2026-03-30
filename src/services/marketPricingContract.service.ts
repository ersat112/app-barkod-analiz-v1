import type {
  MarketAlternativePricingRequest,
  MarketDataFreshness,
  MarketOffer,
  MarketOpportunityBreakdown,
  MarketOpportunityScoreInput,
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

export function getBestInStockOffer(offers: MarketOffer[]): MarketOffer | null {
  const inStockOffers = offers.filter((offer) => offer.inStock);

  if (!inStockOffers.length) {
    return null;
  }

  return [...inStockOffers].sort((left, right) => left.price - right.price)[0] ?? null;
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

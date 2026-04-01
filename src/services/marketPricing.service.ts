import axios from 'axios';

import { MARKET_GELSIN_RUNTIME } from '../config/marketGelsinRuntime';
import type {
  MarketAlternativePricingEntry,
  MarketAlternativePricingRequest,
  MarketAlternativePricingResponse,
  MarketBatchScanEventResponse,
  MarketDataFreshness,
  MarketOffer,
  MarketIntegrationsStatusResponse,
  MarketProductSearchResponse,
  MarketProgramCoverageResponse,
  MarketPriceHistoryPoint,
  MarketPriceHistoryResponse,
  MarketProductOffersResponse,
  MarketRuntimeStatusResponse,
  MarketScanEventRequest,
  MarketScanEventResponse,
  MarketSearchProduct,
} from '../types/marketPricing';
import {
  buildMarketGelsinAlternativesEndpoint,
  buildMarketGelsinBatchScanEventEndpoint,
  buildMarketGelsinHistoryEndpoint,
  buildMarketGelsinIntegrationsStatusEndpoint,
  buildMarketGelsinOffersEndpoint,
  buildMarketGelsinProgramCoverageEndpoint,
  buildMarketGelsinScanEventEndpoint,
  buildMarketGelsinSearchEndpoint,
  buildMarketGelsinStatusEndpoint,
} from './marketPricingContract.service';

const marketPricingClient = MARKET_GELSIN_RUNTIME.baseUrl
  ? axios.create({
      baseURL: MARKET_GELSIN_RUNTIME.baseUrl,
      timeout: MARKET_GELSIN_RUNTIME.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ErEnesAl/1.0 (BarkodAnaliz Market Pricing)',
      },
    })
  : null;

const toObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const toText = (value: unknown, fallback = ''): string => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim();
  return normalized.length ? normalized : fallback;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const toBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const parseFreshness = (value: unknown): MarketDataFreshness | null => {
  const payload = toObject(value);
  const mode = toText(payload.mode);

  if (!mode) {
    return null;
  }

  return {
    mode: mode as MarketDataFreshness['mode'],
    lastFullRefreshAt: toText(
      payload.last_full_refresh_at ?? payload.lastFullRefreshAt,
      ''
    ) || null,
    lastHotRefreshAt: toText(
      payload.last_hot_refresh_at ?? payload.lastHotRefreshAt,
      ''
    ) || null,
  };
};

const parseOffer = (
  value: unknown,
  fallbackCityCode?: string,
  fallbackCityName?: string
): MarketOffer => {
  const payload = toObject(value);

  return {
    marketKey: toText(payload.market_key ?? payload.marketKey, '') || null,
    marketName: toText(payload.market_name ?? payload.marketName, '-'),
    marketLogoUrl:
      toText(payload.market_logo_url ?? payload.marketLogoUrl, '') || null,
    marketType: toText(payload.market_type ?? payload.marketType, 'local') as MarketOffer['marketType'],
    coverageScope: toText(
      payload.coverage_scope ?? payload.coverageScope,
      ''
    ) || null,
    pricingScope: toText(
      payload.pricing_scope ?? payload.pricingScope,
      ''
    ) || null,
    priceSourceType: toText(
      payload.price_source_type ?? payload.priceSourceType,
      ''
    ) || null,
    cityCode:
      toText(payload.city_code ?? payload.cityCode, '') ||
      fallbackCityCode ||
      '',
    cityName:
      toText(payload.city_name ?? payload.cityName, '') ||
      fallbackCityName ||
      '',
    districtName: toText(payload.district_name ?? payload.districtName, '') || null,
    distanceMeters: toNumber(
      payload.distance_meters ?? payload.distanceMeters ?? payload.distance
    ),
    price: toNumber(payload.price) ?? 0,
    currency: toText(payload.currency, 'TRY'),
    unitPrice: toNumber(payload.unit_price ?? payload.unitPrice),
    unitPriceUnit: toText(
      payload.unit_price_unit ?? payload.unitPriceUnit,
      ''
    ) || null,
    inStock: toBoolean(payload.in_stock ?? payload.inStock, false),
    imageUrl: toText(payload.image_url ?? payload.imageUrl, '') || null,
    capturedAt: toText(
      payload.captured_at ?? payload.capturedAt,
      new Date().toISOString()
    ),
    sourceUrl: toText(payload.source_url ?? payload.sourceUrl, ''),
    sourceConfidence: toNumber(
      payload.source_confidence ?? payload.sourceConfidence
    ),
  };
};

const parseHistoryPoint = (value: unknown): MarketPriceHistoryPoint => {
  const payload = toObject(value);

  return {
    capturedAt: toText(payload.captured_at ?? payload.capturedAt, new Date().toISOString()),
    price: toNumber(payload.price) ?? 0,
    currency: toText(payload.currency, 'TRY'),
    inStock: toBoolean(payload.in_stock ?? payload.inStock, false),
  };
};

const parseSearchProduct = (value: unknown): MarketSearchProduct => {
  const payload = toObject(value);
  const nestedOffers = Array.isArray(payload.offers)
    ? payload.offers.map((item) => parseOffer(item))
    : [];
  const bestOffer =
    payload.best_offer
      ? parseOffer(payload.best_offer)
      : payload.bestOffer
        ? parseOffer(payload.bestOffer)
        : nestedOffers.find((item) => item.inStock) ?? nestedOffers[0] ?? null;
  const marketCount =
    toNumber(
      payload.market_count ??
        payload.marketCount ??
        payload.markets_seen_count ??
        payload.marketsSeenCount
    ) ?? nestedOffers.length;
  const inStockMarketCount =
    toNumber(payload.in_stock_market_count ?? payload.inStockMarketCount) ??
    nestedOffers.filter((item) => item.inStock).length;

  return {
    barcode: toText(payload.barcode ?? payload.code, ''),
    productName: toText(
      payload.product_name ??
        payload.productName ??
        payload.normalized_product_name ??
        payload.normalizedProductName ??
        payload.display_name ??
        payload.displayName ??
        payload.name ??
        payload.title,
      '-'
    ),
    brand: toText(payload.brand ?? payload.brand_name ?? payload.brandName, '') || null,
    category:
      toText(
        payload.category ??
          payload.category_name ??
          payload.categoryName ??
          payload.normalized_category ??
          payload.normalizedCategory,
        ''
      ) ||
      null,
    imageUrl: toText(payload.image_url ?? payload.imageUrl, '') || null,
    marketLogoUrl:
      toText(payload.market_logo_url ?? payload.marketLogoUrl, '') || null,
    bestOffer,
    marketCount,
    inStockMarketCount,
    dataFreshness: parseFreshness(payload.data_freshness ?? payload.dataFreshness),
  };
};

const ensureRuntimeReady = () => {
  if (!MARKET_GELSIN_RUNTIME.isEnabled || !marketPricingClient) {
    throw new Error('market_gelsin_runtime_not_ready');
  }
};

export async function fetchMarketProductOffers(
  barcode: string,
  params?: {
    cityCode?: string;
    districtName?: string;
    limit?: number;
    includeOutOfStock?: boolean;
  }
): Promise<MarketProductOffersResponse> {
  ensureRuntimeReady();

  const endpoint = buildMarketGelsinOffersEndpoint(barcode, params);
  const response = await marketPricingClient!.get(endpoint);
  const payload = toObject(response.data);
  const city = toObject(payload.city);
  const cityCode = toText(city.code ?? city.city_code, params?.cityCode || '');
  const cityName = toText(city.name ?? city.city_name, '');
  const offers = Array.isArray(payload.offers)
    ? payload.offers.map((item) => parseOffer(item, cityCode, cityName))
    : [];

  return {
    barcode: toText(payload.barcode, barcode),
    fetchedAt: toText(payload.fetched_at ?? payload.fetchedAt, new Date().toISOString()),
    requestId: toText(payload.request_id ?? payload.requestId, '') || null,
    partial: toBoolean(payload.partial, false),
    warnings: toStringArray(payload.warnings),
    city: cityCode || cityName ? { code: cityCode, name: cityName } : null,
    dataFreshness: parseFreshness(payload.data_freshness ?? payload.dataFreshness),
    offers,
  };
}

export async function fetchMarketProductSearch(params: {
  query: string;
  cityCode?: string;
  category?: string;
  brand?: string;
  limit?: number;
}): Promise<MarketProductSearchResponse> {
  ensureRuntimeReady();

  const endpoint = buildMarketGelsinSearchEndpoint({
    query: params.query,
    cityCode: params.cityCode,
    category: params.category,
    brand: params.brand,
    limit: params.limit,
  });
  const response = await marketPricingClient!.get(endpoint);
  const payload = toObject(response.data);
  const rawResults = Array.isArray(payload.results)
    ? payload.results
    : Array.isArray(payload.products)
      ? payload.products
      : [];
  const results = rawResults
    .map(parseSearchProduct)
    .filter((item) => item.barcode)

  return {
    query: toText(payload.query ?? payload.q, params.query),
    fetchedAt: toText(payload.fetched_at ?? payload.fetchedAt, new Date().toISOString()),
    requestId: toText(payload.request_id ?? payload.requestId, '') || null,
    partial: toBoolean(payload.partial, false),
    warnings: toStringArray(payload.warnings),
    results,
  };
}

export async function fetchMarketAlternativePricing(
  request: MarketAlternativePricingRequest
): Promise<MarketAlternativePricingResponse> {
  ensureRuntimeReady();

  const endpoint = buildMarketGelsinAlternativesEndpoint();
  const response = await marketPricingClient!.post(endpoint, {
    city_code: request.cityCode,
    district_name: request.districtName ?? undefined,
    barcode: request.barcode,
    candidate_barcodes: request.candidateBarcodes,
  });
  const payload = toObject(response.data);
  const city = toObject(payload.city);
  const cityCode =
    toText(payload.city_code ?? payload.cityCode, '') ||
    toText(city.code ?? city.city_code, '') ||
    request.cityCode;
  const rawEntries = Array.isArray(payload.entries)
    ? payload.entries
    : Array.isArray(payload.alternatives)
      ? payload.alternatives
      : [];
  const entries = rawEntries.map((item) => {
    const entry = toObject(item);
    const entryOffers = Array.isArray(entry.offers)
      ? entry.offers.map((offer) => parseOffer(offer, cityCode, toText(city.name ?? city.city_name)))
      : [];
    return {
      barcode: toText(entry.barcode),
      bestOffer: entry.best_offer
        ? parseOffer(entry.best_offer, cityCode)
        : entry.bestOffer
          ? parseOffer(entry.bestOffer, cityCode)
          : entryOffers.find((offer) => offer.inStock) ?? entryOffers[0] ?? null,
      marketCount:
        toNumber(
          entry.market_count ??
            entry.marketCount ??
            entry.markets_seen_count ??
            entry.marketsSeenCount
        ) ?? entryOffers.length,
      inStockMarketCount:
        toNumber(entry.in_stock_market_count ?? entry.inStockMarketCount) ??
        entryOffers.filter((offer) => offer.inStock).length,
      dataFreshness: parseFreshness(
        entry.data_freshness ?? entry.dataFreshness ?? payload.data_freshness ?? payload.dataFreshness
      ),
    } satisfies MarketAlternativePricingEntry;
  });

  return {
    barcode: toText(payload.barcode, request.barcode),
    cityCode,
    fetchedAt: toText(payload.fetched_at ?? payload.fetchedAt, new Date().toISOString()),
    requestId: toText(payload.request_id ?? payload.requestId, '') || null,
    partial: toBoolean(payload.partial, false),
    warnings: toStringArray(payload.warnings),
    entries,
  };
}

export async function fetchMarketPriceHistory(
  barcode: string,
  params?: {
    cityCode?: string;
    marketName?: string;
    days?: number;
  }
): Promise<MarketPriceHistoryResponse> {
  ensureRuntimeReady();

  const endpoint = buildMarketGelsinHistoryEndpoint(barcode, params);
  const response = await marketPricingClient!.get(endpoint);
  const payload = toObject(response.data);
  const history = Array.isArray(payload.history)
    ? payload.history.map(parseHistoryPoint)
    : [];

  return {
    barcode: toText(payload.barcode, barcode),
    marketName: toText(payload.market_name ?? payload.marketName, params?.marketName || ''),
    days: toNumber(payload.days) ?? params?.days ?? 0,
    fetchedAt: toText(payload.fetched_at ?? payload.fetchedAt, new Date().toISOString()),
    requestId: toText(payload.request_id ?? payload.requestId, '') || null,
    partial: toBoolean(payload.partial, false),
    warnings: toStringArray(payload.warnings),
    history,
  };
}

export async function fetchMarketRuntimeStatus(): Promise<MarketRuntimeStatusResponse> {
  ensureRuntimeReady();
  const response = await marketPricingClient!.get(buildMarketGelsinStatusEndpoint());
  return toObject(response.data) as unknown as MarketRuntimeStatusResponse;
}

export async function fetchMarketProgramCoverage(): Promise<MarketProgramCoverageResponse> {
  ensureRuntimeReady();
  const response = await marketPricingClient!.get(buildMarketGelsinProgramCoverageEndpoint());
  return toObject(response.data) as unknown as MarketProgramCoverageResponse;
}

export async function fetchMarketIntegrationsStatus(): Promise<MarketIntegrationsStatusResponse> {
  ensureRuntimeReady();
  const response = await marketPricingClient!.get(buildMarketGelsinIntegrationsStatusEndpoint());
  return toObject(response.data) as unknown as MarketIntegrationsStatusResponse;
}

export async function postMarketScanEvent(
  request: MarketScanEventRequest
): Promise<MarketScanEventResponse> {
  ensureRuntimeReady();
  const response = await marketPricingClient!.post(buildMarketGelsinScanEventEndpoint(), {
    barcode: request.barcode,
    city_code: request.cityCode ?? undefined,
    district_name: request.districtName ?? undefined,
    platform: request.platform ?? undefined,
    scanned_at: request.scannedAt,
    app_version: request.appVersion ?? undefined,
    request_id: request.requestId ?? undefined,
  });
  return toObject(response.data) as unknown as MarketScanEventResponse;
}

export async function postMarketBatchScanEvents(payload: {
  events: MarketScanEventRequest[];
  rebuildHotRefresh?: boolean;
}): Promise<MarketBatchScanEventResponse> {
  ensureRuntimeReady();
  const response = await marketPricingClient!.post(
    buildMarketGelsinBatchScanEventEndpoint(),
    {
      rebuild_hot_refresh: payload.rebuildHotRefresh ?? false,
      events: payload.events.map((event) => ({
        barcode: event.barcode,
        city_code: event.cityCode ?? undefined,
        district_name: event.districtName ?? undefined,
        platform: event.platform ?? undefined,
        scanned_at: event.scannedAt,
        app_version: event.appVersion ?? undefined,
        request_id: event.requestId ?? undefined,
      })),
    }
  );
  return toObject(response.data) as unknown as MarketBatchScanEventResponse;
}

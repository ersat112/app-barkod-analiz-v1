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
  MarketProgramCoverageResponse,
  MarketPriceHistoryPoint,
  MarketPriceHistoryResponse,
  MarketProductOffersResponse,
  MarketRuntimeStatusResponse,
  MarketScanEventRequest,
  MarketScanEventResponse,
} from '../types/marketPricing';
import {
  buildMarketGelsinAlternativesEndpoint,
  buildMarketGelsinBatchScanEventEndpoint,
  buildMarketGelsinHistoryEndpoint,
  buildMarketGelsinIntegrationsStatusEndpoint,
  buildMarketGelsinOffersEndpoint,
  buildMarketGelsinProgramCoverageEndpoint,
  buildMarketGelsinScanEventEndpoint,
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
  const entries = Array.isArray(payload.entries)
    ? payload.entries.map((item) => {
        const entry = toObject(item);
        return {
          barcode: toText(entry.barcode),
          bestOffer: entry.best_offer
            ? parseOffer(entry.best_offer, request.cityCode)
            : entry.bestOffer
              ? parseOffer(entry.bestOffer, request.cityCode)
              : null,
          marketCount: toNumber(entry.market_count ?? entry.marketCount) ?? 0,
          inStockMarketCount:
            toNumber(entry.in_stock_market_count ?? entry.inStockMarketCount) ?? 0,
          dataFreshness: parseFreshness(
            entry.data_freshness ?? entry.dataFreshness
          ),
        } satisfies MarketAlternativePricingEntry;
      })
    : [];

  return {
    barcode: toText(payload.barcode, request.barcode),
    cityCode: toText(payload.city_code ?? payload.cityCode, request.cityCode),
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

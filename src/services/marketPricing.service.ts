import axios from 'axios';

import type { AxiosInstance } from 'axios';

import type {
  MarketAlternativePricingEntry,
  MarketAlternativePricingRequest,
  MarketAlternativePricingResponse,
  MarketBasketCompareItem,
  MarketBasketCompareItemRequest,
  MarketBasketCompareResponse,
  MarketBasketMarketTotal,
  MarketBasketMissingItem,
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
import { resolveMarketGelsinRuntimeConfig } from './marketGelsinRuntimeConfig.service';
import {
  buildMarketGelsinAlternativesEndpoint,
  buildMarketGelsinBarcodeLookupEndpoint,
  buildMarketGelsinBasketCompareEndpoint,
  buildMarketGelsinBatchScanEventEndpoint,
  buildMarketGelsinHistoryEndpoint,
  buildMarketGelsinIntegrationsStatusEndpoint,
  buildMarketGelsinLegacyOffersSearchEndpoint,
  buildMarketGelsinOffersEndpoint,
  buildMarketGelsinProgramCoverageEndpoint,
  buildMarketGelsinScanEventEndpoint,
  buildMarketGelsinSearchEndpoint,
  buildMarketGelsinStatusEndpoint,
} from './marketPricingContract.service';

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
    branchId: toText(payload.branch_id ?? payload.branchId, '') || null,
    branchName: toText(payload.branch_name ?? payload.branchName, '') || null,
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
    latitude: toNumber(payload.latitude),
    longitude: toNumber(payload.longitude),
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

const parseLegacyOffer = (
  value: unknown,
  fallbackBarcode?: string,
  fallbackCityName?: string
): MarketOffer & { barcode?: string | null; displayName?: string | null } => {
  const payload = toObject(value);
  return {
    ...parseOffer(
      {
        market_key: payload.market_key,
        market_name: payload.market_name,
        market_logo_url: payload.market_logo_url,
        branch_id: payload.branch_id,
        branch_name: payload.branch_name,
        market_type: payload.market_type,
        coverage_scope: payload.coverage_scope,
        pricing_scope: payload.pricing_scope,
        price_source_type: payload.price_source_type,
        city_code: payload.city_code,
        city_name: payload.city_name ?? payload.city_slug ?? fallbackCityName,
        district_name: payload.district_name,
        latitude: payload.latitude,
        longitude: payload.longitude,
        distance_meters: payload.distance_meters,
        price: payload.price ?? payload.active_price ?? payload.listed_price,
        currency: payload.currency,
        unit_price: payload.unit_price,
        unit_price_unit: payload.unit_price_unit ?? payload.unit_label,
        in_stock:
          payload.in_stock ??
          (toText(payload.availability, 'in_stock') !== 'out_of_stock'),
        image_url: payload.image_url,
        captured_at: payload.captured_at ?? payload.observed_at,
        source_url: payload.source_url,
        source_confidence: payload.source_confidence,
      },
      toText(payload.barcode ?? payload.source_barcode, fallbackBarcode || ''),
      fallbackCityName
    ),
    barcode: toText(payload.barcode ?? payload.source_barcode, fallbackBarcode || '') || null,
    displayName:
      toText(payload.display_name ?? payload.product_name ?? payload.normalized_product_name, '') ||
      null,
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

const buildMarketPricingClient = (baseUrl: string, timeoutMs: number): AxiosInstance =>
  axios.create({
    baseURL: baseUrl,
    timeout: timeoutMs,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'ErEnesAl/1.0 (BarkodAnaliz Market Pricing)',
    },
  });

const ensureRuntimeReady = async (): Promise<AxiosInstance> => {
  const runtime = await resolveMarketGelsinRuntimeConfig({
    allowStale: true,
  });

  if (!runtime.isEnabled || !runtime.baseUrl) {
    throw new Error('market_gelsin_runtime_not_ready');
  }

  return buildMarketPricingClient(runtime.baseUrl, runtime.timeoutMs);
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
  const marketPricingClient = await ensureRuntimeReady();

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
  const marketPricingClient = await ensureRuntimeReady();

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

export async function fetchMarketBarcodeLookup(
  barcode: string
): Promise<MarketSearchProduct | null> {
  const marketPricingClient = await ensureRuntimeReady();

  const response = await marketPricingClient!.get(buildMarketGelsinBarcodeLookupEndpoint(barcode));
  const payload = toObject(response.data);
  const rawOffers = Array.isArray(payload.offers) ? payload.offers : [];
  const offers = rawOffers.map((item) => parseLegacyOffer(item, barcode));
  const bestOffer = offers.find((item) => item.inStock) ?? offers[0] ?? null;
  const displayName =
    bestOffer?.displayName ||
    toText(payload.display_name ?? payload.product_name ?? payload.normalized_product_name, '') ||
    barcode;

  if (!bestOffer) {
    return null;
  }

  return {
    barcode,
    productName: displayName,
    brand: toText(payload.brand, '') || null,
    category: toText(payload.normalized_category ?? payload.category, '') || null,
    imageUrl: bestOffer.imageUrl ?? null,
    marketLogoUrl: bestOffer.marketLogoUrl ?? null,
    bestOffer,
    marketCount:
      toNumber(payload.match_count ?? payload.market_count ?? payload.markets_seen_count) ??
      offers.length,
    inStockMarketCount: offers.filter((item) => item.inStock).length,
    dataFreshness: parseFreshness(payload.data_freshness ?? payload.dataFreshness),
  };
}

export async function fetchLegacyMarketOfferSearch(params: {
  query: string;
  citySlug?: string;
  barcode?: string;
  limit?: number;
}): Promise<MarketProductSearchResponse> {
  const marketPricingClient = await ensureRuntimeReady();

  const response = await marketPricingClient!.get(
    buildMarketGelsinLegacyOffersSearchEndpoint({
      citySlug: params.citySlug,
      query: params.query,
      barcode: params.barcode,
      limit: params.limit,
    })
  );
  const payload = toObject(response.data);
  const rawOffers = Array.isArray(payload.offers) ? payload.offers : [];
  const grouped = new Map<string, ReturnType<typeof parseLegacyOffer>[]>();

  rawOffers.forEach((item) => {
    const offer = parseLegacyOffer(item, params.barcode);
    const key = offer.barcode || `${offer.marketName}-${offer.displayName || ''}`;

    if (!key) {
      return;
    }

    const current = grouped.get(key) ?? [];
    current.push(offer);
    grouped.set(key, current);
  });

  const results: MarketSearchProduct[] = Array.from(grouped.entries()).flatMap(
    ([fallbackKey, offers]) => {
      const bestOffer = offers.find((item) => item.inStock) ?? offers[0] ?? null;
      const barcode = bestOffer?.barcode || fallbackKey;

      if (!barcode || !bestOffer) {
        return [];
      }

      return [
        {
          barcode,
          productName: bestOffer.displayName || barcode,
          brand: null,
          category: null,
          imageUrl: bestOffer.imageUrl ?? null,
          marketLogoUrl: bestOffer.marketLogoUrl ?? null,
          bestOffer,
          marketCount: offers.length,
          inStockMarketCount: offers.filter((item) => item.inStock).length,
          dataFreshness: parseFreshness(payload.data_freshness ?? payload.dataFreshness),
        } satisfies MarketSearchProduct,
      ];
    }
  );

  return {
    query: toText(payload.query ?? payload.q, params.query),
    fetchedAt: toText(payload.fetched_at ?? payload.fetchedAt, new Date().toISOString()),
    requestId: toText(payload.request_id ?? payload.requestId, '') || null,
    partial: toBoolean(payload.partial, false),
    warnings: toStringArray(payload.warnings),
    results,
  };
}

export async function fetchLegacyMarketProductOffers(params: {
  barcode: string;
  citySlug?: string | null;
  limit?: number;
}): Promise<MarketProductOffersResponse> {
  const marketPricingClient = await ensureRuntimeReady();

  if (params.citySlug) {
    const response = await marketPricingClient!.get(
      buildMarketGelsinLegacyOffersSearchEndpoint({
        citySlug: params.citySlug,
        barcode: params.barcode,
        limit: params.limit,
      })
    );
    const payload = toObject(response.data);
    const offers = Array.isArray(payload.offers)
      ? payload.offers.map((item) => parseLegacyOffer(item, params.barcode, params.citySlug || undefined))
      : [];

    return {
      barcode: params.barcode,
      fetchedAt: toText(payload.fetched_at ?? payload.fetchedAt, new Date().toISOString()),
      requestId: toText(payload.request_id ?? payload.requestId, '') || null,
      partial: toBoolean(payload.partial, false),
      warnings: toStringArray(payload.warnings),
      city: params.citySlug
        ? {
            code: '',
            name: params.citySlug,
          }
        : null,
      dataFreshness: parseFreshness(payload.data_freshness ?? payload.dataFreshness),
      offers,
    };
  }

  const response = await marketPricingClient!.get(
    buildMarketGelsinBarcodeLookupEndpoint(params.barcode)
  );
  const payload = toObject(response.data);
  const offers = Array.isArray(payload.offers)
    ? payload.offers.map((item) => parseLegacyOffer(item, params.barcode))
    : [];

  return {
    barcode: params.barcode,
    fetchedAt: toText(payload.fetched_at ?? payload.fetchedAt, new Date().toISOString()),
    requestId: toText(payload.request_id ?? payload.requestId, '') || null,
    partial: toBoolean(payload.partial, false),
    warnings: toStringArray(payload.warnings),
    city: null,
    dataFreshness: parseFreshness(payload.data_freshness ?? payload.dataFreshness),
    offers,
  };
}

export async function fetchMarketAlternativePricing(
  request: MarketAlternativePricingRequest
): Promise<MarketAlternativePricingResponse> {
  const marketPricingClient = await ensureRuntimeReady();

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
  const marketPricingClient = await ensureRuntimeReady();

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
  const marketPricingClient = await ensureRuntimeReady();
  const response = await marketPricingClient!.get(buildMarketGelsinStatusEndpoint());
  return toObject(response.data) as unknown as MarketRuntimeStatusResponse;
}

export async function fetchMarketProgramCoverage(): Promise<MarketProgramCoverageResponse> {
  const marketPricingClient = await ensureRuntimeReady();
  const response = await marketPricingClient!.get(buildMarketGelsinProgramCoverageEndpoint());
  return toObject(response.data) as unknown as MarketProgramCoverageResponse;
}

export async function fetchMarketIntegrationsStatus(): Promise<MarketIntegrationsStatusResponse> {
  const marketPricingClient = await ensureRuntimeReady();
  const response = await marketPricingClient!.get(buildMarketGelsinIntegrationsStatusEndpoint());
  return toObject(response.data) as unknown as MarketIntegrationsStatusResponse;
}

export async function postMarketScanEvent(
  request: MarketScanEventRequest
): Promise<MarketScanEventResponse> {
  const marketPricingClient = await ensureRuntimeReady();
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
  const marketPricingClient = await ensureRuntimeReady();
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

export async function fetchMarketBasketCompare(request: {
  cityCode: string;
  citySlug?: string | null;
  districtName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  items: MarketBasketCompareItemRequest[];
}): Promise<MarketBasketCompareResponse> {
  const marketPricingClient = await ensureRuntimeReady();

  const response = await marketPricingClient!.post(buildMarketGelsinBasketCompareEndpoint(), {
    city_code: request.cityCode,
    city_slug: request.citySlug ?? undefined,
    district: request.districtName ?? undefined,
    lat: request.latitude ?? undefined,
    lng: request.longitude ?? undefined,
    items: request.items.map((item) => ({
      barcode: item.barcode,
      quantity: item.quantity,
    })),
  });
  const payload = toObject(response.data);
  const city = toObject(payload.city);
  const items = Array.isArray(payload.items)
    ? payload.items.map((item) => {
        const entry = toObject(item);
        const offers = Array.isArray(entry.offers)
          ? entry.offers.map((offer) =>
              parseOffer(offer, toText(city.code ?? city.city_code, request.cityCode), toText(city.name ?? city.city_name, ''))
            )
          : [];

        return {
          barcode: toText(entry.barcode),
          quantity: toNumber(entry.quantity) ?? 1,
          bestOffer: entry.best_offer
            ? parseOffer(entry.best_offer, toText(city.code ?? city.city_code, request.cityCode), toText(city.name ?? city.city_name, ''))
            : offers[0] ?? null,
          offers,
          availableMarketCount:
            toNumber(entry.available_market_count ?? entry.availableMarketCount) ?? offers.length,
        } satisfies MarketBasketCompareItem;
      })
    : [];
  const marketTotals = Array.isArray(payload.market_totals)
    ? payload.market_totals.map((item) => {
        const entry = toObject(item);
        return {
          marketKey: toText(entry.market_key ?? entry.marketKey, ''),
          marketName: toText(entry.market_name ?? entry.marketName, '-'),
          marketLogoUrl: toText(entry.market_logo_url ?? entry.marketLogoUrl, '') || null,
          distanceMeters: toNumber(entry.distance_meters ?? entry.distanceMeters),
          branchId: toText(entry.branch_id ?? entry.branchId, '') || null,
          branchName: toText(entry.branch_name ?? entry.branchName, '') || null,
          latitude: toNumber(entry.latitude),
          longitude: toNumber(entry.longitude),
          basketTotal: toNumber(entry.basket_total ?? entry.basketTotal) ?? 0,
          availableItemCount:
            toNumber(entry.available_item_count ?? entry.availableItemCount) ?? 0,
          missingItemCount:
            toNumber(entry.missing_item_count ?? entry.missingItemCount) ?? 0,
        } satisfies MarketBasketMarketTotal;
      })
    : [];
  const missingItems = Array.isArray(payload.missing_items)
    ? payload.missing_items.map((item) => {
        const entry = toObject(item);
        return {
          barcode: toText(entry.barcode),
          quantity: toNumber(entry.quantity) ?? 1,
        } satisfies MarketBasketMissingItem;
      })
    : [];

  return {
    fetchedAt: toText(payload.fetched_at ?? payload.fetchedAt, new Date().toISOString()),
    requestId: toText(payload.request_id ?? payload.requestId, '') || null,
    partial: toBoolean(payload.partial, false),
    warnings: toStringArray(payload.warnings),
    city:
      toText(city.code ?? city.city_code, '') || toText(city.name ?? city.city_name, '')
        ? {
            code: toText(city.code ?? city.city_code, request.cityCode),
            name: toText(city.name ?? city.city_name, ''),
          }
        : null,
    district: toText(payload.district, '') || null,
    mixedCheapestTotal: toNumber(payload.mixed_cheapest_total ?? payload.mixedCheapestTotal) ?? 0,
    bestSingleMarketTotal:
      toNumber(payload.best_single_market_total ?? payload.bestSingleMarketTotal),
    nearestMarketTotal: toNumber(payload.nearest_market_total ?? payload.nearestMarketTotal),
    items,
    marketTotals,
    missingItems,
  };
}

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
  MarketCategoryNode,
  MarketCategoryProductsResponse,
  MarketCategoryTreeResponse,
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
import { getEnvString } from '../config/appRuntime';
import { resolveMarketLogoUrl } from '../config/marketBranding';
import { getMarketGelsinSupabaseApiKey } from '../config/marketGelsinRuntime';
import { resolveMarketGelsinRuntimeConfig } from './marketGelsinRuntimeConfig.service';
import {
  buildMarketGelsinAlternativesEndpoint,
  buildMarketGelsinBasketCompareEndpoint,
  buildMarketGelsinBatchScanEventEndpoint,
  buildMarketGelsinCategoryTreeEndpoint,
  buildMarketGelsinHistoryEndpoint,
  buildMarketGelsinIntegrationsStatusEndpoint,
  buildMarketGelsinLegacyOffersSearchEndpoint,
  buildMarketGelsinOffersEndpoint,
  buildMarketGelsinProgramCoverageEndpoint,
  buildMarketGelsinScanEventEndpoint,
  buildMarketGelsinSearchEndpoint,
  buildMarketGelsinStatusEndpoint,
  countUniqueMarkets,
  getBestInStockOffer,
  getMarketOfferIdentity,
} from './marketPricingContract.service';

type MarketPricingTransport = 'legacy_http' | 'supabase_rpc';

type MarketPricingRuntimeContext = {
  client: AxiosInstance;
  transport: MarketPricingTransport;
  anonKey: string | null;
  rpc: {
    health: string;
    offers: string;
    resolve: string;
    priceHistory: string;
    searchProducts: string;
    listCategories: string;
    listCategoryProducts: string;
    recordScan: string;
  };
};

const RPC_SUFFIX_REGEX = /\/rest\/v1\/rpc\/?$/i;
const DEFAULT_RPC_NAMES = Object.freeze({
  health: 'mg_rpc_health',
  offers: 'mg_rpc_product_offers',
  resolve: 'mg_rpc_product_resolve',
  priceHistory: 'mg_rpc_product_price_history',
  searchProducts: 'mg_rpc_search_products',
  listCategories: 'mg_rpc_list_categories',
  listCategoryProducts: 'mg_rpc_list_category_products',
  recordScan: 'mg_rpc_record_barcode_scan',
});

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

const isSupabaseRpcBaseUrl = (baseUrl: string): boolean =>
  RPC_SUFFIX_REGEX.test(String(baseUrl || '').trim());

const getSupabaseAnonKey = (): string =>
  getMarketGelsinSupabaseApiKey() ||
  getEnvString('EXPO_PUBLIC_SUPABASE_ANON_KEY', '').trim();

const getRpcName = (
  envKey:
    | 'EXPO_PUBLIC_MARKET_GELSIN_RPC_PRODUCT_OFFERS'
    | 'EXPO_PUBLIC_MARKET_GELSIN_RPC_PRODUCT_RESOLVE'
    | 'EXPO_PUBLIC_MARKET_GELSIN_RPC_PRODUCT_PRICE_HISTORY'
    | 'EXPO_PUBLIC_MARKET_GELSIN_RPC_SEARCH_PRODUCTS'
    | 'EXPO_PUBLIC_MARKET_GELSIN_RPC_LIST_CATEGORIES'
    | 'EXPO_PUBLIC_MARKET_GELSIN_RPC_LIST_CATEGORY_PRODUCTS'
    | 'EXPO_PUBLIC_MARKET_GELSIN_RPC_RECORD_SCAN',
  fallback: string
): string => getEnvString(envKey, fallback).trim() || fallback;

const getRpcConfig = () => ({
  health: DEFAULT_RPC_NAMES.health,
  offers: getRpcName(
    'EXPO_PUBLIC_MARKET_GELSIN_RPC_PRODUCT_OFFERS',
    DEFAULT_RPC_NAMES.offers
  ),
  resolve: getRpcName(
    'EXPO_PUBLIC_MARKET_GELSIN_RPC_PRODUCT_RESOLVE',
    DEFAULT_RPC_NAMES.resolve
  ),
  priceHistory: getRpcName(
    'EXPO_PUBLIC_MARKET_GELSIN_RPC_PRODUCT_PRICE_HISTORY',
    DEFAULT_RPC_NAMES.priceHistory
  ),
  searchProducts: getRpcName(
    'EXPO_PUBLIC_MARKET_GELSIN_RPC_SEARCH_PRODUCTS',
    DEFAULT_RPC_NAMES.searchProducts
  ),
  listCategories: getRpcName(
    'EXPO_PUBLIC_MARKET_GELSIN_RPC_LIST_CATEGORIES',
    DEFAULT_RPC_NAMES.listCategories
  ),
  listCategoryProducts: getRpcName(
    'EXPO_PUBLIC_MARKET_GELSIN_RPC_LIST_CATEGORY_PRODUCTS',
    DEFAULT_RPC_NAMES.listCategoryProducts
  ),
  recordScan: getRpcName(
    'EXPO_PUBLIC_MARKET_GELSIN_RPC_RECORD_SCAN',
    DEFAULT_RPC_NAMES.recordScan
  ),
});

const normalizeLooseSearchValue = (value?: string | null): string =>
  String(value || '')
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const buildSearchFallbackQueries = (params: {
  productName?: string | null;
  brand?: string | null;
}): string[] => {
  const productName = String(params.productName || '').trim();
  const brand = String(params.brand || '').trim();

  if (!productName) {
    return [];
  }

  const normalizedProductName = normalizeLooseSearchValue(productName);
  const normalizedBrand = normalizeLooseSearchValue(brand);
  const productAlreadyContainsBrand =
    Boolean(normalizedBrand) && normalizedProductName.startsWith(normalizedBrand);
  const brandedName =
    brand && !productAlreadyContainsBrand ? `${brand} ${productName}`.trim() : productName;
  const shortName = productName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .join(' ')
    .trim();

  return Array.from(
    new Set([brandedName, productName, shortName].filter((value) => value.length >= 3))
  ).slice(0, 3);
};

const computeSearchCandidateScore = (
  candidate: MarketSearchProduct,
  target: {
    productName?: string | null;
    brand?: string | null;
  }
): number => {
  const targetName = normalizeLooseSearchValue(target.productName);
  const targetBrand = normalizeLooseSearchValue(target.brand);
  const candidateName = normalizeLooseSearchValue(candidate.productName);
  const candidateBrand = normalizeLooseSearchValue(candidate.brand);
  const targetTokens = targetName.split(/\s+/).filter((token) => token.length >= 2);

  let score = 0;

  if (!candidateName || !targetName) {
    return score;
  }

  if (candidateName === targetName) {
    score += 180;
  } else if (candidateName.includes(targetName) || targetName.includes(candidateName)) {
    score += 120;
  }

  const matchedTokenCount = targetTokens.filter((token) => candidateName.includes(token)).length;
  score += matchedTokenCount * 18;

  if (targetTokens.length > 0 && matchedTokenCount === targetTokens.length) {
    score += 30;
  }

  if (targetBrand && candidateBrand) {
    if (candidateBrand === targetBrand) {
      score += 70;
    } else if (candidateBrand.includes(targetBrand) || targetBrand.includes(candidateBrand)) {
      score += 35;
    }
  }

  if (candidate.bestOffer?.inStock) {
    score += 10;
  }

  score += Math.min(candidate.inStockMarketCount * 3, 18);
  score += Math.min(candidate.marketCount * 2, 12);

  return score;
};

const normalizeBarcode = (value?: string | null): string =>
  String(value || '').replace(/\D+/g, '').trim();

const selectBestBarcodeSearchResult = (
  results: MarketSearchProduct[],
  barcode: string
): MarketSearchProduct | null => {
  if (!results.length) {
    return null;
  }

  const normalizedBarcode = normalizeBarcode(barcode);

  if (normalizedBarcode) {
    const exactMatch =
      results.find((item) => normalizeBarcode(item.barcode) === normalizedBarcode) ??
      null;

    if (exactMatch) {
      return exactMatch;
    }
  }

  return results[0] ?? null;
};

const mergeResolvedSearchProduct = (
  base: MarketSearchProduct,
  detail: Partial<MarketSearchProduct> | null
): MarketSearchProduct => {
  if (!detail) {
    return base;
  }

  return {
    ...base,
    ...detail,
    id: detail.id ?? base.id,
    barcode: detail.barcode ?? base.barcode,
    productName: detail.productName ?? base.productName,
    brand: detail.brand ?? base.brand,
    category: detail.category ?? base.category,
    normalizedCategoryId: detail.normalizedCategoryId ?? base.normalizedCategoryId ?? null,
    taxonomyPath: detail.taxonomyPath ?? base.taxonomyPath ?? null,
    taxonomyLeaf: detail.taxonomyLeaf ?? base.taxonomyLeaf ?? null,
    packSize: detail.packSize ?? base.packSize,
    packUnit: detail.packUnit ?? base.packUnit,
    matchConfidence: detail.matchConfidence ?? base.matchConfidence,
    imageUrl: detail.imageUrl ?? base.imageUrl,
    marketLogoUrl: detail.marketLogoUrl ?? base.marketLogoUrl,
    bestOffer: detail.bestOffer ?? base.bestOffer,
    seedOffers:
      detail.seedOffers && detail.seedOffers.length > 0
        ? detail.seedOffers
        : base.seedOffers,
    marketCount: detail.marketCount ?? base.marketCount,
    inStockMarketCount: detail.inStockMarketCount ?? base.inStockMarketCount,
    dataFreshness: detail.dataFreshness ?? base.dataFreshness,
  };
};

const scoreOfferForDisplay = (offer: MarketOffer, targetCityCode?: string | null): number => {
  let score = 0;

  if (offer.inStock) {
    score += 1000;
  }

  if (targetCityCode && offer.cityCode && offer.cityCode.trim() === targetCityCode.trim()) {
    score += 120;
  }

  if (offer.priceSourceType === 'local_market_price') {
    score += 80;
  } else if (offer.priceSourceType === 'national_reference_price') {
    score += 25;
  }

  if (typeof offer.distanceMeters === 'number' && Number.isFinite(offer.distanceMeters)) {
    score += Math.max(0, 60 - Math.min(60, offer.distanceMeters / 250));
  }

  score -= Math.round((offer.price || 0) * 100) / 1000;

  return score;
};

const buildOfferBranchIdentity = (offer: MarketOffer): string =>
  [
    getMarketOfferIdentity(offer),
    normalizeLooseSearchValue(offer.branchId),
    normalizeLooseSearchValue(offer.branchName),
  ]
    .filter(Boolean)
    .join('::');

const mergeOffersForDisplay = (
  offers: MarketOffer[],
  targetCityCode?: string | null
): MarketOffer[] => {
  const grouped = new Map<string, MarketOffer>();

  offers.forEach((offer) => {
    const identity = buildOfferBranchIdentity(offer);

    if (!identity) {
      return;
    }

    const existing = grouped.get(identity);

    if (!existing) {
      grouped.set(identity, offer);
      return;
    }

    const nextScore = scoreOfferForDisplay(offer, targetCityCode);
    const existingScore = scoreOfferForDisplay(existing, targetCityCode);

    if (nextScore > existingScore) {
      grouped.set(identity, offer);
    }
  });

  return Array.from(grouped.values()).sort((left, right) => {
    const rightScore = scoreOfferForDisplay(right, targetCityCode);
    const leftScore = scoreOfferForDisplay(left, targetCityCode);

    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    return left.marketName.localeCompare(right.marketName, 'tr');
  });
};

const fetchSearchFallbackOffers = async (params: {
  productName?: string | null;
  brand?: string | null;
  cityCode?: string;
}): Promise<MarketOffer[]> => {
  const queries = buildSearchFallbackQueries({
    productName: params.productName,
    brand: params.brand,
  });

  if (!queries.length) {
    return [];
  }

  const settled = await Promise.allSettled(
    queries.map((query) =>
      fetchMarketProductSearch({
        query,
        cityCode: params.cityCode,
        brand: params.brand ?? undefined,
        limit: 8,
      })
    )
  );

  const candidates = settled
    .filter((result): result is PromiseFulfilledResult<MarketProductSearchResponse> => result.status === 'fulfilled')
    .flatMap((result) => result.value.results)
    .map((item) => ({
      item,
      score: computeSearchCandidateScore(item, {
        productName: params.productName,
        brand: params.brand,
      }),
    }))
    .filter(({ item, score }) => score >= 90)
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);

  const embeddedOffers = candidates.flatMap(({ item }) => item.seedOffers ?? []);
  const candidatesNeedingLookup = candidates
    .filter(({ item }) => (!item.seedOffers || item.seedOffers.length === 0) && item.barcode)
    .slice(0, 3);

  const lookedUpOffers = await Promise.allSettled(
    candidatesNeedingLookup.map(({ item }) =>
      fetchMarketProductOffers(item.barcode!, {
        cityCode: params.cityCode,
        limit: 12,
        includeOutOfStock: true,
        enableNameFallback: false,
      })
    )
  );

  const fallbackOffers = [
    ...embeddedOffers,
    ...lookedUpOffers
      .filter((result): result is PromiseFulfilledResult<MarketProductOffersResponse> => result.status === 'fulfilled')
      .flatMap((result) => result.value.offers),
  ];

  return mergeOffersForDisplay(fallbackOffers, params.cityCode ?? null);
};

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
  const marketKey = toText(payload.market_key ?? payload.marketKey, '') || null;
  const marketName = toText(payload.market_name ?? payload.marketName, '-');
  const marketLogoUrl = resolveMarketLogoUrl(
    marketKey,
    marketName,
    toText(payload.market_logo_url ?? payload.marketLogoUrl, '') || null
  );

  return {
    marketKey,
    marketName,
    marketLogoUrl,
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
  const productId =
    toText(payload.product_id ?? payload.productId, '') ||
    null;
  const barcode =
    toText(payload.barcode ?? payload.code, '') ||
    null;
  const nestedOffers = Array.isArray(payload.offers)
    ? payload.offers.map((item) => parseOffer(item))
    : [];
  const bestMarketKey =
    toText(
      payload.best_market_key ?? payload.bestMarketKey ?? payload.market_key ?? payload.marketKey,
      ''
    ) || null;
  const bestMarketName =
    toText(
      payload.best_market_name ??
        payload.bestMarketName ??
        payload.market_name ??
        payload.marketName,
      ''
    ) || null;
  const bestMarketLogoUrl =
    toText(
      payload.best_market_logo_url ??
        payload.bestMarketLogoUrl ??
        payload.market_logo_url ??
        payload.marketLogoUrl,
      ''
    ) || null;
  const bestOffer =
    payload.best_offer
      ? parseOffer(payload.best_offer)
      : payload.bestOffer
        ? parseOffer(payload.bestOffer)
        : nestedOffers.find((item) => item.inStock) ?? nestedOffers[0] ?? null;
  const lowestPrice = toNumber(payload.lowest_price ?? payload.lowestPrice);
  const offerCount =
    toNumber(payload.offer_count ?? payload.offerCount) ??
    toNumber(payload.market_count ?? payload.marketCount) ??
    0;
  const fallbackBestOffer =
    !bestOffer && lowestPrice != null
      ? ({
          marketKey: bestMarketKey,
          marketName: bestMarketName || 'Market',
          marketLogoUrl: resolveMarketLogoUrl(
            bestMarketKey,
            bestMarketName || 'Market',
            bestMarketLogoUrl
          ),
          marketType: 'national_chain',
          cityCode: toText(payload.city_code ?? payload.cityCode, ''),
          cityName: toText(payload.city_name ?? payload.cityName, ''),
          price: lowestPrice,
          currency: toText(payload.currency, 'TRY'),
          inStock: offerCount > 0,
          capturedAt: toText(
            payload.last_seen_at ?? payload.lastSeenAt,
            new Date().toISOString()
          ),
          sourceUrl: '',
        } satisfies MarketOffer)
      : null;
  const marketCount =
    toNumber(
      payload.market_count ??
        payload.marketCount ??
        payload.markets_seen_count ??
        payload.marketsSeenCount
    ) ??
    offerCount ??
    countUniqueMarkets(nestedOffers);
  const inStockMarketCount =
    toNumber(payload.in_stock_market_count ?? payload.inStockMarketCount) ??
    offerCount ??
    countUniqueMarkets(nestedOffers, { inStockOnly: true });
  const productName = toText(
    payload.product_name ??
      payload.productName ??
      payload.normalized_product_name ??
      payload.normalizedProductName ??
      payload.display_name ??
      payload.displayName ??
      payload.name ??
      payload.title,
    '-'
  );
  const brand = toText(payload.brand ?? payload.brand_name ?? payload.brandName, '') || null;
  const category =
    toText(
      payload.taxonomy_leaf ??
        payload.taxonomyLeaf ??
      payload.category ??
        payload.category_name ??
        payload.categoryName ??
        payload.normalized_category ??
        payload.normalizedCategory,
      ''
    ) ||
    null;
  const packSize = toNumber(payload.pack_size ?? payload.packSize);
  const packUnit =
    toText(payload.pack_unit ?? payload.packUnit, '') ||
    null;
  const matchConfidence = toNumber(
    payload.match_confidence ?? payload.matchConfidence
  );
  const id =
    productId ||
    barcode ||
    [
      productName,
      brand ?? '',
      category ?? '',
      packSize ?? '',
      packUnit ?? '',
      bestOffer?.marketKey ?? bestOffer?.marketName ?? '',
      typeof bestOffer?.price === 'number' ? String(bestOffer.price) : '',
    ]
      .join('::')
      .trim() ||
    `market-search-${Math.random().toString(36).slice(2, 10)}`;

  return {
    id,
    productId,
    barcode,
    productName,
    brand,
    category,
    normalizedCategoryId:
      toText(
        payload.normalized_category_id ?? payload.normalizedCategoryId,
        ''
      ) || null,
    taxonomyPath:
      toText(payload.taxonomy_path ?? payload.taxonomyPath, '') || null,
    taxonomyLeaf:
      toText(payload.taxonomy_leaf ?? payload.taxonomyLeaf, '') || null,
    packSize,
    packUnit,
    matchConfidence,
    imageUrl: toText(payload.image_url ?? payload.imageUrl, '') || null,
    marketLogoUrl: resolveMarketLogoUrl(
      bestOffer?.marketKey ??
        fallbackBestOffer?.marketKey ??
        bestMarketKey ??
        bestOffer?.marketName ??
        fallbackBestOffer?.marketName ??
        bestMarketName ??
        null,
      bestOffer?.marketName ?? fallbackBestOffer?.marketName ?? bestMarketName ?? null,
      bestMarketLogoUrl ||
        bestOffer?.marketLogoUrl ||
        fallbackBestOffer?.marketLogoUrl ||
        null
    ),
    bestOffer: bestOffer ?? fallbackBestOffer,
    seedOffers:
      nestedOffers.length > 0
        ? nestedOffers
        : bestOffer ?? fallbackBestOffer
          ? [bestOffer ?? fallbackBestOffer!]
          : [],
    marketCount,
    inStockMarketCount,
    dataFreshness: parseFreshness(payload.data_freshness ?? payload.dataFreshness),
  };
};

const parseResolveResult = (
  value: unknown,
  fallbackBarcode: string
): MarketSearchProduct => {
  const payload = toObject(value);
  const productId =
    toText(payload.product_id ?? payload.productId, '') ||
    null;
  const nestedOffers = Array.isArray(payload.offers)
    ? payload.offers.map((item) => parseOffer(item))
    : [];
  const barcode = toText(payload.barcode, fallbackBarcode) || fallbackBarcode;
  const normalizedProductName = toText(
    payload.normalized_product_name ?? payload.normalizedProductName,
    ''
  );

  return {
    id: productId || barcode,
    productId,
    barcode,
    productName: normalizedProductName || barcode,
    brand: toText(payload.brand, '') || null,
    category:
      toText(
        payload.taxonomy_leaf ??
          payload.taxonomyLeaf ??
          payload.normalized_category ??
          payload.normalizedCategory,
        ''
      ) || null,
    normalizedCategoryId:
      toText(
        payload.normalized_category_id ?? payload.normalizedCategoryId,
        ''
      ) || null,
    taxonomyPath:
      toText(payload.taxonomy_path ?? payload.taxonomyPath, '') || null,
    taxonomyLeaf:
      toText(payload.taxonomy_leaf ?? payload.taxonomyLeaf, '') || null,
    matchConfidence: toNumber(
      payload.catalog_match_confidence ?? payload.catalogMatchConfidence
    ),
    imageUrl: nestedOffers[0]?.imageUrl ?? null,
    marketLogoUrl: nestedOffers[0]?.marketLogoUrl ?? null,
    bestOffer: getBestInStockOffer(nestedOffers) ?? nestedOffers[0] ?? null,
    seedOffers: nestedOffers,
    marketCount: countUniqueMarkets(nestedOffers),
    inStockMarketCount: countUniqueMarkets(nestedOffers, { inStockOnly: true }),
    dataFreshness: parseFreshness(payload.data_freshness ?? payload.dataFreshness),
  };
};

const parseCategoryNode = (value: unknown): MarketCategoryNode | null => {
  const payload = toObject(value);
  const normalizedCategoryId =
    toText(payload.normalized_category_id ?? payload.normalizedCategoryId, '') || null;
  const taxonomyLeaf =
    toText(
      payload.taxonomy_leaf ??
        payload.taxonomyLeaf ??
        payload.normalized_category ??
        payload.normalizedCategory,
      ''
    ) || null;

  if (!normalizedCategoryId || !taxonomyLeaf) {
    return null;
  }

  return {
    normalizedCategoryId,
    taxonomyLeaf,
    taxonomyPath: toText(payload.taxonomy_path ?? payload.taxonomyPath, '') || null,
    normalizedCategory:
      toText(payload.normalized_category ?? payload.normalizedCategory, '') || null,
    parentCategoryId:
      toText(payload.parent_category_id ?? payload.parentCategoryId, '') || null,
    depth: Math.max(0, toNumber(payload.depth) ?? 0),
    childrenCount: Math.max(0, toNumber(payload.children_count ?? payload.childrenCount) ?? 0),
    productCount: toNumber(payload.product_count ?? payload.productCount),
    inStockProductCount: toNumber(
      payload.in_stock_product_count ?? payload.inStockProductCount
    ),
    marketCount: toNumber(payload.market_count ?? payload.marketCount),
    sortOrder: toNumber(payload.sort_order ?? payload.sortOrder),
  };
};

const buildLegacyProductGroupKey = (
  offer: ReturnType<typeof parseLegacyOffer>,
  fallbackKey: string
): string => {
  if (offer.barcode && offer.barcode.trim()) {
    return offer.barcode.trim();
  }

  const normalizedDisplayName = normalizeLooseSearchValue(offer.displayName);

  if (normalizedDisplayName) {
    return normalizedDisplayName;
  }

  return normalizeLooseSearchValue(fallbackKey) || fallbackKey;
};

const buildMarketPricingClient = (
  baseUrl: string,
  timeoutMs: number,
  transport: MarketPricingTransport,
  anonKey: string | null
): AxiosInstance => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'ErEnesAl/1.0 (BarkodAnaliz Market Pricing)',
  };

  if (transport === 'supabase_rpc') {
    if (!anonKey) {
      throw new Error('market_gelsin_supabase_anon_key_missing');
    }

    headers.apikey = anonKey;
    headers.Authorization = `Bearer ${anonKey}`;
    headers.Accept = 'application/json';
  }

  return axios.create({
    baseURL: baseUrl,
    timeout: timeoutMs,
    headers,
  });
};

const ensureRuntimeReady = async (): Promise<MarketPricingRuntimeContext> => {
  const runtime = await resolveMarketGelsinRuntimeConfig({
    allowStale: true,
  });

  if (!runtime.isEnabled || !runtime.baseUrl) {
    throw new Error('market_gelsin_runtime_not_ready');
  }

  const transport: MarketPricingTransport = isSupabaseRpcBaseUrl(runtime.baseUrl)
    ? 'supabase_rpc'
    : 'legacy_http';
  const anonKey = getSupabaseAnonKey() || runtime.anonKey || null;

  return {
    client: buildMarketPricingClient(
      runtime.baseUrl,
      runtime.timeoutMs,
      transport,
      anonKey
    ),
    transport,
    anonKey,
    rpc: getRpcConfig(),
  };
};

export async function fetchMarketProductOffers(
  barcode: string,
  params?: {
    cityCode?: string;
    districtName?: string;
    limit?: number;
    includeOutOfStock?: boolean;
    fallbackProductName?: string | null;
    fallbackBrand?: string | null;
    enableNameFallback?: boolean;
  }
): Promise<MarketProductOffersResponse> {
  const runtime = await ensureRuntimeReady();
  const response =
    runtime.transport === 'supabase_rpc'
      ? await runtime.client.post(`/${runtime.rpc.offers}`, {
          p_barcode: barcode,
          p_city_code: params?.cityCode ?? null,
          p_district: params?.districtName ?? null,
          p_lat: null,
          p_lng: null,
          p_limit: params?.limit ?? 12,
          p_include_out_of_stock: params?.includeOutOfStock ?? false,
        })
      : await runtime.client.get(
          buildMarketGelsinOffersEndpoint(barcode, params)
        );
  const payload = toObject(response.data);
  const city = toObject(payload.city);
  const cityCode = toText(city.code ?? city.city_code, params?.cityCode || '');
  const cityName = toText(city.name ?? city.city_name, '');
  const directOffers = Array.isArray(payload.offers)
    ? payload.offers.map((item) => parseOffer(item, cityCode, cityName))
    : [];
  const shouldTryNameFallback =
    Boolean(params?.enableNameFallback) &&
    Boolean(params?.fallbackProductName) &&
    countUniqueMarkets(directOffers) < 3;
  const fallbackOffers = shouldTryNameFallback
    ? await fetchSearchFallbackOffers({
        productName: params?.fallbackProductName,
        brand: params?.fallbackBrand,
        cityCode: params?.cityCode,
      })
    : [];
  const offers = mergeOffersForDisplay(
    [...directOffers, ...fallbackOffers],
    params?.cityCode ?? null
  );
  const warnings = toStringArray(payload.warnings);

  if (fallbackOffers.length) {
    warnings.push('name_match_fallback_used');
  }

  return {
    barcode: toText(payload.barcode, barcode),
    fetchedAt: toText(payload.fetched_at ?? payload.fetchedAt, new Date().toISOString()),
    requestId: toText(payload.request_id ?? payload.requestId, '') || null,
    partial: toBoolean(payload.partial, false),
    warnings,
    city: cityCode || cityName ? { code: cityCode, name: cityName } : null,
    dataFreshness: parseFreshness(payload.data_freshness ?? payload.dataFreshness),
    offers,
  };
}

export async function fetchMarketProductSearch(params: {
  query: string;
  cityCode?: string;
  category?: string;
  categoryId?: string;
  brand?: string;
  limit?: number;
}): Promise<MarketProductSearchResponse> {
  const runtime = await ensureRuntimeReady();
  const response =
    runtime.transport === 'supabase_rpc'
      ? await runtime.client.post(`/${runtime.rpc.searchProducts}`, {
          p_q: params.query,
          p_city_code: params.cityCode ?? null,
          p_limit: params.limit ?? 12,
          p_category_id: params.categoryId ?? null,
        })
      : await runtime.client.get(
          buildMarketGelsinSearchEndpoint({
            query: params.query,
            cityCode: params.cityCode,
            category: params.category,
            categoryId: params.categoryId,
            brand: params.brand,
            limit: params.limit,
          })
        );
  const payload = toObject(response.data);
  const rawResults = Array.isArray(response.data)
    ? response.data
    : Array.isArray(payload.results)
    ? payload.results
    : Array.isArray(payload.products)
      ? payload.products
      : [];
  const results = rawResults
    .map(parseSearchProduct)
    .filter((item) => item.productName || item.seedOffers?.length)

  return {
    query: toText(payload.query ?? payload.q, params.query),
    categoryId:
      toText(payload.category_id ?? payload.categoryId, params.categoryId || '') || null,
    fetchedAt: toText(payload.fetched_at ?? payload.fetchedAt, new Date().toISOString()),
    requestId: toText(payload.request_id ?? payload.requestId, '') || null,
    partial: toBoolean(payload.partial, false),
    warnings: toStringArray(payload.warnings),
    results,
  };
}

export async function fetchMarketCategoryTree(params?: {
  cityCode?: string;
  rootCategoryId?: string | null;
  depthLimit?: number;
  query?: string;
  includeCounts?: boolean;
  onlyActive?: boolean;
}): Promise<MarketCategoryTreeResponse> {
  const runtime = await ensureRuntimeReady();
  const response =
    runtime.transport === 'supabase_rpc'
      ? await runtime.client.post(`/${runtime.rpc.listCategories}`, {
          p_city_code: params?.cityCode ?? null,
          p_root_category_id: params?.rootCategoryId ?? null,
          p_depth_limit: params?.depthLimit ?? 1,
          p_q: params?.query ?? null,
          p_include_counts: params?.includeCounts ?? true,
          p_only_active: params?.onlyActive ?? true,
        })
      : await runtime.client.get(
          buildMarketGelsinCategoryTreeEndpoint({
            cityCode: params?.cityCode,
            rootCategoryId: params?.rootCategoryId ?? undefined,
            depthLimit: params?.depthLimit,
            query: params?.query,
            includeCounts: params?.includeCounts,
            onlyActive: params?.onlyActive,
          })
        );
  const payload = toObject(response.data);
  const rawNodes = Array.isArray(response.data)
    ? response.data
    : Array.isArray(payload.nodes)
    ? payload.nodes
    : Array.isArray(payload.categories)
      ? payload.categories
      : [];
  const nodes = rawNodes
    .map(parseCategoryNode)
    .filter((item): item is MarketCategoryNode => Boolean(item));

  return {
    fetchedAt: toText(payload.fetched_at ?? payload.fetchedAt, new Date().toISOString()),
    requestId: toText(payload.request_id ?? payload.requestId, '') || null,
    partial: toBoolean(payload.partial, false),
    warnings: toStringArray(payload.warnings),
    nodes,
  };
}

export async function fetchMarketCategoryProducts(params: {
  categoryId: string;
  cityCode?: string;
  limit?: number;
  cursor?: number;
  sort?: 'popular' | 'price_asc' | 'price_desc' | 'newest' | 'name';
}): Promise<MarketCategoryProductsResponse> {
  const runtime = await ensureRuntimeReady();
  const response =
    runtime.transport === 'supabase_rpc'
      ? await runtime.client.post(`/${runtime.rpc.listCategoryProducts}`, {
          p_category_id: params.categoryId,
          p_city_code: params.cityCode ?? null,
          p_limit: params.limit ?? 12,
          p_cursor: params.cursor ?? 0,
          p_sort: params.sort ?? 'popular',
        })
      : await runtime.client.get(
          buildMarketGelsinSearchEndpoint({
            cityCode: params.cityCode,
            categoryId: params.categoryId,
            limit: params.limit,
          })
        );
  const payload = toObject(response.data);
  const rawResults = Array.isArray(response.data)
    ? response.data
    : Array.isArray(payload.results)
    ? payload.results
    : Array.isArray(payload.products)
      ? payload.products
      : [];
  const results = rawResults
    .map(parseSearchProduct)
    .filter((item) => item.productName || item.seedOffers?.length);

  return {
    categoryId:
      toText(payload.category_id ?? payload.categoryId, params.categoryId) || params.categoryId,
    nextCursor: toNumber(payload.next_cursor ?? payload.nextCursor),
    fetchedAt: toText(payload.fetched_at ?? payload.fetchedAt, new Date().toISOString()),
    requestId: toText(payload.request_id ?? payload.requestId, '') || null,
    partial: toBoolean(payload.partial, false),
    warnings: toStringArray(payload.warnings),
    results,
  };
}

export async function fetchMarketBarcodeLookup(
  barcode: string,
  params?: {
    cityCode?: string;
    limit?: number;
    includeOutOfStock?: boolean;
  }
): Promise<MarketSearchProduct | null> {
  const runtime = await ensureRuntimeReady();
  const searchResponse = await fetchMarketProductSearch({
    query: barcode,
    cityCode: params?.cityCode,
    limit: params?.limit ?? 5,
  });
  let matched = selectBestBarcodeSearchResult(searchResponse.results, barcode);

  if (!matched && runtime.transport === 'supabase_rpc') {
    const response = await runtime.client.post(`/${runtime.rpc.resolve}`, {
      p_barcode: barcode,
      p_city_code: params?.cityCode ?? null,
      p_district: null,
      p_lat: null,
      p_lng: null,
      p_limit: params?.limit ?? 5,
      p_include_out_of_stock: params?.includeOutOfStock ?? true,
    });
    const payload = toObject(response.data);
    const rawResults = Array.isArray(payload.results) ? payload.results : [];
    const firstResult = rawResults[0];

    if (firstResult) {
      const parsed = parseResolveResult(firstResult, barcode);
      matched = {
        ...parsed,
        dataFreshness:
          parsed.dataFreshness ??
          parseFreshness(payload.data_freshness ?? payload.dataFreshness),
      };
    }
  }

  if (!matched) {
    return null;
  }

  if (!matched.barcode) {
    return matched;
  }

  try {
    const offersResponse = await fetchMarketProductOffers(matched.barcode, {
      cityCode: params?.cityCode,
      includeOutOfStock: params?.includeOutOfStock ?? true,
      limit: 20,
      fallbackProductName: matched.productName,
      fallbackBrand: matched.brand,
      enableNameFallback: true,
    });

    return mergeResolvedSearchProduct(matched, {
      bestOffer:
        getBestInStockOffer(offersResponse.offers) ??
        offersResponse.offers[0] ??
        matched.bestOffer,
      seedOffers: offersResponse.offers,
      marketCount: countUniqueMarkets(offersResponse.offers),
      inStockMarketCount: countUniqueMarkets(offersResponse.offers, {
        inStockOnly: true,
      }),
      dataFreshness: offersResponse.dataFreshness ?? matched.dataFreshness,
    });
  } catch {
    return matched;
  }
}

export async function fetchLegacyMarketOfferSearch(params: {
  query: string;
  citySlug?: string;
  barcode?: string;
  limit?: number;
}): Promise<MarketProductSearchResponse> {
  const runtime = await ensureRuntimeReady();

  if (runtime.transport === 'supabase_rpc') {
    return fetchMarketProductSearch({
      query: params.query || params.barcode || '',
      limit: params.limit,
    });
  }

  const response = await runtime.client.get(
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
    const key = buildLegacyProductGroupKey(
      offer,
      `${offer.marketName}-${offer.displayName || ''}`
    );

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
          id: barcode,
          barcode: bestOffer?.barcode || null,
          productName: bestOffer.displayName || barcode,
          brand: null,
          category: null,
          imageUrl: bestOffer.imageUrl ?? null,
          marketLogoUrl: bestOffer.marketLogoUrl ?? null,
          bestOffer,
          seedOffers: offers,
          marketCount: countUniqueMarkets(offers),
          inStockMarketCount: countUniqueMarkets(offers, { inStockOnly: true }),
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
  const runtime = await ensureRuntimeReady();

  if (runtime.transport === 'supabase_rpc') {
    return fetchMarketProductOffers(params.barcode, {
      limit: params.limit,
      includeOutOfStock: true,
    });
  }

  const response = await runtime.client.get(
    buildMarketGelsinOffersEndpoint(params.barcode, {
      limit: params.limit,
      includeOutOfStock: true,
    })
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
  const runtime = await ensureRuntimeReady();

  if (runtime.transport === 'supabase_rpc') {
    const settled: (MarketAlternativePricingEntry | null)[] = await Promise.all(
      request.candidateBarcodes.map(async (candidateBarcode) => {
        try {
          const offersResponse = await fetchMarketProductOffers(candidateBarcode, {
            cityCode: request.cityCode,
            districtName: request.districtName ?? undefined,
            includeOutOfStock: true,
          });

          return {
            barcode: candidateBarcode,
            bestOffer: getBestInStockOffer(offersResponse.offers) ?? offersResponse.offers[0] ?? null,
            marketCount: offersResponse.offers.length,
            inStockMarketCount: offersResponse.offers.filter((offer) => offer.inStock).length,
            dataFreshness: offersResponse.dataFreshness ?? null,
          } satisfies MarketAlternativePricingEntry;
        } catch {
          return null;
        }
      })
    );

    return {
      barcode: request.barcode,
      cityCode: request.cityCode,
      fetchedAt: new Date().toISOString(),
      requestId: null,
      partial: settled.some((entry) => entry == null),
      warnings: settled.some((entry) => entry == null)
        ? ['supabase_rpc_alternative_pricing_fallback_partial']
        : [],
      entries: settled.filter(
        (entry): entry is MarketAlternativePricingEntry => entry !== null
      ),
    };
  }

  const endpoint = buildMarketGelsinAlternativesEndpoint();
  const response = await runtime.client.post(endpoint, {
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
  const runtime = await ensureRuntimeReady();
  const response =
    runtime.transport === 'supabase_rpc'
      ? await runtime.client.post(`/${runtime.rpc.priceHistory}`, {
          p_barcode: barcode,
          p_city_code: params?.cityCode ?? null,
          p_market_name: params?.marketName ?? null,
          p_days: params?.days ?? 30,
        })
      : await runtime.client.get(buildMarketGelsinHistoryEndpoint(barcode, params));
  const payload = toObject(response.data);
  const historyPayload = Array.isArray(payload.history)
    ? payload.history
    : Array.isArray(payload.entries)
      ? payload.entries
      : [];
  const history = historyPayload.map(parseHistoryPoint);

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
  const runtime = await ensureRuntimeReady();

  if (runtime.transport === 'supabase_rpc') {
    const response = await runtime.client.post(`/${runtime.rpc.health}`, {});
    const payload = toObject(response.data);
    const ok = toBoolean(payload.ok, false);

    return {
      cities: 0,
      activeMarkets: ok ? 1 : 0,
      cityTargets: 0,
      verifiedCities: 0,
      localCandidates: 0,
      scrapeRuns: 0,
      offers: 0,
      currentOffers: 0,
      canonicalProducts: 0,
      barcodes: 0,
      liveAdapters: ok ? 1 : 0,
      plannedAdapters: 0,
      metroCities: 0,
      v1LocalProgramCities: 0,
      v2LocalProgramCities: 0,
      v1NationalCoreMarkets: 0,
      scanSignals: 0,
    };
  }

  const response = await runtime.client.get(buildMarketGelsinStatusEndpoint());
  return toObject(response.data) as unknown as MarketRuntimeStatusResponse;
}

export async function fetchMarketProgramCoverage(): Promise<MarketProgramCoverageResponse> {
  const runtime = await ensureRuntimeReady();

  if (runtime.transport === 'supabase_rpc') {
    return {
      mode: 'supabase_rpc',
      note: 'program_coverage_endpoint_not_exposed_in_supabase_rpc_yet',
    };
  }

  const response = await runtime.client.get(buildMarketGelsinProgramCoverageEndpoint());
  return toObject(response.data) as unknown as MarketProgramCoverageResponse;
}

export async function fetchMarketIntegrationsStatus(): Promise<MarketIntegrationsStatusResponse> {
  const runtime = await ensureRuntimeReady();

  if (runtime.transport === 'supabase_rpc') {
    return {
      postgres: {
        enabled: true,
        available: true,
      },
      sqlite: {
        enabled: false,
        available: false,
      },
      firebase: {
        enabled: true,
        available: true,
      },
    };
  }

  const response = await runtime.client.get(buildMarketGelsinIntegrationsStatusEndpoint());
  return toObject(response.data) as unknown as MarketIntegrationsStatusResponse;
}

export async function postMarketScanEvent(
  request: MarketScanEventRequest
): Promise<MarketScanEventResponse> {
  const runtime = await ensureRuntimeReady();
  const response =
    runtime.transport === 'supabase_rpc'
      ? await runtime.client.post(`/${runtime.rpc.recordScan}`, {
          p_barcode: request.barcode,
          p_city_code: request.cityCode ? Number(request.cityCode) : null,
          p_signal_date: String(request.scannedAt || '').slice(0, 10) || null,
          p_scanned_at: request.scannedAt,
          p_scan_count: 1,
          p_source_app: 'barkod_analiz',
          p_device_id: null,
          p_session_id: null,
          p_user_id: null,
          p_payload: {
            district_name: request.districtName ?? null,
            platform: request.platform ?? null,
            app_version: request.appVersion ?? null,
          },
          p_event_id: request.requestId ?? null,
          p_rebuild_hot_refresh: false,
        })
      : await runtime.client.post(buildMarketGelsinScanEventEndpoint(), {
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
  const runtime = await ensureRuntimeReady();

  if (runtime.transport === 'supabase_rpc') {
    const settled = await Promise.allSettled(
      payload.events.map((event) => postMarketScanEvent(event))
    );
    const acceptedCount = settled.filter((item) => item.status === 'fulfilled').length;

    return {
      acceptedCount,
      writtenCount: acceptedCount,
      signalCount: acceptedCount,
    };
  }

  const response = await runtime.client.post(buildMarketGelsinBatchScanEventEndpoint(), {
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
  });
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
  const runtime = await ensureRuntimeReady();

  if (runtime.transport === 'supabase_rpc') {
    throw new Error('market_gelsin_basket_compare_not_available_in_supabase_rpc_yet');
  }

  const response = await runtime.client.post(buildMarketGelsinBasketCompareEndpoint(), {
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
          marketLogoUrl: resolveMarketLogoUrl(
            toText(entry.market_key ?? entry.marketKey, '') || null,
            toText(entry.market_name ?? entry.marketName, '-') || null,
            toText(entry.market_logo_url ?? entry.marketLogoUrl, '') || null
          ),
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

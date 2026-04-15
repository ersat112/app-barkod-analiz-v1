import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MarketCategoryNode } from '../types/marketPricing';
import { fetchMarketCategoryTree } from './marketPricing.service';
import { resolveMarketGelsinRuntimeConfig } from './marketGelsinRuntimeConfig.service';

const PRICE_COMPARE_ROOT_CACHE_KEY = 'price_compare_root_categories_v1';
const PRICE_COMPARE_ROOT_CACHE_TTL_MS = 1000 * 60 * 30;

type StoredRootCategoryCache = {
  fetchedAt: string;
  nodes: MarketCategoryNode[];
};

let inMemoryRootCategoryCache: StoredRootCategoryCache | null = null;
let prewarmPromise: Promise<MarketCategoryNode[] | null> | null = null;

const toNodes = (value: unknown): MarketCategoryNode[] =>
  Array.isArray(value)
    ? value.filter((item): item is MarketCategoryNode => {
        if (!item || typeof item !== 'object') {
          return false;
        }

        const candidate = item as Partial<MarketCategoryNode>;
        return (
          typeof candidate.normalizedCategoryId === 'string' &&
          candidate.normalizedCategoryId.trim().length > 0 &&
          typeof candidate.taxonomyLeaf === 'string' &&
          candidate.taxonomyLeaf.trim().length > 0 &&
          typeof candidate.depth === 'number' &&
          Number.isFinite(candidate.depth)
        );
      })
    : [];

const isFresh = (fetchedAt?: string | null): boolean => {
  if (!fetchedAt) {
    return false;
  }

  const fetchedAtMs = new Date(fetchedAt).getTime();

  if (Number.isNaN(fetchedAtMs)) {
    return false;
  }

  return Date.now() - fetchedAtMs < PRICE_COMPARE_ROOT_CACHE_TTL_MS;
};

const readStoredRootCategories = async (): Promise<StoredRootCategoryCache | null> => {
  try {
    const raw = await AsyncStorage.getItem(PRICE_COMPARE_ROOT_CACHE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredRootCategoryCache> | null;
    const fetchedAt =
      typeof parsed?.fetchedAt === 'string' && parsed.fetchedAt.trim().length > 0
        ? parsed.fetchedAt
        : null;
    const nodes = toNodes(parsed?.nodes);

    if (!fetchedAt || !nodes.length) {
      return null;
    }

    return {
      fetchedAt,
      nodes,
    };
  } catch (error) {
    console.warn('[PriceCompareWarmup] root cache read failed:', error);
    return null;
  }
};

const writeStoredRootCategories = async (payload: StoredRootCategoryCache): Promise<void> => {
  inMemoryRootCategoryCache = payload;

  try {
    await AsyncStorage.setItem(PRICE_COMPARE_ROOT_CACHE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('[PriceCompareWarmup] root cache write failed:', error);
  }
};

export const getCachedPriceCompareRootCategories = async (options?: {
  allowStale?: boolean;
}): Promise<MarketCategoryNode[] | null> => {
  const allowStale = Boolean(options?.allowStale);

  if (
    inMemoryRootCategoryCache?.nodes.length &&
    (allowStale || isFresh(inMemoryRootCategoryCache.fetchedAt))
  ) {
    return inMemoryRootCategoryCache.nodes;
  }

  const stored = await readStoredRootCategories();

  if (!stored) {
    return null;
  }

  inMemoryRootCategoryCache = stored;

  if (!allowStale && !isFresh(stored.fetchedAt)) {
    return null;
  }

  return stored.nodes;
};

export const prewarmPriceCompareRootCategories = async (options?: {
  forceRefresh?: boolean;
  allowStale?: boolean;
}): Promise<MarketCategoryNode[] | null> => {
  const forceRefresh = Boolean(options?.forceRefresh);
  const allowStale = Boolean(options?.allowStale);

  if (!forceRefresh && prewarmPromise) {
    return prewarmPromise;
  }

  const run = async (): Promise<MarketCategoryNode[] | null> => {
    const runtime = await resolveMarketGelsinRuntimeConfig({
      forceRefresh: false,
      allowStale: true,
    });

    if (!runtime.isEnabled) {
      return null;
    }

    if (!forceRefresh) {
      const cached = await getCachedPriceCompareRootCategories({ allowStale });

      if (cached?.length && (allowStale || inMemoryRootCategoryCache?.fetchedAt)) {
        if (allowStale || isFresh(inMemoryRootCategoryCache?.fetchedAt)) {
          return cached;
        }
      }
    }

    try {
      const response = await fetchMarketCategoryTree({
        depthLimit: 1,
        includeCounts: false,
        onlyActive: true,
      });

      if (!response.nodes.length) {
        return null;
      }

      await writeStoredRootCategories({
        fetchedAt: new Date().toISOString(),
        nodes: response.nodes,
      });

      return response.nodes;
    } catch (error) {
      console.warn('[PriceCompareWarmup] root prewarm failed:', error);
      const fallback = await getCachedPriceCompareRootCategories({ allowStale: true });
      return fallback;
    }
  };

  prewarmPromise = run();

  try {
    return await prewarmPromise;
  } finally {
    prewarmPromise = null;
  }
};

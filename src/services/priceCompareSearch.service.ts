import { getLatestHistoryEntriesForBarcodes, getRecentUniqueHistoryEntries } from './db/history.repository';
import { getAllFavoriteBarcodes } from './db/favorites.repository';
import { getCachedProductsByType } from './db/productCache.repository';
import type { MarketSearchProduct } from '../types/marketPricing';
import type { Product } from '../utils/analysis';

type LocalSearchSource = 'history' | 'favorite' | 'cache';

type LocalSearchCandidate = {
  barcode: string;
  productName: string;
  brand?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  source: LocalSearchSource;
  freshnessSeed: number;
};

const normalizeSearchValue = (value?: string | null): string =>
  String(value || '')
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const tokenizeSearchValue = (value?: string | null): string[] =>
  normalizeSearchValue(value)
    .split(/\s+/)
    .filter(Boolean);

const buildSearchHaystack = (candidate: LocalSearchCandidate): string =>
  normalizeSearchValue(
    [candidate.productName, candidate.brand, candidate.category, candidate.barcode].join(' ')
  );

const buildCandidateFromProduct = (
  product: Product,
  source: LocalSearchSource,
  freshnessSeed: number
): LocalSearchCandidate | null => {
  if (product.type === 'medicine') {
    return null;
  }

  const barcode = String(product.barcode || '').trim();

  if (!barcode) {
    return null;
  }

  return {
    barcode,
    productName: String(product.name || '').trim() || barcode,
    brand: String(product.brand || '').trim() || null,
    category: product.type === 'food'
      ? 'Gıda'
      : product.type === 'beauty'
        ? 'Kozmetik'
        : 'İlaç',
    imageUrl: String(product.image_url || '').trim() || null,
    source,
    freshnessSeed,
  };
};

const computeLocalCandidateScore = (
  candidate: LocalSearchCandidate,
  query: string,
  queryTokens: string[]
): number => {
  const normalizedQuery = normalizeSearchValue(query);
  const haystack = buildSearchHaystack(candidate);
  let score = 0;
  let hasMatch = false;

  if (!normalizedQuery) {
    return score;
  }

  if (candidate.barcode === query.trim()) {
    score += 140;
    hasMatch = true;
  } else if (candidate.barcode.startsWith(query.trim())) {
    score += 110;
    hasMatch = true;
  }

  if (haystack === normalizedQuery) {
    score += 100;
    hasMatch = true;
  } else if (haystack.startsWith(normalizedQuery)) {
    score += 82;
    hasMatch = true;
  } else if (haystack.includes(normalizedQuery)) {
    score += 64;
    hasMatch = true;
  }

  if (queryTokens.length) {
    const matchedTokenCount = queryTokens.filter((token) => haystack.includes(token)).length;

    if (matchedTokenCount > 0) {
      hasMatch = true;
      score += matchedTokenCount * 14;
    }

    if (matchedTokenCount === queryTokens.length) {
      score += 18;
    }
  }

  if (!hasMatch) {
    return 0;
  }

  if (candidate.source === 'favorite') {
    score += 12;
  } else if (candidate.source === 'history') {
    score += 8;
  }

  score += Math.max(0, 30 - candidate.freshnessSeed);

  return score;
};

const toMarketSearchProduct = (candidate: LocalSearchCandidate): MarketSearchProduct => ({
  id: candidate.barcode,
  barcode: candidate.barcode,
  productName: candidate.productName,
  brand: candidate.brand ?? null,
  category: candidate.category ?? null,
  imageUrl: candidate.imageUrl ?? null,
  marketLogoUrl: null,
  bestOffer: null,
  seedOffers: [],
  marketCount: 0,
  inStockMarketCount: 0,
  dataFreshness: null,
});

export function searchLocalPriceCompareProducts(
  query: string,
  limit = 8
): MarketSearchProduct[] {
  const trimmedQuery = query.trim();
  const queryTokens = tokenizeSearchValue(trimmedQuery);

  if (trimmedQuery.length < 2) {
    return [];
  }

  const recentHistory = getRecentUniqueHistoryEntries(40);
  const favoriteBarcodes = getAllFavoriteBarcodes(30);
  const favoriteEntries = getLatestHistoryEntriesForBarcodes(favoriteBarcodes);
  const cachedFood = getCachedProductsByType('food', 80);
  const cachedBeauty = getCachedProductsByType('beauty', 60);

  const candidateMap = new Map<string, LocalSearchCandidate>();

  const remember = (candidate: LocalSearchCandidate | null) => {
    if (!candidate) {
      return;
    }

    const existing = candidateMap.get(candidate.barcode);

    if (!existing || candidate.freshnessSeed < existing.freshnessSeed) {
      candidateMap.set(candidate.barcode, candidate);
    }
  };

  recentHistory.forEach((entry, index) => {
    remember(buildCandidateFromProduct(entry, 'history', index));
  });

  favoriteEntries.forEach((entry, index) => {
    remember(buildCandidateFromProduct(entry, 'favorite', index));
  });

  [...cachedFood, ...cachedBeauty].forEach((entry, index) => {
    remember(buildCandidateFromProduct(entry, 'cache', index + 10));
  });

  return Array.from(candidateMap.values())
    .map((candidate) => ({
      candidate,
      score: computeLocalCandidateScore(candidate, trimmedQuery, queryTokens),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }

      return left.candidate.productName.localeCompare(right.candidate.productName, 'tr');
    })
    .slice(0, Math.max(1, Math.min(limit, 20)))
    .map((item) => toMarketSearchProduct(item.candidate));
}

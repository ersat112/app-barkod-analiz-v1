import type { HistoryEntry } from './db';
import { getLatestHistoryEntriesForBarcodes, getRecentUniqueHistoryEntries } from './db/history.repository';
import { getAllFavoriteBarcodes } from './db/favorites.repository';
import { getCachedProductsByType } from './db/productCache.repository';
import { getCuratedAlternativeProducts } from './curatedAlternativeCatalog.service';
import {
  hasActiveNutritionPreferences,
  isProductCompatibleWithNutritionPreferences,
  isProductStrictlyCompatibleWithNutritionPreferences,
  type NutritionPreferences,
} from './nutritionPreferences.service';
import {
  analyzeProduct,
  type AnalysisResult,
  type Product,
} from '../utils/analysis';

export type ProductAlternativeCandidateSource = 'curated' | 'favorite' | 'history' | 'cache';

export type ProductAlternativeSuggestion = {
  product: Product;
  analysis: AnalysisResult;
  candidateSource: ProductAlternativeCandidateSource;
  rankingScore: number;
  scoreDelta: number;
  additiveImprovement: number;
  novaImprovement: number;
  sharedTokenCount: number;
  sameBrand: boolean;
};

type CandidateEnvelope = {
  product: Product;
  analysis: AnalysisResult;
  source: ProductAlternativeCandidateSource;
};

const STOP_WORDS = new Set([
  'VE',
  'ILE',
  'THE',
  'AND',
  'FOR',
  'WITH',
  'DER',
  'DIE',
  'DAS',
  'ET',
  'LE',
  'LA',
  'DE',
  'DU',
  'DES',
  'KREM',
  'CREAM',
  'GEL',
  'SOAP',
  'SABUN',
  'URUN',
  'PRODUCT',
  'COSMETIC',
  'KOZMETIK',
]);

const SOURCE_WEIGHT: Record<ProductAlternativeCandidateSource, number> = {
  curated: 4,
  favorite: 3,
  history: 2,
  cache: 1,
};

const normalizeText = (value?: string | null): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLocaleUpperCase('tr-TR');

const tokenize = (value?: string | null): string[] =>
  normalizeText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 3 &&
        !STOP_WORDS.has(token) &&
        !/^\d+$/.test(token)
    );

const getProductTokens = (product: Product): Set<string> => {
  return new Set([
    ...tokenize(product.name),
    ...tokenize(product.brand),
  ]);
};

const getSharedTokenCount = (left: Product, right: Product): number => {
  const leftTokens = getProductTokens(left);
  const rightTokens = getProductTokens(right);
  let count = 0;

  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) {
      count += 1;
    }
  });

  return count;
};

const isSameBrand = (left?: string | null, right?: string | null): boolean => {
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);

  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
};

const getProductRichnessScore = (product: Product): number => {
  let score = 0;

  score += Math.min(String(product.name || '').trim().length, 80);
  score += Math.min(String(product.brand || '').trim().length, 40);
  score += Math.min(String(product.ingredients_text || '').trim().length, 120);

  if (product.image_url) {
    score += 20;
  }

  if (typeof product.score === 'number' && Number.isFinite(product.score)) {
    score += 24;
  }

  if (product.grade) {
    score += 16;
  }

  if (Array.isArray(product.additives) && product.additives.length > 0) {
    score += Math.min(product.additives.length * 4, 20);
  }

  if (product.usage_instructions) {
    score += 12;
  }

  return score;
};

const choosePreferredEnvelope = (
  current: CandidateEnvelope,
  next: CandidateEnvelope
): CandidateEnvelope => {
  const currentRichness = getProductRichnessScore(current.product);
  const nextRichness = getProductRichnessScore(next.product);

  if (nextRichness > currentRichness) {
    return SOURCE_WEIGHT[next.source] >= SOURCE_WEIGHT[current.source]
      ? next
      : {
          ...next,
          source: current.source,
        };
  }

  if (nextRichness === currentRichness && SOURCE_WEIGHT[next.source] > SOURCE_WEIGHT[current.source]) {
    return {
      ...current,
      source: next.source,
    };
  }

  return current;
};

const toHistoryProducts = (entries: HistoryEntry[]): Product[] =>
  entries.map((entry) => ({
    ...entry,
  }));

const buildCandidatePool = (currentProduct: Product): CandidateEnvelope[] => {
  const curatedProducts = getCuratedAlternativeProducts(currentProduct);
  const favoriteBarcodes = getAllFavoriteBarcodes(20);
  const favoriteEntries = getLatestHistoryEntriesForBarcodes(favoriteBarcodes);
  const recentEntries = getRecentUniqueHistoryEntries(60);
  const cachedProducts = getCachedProductsByType(currentProduct.type, 120);

  const envelopes: CandidateEnvelope[] = [
    ...curatedProducts.map((product) => ({
      product,
      analysis: analyzeProduct(product),
      source: 'curated' as const,
    })),
    ...toHistoryProducts(favoriteEntries).map((product) => ({
      product,
      analysis: analyzeProduct(product),
      source: 'favorite' as const,
    })),
    ...toHistoryProducts(recentEntries).map((product) => ({
      product,
      analysis: analyzeProduct(product),
      source: 'history' as const,
    })),
    ...cachedProducts.map((product) => ({
      product,
      analysis: analyzeProduct(product),
      source: 'cache' as const,
    })),
  ];

  const deduped = new Map<string, CandidateEnvelope>();

  envelopes.forEach((candidate) => {
    const barcode = String(candidate.product.barcode || '').trim();

    if (!barcode || barcode === currentProduct.barcode || candidate.product.type !== currentProduct.type) {
      return;
    }

    const existing = deduped.get(barcode);

    if (!existing) {
      deduped.set(barcode, candidate);
      return;
    }

    deduped.set(barcode, choosePreferredEnvelope(existing, candidate));
  });

  return Array.from(deduped.values());
};

const rankSuggestion = (
  currentProduct: Product,
  currentAnalysis: AnalysisResult,
  candidate: CandidateEnvelope
): ProductAlternativeSuggestion | null => {
  const scoreDelta = candidate.analysis.score - currentAnalysis.score;
  const additiveImprovement =
    Math.max(
      0,
      currentAnalysis.highRiskAdditiveCount - candidate.analysis.highRiskAdditiveCount
    ) +
    Math.max(
      0,
      currentAnalysis.foundECodes.length - candidate.analysis.foundECodes.length
    );
  const novaImprovement =
    currentProduct.type === 'food' &&
    typeof currentAnalysis.novaGroup === 'number' &&
    typeof candidate.analysis.novaGroup === 'number'
      ? Math.max(0, currentAnalysis.novaGroup - candidate.analysis.novaGroup)
      : 0;
  const sharedTokenCount = getSharedTokenCount(currentProduct, candidate.product);
  const sameBrand = isSameBrand(currentProduct.brand, candidate.product.brand);

  const qualityImproved =
    scoreDelta >= 5 || additiveImprovement > 0 || novaImprovement > 0;

  if (!qualityImproved) {
    return null;
  }

  let rankingScore = scoreDelta * 2;
  rankingScore += additiveImprovement * (currentProduct.type === 'food' ? 7 : 8);
  rankingScore += novaImprovement * 10;
  rankingScore += sharedTokenCount * 12;
  rankingScore += sameBrand ? 8 : 0;
  rankingScore += SOURCE_WEIGHT[candidate.source] * 5;
  rankingScore += candidate.product.image_url ? 4 : 0;

  return {
    product: candidate.product,
    analysis: candidate.analysis,
    candidateSource: candidate.source,
    rankingScore,
    scoreDelta,
    additiveImprovement,
    novaImprovement,
    sharedTokenCount,
    sameBrand,
  };
};

export const getProductAlternativeSuggestions = ({
  product,
  analysis,
  limit = 3,
  nutritionPreferences = undefined,
}: {
  product: Product;
  analysis: AnalysisResult;
  limit?: number;
  nutritionPreferences?: NutritionPreferences;
}): ProductAlternativeSuggestion[] => {
  if (product.type === 'medicine') {
    return [];
  }

  const safeLimit =
    typeof limit === 'number' && Number.isFinite(limit)
      ? Math.max(1, Math.min(Math.round(limit), 6))
      : 3;

  const candidatePool = buildCandidatePool(product);
  const preferenceAwarePool =
    product.type === 'food' &&
    nutritionPreferences &&
    hasActiveNutritionPreferences(nutritionPreferences)
      ? (() => {
          const compatibleCandidates = candidatePool.filter((candidate) =>
            isProductCompatibleWithNutritionPreferences(candidate.product, nutritionPreferences)
          );
          const strictlyCompatibleCandidates = compatibleCandidates.filter((candidate) =>
            isProductStrictlyCompatibleWithNutritionPreferences(
              candidate.product,
              nutritionPreferences
            )
          );

          if (strictlyCompatibleCandidates.length) {
            return strictlyCompatibleCandidates;
          }

          if (compatibleCandidates.length) {
            return compatibleCandidates;
          }

          return candidatePool;
        })()
      : candidatePool;

  const ranked = preferenceAwarePool
    .map((candidate) => rankSuggestion(product, analysis, candidate))
    .filter((candidate): candidate is ProductAlternativeSuggestion => candidate !== null)
    .sort((left, right) => {
      const rankingDelta = right.rankingScore - left.rankingScore;

      if (rankingDelta !== 0) {
        return rankingDelta;
      }

      return right.analysis.score - left.analysis.score;
    });

  if (ranked.length >= safeLimit) {
    return ranked.slice(0, safeLimit);
  }

  const fallbackCandidates = preferenceAwarePool
    .map((candidate) => {
      const scoreDelta = candidate.analysis.score - analysis.score;

      if (scoreDelta <= 0) {
        return null;
      }

      return {
        product: candidate.product,
        analysis: candidate.analysis,
        candidateSource: candidate.source,
        rankingScore: scoreDelta,
        scoreDelta,
        additiveImprovement: Math.max(
          0,
          analysis.foundECodes.length - candidate.analysis.foundECodes.length
        ),
        novaImprovement:
          product.type === 'food' &&
          typeof analysis.novaGroup === 'number' &&
          typeof candidate.analysis.novaGroup === 'number'
            ? Math.max(0, analysis.novaGroup - candidate.analysis.novaGroup)
            : 0,
        sharedTokenCount: getSharedTokenCount(product, candidate.product),
        sameBrand: isSameBrand(product.brand, candidate.product.brand),
      } satisfies ProductAlternativeSuggestion;
    })
    .filter((candidate): candidate is ProductAlternativeSuggestion => candidate !== null)
    .sort((left, right) => right.rankingScore - left.rankingScore);

  const merged = new Map<string, ProductAlternativeSuggestion>();

  [...ranked, ...fallbackCandidates].forEach((candidate) => {
    if (!merged.has(candidate.product.barcode)) {
      merged.set(candidate.product.barcode, candidate);
    }
  });

  return Array.from(merged.values()).slice(0, safeLimit);
};

import type { HistoryEntry } from './db';
import { getLatestHistoryEntriesForBarcodes, getRecentUniqueHistoryEntries } from './db/history.repository';
import { getAllFavoriteBarcodes } from './db/favorites.repository';
import { getCachedProductsByType } from './db/productCache.repository';
import { getCuratedAlternativeProducts } from './curatedAlternativeCatalog.service';
import { searchBeautyProductsByText } from '../api/beautyApi';
import { searchFoodProductsByText } from '../api/foodApi';
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

export type ProductAlternativeCandidateSource =
  | 'curated'
  | 'favorite'
  | 'history'
  | 'cache'
  | 'remote';

export type ProductAlternativeSuggestion = {
  product: Product;
  analysis: AnalysisResult;
  candidateSource: ProductAlternativeCandidateSource;
  suggestionKind: 'same-category' | 'healthier-substitute';
  replacementProfileId?: string;
  rankingScore: number;
  scoreDelta: number;
  additiveImprovement: number;
  novaImprovement: number;
  sharedTokenCount: number;
  categoryOverlapCount: number;
  sameBrand: boolean;
};

type CandidateEnvelope = {
  product: Product;
  analysis: AnalysisResult;
  source: ProductAlternativeCandidateSource;
};

type ReplacementProfile = {
  id: 'sweetened_beverage';
  searchQueries: string[];
  candidateMarkers: string[];
  maxSugarPer100g: number;
};

const isNonNull = <T>(value: T | null): value is T => value !== null;

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
  remote: 5,
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

const normalizeCategoryTag = (value?: string | null): string =>
  normalizeText(value)
    .replace(/^[A-Z]{2}:/, '')
    .trim();

const getProductCategoryTokens = (product: Product): Set<string> => {
  const directTags = Array.isArray(product.categories_tags)
    ? product.categories_tags
    : [];

  const categoryTokens = [
    ...directTags.map((item) => normalizeCategoryTag(item)).filter(Boolean),
    ...tokenize(product.categories),
  ];

  return new Set(categoryTokens);
};

const getNumericNutriment = (product: Product, ...keys: string[]): number | null => {
  const nutriments = product.nutriments;

  if (!nutriments) {
    return null;
  }

  for (const key of keys) {
    const value = nutriments[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
};

const getSugarAmount = (product: Product): number | null =>
  getNumericNutriment(product, 'sugars_100g', 'sugars_100ml', 'sugars');

const getCombinedProductTokens = (product: Product): Set<string> => {
  return new Set([
    ...getProductTokens(product),
    ...getProductCategoryTokens(product),
  ]);
};

const markerCount = (product: Product, markers: string[]): number => {
  const tokens = getCombinedProductTokens(product);
  let count = 0;

  markers.forEach((marker) => {
    if (tokens.has(normalizeText(marker))) {
      count += 1;
    }
  });

  return count;
};

const SWEETENED_BEVERAGE_SOURCE_MARKERS = [
  'COLA',
  'COLAS',
  'SOFT DRINK',
  'SOFT DRINKS',
  'SODA',
  'SODAS',
  'GAZLI',
  'MESRUBAT',
  'LEMONADE',
  'ICE TEA',
  'ICED TEA',
  'ENERGY DRINK',
  'ENERGY DRINKS',
  'SWEETENED BEVERAGE',
  'SWEETENED BEVERAGES',
  'CARBONATED DRINKS',
];

const BEVERAGE_CONTEXT_MARKERS = [
  'BEVERAGE',
  'BEVERAGES',
  'DRINK',
  'DRINKS',
  'ICECEK',
  'İÇECEK',
  'SODA',
  'COLA',
  'LEMONADE',
  'AYRAN',
  'MADEN SUYU',
  'MINERAL WATER',
  'SPARKLING WATER',
  'ENERGY DRINK',
  'ICE TEA',
  'ICED TEA',
  'FRUIT JUICE',
  'JUICE',
];

const SWEETENED_BEVERAGE_REPLACEMENT_MARKERS = [
  'WATER',
  'WATERS',
  'MINERAL WATER',
  'MINERAL WATERS',
  'SPARKLING WATER',
  'SODA WATER',
  'SPRING WATER',
  'MADEN SUYU',
  'MEYVE SUYU',
  'FRUIT JUICE',
  'FRUIT JUICES',
  'JUICE',
  'JUICES',
];

const GENERIC_HEALTHIER_BEVERAGE_CANDIDATES: Product[] = [
  {
    barcode: '9900000000001',
    name: 'Natural Spring Water',
    brand: 'ScanScore Choice',
    image_url: '',
    type: 'food',
    ingredients_text: 'Natural spring water.',
    nutriments: {
      energy_kcal_100g: 0,
      fat_100g: 0,
      saturated_fat_100g: 0,
      sugars_100g: 0,
      salt_100g: 0,
      fiber_100g: 0,
      proteins_100g: 0,
    },
    categories: 'Waters, Spring waters',
    categories_tags: ['en:waters', 'en:spring-waters', 'en:beverages'],
  },
  {
    barcode: '9900000000002',
    name: 'Sparkling Mineral Water',
    brand: 'ScanScore Choice',
    image_url: '',
    type: 'food',
    ingredients_text: 'Natural mineral water, carbon dioxide.',
    nutriments: {
      energy_kcal_100g: 0,
      fat_100g: 0,
      saturated_fat_100g: 0,
      sugars_100g: 0,
      salt_100g: 0.02,
      fiber_100g: 0,
      proteins_100g: 0,
    },
    categories: 'Sparkling waters, Mineral waters',
    categories_tags: ['en:sparkling-waters', 'en:mineral-waters', 'en:beverages'],
  },
  {
    barcode: '9900000000003',
    name: 'Soda Water',
    brand: 'ScanScore Choice',
    image_url: '',
    type: 'food',
    ingredients_text: 'Carbonated water.',
    nutriments: {
      energy_kcal_100g: 0,
      fat_100g: 0,
      saturated_fat_100g: 0,
      sugars_100g: 0,
      salt_100g: 0.03,
      fiber_100g: 0,
      proteins_100g: 0,
    },
    categories: 'Carbonated waters, Waters',
    categories_tags: ['en:carbonated-waters', 'en:waters', 'en:beverages'],
  },
  {
    barcode: '9900000000004',
    name: '100% Orange Juice',
    brand: 'ScanScore Choice',
    image_url: '',
    type: 'food',
    ingredients_text: '100% orange juice from concentrate.',
    nutriments: {
      energy_kcal_100g: 45,
      fat_100g: 0,
      saturated_fat_100g: 0,
      sugars_100g: 8.8,
      salt_100g: 0.01,
      fiber_100g: 0.2,
      proteins_100g: 0.7,
    },
    categories: 'Fruit juices, Orange juices',
    categories_tags: ['en:fruit-juices', 'en:orange-juices', 'en:beverages'],
  },
];

const getReplacementProfile = (
  product: Product,
  analysis: AnalysisResult
): ReplacementProfile | null => {
  if (product.type !== 'food' || analysis.score >= 45) {
    return null;
  }

  const sourceMarkerHits = markerCount(product, SWEETENED_BEVERAGE_SOURCE_MARKERS);
  const beverageContextHits = markerCount(product, BEVERAGE_CONTEXT_MARKERS);
  const sugarAmount = getSugarAmount(product);

  if (sourceMarkerHits === 0 && beverageContextHits === 0) {
    return null;
  }

  if (typeof sugarAmount === 'number' && sugarAmount < 3 && sourceMarkerHits === 0) {
    return null;
  }

  return {
    id: 'sweetened_beverage',
    searchQueries: ['water', 'mineral water', 'sparkling water', 'soda water', 'fruit juice'],
    candidateMarkers: SWEETENED_BEVERAGE_REPLACEMENT_MARKERS,
    maxSugarPer100g: 10,
  };
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

const getCategoryOverlapCount = (left: Product, right: Product): number => {
  const leftTokens = getProductCategoryTokens(left);
  const rightTokens = getProductCategoryTokens(right);
  let count = 0;

  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) {
      count += 1;
    }
  });

  return count;
};

const hasMeaningfulSimilarity = (left: Product, right: Product): boolean => {
  const categoryOverlapCount = getCategoryOverlapCount(left, right);
  const sharedTokenCount = getSharedTokenCount(left, right);
  const sameBrand = isSameBrand(left.brand, right.brand);

  return (
    categoryOverlapCount > 0 ||
    sharedTokenCount >= 2 ||
    (sameBrand && sharedTokenCount >= 1)
  );
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

const buildSearchQueries = (product: Product): string[] => {
  const normalizedBrand = String(product.brand || '').trim();
  const normalizedName = String(product.name || '').trim();
  const nameTokens = tokenize(normalizedName).slice(0, 5);

  return [
    [normalizedBrand, normalizedName].filter(Boolean).join(' ').trim(),
    normalizedName,
    nameTokens.join(' ').trim(),
  ].filter((value, index, list) => value.length >= 3 && list.indexOf(value) === index);
};

const searchProductsByType = async (
  productType: Product['type'],
  query: string,
  limit = 10
): Promise<Product[]> => {
  if (productType === 'food') {
    return searchFoodProductsByText(query, limit);
  }

  if (productType === 'beauty') {
    return searchBeautyProductsByText(query, limit);
  }

  return [];
};

const buildRemoteCandidatePool = async (
  currentProduct: Product
): Promise<CandidateEnvelope[]> => {
  const queries = buildSearchQueries(currentProduct);

  if (!queries.length) {
    return [];
  }

  const settledResults = await Promise.allSettled(
    queries.map((query) => searchProductsByType(currentProduct.type, query, 10))
  );

  const deduped = new Map<string, CandidateEnvelope>();

  settledResults.forEach((result) => {
    if (result.status !== 'fulfilled') {
      return;
    }

    result.value.forEach((product) => {
      const barcode = String(product.barcode || '').trim();

      if (
        !barcode ||
        barcode === String(currentProduct.barcode || '').trim() ||
        product.type !== currentProduct.type
      ) {
        return;
      }

      const nextEnvelope: CandidateEnvelope = {
        product,
        analysis: analyzeProduct(product),
        source: 'remote',
      };
      const existing = deduped.get(barcode);

      if (!existing) {
        deduped.set(barcode, nextEnvelope);
        return;
      }

      deduped.set(barcode, choosePreferredEnvelope(existing, nextEnvelope));
    });
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
  const categoryOverlapCount = getCategoryOverlapCount(
    currentProduct,
    candidate.product
  );
  const sameBrand = isSameBrand(currentProduct.brand, candidate.product.brand);
  const similarityStrongEnough = hasMeaningfulSimilarity(
    currentProduct,
    candidate.product
  );

  const qualityImproved =
    scoreDelta >= 5 || additiveImprovement > 0 || novaImprovement > 0;

  if (!qualityImproved || !similarityStrongEnough) {
    return null;
  }

  let rankingScore = scoreDelta * 2;
  rankingScore += additiveImprovement * (currentProduct.type === 'food' ? 7 : 8);
  rankingScore += novaImprovement * 10;
  rankingScore += categoryOverlapCount * 16;
  rankingScore += sharedTokenCount * 12;
  rankingScore += sameBrand ? 8 : 0;
  rankingScore += SOURCE_WEIGHT[candidate.source] * 5;
  rankingScore += candidate.product.image_url ? 4 : 0;

  return {
    product: candidate.product,
    analysis: candidate.analysis,
    candidateSource: candidate.source,
    suggestionKind: 'same-category',
    rankingScore,
    scoreDelta,
    additiveImprovement,
    novaImprovement,
    sharedTokenCount,
    categoryOverlapCount,
    sameBrand,
  };
};

const finalizeSuggestions = ({
  product,
  analysis,
  candidatePool,
  limit = 3,
  nutritionPreferences = undefined,
}: {
  product: Product;
  analysis: AnalysisResult;
  candidatePool: CandidateEnvelope[];
  limit?: number;
  nutritionPreferences?: NutritionPreferences;
}): ProductAlternativeSuggestion[] => {
  const safeLimit =
    typeof limit === 'number' && Number.isFinite(limit)
      ? Math.max(1, Math.min(Math.round(limit), 6))
      : 3;

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
      const sharedTokenCount = getSharedTokenCount(product, candidate.product);
      const categoryOverlapCount = getCategoryOverlapCount(product, candidate.product);
      const sameBrand = isSameBrand(product.brand, candidate.product.brand);

      if (!hasMeaningfulSimilarity(product, candidate.product)) {
        return null;
      }

      if (scoreDelta <= 0) {
        return null;
      }

      const suggestion: ProductAlternativeSuggestion = {
        product: candidate.product,
        analysis: candidate.analysis,
        candidateSource: candidate.source,
        suggestionKind: 'same-category',
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
        sharedTokenCount,
        categoryOverlapCount,
        sameBrand,
      };

      return suggestion;
    })
    .filter(isNonNull)
    .sort((left, right) => right.rankingScore - left.rankingScore);

  const merged = new Map<string, ProductAlternativeSuggestion>();

  [...ranked, ...fallbackCandidates].forEach((candidate) => {
    if (!merged.has(candidate.product.barcode)) {
      merged.set(candidate.product.barcode, candidate);
    }
  });

  return Array.from(merged.values()).slice(0, safeLimit);
};

const buildReplacementCandidatePool = async (
  profile: ReplacementProfile,
  currentProduct: Product
): Promise<CandidateEnvelope[]> => {
  const genericCandidates: CandidateEnvelope[] =
    profile.id === 'sweetened_beverage'
      ? GENERIC_HEALTHIER_BEVERAGE_CANDIDATES.map((product) => ({
          product,
          analysis: analyzeProduct(product),
          source: 'curated' as const,
        }))
      : [];

  const settledResults = await Promise.allSettled(
    profile.searchQueries.map((query) =>
      searchProductsByType(currentProduct.type, query, 8)
    )
  );

  const deduped = new Map<string, CandidateEnvelope>();

  settledResults.forEach((result) => {
    if (result.status !== 'fulfilled') {
      return;
    }

    result.value.forEach((product) => {
      const barcode = String(product.barcode || '').trim();

      if (
        !barcode ||
        barcode === String(currentProduct.barcode || '').trim() ||
        product.type !== currentProduct.type
      ) {
        return;
      }

      const nextEnvelope: CandidateEnvelope = {
        product,
        analysis: analyzeProduct(product),
        source: 'remote',
      };
      const existing = deduped.get(barcode);

      if (!existing) {
        deduped.set(barcode, nextEnvelope);
        return;
      }

      deduped.set(barcode, choosePreferredEnvelope(existing, nextEnvelope));
    });
  });

  genericCandidates.forEach((candidate) => {
    const barcode = String(candidate.product.barcode || '').trim();

    if (!barcode || barcode === String(currentProduct.barcode || '').trim()) {
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

const finalizeReplacementSuggestions = ({
  product,
  analysis,
  candidatePool,
  profile,
  limit,
}: {
  product: Product;
  analysis: AnalysisResult;
  candidatePool: CandidateEnvelope[];
  profile: ReplacementProfile;
  limit: number;
}): ProductAlternativeSuggestion[] => {
  const currentSugar = getSugarAmount(product);

  return candidatePool
    .map((candidate) => {
      const scoreDelta = candidate.analysis.score - analysis.score;
      const replacementMarkerHits = markerCount(
        candidate.product,
        profile.candidateMarkers
      );
      const candidateSugar = getSugarAmount(candidate.product);

      if (replacementMarkerHits === 0) {
        return null;
      }

      if (scoreDelta < 12 || candidate.analysis.score < 65) {
        return null;
      }

      if (
        typeof candidateSugar === 'number' &&
        candidateSugar > profile.maxSugarPer100g
      ) {
        return null;
      }

      if (
        typeof currentSugar === 'number' &&
        typeof candidateSugar === 'number' &&
        candidateSugar >= currentSugar
      ) {
        return null;
      }

      const additiveImprovement = Math.max(
        0,
        analysis.highRiskAdditiveCount - candidate.analysis.highRiskAdditiveCount
      );
      const sugarImprovement =
        typeof currentSugar === 'number' && typeof candidateSugar === 'number'
          ? Math.max(0, currentSugar - candidateSugar)
          : 0;

      const suggestion: ProductAlternativeSuggestion = {
        product: candidate.product,
        analysis: candidate.analysis,
        candidateSource: candidate.source,
        suggestionKind: 'healthier-substitute',
        replacementProfileId: profile.id,
        rankingScore:
          scoreDelta * 2 +
          replacementMarkerHits * 18 +
          additiveImprovement * 8 +
          sugarImprovement * 1.5 +
          SOURCE_WEIGHT[candidate.source] * 5,
        scoreDelta,
        additiveImprovement,
        novaImprovement:
          product.type === 'food' &&
          typeof analysis.novaGroup === 'number' &&
          typeof candidate.analysis.novaGroup === 'number'
            ? Math.max(0, analysis.novaGroup - candidate.analysis.novaGroup)
            : 0,
        sharedTokenCount: getSharedTokenCount(product, candidate.product),
        categoryOverlapCount: getCategoryOverlapCount(product, candidate.product),
        sameBrand: isSameBrand(product.brand, candidate.product.brand),
      };

      return suggestion;
    })
    .filter(isNonNull)
    .sort((left, right) => right.rankingScore - left.rankingScore)
    .slice(0, Math.max(1, Math.min(limit, 3)));
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

  return finalizeSuggestions({
    product,
    analysis,
    candidatePool: buildCandidatePool(product),
    limit,
    nutritionPreferences,
  });
};

export const getExpandedProductAlternativeSuggestions = async ({
  product,
  analysis,
  limit = 3,
  nutritionPreferences = undefined,
}: {
  product: Product;
  analysis: AnalysisResult;
  limit?: number;
  nutritionPreferences?: NutritionPreferences;
}): Promise<ProductAlternativeSuggestion[]> => {
  if (product.type === 'medicine') {
    return [];
  }

  const replacementProfile = getReplacementProfile(product, analysis);
  const [localCandidates, remoteCandidates] = await Promise.all([
    Promise.resolve(buildCandidatePool(product)),
    buildRemoteCandidatePool(product),
  ]);

  const merged = new Map<string, CandidateEnvelope>();

  [...remoteCandidates, ...localCandidates].forEach((candidate) => {
    const barcode = String(candidate.product.barcode || '').trim();

    if (!barcode) {
      return;
    }

    const existing = merged.get(barcode);

    if (!existing) {
      merged.set(barcode, candidate);
      return;
    }

    merged.set(barcode, choosePreferredEnvelope(existing, candidate));
  });

  const sameCategorySuggestions = finalizeSuggestions({
    product,
    analysis,
    candidatePool: Array.from(merged.values()),
    limit,
    nutritionPreferences,
  });

  if (!replacementProfile) {
    return sameCategorySuggestions;
  }

  const replacementCandidates = await buildReplacementCandidatePool(
    replacementProfile,
    product
  );
  const replacementSuggestions = finalizeReplacementSuggestions({
    product,
    analysis,
    candidatePool: replacementCandidates,
    profile: replacementProfile,
    limit,
  });

  const combined = new Map<string, ProductAlternativeSuggestion>();

  [...replacementSuggestions, ...sameCategorySuggestions].forEach((candidate) => {
    if (!combined.has(candidate.product.barcode)) {
      combined.set(candidate.product.barcode, candidate);
    }
  });

  return Array.from(combined.values()).slice(0, Math.max(1, limit));
};

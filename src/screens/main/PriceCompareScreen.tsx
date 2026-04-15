import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { searchBeautyProductsByText } from '../../api/beautyApi';
import { searchFoodProductsByText } from '../../api/foodApi';

import type { RootStackParamList } from '../../navigation/AppNavigator';
import { MarketOfferSheet } from '../../components/MarketOfferSheet';
import { MarketPriceTableCard } from '../../components/MarketPriceTableCard';
import { ProductSummaryCard } from '../../components/ProductSummaryCard';
import { ScreenOnboardingOverlay } from '../../components/ScreenOnboardingOverlay';
import { AdBanner } from '../../components/AdBanner';
import {
  buildMarketMonogram,
  resolveMarketAccent,
  resolveMarketLogoUrl,
} from '../../config/marketBranding';
import { inferMarketDisplayProductType } from '../../config/marketDisplay';
import { useAuth } from '../../context/AuthContext';
import { useTheme, type ThemeColors } from '../../context/ThemeContext';
import { useAppScreenLayout } from '../../components/layout/useAppScreenLayout';
import { useMarketGelsinRuntime } from '../../hooks/useMarketGelsinRuntime';
import { AmbientBackdrop } from '../../components/ui/AmbientBackdrop';
import {
  addFavoriteBarcode,
  getAllFavoriteBarcodes,
  getLatestHistoryEntriesForBarcodes,
  isFavoriteBarcode,
  removeFavoriteBarcode,
  type HistoryEntry,
} from '../../services/db';
import {
  getBestInStockOffer,
  getMarketOfferIdentity,
} from '../../services/marketPricingContract.service';
import {
  fetchMarketBarcodeLookup,
  fetchMarketCategoryProducts,
  fetchMarketCategoryTree,
  fetchMarketProductOffers,
  fetchMarketProductOffersById,
  fetchMarketPriceHistory,
  fetchMarketProductSearch,
} from '../../services/marketPricing.service';
import {
  getCurrentLocationContext,
  type CurrentLocationContext,
} from '../../services/locationPermission.service';
import {
  resolveCanonicalCity,
  resolveCanonicalDistrict,
  resolveTurkeyCityCode,
} from '../../services/locationData';
import {
  InfoActionCard,
  NoticeCard,
} from './detail/DetailSections';
import type {
  MarketCategoryNode,
  MarketOffer,
  MarketPriceHistoryResponse,
  MarketProductOffersResponse,
  MarketSearchProduct,
} from '../../types/marketPricing';
import { usePreferenceStore } from '../../store/usePreferenceStore';
import { withAlpha } from '../../utils/color';
import { searchLocalPriceCompareProducts } from '../../services/priceCompareSearch.service';
import {
  getPriceCompareFavoriteKey,
  listPriceCompareFavorites,
  mergePriceCompareFavorites,
  togglePriceCompareFavorite,
} from '../../services/priceCompareFavorites.service';
import {
  getCachedPriceCompareRootCategories,
  prewarmPriceCompareRootCategories,
} from '../../services/priceCompareWarmup.service';
import {
  hasSeenScreenOnboarding,
  markScreenOnboardingSeen,
} from '../../services/screenOnboarding.service';
import { adService } from '../../services/adService';
import { usePriceCompareBasketStore } from '../../store/usePriceCompareBasketStore';
import type { Product } from '../../utils/analysis';

type PriceCompareRoute = RouteProp<RootStackParamList, 'PriceCompare'>;
type TranslateFn = (key: string, fallback: string) => string;
type MarketSheetState =
  | {
      kind: 'offer';
      offer: MarketOffer;
    }
  | null;

type SearchCategoryTreeNode = {
  key: string;
  label: string;
  count: number | null;
  depth: number;
  pathLabel: string;
  categoryId: string;
  childrenCount: number;
  sortOrder: number | null;
  children: SearchCategoryTreeNode[];
};

const SEARCH_MIN_LENGTH = 2;
const REMOTE_SEARCH_TIMEOUT_MS = 9000;
const REMOTE_AUTOCOMPLETE_TIMEOUT_MS = 4500;
const REMOTE_OFFERS_TIMEOUT_MS = 5000;
const REMOTE_CATEGORY_TREE_TIMEOUT_MS = 12000;
const CATEGORY_ROOT_KEY = '__root__';
const SYNTHETIC_CATEGORY_PREFIX = '__synthetic_category__:';
const RESULT_GRID_COLUMNS = 4;
const RESULT_GRID_GAP = 8;
const RESULT_GRID_HORIZONTAL_PADDING = 6;
const SEARCH_RESULTS_PAGE_SIZE = 12;
const SEARCH_RESULTS_FETCH_LIMIT = 48;
const CATEGORY_ROOT_SPECS = Object.freeze([
  { label: 'Gıda, Şekerleme', query: 'Gıda, Şekerleme' },
  { label: 'Et, Tavuk', query: 'Et, Tavuk' },
  { label: 'Süt, Kahvaltılık', query: 'Süt, Kahvaltılık' },
  { label: 'İçecek', query: 'İçecek' },
  { label: 'Deterjan, Temizlik', query: 'Deterjan, Temizlik' },
  { label: 'Meyve, Sebze', query: 'Meyve, Sebze' },
  { label: 'Kağıt, Kozmetik', query: 'Kağıt, Kozmetik' },
  { label: 'Bebek', query: 'Bebek' },
]);
const CATEGORY_ROOT_GROUPS = Object.freeze([
  {
    label: 'Gıda',
    members: ['Gıda, Şekerleme', 'Et, Tavuk', 'Süt, Kahvaltılık', 'İçecek', 'Meyve, Sebze'],
  },
  {
    label: 'Kozmetik',
    members: ['Kağıt, Kozmetik', 'Deterjan, Temizlik', 'Bebek'],
  },
]);
const CATEGORY_BROWSE_QUERY_RULES = Object.freeze<Record<string, string[]>>({
  bebek: ['prima', 'molfix', 'aptamil', 'milupa'],
  'bebek bakim': ['islak mendil', 'pisik kremi', 'uni baby', 'dalin'],
  'bebek banyo': ['dalin', 'bebek sampuani', 'johnsons baby'],
  'bebek beslenme': ['aptamil', 'milupa', 'bebelac', 'hero baby'],
  'bebek bezi': ['prima', 'molfix', 'sleepy', 'canbebe'],
  'bebek deterjani ve yumusaticisi': ['bebek yumusatici', 'bebek deterjani'],
  'deterjan temizlik': ['deterjan', 'sabun'],
  'et tavuk': ['tavuk', 'kofte'],
  'gida sekerleme': ['makarna', 'salca', 'atistirmalik'],
  atistirmalik: ['cips', 'kraker'],
  makarna: ['makarna'],
  salca: ['salca'],
  sos: ['sos'],
  'icecek': ['coca cola', 'ayran', 'meyve suyu', 'kahve'],
  'gazli icecek': ['kola'],
  'gazsiz icecek': ['ayran', 'meyve suyu', 'limonata'],
  cay: ['cay'],
  kahve: ['kahve'],
  'maden suyu': ['beypazari', 'maden suyu', 'uludag'],
  su: ['erikli', 'hayat su', 'damla su'],
  'kagit kozmetik': ['sampuan', 'kolonya', 'havlu kagit', 'dalin'],
  'meyve sebze': ['domates', 'muz', 'patates'],
  'sut kahvaltilik': ['sut', 'peynir', 'yumurta'],
});

const resolveWithin = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`timed_out_after_${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });

const normalizeLooseSearchValue = (value?: string | null): string =>
  String(value || '')
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const tokenizeLooseSearchValue = (value?: string | null): string[] =>
  normalizeLooseSearchValue(value)
    .split(/\s+/)
    .filter(Boolean);

const toDisplayProductName = (value?: string | null): string =>
  String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLocaleLowerCase('tr');
      return lower.charAt(0).toLocaleUpperCase('tr') + lower.slice(1);
    })
    .join(' ');

const isSyntheticCategoryId = (value?: string | null): boolean =>
  String(value || '').startsWith(SYNTHETIC_CATEGORY_PREFIX);

const BEAUTY_CATEGORY_HINTS = [
  'kozmetik',
  'makyaj',
  'parfum',
  'parfüm',
  'sampuan',
  'şampuan',
  'sac',
  'saç',
  'bakim',
  'bakım',
  'cilt',
  'deodorant',
  'ruj',
];

const inferBrowseProductTypeFromResult = (product: MarketSearchProduct): Product['type'] => {
  const marketType = inferMarketDisplayProductType(
    [
      product.bestOffer?.marketKey,
      product.bestOffer?.marketName,
      product.marketLogoUrl,
      ...(product.seedOffers || []).flatMap((offer) => [offer.marketKey, offer.marketName]),
    ].filter(Boolean)
  );

  if (marketType === 'beauty') {
    return 'beauty';
  }

  const haystack = normalizeLooseSearchValue(
    [product.taxonomyLeaf, product.category, product.productName, product.brand].join(' ')
  );

  if (BEAUTY_CATEGORY_HINTS.some((hint) => haystack.includes(normalizeLooseSearchValue(hint)))) {
    return 'beauty';
  }

  return 'food';
};

const buildReferenceSearchQuery = (product: MarketSearchProduct): string => {
  const productName = String(product.productName || '').trim();
  const brand = String(product.brand || '').trim();

  if (brand && productName.toLocaleLowerCase('tr').startsWith(brand.toLocaleLowerCase('tr'))) {
    return productName;
  }

  return [brand, productName].filter(Boolean).join(' ').trim();
};

const scoreReferenceProductMatch = (
  product: MarketSearchProduct,
  candidate: Product
): number => {
  const referenceQuery = buildReferenceSearchQuery(product);
  const productTokens = tokenizeLooseSearchValue(referenceQuery);
  const candidateName = normalizeLooseSearchValue(candidate.name);
  const candidateBrand = normalizeLooseSearchValue(candidate.brand);
  const candidateTokens = new Set(tokenizeLooseSearchValue([candidate.name, candidate.brand].join(' ')));
  const normalizedBrand = normalizeLooseSearchValue(product.brand);
  let score = 0;

  if (!candidate.barcode) {
    return 0;
  }

  if (normalizedBrand && candidateBrand === normalizedBrand) {
    score += 28;
  }

  const matchedTokenCount = productTokens.filter((token) => candidateTokens.has(token)).length;
  score += matchedTokenCount * 8;

  if (candidateName === normalizeLooseSearchValue(product.productName)) {
    score += 26;
  } else if (candidateName.includes(normalizeLooseSearchValue(product.productName))) {
    score += 16;
  }

  const productPackToken = [product.packSize, product.packUnit].filter(Boolean).join(' ');
  if (productPackToken && candidateName.includes(normalizeLooseSearchValue(productPackToken))) {
    score += 12;
  }

  return score;
};

const buildSearchVariants = (query: string): string[] => {
  const trimmed = query.trim();
  const loose = normalizeLooseSearchValue(trimmed);
  const tokenVariants = loose
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3);

  return Array.from(
    new Set(
      [trimmed, loose, ...tokenVariants].filter((item) => item.length >= SEARCH_MIN_LENGTH)
    )
  ).slice(0, 6);
};

const mapHistoryEntryToSearchProduct = (entry: HistoryEntry): MarketSearchProduct => ({
  id: entry.barcode || `history-${entry.id}`,
  productId: null,
  barcode: entry.barcode,
  productName: entry.name || entry.barcode,
  brand: entry.brand || null,
  category:
    entry.categories ||
    (entry.type === 'food' ? 'Gıda' : entry.type === 'beauty' ? 'Kozmetik' : 'İlaç'),
  normalizedCategoryId: null,
  taxonomyPath: entry.categories || null,
  taxonomyLeaf: entry.categories || null,
  packSize: null,
  packUnit: null,
  matchConfidence: null,
  imageUrl: entry.image_url || null,
  marketLogoUrl: null,
  bestOffer: null,
  seedOffers: [],
  marketCount: 0,
  inStockMarketCount: 0,
  dataFreshness: null,
});

const resolveReferenceProductForMarketProduct = async (
  product: MarketSearchProduct
): Promise<Product | null> => {
  const query = buildReferenceSearchQuery(product);

  if (query.length < 3) {
    return null;
  }

  const productType = inferBrowseProductTypeFromResult(product);
  const searchFn =
    productType === 'beauty' ? searchBeautyProductsByText : searchFoodProductsByText;
  const variants = buildSearchVariants(query);
  const settled = await Promise.allSettled(variants.map((variant) => searchFn(variant, 8)));
  const candidates = settled.flatMap((result) =>
    result.status === 'fulfilled' ? result.value : []
  );

  if (!candidates.length) {
    return null;
  }

  const bestCandidate = candidates
    .map((candidate) => ({
      candidate,
      score: scoreReferenceProductMatch(product, candidate),
    }))
    .sort((left, right) => right.score - left.score)[0];

  if (!bestCandidate || bestCandidate.score < 12) {
    return null;
  }

  return bestCandidate.candidate;
};

const resolveReferenceBarcodeForMarketProduct = async (
  product: MarketSearchProduct
): Promise<string | null> => {
  const candidate = await resolveReferenceProductForMarketProduct(product);
  return String(candidate?.barcode || '').trim() || null;
};

const isBarcodeLikeQuery = (query: string): boolean =>
  /^\d{8,14}$/.test(query.trim());

const getProductIdentity = (item: MarketSearchProduct): string =>
  item.productId || item.id || item.barcode || `${item.productName}-${item.brand || ''}`;

const hasComparableBarcode = (item: MarketSearchProduct): boolean =>
  Boolean(item.barcode && item.barcode.trim().length > 0);

const hasComparableProductId = (item: MarketSearchProduct): boolean =>
  Boolean(item.productId && item.productId.trim().length > 0);

const dedupeSearchProducts = (items: MarketSearchProduct[]): MarketSearchProduct[] => {
  const map = new Map<string, MarketSearchProduct>();

  items.forEach((item) => {
    const key = getProductIdentity(item);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, item);
      return;
    }

    const existingStrength =
      (existing.bestOffer ? 4 : 0) + existing.marketCount + existing.inStockMarketCount;
    const nextStrength = (item.bestOffer ? 4 : 0) + item.marketCount + item.inStockMarketCount;

    if (nextStrength > existingStrength) {
      map.set(key, item);
    }
  });

  return Array.from(map.values());
};

const computeSearchProductScore = (
  item: MarketSearchProduct,
  query: string
): number => {
  const normalizedQuery = normalizeLooseSearchValue(query);
  const haystack = normalizeLooseSearchValue(
    [
      item.productName,
      item.brand ?? '',
      item.category ?? '',
      item.packSize != null ? String(item.packSize) : '',
      item.packUnit ?? '',
      item.barcode ?? '',
    ].join(' ')
  );
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

  let score = 0;

  if (item.barcode && item.barcode === query.trim()) {
    score += 280;
  } else if (item.barcode?.startsWith(query.trim())) {
    score += 180;
  }

  if (haystack === normalizedQuery) {
    score += 220;
  } else if (haystack.startsWith(normalizedQuery)) {
    score += 150;
  } else if (haystack.includes(normalizedQuery)) {
    score += 110;
  }

  if (queryTokens.length > 0) {
    const matchedTokens = queryTokens.filter((token) => haystack.includes(token)).length;
    score += matchedTokens * 26;

    if (matchedTokens === queryTokens.length) {
      score += 40;
    }
  }

  if (typeof item.matchConfidence === 'number' && Number.isFinite(item.matchConfidence)) {
    score += Math.round(item.matchConfidence * 100);
  }

  if (item.bestOffer?.inStock) {
    score += 18;
  }

  score += Math.min(item.inStockMarketCount * 5, 30);
  score += Math.min(item.marketCount * 2, 16);

  return score;
};

const rankSearchProducts = (
  items: MarketSearchProduct[],
  query: string
): MarketSearchProduct[] =>
  [...items].sort((left, right) => {
    const rightScore = computeSearchProductScore(right, query);
    const leftScore = computeSearchProductScore(left, query);

    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

      return left.productName.localeCompare(right.productName, 'tr');
    });

const buildSearchCategoryTree = (items: MarketCategoryNode[]): SearchCategoryTreeNode[] => {
  const nodeMap = new Map<string, SearchCategoryTreeNode>();
  const rootNodes: SearchCategoryTreeNode[] = [];

  items.forEach((item) => {
    const exactCount = item.productCount ?? item.marketCount ?? item.inStockProductCount ?? null;
    const displayCount = item.childrenCount > 0 ? null : exactCount;

    nodeMap.set(item.normalizedCategoryId, {
      key: item.normalizedCategoryId,
      label: item.taxonomyLeaf,
      count: displayCount,
      depth: item.depth,
      pathLabel:
        item.taxonomyPath ||
        item.normalizedCategory ||
        item.taxonomyLeaf,
      categoryId: item.normalizedCategoryId,
      childrenCount: item.childrenCount,
      sortOrder: item.sortOrder ?? null,
      children: [],
    });
  });

  items.forEach((item) => {
    const currentNode = nodeMap.get(item.normalizedCategoryId);

    if (!currentNode) {
      return;
    }

    if (item.parentCategoryId && nodeMap.has(item.parentCategoryId)) {
      nodeMap.get(item.parentCategoryId)?.children.push(currentNode);
      return;
    }

    rootNodes.push(currentNode);
  });

  const sortNodes = (nodes: SearchCategoryTreeNode[]): SearchCategoryTreeNode[] =>
    [...nodes]
      .map((node) => ({
        ...node,
        children: sortNodes(node.children),
      }))
      .sort((left, right) => {
        const leftOrder = left.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = right.sortOrder ?? Number.MAX_SAFE_INTEGER;

        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }

        if ((right.count ?? -1) !== (left.count ?? -1)) {
          return (right.count ?? -1) - (left.count ?? -1);
        }

        return left.label.localeCompare(right.label, 'tr');
      });

  return sortNodes(rootNodes);
};

const buildGroupedRootCategoryNodes = (
  rootNodes: MarketCategoryNode[]
): MarketCategoryNode[] => {
  const normalizedRootMap = new Map(
    rootNodes.map((node) => [normalizeLooseSearchValue(node.taxonomyLeaf), node] as const)
  );
  const groupedNodes: MarketCategoryNode[] = [];
  const consumedIds = new Set<string>();

  CATEGORY_ROOT_GROUPS.forEach((group, groupIndex) => {
    const rootId = `${SYNTHETIC_CATEGORY_PREFIX}root:${groupIndex}:${normalizeLooseSearchValue(group.label).replace(/\s+/g, '-')}`;
    const groupChildren = group.members
      .map((label) => normalizedRootMap.get(normalizeLooseSearchValue(label)) ?? null)
      .filter((node): node is MarketCategoryNode => Boolean(node));

    if (!groupChildren.length) {
      return;
    }

    groupedNodes.push({
      normalizedCategoryId: rootId,
      taxonomyLeaf: group.label,
      taxonomyPath: group.label,
      normalizedCategory: group.label,
      parentCategoryId: null,
      depth: 1,
      childrenCount: groupChildren.length,
      productCount: null,
      inStockProductCount: null,
      marketCount: null,
      sortOrder: groupIndex + 1,
    });

    groupChildren.forEach((child, childIndex) => {
      consumedIds.add(child.normalizedCategoryId);
      groupedNodes.push({
        ...child,
        parentCategoryId: rootId,
        depth: 2,
        sortOrder: child.sortOrder ?? childIndex + 1,
      });
    });
  });

  rootNodes.forEach((node) => {
    if (!consumedIds.has(node.normalizedCategoryId)) {
      groupedNodes.push(node);
    }
  });

  return groupedNodes;
};

const filterSeededCategoryChildren = (
  label: string,
  items: MarketCategoryNode[]
): MarketCategoryNode[] => {
  const normalizedLabel = normalizeLooseSearchValue(label);

  const matches = items.filter((item) => {
    const normalizedPath = normalizeLooseSearchValue(item.taxonomyPath);
    const normalizedCategory = normalizeLooseSearchValue(item.normalizedCategory);
    const normalizedLeaf = normalizeLooseSearchValue(item.taxonomyLeaf);

    if (normalizedPath.startsWith(`${normalizedLabel} `) || normalizedPath.startsWith(`${normalizedLabel}`)) {
      return normalizedPath.includes(' > ');
    }

    if (normalizedCategory === normalizedLabel && normalizedLeaf !== normalizedLabel) {
      return true;
    }

    if (normalizedLabel === 'bebek' && normalizedLeaf.startsWith('bebek')) {
      return true;
    }

    return false;
  });

  if (matches.length) {
    return matches;
  }

  return items.slice(0, 8);
};

const buildSeededCategoryNodes = (
  groups: { label: string; nodes: MarketCategoryNode[] }[]
): MarketCategoryNode[] => {
  const seededNodes: MarketCategoryNode[] = [];
  const groupMap = new Map(groups.map((group) => [group.label, group.nodes]));

  CATEGORY_ROOT_GROUPS.forEach((rootGroup, groupIndex) => {
    const rootId = `${SYNTHETIC_CATEGORY_PREFIX}root:${groupIndex}:${normalizeLooseSearchValue(rootGroup.label).replace(/\s+/g, '-')}`;
    const sectionEntries = rootGroup.members
      .map((member) => ({
        label: member,
        nodes: groupMap.get(member) ?? [],
      }))
      .map((entry) => {
        const anchorNode =
          entry.nodes.find(
            (node) =>
              normalizeLooseSearchValue(node.taxonomyLeaf) ===
                normalizeLooseSearchValue(entry.label) || !node.parentCategoryId
          ) ?? entry.nodes[0] ?? null;

        return {
          label: entry.label,
          anchorNode,
          children: filterSeededCategoryChildren(entry.label, entry.nodes).filter(
            (child) => child.normalizedCategoryId !== anchorNode?.normalizedCategoryId
          ),
        };
      })
      .filter(
        (
          entry
        ): entry is {
          label: string;
          anchorNode: MarketCategoryNode;
          children: MarketCategoryNode[];
        } => entry.anchorNode != null
      )
      .filter((entry) => entry.children.length > 0 || entry.anchorNode.childrenCount > 0);

    if (!sectionEntries.length) {
      return;
    }

    seededNodes.push({
      normalizedCategoryId: rootId,
      taxonomyLeaf: rootGroup.label,
      taxonomyPath: rootGroup.label,
      normalizedCategory: rootGroup.label,
      parentCategoryId: null,
      depth: 1,
      childrenCount: sectionEntries.length,
      productCount: null,
      inStockProductCount: null,
      marketCount: null,
      sortOrder: groupIndex + 1,
    });

    sectionEntries.forEach((section, sectionIndex) => {
      seededNodes.push({
        ...section.anchorNode,
        parentCategoryId: rootId,
        depth: 2,
        childrenCount: Math.max(section.anchorNode.childrenCount, section.children.length),
        taxonomyPath: `${rootGroup.label} > ${section.anchorNode.taxonomyLeaf}`,
        sortOrder: section.anchorNode.sortOrder ?? sectionIndex + 1,
      });

      section.children.forEach((child, childIndex) => {
        seededNodes.push({
          ...child,
          parentCategoryId: section.anchorNode.normalizedCategoryId,
          depth: 3,
          sortOrder: child.sortOrder ?? childIndex + 1,
        });
      });
    });
  });

  return seededNodes;
};

const buildResultDerivedCategoryTree = (
  items: MarketSearchProduct[]
): SearchCategoryTreeNode[] => {
  const grouped = new Map<string, SearchCategoryTreeNode>();

  items.forEach((item) => {
    const categoryId = item.normalizedCategoryId?.trim();
    const label = item.taxonomyLeaf?.trim() || item.category?.trim() || '';

    if (!categoryId || !label) {
      return;
    }

    const existing = grouped.get(categoryId);

    if (existing) {
      existing.count = (existing.count ?? 0) + 1;
      return;
    }

    grouped.set(categoryId, {
      key: categoryId,
      label,
      count: 1,
      depth: 0,
      pathLabel: item.taxonomyPath?.trim() || label,
      categoryId,
      childrenCount: 0,
      sortOrder: null,
      children: [],
    });
  });

  return Array.from(grouped.values()).sort((left, right) => {
    if ((right.count ?? 0) !== (left.count ?? 0)) {
      return (right.count ?? 0) - (left.count ?? 0);
    }

    return left.label.localeCompare(right.label, 'tr');
  });
};

const buildCategoryBrowseQueries = (label?: string | null): string[] => {
  const normalizedLabel = normalizeLooseSearchValue(label);
  const mappedQueries = CATEGORY_BROWSE_QUERY_RULES[normalizedLabel];
  const labelTokens = normalizedLabel
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= SEARCH_MIN_LENGTH);

  if (!normalizedLabel) {
    return [];
  }

  return Array.from(
    new Set(
      [...(mappedQueries ?? []), normalizedLabel, ...labelTokens].filter(
        (item) => item.length >= SEARCH_MIN_LENGTH
      )
    )
  );
};

const searchLocalCategoryBrowseProducts = (
  label: string,
  limit: number
): MarketSearchProduct[] => {
  const queries = buildCategoryBrowseQueries(label).slice(0, 4);

  if (!queries.length) {
    return [];
  }

  const merged = dedupeSearchProducts(
    queries.flatMap((query) => searchLocalPriceCompareProducts(query, limit))
  );

  return merged.slice(0, limit);
};

const annotateBrowseResult = (
  item: MarketSearchProduct,
  node: Pick<MarketCategoryNode, 'normalizedCategoryId' | 'taxonomyLeaf' | 'taxonomyPath' | 'normalizedCategory'>
): MarketSearchProduct => {
  if (item.normalizedCategoryId || item.taxonomyLeaf || item.category) {
    return item;
  }

  return {
    ...item,
    category: node.normalizedCategory ?? node.taxonomyLeaf,
    normalizedCategoryId: node.normalizedCategoryId,
    taxonomyLeaf: node.taxonomyLeaf,
    taxonomyPath: node.taxonomyPath ?? node.taxonomyLeaf,
  };
};

const isSearchProductSparse = (item: MarketSearchProduct): boolean => {
  const hasReadableName =
    Boolean(item.productName) &&
    item.productName !== '-' &&
    item.productName !== item.barcode;
  const hasMarketSignal =
    item.marketCount > 0 ||
    item.inStockMarketCount > 0 ||
    Boolean(item.bestOffer) ||
    Boolean(item.seedOffers?.length);

  return !hasReadableName || !hasMarketSignal;
};

const mergeSearchProductDetails = (
  base: MarketSearchProduct,
  enriched: MarketSearchProduct | null
): MarketSearchProduct => {
  if (!enriched) {
    return base;
  }

  const stableProductId = base.productId ?? enriched.productId ?? null;

  return {
    ...base,
    id:
      stableProductId ||
      base.id ||
      enriched.id ||
      base.barcode ||
      enriched.barcode ||
      `market-search-${Math.random().toString(36).slice(2, 10)}`,
    productId: stableProductId,
    barcode: enriched.barcode || base.barcode,
    productName:
      enriched.productName && enriched.productName !== '-'
        ? enriched.productName
        : base.productName,
    brand: enriched.brand ?? base.brand ?? null,
    category: enriched.category ?? base.category ?? null,
    normalizedCategoryId:
      enriched.normalizedCategoryId ?? base.normalizedCategoryId ?? null,
    taxonomyPath: enriched.taxonomyPath ?? base.taxonomyPath ?? null,
    taxonomyLeaf: enriched.taxonomyLeaf ?? base.taxonomyLeaf ?? null,
    packSize: enriched.packSize ?? base.packSize ?? null,
    packUnit: enriched.packUnit ?? base.packUnit ?? null,
    matchConfidence: enriched.matchConfidence ?? base.matchConfidence ?? null,
    imageUrl: enriched.imageUrl ?? base.imageUrl ?? null,
    marketLogoUrl: enriched.marketLogoUrl ?? base.marketLogoUrl ?? null,
    bestOffer: enriched.bestOffer ?? base.bestOffer ?? null,
    seedOffers:
      (enriched.seedOffers && enriched.seedOffers.length ? enriched.seedOffers : base.seedOffers) ??
      [],
    marketCount: enriched.marketCount || base.marketCount,
    inStockMarketCount: enriched.inStockMarketCount || base.inStockMarketCount,
    dataFreshness: enriched.dataFreshness ?? base.dataFreshness ?? null,
  };
};

const buildOffersResponseFromSearchProduct = (
  item: MarketSearchProduct
): MarketProductOffersResponse | null => {
  const offers =
    (item.seedOffers && item.seedOffers.length ? item.seedOffers : null) ??
    (item.bestOffer ? [item.bestOffer] : null);

  if (!offers?.length) {
    return null;
  }

  const firstOffer = offers[0];

  return {
    barcode: item.barcode || item.id,
    productId: item.productId ?? null,
    product: {
      productId: item.productId ?? null,
      barcode: item.barcode ?? null,
      productName: item.productName,
      brand: item.brand ?? null,
      imageUrl: item.imageUrl ?? null,
    },
    fetchedAt: new Date().toISOString(),
    requestId: null,
    partial: false,
    warnings: [],
    city:
      firstOffer?.cityCode && firstOffer.cityName
        ? {
            code: firstOffer.cityCode,
            name: firstOffer.cityName,
          }
        : null,
    dataFreshness: item.dataFreshness ?? null,
    offers,
  };
};

const buildCartFallbackOffersResponseFromSearchProduct = (
  item: MarketSearchProduct
): MarketProductOffersResponse | null => {
  const seededResponse = buildOffersResponseFromSearchProduct(item);

  if (seededResponse) {
    return seededResponse;
  }

  if (!hasComparableBarcode(item) && !hasComparableProductId(item)) {
    return null;
  }

  return {
    barcode: item.barcode || item.id || item.productId || getProductIdentity(item),
    productId: item.productId ?? null,
    product: {
      productId: item.productId ?? null,
      barcode: item.barcode ?? null,
      productName: item.productName,
      brand: item.brand ?? null,
      imageUrl: item.imageUrl ?? null,
    },
    fetchedAt: new Date().toISOString(),
    requestId: null,
    partial: true,
    warnings: ['live_offers_unavailable'],
    city: null,
    dataFreshness: item.dataFreshness ?? null,
    offers: [],
  };
};

const mergeMarketOfferLists = (
  primaryOffers: MarketOffer[],
  fallbackOffers: MarketOffer[]
): MarketOffer[] => {
  if (!primaryOffers.length) {
    return fallbackOffers;
  }

  if (!fallbackOffers.length) {
    return primaryOffers;
  }

  const merged = new Map<string, MarketOffer>();

  [...primaryOffers, ...fallbackOffers].forEach((offer) => {
    const identity =
      getMarketOfferIdentity(offer) ||
      `${offer.marketKey || offer.marketName}-${offer.price}-${offer.cityCode || ''}-${offer.capturedAt || ''}`;

    if (!merged.has(identity)) {
      merged.set(identity, offer);
      return;
    }

    const existing = merged.get(identity)!;

    if (offer.inStock && !existing.inStock) {
      merged.set(identity, offer);
      return;
    }

    if (
      offer.inStock === existing.inStock &&
      offer.priceSourceType === 'local_market_price' &&
      existing.priceSourceType !== 'local_market_price'
    ) {
      merged.set(identity, offer);
    }
  });

  return Array.from(merged.values());
};

const mergeMarketOfferResponses = (
  responses: (MarketProductOffersResponse | null | undefined)[]
): MarketProductOffersResponse | null => {
  const fulfilledResponses = responses.filter(
    (response): response is MarketProductOffersResponse => Boolean(response)
  );

  if (!fulfilledResponses.length) {
    return null;
  }

  const firstResponse = fulfilledResponses[0];

  return {
    ...firstResponse,
    productId:
      fulfilledResponses.find((response) => response.productId)?.productId ??
      firstResponse.productId ??
      null,
    product:
      fulfilledResponses.find((response) => response.product != null)?.product ??
      firstResponse.product ??
      null,
    warnings: Array.from(
      new Set(fulfilledResponses.flatMap((response) => response.warnings ?? []))
    ),
    dataFreshness:
      fulfilledResponses.find((response) => response.dataFreshness != null)?.dataFreshness ??
      firstResponse.dataFreshness ??
      null,
    city:
      fulfilledResponses.find((response) => response.city?.code || response.city?.name)?.city ??
      firstResponse.city ??
      null,
    offers: fulfilledResponses.reduce<MarketOffer[]>(
      (accumulator, response) => mergeMarketOfferLists(accumulator, response.offers),
      []
    ),
  };
};

const canQuickAddSearchProduct = (item: MarketSearchProduct): boolean =>
  Boolean(buildOffersResponseFromSearchProduct(item)?.offers.length) ||
  hasComparableBarcode(item) ||
  hasComparableProductId(item);

const isLocationScopedOffer = (offer: MarketOffer): boolean => {
  const coverage = String(offer.coverageScope || '').toLocaleLowerCase('tr');
  const pricing = String(offer.pricingScope || '').toLocaleLowerCase('tr');

  return (
    offer.priceSourceType === 'local_market_price' ||
    coverage.includes('city') ||
    coverage.includes('district') ||
    pricing.includes('city') ||
    pricing.includes('district')
  );
};

const rankDisplayOffer = (offer: MarketOffer, targetCityCode?: string | null): number => {
  let score = 0;

  if (offer.inStock) {
    score += 1000;
  }

  if (
    targetCityCode &&
    offer.cityCode &&
    offer.cityCode.trim() &&
    offer.cityCode.trim() === targetCityCode.trim()
  ) {
    score += 160;
  }

  if (offer.priceSourceType === 'local_market_price') {
    score += 90;
  } else if (offer.priceSourceType === 'national_reference_price') {
    score += 40;
  }

  if (isLocationScopedOffer(offer)) {
    score += 50;
  }

  if (Number.isFinite(offer.sourceConfidence ?? NaN)) {
    score += Math.round((offer.sourceConfidence ?? 0) * 10);
  }

  score -= Math.round((offer.price || 0) * 100) / 1000;

  return score;
};

const normalizeOffersForDisplay = (
  offers: MarketOffer[],
  options?: {
    cityCode?: string | null;
  }
): MarketOffer[] => {
  if (!offers.length) {
    return [];
  }

  const targetCityCode = options?.cityCode?.trim() || null;
  const filteredOffers = offers.filter((offer) => {
    if (!targetCityCode) {
      return true;
    }

    const offerCityCode = offer.cityCode?.trim();

    if (!offerCityCode) {
      return true;
    }

    if (offerCityCode === targetCityCode) {
      return true;
    }

    return !isLocationScopedOffer(offer);
  });

  const grouped = new Map<string, MarketOffer[]>();

  filteredOffers.forEach((offer) => {
    const identity = getMarketOfferIdentity(offer);

    if (!identity) {
      return;
    }

    const current = grouped.get(identity) ?? [];
    current.push(offer);
    grouped.set(identity, current);
  });

  return Array.from(grouped.values())
    .map((entries) =>
      [...entries].sort((left, right) => {
        const scoreDiff =
          rankDisplayOffer(right, targetCityCode) - rankDisplayOffer(left, targetCityCode);

        if (scoreDiff !== 0) {
          return scoreDiff;
        }

        if (left.price !== right.price) {
          return left.price - right.price;
        }

        return left.marketName.localeCompare(right.marketName, 'tr');
      })[0]
    )
    .filter(Boolean)
    .sort((left, right) => {
      const leftRank = rankDisplayOffer(left, targetCityCode);
      const rightRank = rankDisplayOffer(right, targetCityCode);

      if (leftRank !== rightRank) {
        return rightRank - leftRank;
      }

      return left.price - right.price;
    });
};

const formatLocalizedPrice = (locale: string, amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat(locale || 'tr-TR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};

const getOfferToneLabel = (tt: TranslateFn, offer: MarketOffer): string => {
  if (offer.priceSourceType === 'local_market_price') {
    return tt('price_compare_market_row_local', 'Yerel fiyat');
  }

  if (offer.priceSourceType === 'national_reference_price') {
    return tt('price_compare_market_row_reference', 'Ulusal referans');
  }

  return tt('price_compare_market_row_other', 'Diğer fiyat');
};

const formatDistanceMeters = (tt: TranslateFn, value?: number | null): string | null => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  if (value < 1000) {
    return tt('price_compare_distance_meters', '{{value}} m').replace(
      '{{value}}',
      String(Math.round(value))
    );
  }

  return tt('price_compare_distance_km', '{{value}} km').replace(
    '{{value}}',
    (value / 1000).toFixed(1)
  );
};

type WeeklyPriceHistoryBucket = {
  key: string;
  start: Date;
  end: Date;
  averagePrice: number;
  lowestPrice: number;
  highestPrice: number;
  currency: string;
  count: number;
  shortLabel: string;
  longLabel: string;
};

const getWeekStart = (value: Date): Date => {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  const day = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - day);
  return next;
};

const addDays = (value: Date, days: number): Date => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
};

const formatShortDate = (locale: string, value: Date): string => {
  try {
    return new Intl.DateTimeFormat(locale || 'tr-TR', {
      day: '2-digit',
      month: 'short',
    }).format(value);
  } catch {
    return value.toISOString().slice(5, 10);
  }
};

const formatLongDateRange = (locale: string, start: Date, end: Date): string => {
  try {
    const formatter = new Intl.DateTimeFormat(locale || 'tr-TR', {
      day: '2-digit',
      month: 'short',
    });
    return `${formatter.format(start)} - ${formatter.format(end)}`;
  } catch {
    return `${start.toISOString().slice(5, 10)} - ${end.toISOString().slice(5, 10)}`;
  }
};

const buildWeeklyPriceHistory = (
  history: MarketPriceHistoryResponse['history'],
  locale: string,
  limit = 8
): WeeklyPriceHistoryBucket[] => {
  if (!history.length) {
    return [];
  }

  const grouped = new Map<
    string,
    {
      start: Date;
      prices: number[];
      currency: string;
    }
  >();

  history.forEach((entry) => {
    const date = new Date(entry.capturedAt);

    if (Number.isNaN(date.getTime()) || typeof entry.price !== 'number') {
      return;
    }

    const start = getWeekStart(date);
    const key = start.toISOString().slice(0, 10);
    const current = grouped.get(key) ?? {
      start,
      prices: [],
      currency: entry.currency,
    };

    current.prices.push(entry.price);
    current.currency = entry.currency || current.currency;
    grouped.set(key, current);
  });

  return Array.from(grouped.entries())
    .map(([key, value]) => {
      const sortedPrices = [...value.prices].sort((left, right) => left - right);
      const start = value.start;
      const end = addDays(start, 6);
      const total = sortedPrices.reduce((sum, price) => sum + price, 0);
      const averagePrice = total / sortedPrices.length;

      return {
        key,
        start,
        end,
        averagePrice,
        lowestPrice: sortedPrices[0],
        highestPrice: sortedPrices[sortedPrices.length - 1],
        currency: value.currency,
        count: sortedPrices.length,
        shortLabel: formatShortDate(locale, start),
        longLabel: formatLongDateRange(locale, start, end),
      } satisfies WeeklyPriceHistoryBucket;
    })
    .sort((left, right) => left.start.getTime() - right.start.getTime())
    .slice(-limit);
};

const MarketBadge: React.FC<{
  marketName?: string | null;
  marketKey?: string | null;
  logoUrl?: string | null;
  size?: number;
}> = ({ marketName, marketKey, logoUrl, size = 42 }) => {
  const { colors } = useTheme();
  const accent = resolveMarketAccent(marketKey, marketName);
  const monogram = buildMarketMonogram(marketName);
  const stableLogoUrl = resolveMarketLogoUrl(marketKey, marketName, logoUrl);

  if (stableLogoUrl) {
    return (
      <Image
        source={{ uri: stableLogoUrl }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: withAlpha(colors.card, 'EE'),
        }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: withAlpha(accent, '22'),
        borderWidth: 1,
        borderColor: withAlpha(accent, '66'),
      }}
    >
      <Text style={{ color: accent, fontWeight: '800', fontSize: Math.max(11, size * 0.28) }}>
        {monogram}
      </Text>
    </View>
  );
};

const SearchCategoryTreeSection: React.FC<{
  nodes: SearchCategoryTreeNode[];
  selectedCategoryId: string | null;
  selectedCategoryLabel: string | null;
  expandedKeys: string[];
  loadingKeys: string[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onToggle: (key: string) => void;
  onSelect: (categoryId: string | null) => void;
  colors: ThemeColors;
  isDark: boolean;
  tt: TranslateFn;
}> = ({
  nodes,
  selectedCategoryId,
  selectedCategoryLabel,
  expandedKeys,
  loadingKeys,
  collapsed,
  onToggleCollapsed,
  onToggle,
  onSelect,
  colors,
  isDark,
  tt,
}) => {
  const renderNode = (node: SearchCategoryTreeNode): React.ReactNode => {
    const isExpanded = expandedKeys.includes(node.key);
    const hasChildren = node.childrenCount > 0 || node.children.length > 0;
    const isSelected = selectedCategoryId === node.categoryId;
    const isLoading = loadingKeys.includes(node.key);
    const countLabel = typeof node.count === 'number' ? ` (${node.count})` : '';
    const depthOffset = Math.max(0, node.depth - 1) * 18;

    return (
      <View key={node.key} style={styles.categoryTreeNodeWrap}>
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => {
            onSelect(node.categoryId);
            if (hasChildren && !isExpanded) {
              onToggle(node.key);
            }
          }}
          style={[
            styles.categoryTreeRow,
            {
              paddingLeft: 16 + depthOffset,
              backgroundColor: 'transparent',
              borderBottomColor: withAlpha(colors.border, '80'),
            },
          ]}
        >
          <View style={styles.categoryTreeMain}>
            <View style={styles.categoryTreeTitleRow}>
              <Text
                style={[styles.categoryTreeTitle, { color: colors.text }]}
                numberOfLines={2}
              >
                {`${node.label}${countLabel}`}
              </Text>
            </View>
          </View>

          <View style={styles.categoryTreeRowRight}>
            {isSelected ? (
              <Text
                style={[styles.categoryTreeRowValue, { color: colors.mutedText }]}
                numberOfLines={1}
              >
                {tt('price_compare_category_selected_short', 'Seçili')}
              </Text>
            ) : null}

            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => {
                if (hasChildren) {
                  onToggle(node.key);
                } else {
                  onSelect(node.categoryId);
                }
              }}
              style={styles.categoryTreeToggleButton}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.mutedText} />
              ) : (
                <Ionicons
                  name={
                    hasChildren
                      ? isExpanded
                        ? 'chevron-down-outline'
                        : 'chevron-forward-outline'
                      : 'chevron-forward-outline'
                  }
                  size={20}
                  color={colors.mutedText}
                />
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {hasChildren && isExpanded ? (
          <View style={styles.categoryTreeChildren}>
            {node.children.map((child) => renderNode(child))}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View
      style={[
        styles.categoryTreeCard,
        {
          backgroundColor: isDark ? withAlpha(colors.card, 'F7') : '#FFFFFF',
          borderColor: withAlpha(colors.border, isDark ? '70' : '64'),
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={onToggleCollapsed}
        style={[
          styles.categoryTreeHeader,
          { borderBottomColor: withAlpha(colors.border, '66') },
        ]}
      >
        <View style={styles.categoryTreeHeaderLead}>
          <View style={styles.categoryTreeHeaderIconWrap}>
            <Ionicons name="reorder-three-outline" size={18} color={colors.text} />
          </View>
          <Text style={[styles.categoryTreeHeaderTitle, { color: colors.text }]}>
            {tt('price_compare_category_tree_title', 'Kategoriler')}
          </Text>
        </View>
        <View style={styles.categoryTreeHeaderRight}>
          <Text style={[styles.categoryTreeHeaderSubtitle, { color: colors.mutedText }]} numberOfLines={1}>
            {selectedCategoryLabel || tt('price_compare_category_all', 'Tümü')}
          </Text>
          <Ionicons
            name={collapsed ? 'chevron-down-outline' : 'chevron-up-outline'}
            size={18}
            color={colors.mutedText}
          />
        </View>
      </TouchableOpacity>

      {collapsed ? null : (
        <>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => {
              onSelect(null);
            }}
            style={[
              styles.categoryTreeRow,
              styles.categoryTreeRowAll,
              {
                backgroundColor: 'transparent',
                borderBottomColor: withAlpha(colors.border, '80'),
              },
            ]}
          >
            <View style={styles.categoryTreeMain}>
              <View style={styles.categoryTreeTitleRow}>
                <Text
                  style={[styles.categoryTreeTitle, { color: colors.text }]}
                  numberOfLines={2}
                >
                  {tt('price_compare_category_all', 'Tümü')}
                </Text>
              </View>
            </View>
            <View style={styles.categoryTreeRowRight}>
              {!selectedCategoryId ? (
                <Text
                  style={[styles.categoryTreeRowValue, { color: colors.mutedText }]}
                  numberOfLines={1}
                >
                  {tt('price_compare_category_selected_short', 'Seçili')}
                </Text>
              ) : null}
              <Ionicons
                name="chevron-forward-outline"
                size={18}
                color={colors.mutedText}
              />
            </View>
          </TouchableOpacity>

          <View style={styles.categoryTreeList}>{nodes.map((node) => renderNode(node))}</View>
        </>
      )}
    </View>
  );
};

const SearchResultCard: React.FC<{
  item: MarketSearchProduct;
  selected: boolean;
  isFavorite: boolean;
  onOpenPricing: () => void;
  onOpenScore: () => void;
  onQuickAdd: () => void;
  onToggleFavorite: () => void;
  quickAddDisabled: boolean;
  quickAddLoading: boolean;
  cardWidth: number;
  colors: ThemeColors;
  isDark: boolean;
  locale: string;
  tt: TranslateFn;
}> = ({
  item,
  selected,
  isFavorite,
  onOpenPricing,
  onOpenScore,
  onQuickAdd,
  onToggleFavorite,
  quickAddDisabled,
  quickAddLoading,
  cardWidth,
  colors,
  isDark,
  locale,
  tt,
}) => {
  const thumbnailUri =
    item.imageUrl ||
    item.bestOffer?.imageUrl ||
    item.seedOffers?.find((offer) => offer.imageUrl)?.imageUrl ||
    null;
  const normalizedMarketName = String(item.bestOffer?.marketName || '')
    .trim()
    .toLocaleLowerCase('tr');
  const hasConcreteMarketName =
    normalizedMarketName.length > 0 &&
    normalizedMarketName !== 'market' &&
    normalizedMarketName !== '-';
  const bestOfferLabel =
    item.bestOffer != null
      ? formatLocalizedPrice(locale, item.bestOffer.price, item.bestOffer.currency)
      : '—';
  const bestMarketLabel =
    item.marketCount > 1
      ? tt('price_compare_result_market_count', '{{count}} market').replace(
          '{{count}}',
          String(item.marketCount)
        )
      : hasConcreteMarketName
        ? item.bestOffer?.marketName
        : item.marketCount > 0
          ? tt('price_compare_result_market_count', '{{count}} market').replace(
              '{{count}}',
              String(item.marketCount)
            )
          : tt('price_compare_result_market_pending_short', 'Teklif bekliyor');
  const visibleMarketNames = Array.from(
    new Set(
      (item.seedOffers ?? [])
        .map((offer) => offer.marketName?.trim())
        .filter((value): value is string => Boolean(value))
        .concat(hasConcreteMarketName ? [item.bestOffer?.marketName?.trim() || ''] : [])
        .filter(Boolean)
    )
  );
  const marketSecondaryLabel =
    visibleMarketNames.length > 0
      ? `${visibleMarketNames.slice(0, 2).join(' • ')}${
          item.marketCount > visibleMarketNames.length
            ? ` +${item.marketCount - visibleMarketNames.length}`
            : visibleMarketNames.length > 2
              ? ` +${visibleMarketNames.length - 2}`
              : ''
        }`
      : hasConcreteMarketName && item.marketCount > 1
        ? `${item.bestOffer?.marketName} +${Math.max(item.marketCount - 1, 0)}`
        : null;
  const thumbnailIcon = (() => {
    const source = `${item.taxonomyLeaf || ''} ${item.category || ''} ${item.productName || ''}`
      .toLocaleLowerCase('tr');
    if (source.includes('bebek')) {
      return 'happy-outline' as const;
    }
    if (source.includes('meyve') || source.includes('sebze')) {
      return 'leaf-outline' as const;
    }
    if (source.includes('içecek') || source.includes('icecek') || source.includes('soda')) {
      return 'wine-outline' as const;
    }
    if (source.includes('et') || source.includes('tavuk') || source.includes('balık')) {
      return 'restaurant-outline' as const;
    }
    if (source.includes('deterjan') || source.includes('temizlik')) {
      return 'sparkles-outline' as const;
    }
    if (source.includes('kahvalt')) {
      return 'cafe-outline' as const;
    }
    if (source.includes('kozmetik') || source.includes('bakım') || source.includes('bakim')) {
      return 'flower-outline' as const;
    }
    return 'cube-outline' as const;
  })();
  const priceCaption =
    item.bestOffer != null
      ? bestOfferLabel
      : tt('price_compare_result_market_pending_short', 'Teklif bekliyor');
  const displayProductName = toDisplayProductName(item.productName);
  const displayBrand = item.brand ? toDisplayProductName(item.brand) : null;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onOpenScore}
      style={[
        styles.resultGridCard,
        {
          width: cardWidth,
          backgroundColor: withAlpha(colors.card, 'FC'),
          borderColor: withAlpha(selected ? colors.primary : colors.border, selected ? 'A8' : '62'),
        },
      ]}
    >
      <View
        style={[
          styles.resultGridImageWrap,
          {
            backgroundColor: withAlpha(colors.backgroundMuted, isDark ? '90' : '74'),
            borderColor: withAlpha(colors.border, '42'),
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={(event) => {
            event.stopPropagation();
            onQuickAdd();
          }}
          disabled={quickAddDisabled || quickAddLoading}
          style={[
            styles.resultGridAddButton,
            {
              backgroundColor: colors.primary,
              opacity: quickAddDisabled ? 0.55 : 1,
            },
          ]}
        >
          {quickAddLoading ? (
            <ActivityIndicator size="small" color={colors.primaryContrast} />
          ) : (
            <Ionicons name="add" size={16} color={colors.primaryContrast} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={(event) => {
            event.stopPropagation();
            onToggleFavorite();
          }}
          style={[
            styles.resultGridWishButton,
            {
              backgroundColor: withAlpha(
                isFavorite ? colors.primary : colors.cardElevated,
                isFavorite ? '16' : 'F6'
              ),
              borderColor: withAlpha(isFavorite ? colors.primary : colors.border, '80'),
            },
          ]}
        >
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={13}
            color={isFavorite ? colors.primary : withAlpha(colors.mutedText, 'CC')}
          />
        </TouchableOpacity>

        <View style={styles.resultGridImageInner}>
          {thumbnailUri ? (
            <Image source={{ uri: thumbnailUri }} style={styles.resultGridImage} resizeMode="contain" />
          ) : (
            <View
              style={[
                styles.resultGridFallback,
                { backgroundColor: withAlpha(colors.primary, '12') },
              ]}
            >
              <Ionicons name={thumbnailIcon} size={22} color={colors.primary} />
            </View>
          )}
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.82}
        onPress={onOpenPricing}
        style={[
          styles.resultGridMarketBadge,
          {
            backgroundColor: withAlpha(colors.primary, '12'),
            borderColor: withAlpha(colors.primary, '24'),
          },
        ]}
      >
        <Text style={[styles.resultGridMarketBadgeText, { color: colors.primary }]} numberOfLines={1}>
          {bestMarketLabel}
        </Text>
      </TouchableOpacity>

      <Text style={[styles.resultGridTitle, { color: colors.text }]} numberOfLines={2}>
        {displayProductName}
      </Text>

      {displayBrand || (item.packSize && item.packUnit) ? (
        <Text style={[styles.resultGridMeta, { color: colors.mutedText }]} numberOfLines={1}>
          {[displayBrand, item.packSize && item.packUnit ? `${item.packSize} ${item.packUnit}` : null]
            .filter(Boolean)
            .join(' • ')}
        </Text>
      ) : (
        <View style={styles.resultGridMetaSpacer} />
      )}

      {marketSecondaryLabel ? (
        <Text style={[styles.resultGridSubMeta, { color: colors.mutedText }]} numberOfLines={1}>
          {marketSecondaryLabel}
        </Text>
      ) : (
        <View style={styles.resultGridSubMetaSpacer} />
      )}

      <Text style={[styles.resultGridPrice, { color: colors.text }]} numberOfLines={1}>
        {priceCaption}
      </Text>
    </TouchableOpacity>
  );
};

const FavoriteProductStripCard: React.FC<{
  item: MarketSearchProduct;
  onOpen: () => void;
  onQuickAdd: () => void;
  onToggleFavorite: () => void;
  quickAddDisabled: boolean;
  quickAddLoading: boolean;
  colors: ThemeColors;
  locale: string;
  tt: TranslateFn;
}> = ({
  item,
  onOpen,
  onQuickAdd,
  onToggleFavorite,
  quickAddDisabled,
  quickAddLoading,
  colors,
  locale,
  tt,
}) => {
  const thumbnailUri =
    item.imageUrl ||
    item.bestOffer?.imageUrl ||
    item.seedOffers?.find((offer) => offer.imageUrl)?.imageUrl ||
    null;
  const priceLabel = item.bestOffer
    ? formatLocalizedPrice(locale, item.bestOffer.price, item.bestOffer.currency)
    : tt('price_compare_result_market_pending_short', 'Teklif bekliyor');
  const marketLabel =
    item.marketCount > 0
      ? tt('price_compare_result_market_count', '{{count}} market').replace(
          '{{count}}',
          String(item.marketCount)
        )
      : item.bestOffer?.marketName || '';

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onOpen}
      style={[
        styles.favoriteStripCard,
        {
          backgroundColor: withAlpha(colors.card, 'FC'),
          borderColor: withAlpha(colors.border, '66'),
        },
      ]}
    >
      <View
        style={[
          styles.favoriteStripImageWrap,
          { backgroundColor: withAlpha(colors.backgroundMuted, '84') },
        ]}
      >
        {thumbnailUri ? (
          <Image source={{ uri: thumbnailUri }} style={styles.favoriteStripImage} resizeMode="contain" />
        ) : (
          <Ionicons name="cube-outline" size={18} color={colors.primary} />
        )}
      </View>

      <View style={styles.favoriteStripTextWrap}>
        <Text style={[styles.favoriteStripTitle, { color: colors.text }]} numberOfLines={2}>
          {toDisplayProductName(item.productName)}
        </Text>
        <Text style={[styles.favoriteStripMeta, { color: colors.mutedText }]} numberOfLines={1}>
          {[item.brand ? toDisplayProductName(item.brand) : null, marketLabel].filter(Boolean).join(' • ')}
        </Text>
        <Text style={[styles.favoriteStripPrice, { color: colors.text }]} numberOfLines={1}>
          {priceLabel}
        </Text>
      </View>

      <View style={styles.favoriteStripActions}>
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={(event) => {
            event.stopPropagation();
            onToggleFavorite();
          }}
          style={[
            styles.favoriteStripIconButton,
            { backgroundColor: withAlpha(colors.primary, '12') },
          ]}
        >
          <Ionicons name="heart" size={13} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={(event) => {
            event.stopPropagation();
            onQuickAdd();
          }}
          disabled={quickAddDisabled || quickAddLoading}
          style={[
            styles.favoriteStripAddButton,
            { backgroundColor: colors.primary, opacity: quickAddDisabled ? 0.55 : 1 },
          ]}
        >
          {quickAddLoading ? (
            <ActivityIndicator size="small" color={colors.primaryContrast} />
          ) : (
            <Ionicons name="add" size={15} color={colors.primaryContrast} />
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const PriceHistoryTrendCard: React.FC<{
  buckets: WeeklyPriceHistoryBucket[];
  loading: boolean;
  error: string | null;
  locale: string;
  colors: ThemeColors;
  tt: TranslateFn;
}> = ({ buckets, loading, error, locale, colors, tt }) => {
  const averageValues = buckets.map((bucket) => bucket.averagePrice);
  const minAverage = averageValues.length ? Math.min(...averageValues) : 0;
  const maxAverage = averageValues.length ? Math.max(...averageValues) : 0;
  const valueRange = Math.max(maxAverage - minAverage, 0.01);
  const cheapestBucket = buckets.reduce<WeeklyPriceHistoryBucket | null>(
    (current, bucket) =>
      !current || bucket.averagePrice < current.averagePrice ? bucket : current,
    null
  );
  const priciestBucket = buckets.reduce<WeeklyPriceHistoryBucket | null>(
    (current, bucket) =>
      !current || bucket.averagePrice > current.averagePrice ? bucket : current,
    null
  );
  const currency =
    cheapestBucket?.currency || priciestBucket?.currency || buckets[0]?.currency || 'TRY';

  return (
    <View
      style={[
        styles.historyCard,
        {
          backgroundColor: withAlpha(colors.cardElevated, 'F1'),
          borderColor: withAlpha(colors.border, 'BC'),
          shadowColor: colors.shadow,
        },
      ]}
    >
      <View style={styles.historyCardHeader}>
        <View style={styles.historyCardHeaderText}>
          <Text style={[styles.historyCardTitle, { color: colors.text }]}>
            {tt('price_compare_history_title', 'Fiyat performansı')}
          </Text>
          <Text style={[styles.historyCardSubtitle, { color: colors.mutedText }]}>
            {tt(
              'price_compare_history_subtitle',
              'Son haftalara göre fiyat hareketi ve en güçlü dönemler.'
            )}
          </Text>
        </View>
        <View
          style={[
            styles.historyPeriodBadge,
            { backgroundColor: withAlpha(colors.primary, '12') },
          ]}
        >
          <Text style={[styles.historyPeriodBadgeText, { color: colors.primary }]}>
            {tt('price_compare_history_period_label', 'Haftalık')}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.historyLoadingWrap}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : error ? (
        <NoticeCard text={error} colors={colors} />
      ) : !buckets.length ? (
        <NoticeCard
          text={tt(
            'price_compare_history_empty',
            'Bu ürün için haftalık fiyat geçmişi henüz oluşmadı.'
          )}
          colors={colors}
        />
      ) : (
        <>
          <View style={styles.historySummaryRow}>
            {cheapestBucket ? (
              <View
                style={[
                  styles.historySummaryPill,
                  { backgroundColor: withAlpha(colors.success, '12') },
                ]}
              >
                <Text style={[styles.historySummaryLabel, { color: colors.success }]}>
                  {tt('price_compare_history_cheapest_period', 'En ucuz dönem')}
                </Text>
                <Text style={[styles.historySummaryValue, { color: colors.text }]}>
                  {formatLocalizedPrice(locale, cheapestBucket.averagePrice, currency)}
                </Text>
                <Text style={[styles.historySummaryMeta, { color: colors.mutedText }]}>
                  {cheapestBucket.longLabel}
                </Text>
              </View>
            ) : null}

            {priciestBucket ? (
              <View
                style={[
                  styles.historySummaryPill,
                  { backgroundColor: withAlpha(colors.warning, '12') },
                ]}
              >
                <Text style={[styles.historySummaryLabel, { color: colors.warning }]}>
                  {tt('price_compare_history_priciest_period', 'En pahalı dönem')}
                </Text>
                <Text style={[styles.historySummaryValue, { color: colors.text }]}>
                  {formatLocalizedPrice(locale, priciestBucket.averagePrice, currency)}
                </Text>
                <Text style={[styles.historySummaryMeta, { color: colors.mutedText }]}>
                  {priciestBucket.longLabel}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.historyChartWrap}>
            {buckets.map((bucket) => {
              const normalizedHeight =
                maxAverage === minAverage
                  ? 0.58
                  : (bucket.averagePrice - minAverage) / valueRange;
              const barHeight = 28 + normalizedHeight * 92;
              const isCheapest = cheapestBucket?.key === bucket.key;
              const isPriciest = priciestBucket?.key === bucket.key;
              const barColor = isCheapest
                ? colors.success
                : isPriciest
                  ? colors.warning
                  : colors.primary;

              return (
                <View key={bucket.key} style={styles.historyBarColumn}>
                  <Text style={[styles.historyBarValue, { color: colors.text }]}>
                    {formatLocalizedPrice(locale, bucket.averagePrice, currency)}
                  </Text>
                  <View style={styles.historyBarTrack}>
                    <View
                      style={[
                        styles.historyBar,
                        {
                          height: barHeight,
                          backgroundColor: barColor,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.historyBarLabel, { color: colors.mutedText }]}>
                    {bucket.shortLabel}
                  </Text>
                </View>
              );
            })}
          </View>

          <Text style={[styles.historyFootnote, { color: colors.mutedText }]}>
            {tt(
              'price_compare_history_footnote',
              'Grafik haftalık ortalama fiyatı gösterir. Çubuklar ürünün en ucuz ve en pahalı haftalarını vurgular.'
            )}
          </Text>
        </>
      )}
    </View>
  );
};

export const PriceCompareScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<PriceCompareRoute>();
  const { t, i18n } = useTranslation();
  const { colors, isDark } = useTheme();
  const { width: viewportWidth } = useWindowDimensions();
  const { snapshot: marketRuntime } = useMarketGelsinRuntime();
  const { profile } = useAuth();
  const locationPermissionGranted = usePreferenceStore(
    (state) => state.locationPermissionGranted
  );
  const layout = useAppScreenLayout({
    topInsetExtra: 18,
    topInsetMin: 72,
    contentBottomExtra: 42,
    contentBottomMin: 96,
    horizontalPadding: 16,
  });

  const tt = useCallback(
    (key: string, fallback: string) => {
      const value = t(key, { defaultValue: fallback });
      return value === key ? fallback : value;
    },
    [t]
  );
  const resultCardWidth = useMemo(() => {
    const gridInnerWidth =
      viewportWidth -
      layout.horizontalPadding * 2 -
      RESULT_GRID_HORIZONTAL_PADDING * 2 -
      RESULT_GRID_GAP * (RESULT_GRID_COLUMNS - 1);

    return Math.max(72, Math.floor(gridInnerWidth / RESULT_GRID_COLUMNS));
  }, [layout.horizontalPadding, viewportWidth]);
  const preferredLocale = i18n.language || 'tr-TR';
  const [detectedLocation, setDetectedLocation] = useState<CurrentLocationContext | null>(null);
  const [detectedLocationLoading, setDetectedLocationLoading] = useState(false);
  const [detectedLocationResolved, setDetectedLocationResolved] = useState(false);
  const [selectedReferenceProduct, setSelectedReferenceProduct] = useState<Product | null>(null);
  const [selectedReferenceLoading, setSelectedReferenceLoading] = useState(false);
  const canonicalProfileCity = resolveCanonicalCity(profile?.city);
  const canonicalProfileDistrict = resolveCanonicalDistrict(profile?.city, profile?.district);
  const canonicalDetectedCity = resolveCanonicalCity(detectedLocation?.city);
  const canonicalDetectedDistrict = resolveCanonicalDistrict(
    detectedLocation?.city,
    detectedLocation?.district
  );
  const effectiveCity = canonicalProfileCity || canonicalDetectedCity;
  const effectiveDistrict = canonicalProfileDistrict || canonicalDetectedDistrict;
  const cityCode = resolveTurkeyCityCode(effectiveCity);
  const locationLabel = effectiveDistrict
    ? `${effectiveDistrict}, ${effectiveCity ?? profile?.city ?? detectedLocation?.city ?? ''}`
    : effectiveCity || profile?.city || detectedLocation?.city || null;

  const [query, setQuery] = useState(route.params?.initialQuery ?? '');
  const [searchLoading, setSearchLoading] = useState(false);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categoryTreeCollapsed, setCategoryTreeCollapsed] = useState(false);
  const [categoryNodes, setCategoryNodes] = useState<MarketCategoryNode[]>([]);
  const [expandedCategoryKeys, setExpandedCategoryKeys] = useState<string[]>([]);
  const [categoryLoadingKeys, setCategoryLoadingKeys] = useState<string[]>([]);
  const [categoryTreeLoading, setCategoryTreeLoading] = useState(false);
  const [categoryTreeError, setCategoryTreeError] = useState<string | null>(null);
  const [loadedCategoryBranchIds, setLoadedCategoryBranchIds] = useState<string[]>([]);
  const [results, setResults] = useState<MarketSearchProduct[]>([]);
  const [resultsPage, setResultsPage] = useState(1);
  const [resultsNextCursor, setResultsNextCursor] = useState<number | null>(null);
  const [resultsPaginationLoading, setResultsPaginationLoading] = useState(false);
  const [resultsBrowseCategoryId, setResultsBrowseCategoryId] = useState<string | null>(null);
  const [autocompleteResults, setAutocompleteResults] = useState<MarketSearchProduct[]>([]);
  const [favoriteKeys, setFavoriteKeys] = useState<string[]>([]);
  const [favoriteProductsByKey, setFavoriteProductsByKey] = useState<
    Record<string, MarketSearchProduct>
  >({});
  const [selectedProduct, setSelectedProduct] = useState<MarketSearchProduct | null>(null);
  const [offersResponse, setOffersResponse] = useState<MarketProductOffersResponse | null>(null);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState<string | null>(null);
  const [priceHistoryResponse, setPriceHistoryResponse] =
    useState<MarketPriceHistoryResponse | null>(null);
  const [priceHistoryLoading, setPriceHistoryLoading] = useState(false);
  const [priceHistoryError, setPriceHistoryError] = useState<string | null>(null);
  const [marketSheetState, setMarketSheetState] = useState<MarketSheetState>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [quickAddLoadingId, setQuickAddLoadingId] = useState<string | null>(null);
  const priceHistoryRequestRef = useRef(0);
  const appliedInitialQueryRef = useRef<string | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const resultsSectionOffsetRef = useRef<number>(0);
  const selectedSectionOffsetRef = useRef<number>(0);
  const comparisonCart = usePriceCompareBasketStore((state) => state.entries);
  const addOrIncrementEntry = usePriceCompareBasketStore((state) => state.addOrIncrementEntry);
  const updateEntryOffers = usePriceCompareBasketStore((state) => state.updateEntryOffers);
  const loadedResultsPages = useMemo(
    () => Math.max(1, Math.ceil(results.length / SEARCH_RESULTS_PAGE_SIZE)),
    [results.length]
  );
  const totalResultsPages = useMemo(
    () => loadedResultsPages + (resultsNextCursor != null ? 1 : 0),
    [loadedResultsPages, resultsNextCursor]
  );
  const pagedResults = useMemo(() => {
    const startIndex = (resultsPage - 1) * SEARCH_RESULTS_PAGE_SIZE;
    return results.slice(startIndex, startIndex + SEARCH_RESULTS_PAGE_SIZE);
  }, [results, resultsPage]);
  const visibleResultsPageNumbers = useMemo(() => {
    const maxButtons = 4;
    const start = Math.max(1, Math.min(resultsPage - 1, totalResultsPages - maxButtons + 1));
    const end = Math.min(totalResultsPages, start + maxButtons - 1);

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [resultsPage, totalResultsPages]);
  const categoryLabelLookup = useMemo(() => {
    const next = new Map<string, string>();

    categoryNodes.forEach((node) => {
      const label = node.taxonomyLeaf?.trim() || node.normalizedCategory?.trim() || '';
      if (label) {
        next.set(node.normalizedCategoryId, label);
      }
    });

    return next;
  }, [categoryNodes]);
  const selectedCategoryLabel = selectedCategoryId
    ? categoryLabelLookup.get(selectedCategoryId) ?? null
    : null;
  const favoriteKeySet = useMemo(() => new Set(favoriteKeys), [favoriteKeys]);
  const favoriteProducts = useMemo(
    () =>
      favoriteKeys
        .map((key) => favoriteProductsByKey[key])
        .filter((item): item is MarketSearchProduct => Boolean(item)),
    [favoriteKeys, favoriteProductsByKey]
  );

  useEffect(() => {
    let cancelled = false;

    const loadOnboarding = async () => {
      const hasSeen = await hasSeenScreenOnboarding('price');

      if (!cancelled) {
        setShowOnboarding(!hasSeen);
      }
    };

    void loadOnboarding();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleDismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    void markScreenOnboardingSeen('price');
  }, []);

  const refreshFavorites = useCallback(async () => {
    const nextFavoriteBarcodes = getAllFavoriteBarcodes(40);
    const historyFavorites = getLatestHistoryEntriesForBarcodes(nextFavoriteBarcodes);

    if (historyFavorites.length) {
      await mergePriceCompareFavorites(
        historyFavorites.map((entry) => mapHistoryEntryToSearchProduct(entry)),
        { prependNew: true, updateExistingOnly: false }
      );
    }

    const favorites = await listPriceCompareFavorites(40);

    setFavoriteKeys(favorites.map((item) => item.key));
    setFavoriteProductsByKey(
      favorites.reduce<Record<string, MarketSearchProduct>>((acc, item) => {
        acc[item.key] = item.product;
        return acc;
      }, {})
    );
  }, []);

  useEffect(() => {
    void refreshFavorites();
  }, [refreshFavorites]);

  useEffect(() => {
    const candidates = [...results, ...autocompleteResults, ...(selectedProduct ? [selectedProduct] : [])]
      .filter((item) => Boolean(getPriceCompareFavoriteKey(item)));

    if (!candidates.length) {
      return;
    }

    const favoriteCandidates = candidates.filter((item) => {
      const key = getPriceCompareFavoriteKey(item);
      return Boolean(key && favoriteKeySet.has(key));
    });

    if (!favoriteCandidates.length) {
      return;
    }

    setFavoriteProductsByKey((previous) => {
      const next = { ...previous };
      let changed = false;

      favoriteCandidates.forEach((item) => {
        const key = getPriceCompareFavoriteKey(item);

        if (!key) {
          return;
        }

        const existing = next[key];
        const merged = existing ? mergeSearchProductDetails(existing, item) : item;

        if (existing !== merged) {
          next[key] = merged;
          changed = true;
        }
      });

      return changed ? next : previous;
    });

    void mergePriceCompareFavorites(
      favoriteCandidates.map((item) => {
        const key = getPriceCompareFavoriteKey(item);
        return key && favoriteProductsByKey[key]
          ? mergeSearchProductDetails(favoriteProductsByKey[key], item)
          : item;
      }),
      { prependNew: false, updateExistingOnly: true }
    );
  }, [autocompleteResults, favoriteKeySet, favoriteProductsByKey, results, selectedProduct]);

  useEffect(() => {
    setResultsPage(1);
  }, [query, selectedCategoryId]);

  useEffect(() => {
    if (resultsPage > totalResultsPages) {
      setResultsPage(totalResultsPages);
    }
  }, [resultsPage, totalResultsPages]);

  const closeMarketSheet = useCallback(() => {
    setMarketSheetState(null);
  }, []);

  const openOfferSheet = useCallback((offer: MarketOffer) => {
    setMarketSheetState({ kind: 'offer', offer });
  }, []);

  const loadPriceHistory = useCallback(
    async (product: MarketSearchProduct) => {
      const requestId = ++priceHistoryRequestRef.current;

      setPriceHistoryError(null);

      if (!marketRuntime.isEnabled || !hasComparableBarcode(product)) {
        setPriceHistoryResponse(null);
        setPriceHistoryLoading(false);
        return;
      }

      setPriceHistoryLoading(true);

      try {
        const response = await resolveWithin(
          fetchMarketPriceHistory(product.barcode!, {
            cityCode: cityCode ?? undefined,
            days: 84,
          }),
          REMOTE_SEARCH_TIMEOUT_MS
        );

        if (requestId !== priceHistoryRequestRef.current) {
          return;
        }

        setPriceHistoryResponse(response);
      } catch (error) {
        console.warn('[PriceCompareScreen] price history load failed:', error);

        if (requestId !== priceHistoryRequestRef.current) {
          return;
        }

        setPriceHistoryResponse(null);
        setPriceHistoryError(
          tt(
            'price_compare_history_error',
            'Fiyat geçmişi şu anda yüklenemedi. Lütfen biraz sonra tekrar deneyin.'
          )
        );
      } finally {
        if (requestId === priceHistoryRequestRef.current) {
          setPriceHistoryLoading(false);
        }
      }
    },
    [cityCode, marketRuntime.isEnabled, tt]
  );

  const fetchComprehensiveOffersForProduct = useCallback(
    async (product: MarketSearchProduct): Promise<MarketProductOffersResponse | null> => {
      const immediateResponse = buildOffersResponseFromSearchProduct(product);

      if (!hasComparableBarcode(product) && !hasComparableProductId(product)) {
        return immediateResponse;
      }

      const fetchOffersForScope = (
        scope: 'district' | 'city' | 'global'
      ): Promise<MarketProductOffersResponse | null> => {
        const districtName = scope === 'district' ? effectiveDistrict ?? undefined : undefined;
        const scopedCityCode = scope === 'global' ? undefined : cityCode ?? undefined;
        const sharedParams = {
          cityCode: scopedCityCode,
          districtName,
          includeOutOfStock: true,
          limit: 200,
          fallbackProductName: product.productName,
          fallbackBrand: product.brand ?? undefined,
          enableNameFallback: true,
        };

        if (hasComparableBarcode(product)) {
          return resolveWithin(
            fetchMarketProductOffers(product.barcode!, sharedParams),
            REMOTE_OFFERS_TIMEOUT_MS
          ).catch(() => null);
        }

        if (hasComparableProductId(product)) {
          return resolveWithin(
            fetchMarketProductOffersById(product.productId!, sharedParams),
            REMOTE_OFFERS_TIMEOUT_MS
          ).catch(() => null);
        }

        return Promise.resolve<MarketProductOffersResponse | null>(null);
      };

      const [districtScopedResponse, cityWideResponse, globalResponse] = await Promise.all([
        fetchOffersForScope('district'),
        effectiveDistrict
          ? fetchOffersForScope('city')
          : Promise.resolve<MarketProductOffersResponse | null>(null),
        cityCode || effectiveDistrict
          ? fetchOffersForScope('global')
          : Promise.resolve<MarketProductOffersResponse | null>(null),
      ]);

      return mergeMarketOfferResponses([
        districtScopedResponse,
        cityWideResponse,
        globalResponse,
        immediateResponse,
      ]);
    },
    [cityCode, effectiveDistrict]
  );

  const loadOffers = useCallback(
    async (product: MarketSearchProduct) => {
      setSelectedProduct(product);
      setSelectedReferenceProduct(null);
      setOffersLoading(true);
      setOffersError(null);
      void loadPriceHistory(product);

      try {
        const response = await fetchComprehensiveOffersForProduct(product);

        if (!response) {
          throw new Error('market_product_offers_not_available');
        }

        setOffersResponse(response);
      } catch (error) {
        console.error('[PriceCompareScreen] offer load failed:', error);
        setOffersResponse(null);
        setOffersError(
          tt(
            'price_compare_offers_error',
            'Seçilen ürün için market teklifleri şu anda yüklenemedi.'
          )
        );
      } finally {
        setOffersLoading(false);
      }
    },
    [fetchComprehensiveOffersForProduct, loadPriceHistory, tt]
  );

  const loadCategoryBrowsePage = useCallback(
    async (categoryId: string, cursor: number) => {
      const selectedCategoryNode =
        categoryNodes.find((item) => item.normalizedCategoryId === categoryId) ?? null;

      if (!selectedCategoryNode) {
        return {
          results: [] as MarketSearchProduct[],
          nextCursor: null as number | null,
        };
      }

      try {
        const browseResponse = await resolveWithin(
          fetchMarketCategoryProducts({
            categoryId: selectedCategoryNode.normalizedCategoryId,
            cityCode: cityCode ?? undefined,
            limit: SEARCH_RESULTS_PAGE_SIZE,
            cursor,
            sort: 'popular',
          }),
          REMOTE_SEARCH_TIMEOUT_MS
        );

        if (browseResponse.results.length > 0) {
          return {
            results: browseResponse.results.map((item) =>
              annotateBrowseResult(item, selectedCategoryNode)
            ),
            nextCursor: browseResponse.nextCursor ?? null,
          };
        }
      } catch (error) {
        console.warn('[PriceCompareScreen] category browse RPC failed:', error);
      }

      if (cursor > 0) {
        return {
          results: [] as MarketSearchProduct[],
          nextCursor: null as number | null,
        };
      }

      const localFallbackResults = searchLocalCategoryBrowseProducts(
        selectedCategoryNode.taxonomyLeaf,
        SEARCH_RESULTS_PAGE_SIZE
      ).map((item) => annotateBrowseResult(item, selectedCategoryNode));

      try {
        const fallbackQueries =
          buildCategoryBrowseQueries(selectedCategoryNode.taxonomyLeaf).slice(0, 4);

        for (const fallbackQuery of fallbackQueries) {
          const attempts = [
            {
              query: fallbackQuery,
              cityCode: cityCode ?? undefined,
              categoryId: selectedCategoryNode.normalizedCategoryId,
            },
            {
              query: fallbackQuery,
              categoryId: selectedCategoryNode.normalizedCategoryId,
            },
            {
              query: fallbackQuery,
              cityCode: cityCode ?? undefined,
            },
            {
              query: fallbackQuery,
            },
          ];

          for (const attempt of attempts) {
            const response = await resolveWithin(
              fetchMarketProductSearch({
                query: attempt.query,
                cityCode: attempt.cityCode,
                categoryId: attempt.categoryId,
                limit: SEARCH_RESULTS_PAGE_SIZE,
              }),
              REMOTE_SEARCH_TIMEOUT_MS
            );

            if (!response.results.length) {
              continue;
            }

            return {
              results: response.results.map((item) =>
                annotateBrowseResult(item, selectedCategoryNode)
              ),
              nextCursor: null as number | null,
            };
          }
        }

        return {
          results: localFallbackResults,
          nextCursor: null as number | null,
        };
      } catch (error) {
        console.warn('[PriceCompareScreen] category browse search failed:', error);
        return {
          results: localFallbackResults,
          nextCursor: null as number | null,
        };
      }
    },
    [categoryNodes, cityCode]
  );

  useEffect(() => {
    let cancelled = false;

    if (!selectedProduct || selectedProduct.barcode) {
      setSelectedReferenceLoading(false);
      setSelectedReferenceProduct(null);
      return () => {
        cancelled = true;
      };
    }

    setSelectedReferenceLoading(true);
    setSelectedReferenceProduct(null);

    void resolveReferenceProductForMarketProduct(selectedProduct)
      .then((candidate) => {
        if (!cancelled) {
          setSelectedReferenceProduct(candidate);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn('[PriceCompareScreen] selected reference resolve failed:', error);
          setSelectedReferenceProduct(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSelectedReferenceLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProduct]);

  const searchProducts = useCallback(
    async (
      rawQuery: string,
      limit: number,
      mode: 'search' | 'autocomplete',
      categoryIdOverride?: string | null
    ) => {
      const trimmedQuery = rawQuery.trim();
      const effectiveCategoryId = categoryIdOverride ?? selectedCategoryId;
      const selectedCategoryNode =
        effectiveCategoryId
          ? categoryNodes.find((item) => item.normalizedCategoryId === effectiveCategoryId) ?? null
          : null;
      const isCategoryBrowseMode =
        Boolean(effectiveCategoryId) && trimmedQuery.length < SEARCH_MIN_LENGTH;

      if (trimmedQuery.length < SEARCH_MIN_LENGTH && !isCategoryBrowseMode) {
        return [];
      }

      const localResults = effectiveCategoryId || isCategoryBrowseMode
        ? selectedCategoryNode
          ? searchLocalCategoryBrowseProducts(selectedCategoryNode.taxonomyLeaf, limit)
              .map((item) => annotateBrowseResult(item, selectedCategoryNode))
          : []
        : searchLocalPriceCompareProducts(trimmedQuery, limit);
      const variants = buildSearchVariants(trimmedQuery);
      const timeoutMs =
        mode === 'autocomplete' ? REMOTE_AUTOCOMPLETE_TIMEOUT_MS : REMOTE_SEARCH_TIMEOUT_MS;
      const isBarcodeQuery = isBarcodeLikeQuery(trimmedQuery);
      const remoteTasks: Promise<MarketSearchProduct[]>[] = [];
      let categoryBrowseFallbackNeeded = isCategoryBrowseMode && Boolean(selectedCategoryNode);

      if (isBarcodeQuery) {
        remoteTasks.push(
          resolveWithin(
            fetchMarketBarcodeLookup(trimmedQuery, {
              cityCode: cityCode ?? undefined,
              limit,
              includeOutOfStock: true,
            }),
            timeoutMs
          )
            .then((result) => (result ? [result] : []))
            .catch((error) => {
              console.warn('[PriceCompareScreen] barcode lookup failed:', error);
              return [];
            })
        );
      }

      if (!isCategoryBrowseMode) {
        variants.forEach((variant) => {
          remoteTasks.push(
            resolveWithin(
              fetchMarketProductSearch({
                query: variant,
                cityCode: cityCode ?? undefined,
                categoryId: effectiveCategoryId ?? undefined,
                limit,
              }),
              timeoutMs
            )
              .then((response) => response.results)
              .catch((error) => {
                console.warn('[PriceCompareScreen] v1 product search failed:', error);
                return [];
              })
          );
        });
      } else if (selectedCategoryNode) {
        try {
          const browseResponse = await resolveWithin(
            fetchMarketCategoryProducts({
              categoryId: selectedCategoryNode.normalizedCategoryId,
              cityCode: cityCode ?? undefined,
              limit: Math.max(limit, 12),
              cursor: 0,
              sort: 'popular',
            }),
            timeoutMs
          );

          if (browseResponse.results.length) {
            remoteTasks.push(
              Promise.resolve(
                browseResponse.results.map((item) => annotateBrowseResult(item, selectedCategoryNode))
              )
            );
            categoryBrowseFallbackNeeded = false;
          }
        } catch (error) {
          console.warn('[PriceCompareScreen] category browse RPC failed:', error);
        }
      }

      if (categoryBrowseFallbackNeeded && selectedCategoryNode) {
        remoteTasks.push(
          (async () => {
            try {
              const fallbackQueries =
                buildCategoryBrowseQueries(selectedCategoryNode.taxonomyLeaf).slice(0, 4);
              const attempts: {
                query: string;
                cityCode?: string;
                categoryId?: string;
              }[] = fallbackQueries.flatMap((fallbackQuery) => [
                {
                  query: fallbackQuery,
                  cityCode: cityCode ?? undefined,
                  categoryId: selectedCategoryNode.normalizedCategoryId,
                },
                {
                  query: fallbackQuery,
                  categoryId: selectedCategoryNode.normalizedCategoryId,
                },
                {
                  query: fallbackQuery,
                  cityCode: cityCode ?? undefined,
                },
                {
                  query: fallbackQuery,
                },
              ]);

              for (const attempt of attempts) {
                const response = await resolveWithin(
                  fetchMarketProductSearch({
                    query: attempt.query,
                    cityCode: attempt.cityCode,
                    categoryId: attempt.categoryId,
                    limit: Math.max(limit, 12),
                  }),
                  timeoutMs
                );

                if (!response.results.length) {
                  continue;
                }

                return response.results.map((item) =>
                  annotateBrowseResult(item, selectedCategoryNode)
                );
              }

              return [];
            } catch (error) {
              console.warn('[PriceCompareScreen] category browse search failed:', error);
              return [];
            }
          })()
        );
      }

      const settled = await Promise.allSettled(remoteTasks);
      const remoteResults = settled.flatMap((result) =>
        result.status === 'fulfilled' ? result.value : []
      );

      const mergedResults = dedupeSearchProducts(
        remoteResults.length > 0
          ? [...remoteResults, ...localResults]
          : [...localResults]
      );
      const rankingQuery =
        trimmedQuery ||
        selectedCategoryNode?.taxonomyLeaf ||
        categoryLabelLookup.get(effectiveCategoryId || '') ||
        '';
      const rankedResults = rankSearchProducts(mergedResults, rankingQuery).slice(0, limit);
      const sparseResults = rankedResults.filter(
        (item) => item.barcode && isSearchProductSparse(item)
      );
      const enrichmentLimit = mode === 'autocomplete' ? 3 : 6;

      if (!sparseResults.length) {
        return rankedResults;
      }

      const enrichedByBarcode = new Map<string, MarketSearchProduct>();
      const enrichedResults = await Promise.allSettled(
        sparseResults.slice(0, enrichmentLimit).map(async (item) => {
          const resolved = await resolveWithin(
            fetchMarketBarcodeLookup(item.barcode!, {
              cityCode: cityCode ?? undefined,
              includeOutOfStock: true,
            }),
            timeoutMs
          );

          if (resolved?.barcode) {
            enrichedByBarcode.set(resolved.barcode, resolved);
          }
        })
      );

      enrichedResults.forEach((result) => {
        if (result.status === 'rejected') {
          console.warn('[PriceCompareScreen] search result enrichment failed:', result.reason);
        }
      });

      return rankedResults.map((item) =>
        item.barcode ? mergeSearchProductDetails(item, enrichedByBarcode.get(item.barcode) ?? null) : item
      );
    },
    [categoryLabelLookup, categoryNodes, cityCode, selectedCategoryId]
  );

  const remoteCategoryTree = useMemo(
    () => buildSearchCategoryTree(categoryNodes),
    [categoryNodes]
  );
  const resultDerivedCategoryTree = useMemo(
    () => buildResultDerivedCategoryTree(results),
    [results]
  );
  const categoryTreeUsesResultsFallback =
    !remoteCategoryTree.length && Boolean(categoryTreeError) && resultDerivedCategoryTree.length > 0;
  const categoryTree = categoryTreeUsesResultsFallback
    ? resultDerivedCategoryTree
    : remoteCategoryTree;

  useEffect(() => {
    if (!categoryTree.length) {
      setExpandedCategoryKeys([]);
      return;
    }

    const validKeys = new Set<string>();

    const collectKeys = (nodes: SearchCategoryTreeNode[]) => {
      nodes.forEach((node) => {
        validKeys.add(node.key);
        if (node.children.length) {
          collectKeys(node.children);
        }
      });
    };

    collectKeys(categoryTree);

    setExpandedCategoryKeys((previous) => previous.filter((key) => validKeys.has(key)));
  }, [categoryTree]);

  const mergeCategoryNodes = useCallback((incoming: MarketCategoryNode[]) => {
    setCategoryNodes((previous) => {
      const next = new Map<string, MarketCategoryNode>(
        previous.map((item) => [item.normalizedCategoryId, item])
      );

      incoming.forEach((item) => {
        next.set(item.normalizedCategoryId, item);
      });

      return Array.from(next.values());
    });
  }, []);

  const loadSeededRootCategories = useCallback(async () => {
    const settled = await Promise.allSettled(
      CATEGORY_ROOT_SPECS.map(async (spec) => {
        const response = await resolveWithin(
          fetchMarketCategoryTree({
            cityCode: cityCode ?? undefined,
            query: spec.query,
            depthLimit: 2,
            includeCounts: false,
            onlyActive: true,
          }),
          REMOTE_CATEGORY_TREE_TIMEOUT_MS
        );

        return {
          label: spec.label,
          nodes: response.nodes,
        };
      })
    );

    const groups = settled.flatMap((result) =>
      result.status === 'fulfilled' && result.value.nodes.length > 0 ? [result.value] : []
    );

    return buildSeededCategoryNodes(groups);
  }, [cityCode]);

  const loadRootCategories = useCallback(async () => {
    if (!marketRuntime.isEnabled) {
      setCategoryNodes([]);
      setExpandedCategoryKeys([]);
      setLoadedCategoryBranchIds([]);
      setCategoryTreeError(null);
      setCategoryTreeLoading(false);
      return;
    }

    setCategoryTreeLoading(true);
    setCategoryTreeError(null);
    let usedWarmNodes = false;

    try {
      const warmNodes = await getCachedPriceCompareRootCategories({
        allowStale: true,
      });

      if (warmNodes?.length) {
        usedWarmNodes = true;
        setCategoryNodes(buildGroupedRootCategoryNodes(warmNodes));
        setExpandedCategoryKeys([]);
        setLoadedCategoryBranchIds([CATEGORY_ROOT_KEY]);
        setCategoryTreeLoading(false);
      }

      const freshNodes =
        (await prewarmPriceCompareRootCategories({
          forceRefresh: true,
          allowStale: true,
        })) ?? [];

      const resolvedNodes =
        freshNodes.length > 0
          ? buildGroupedRootCategoryNodes(freshNodes)
          : await loadSeededRootCategories();

      setCategoryNodes(resolvedNodes);
      setExpandedCategoryKeys([]);
      setLoadedCategoryBranchIds([CATEGORY_ROOT_KEY]);
    } catch (error) {
      console.warn('[PriceCompareScreen] category root load failed:', error);

      if (!usedWarmNodes) {
        setCategoryNodes([]);
        setExpandedCategoryKeys([]);
        setLoadedCategoryBranchIds([]);
        setCategoryTreeError(
          tt(
            'price_compare_category_tree_error',
            'Market reyonları şu anda yüklenemedi. Aramaya yine de devam edebilirsin.'
          )
        );
      }
    } finally {
      setCategoryTreeLoading(false);
    }
  }, [loadSeededRootCategories, marketRuntime.isEnabled, tt]);

  useEffect(() => {
    void loadRootCategories();
  }, [loadRootCategories]);

  const loadCategoryChildren = useCallback(
    async (rootCategoryId: string) => {
      if (
        !marketRuntime.isEnabled ||
        isSyntheticCategoryId(rootCategoryId) ||
        loadedCategoryBranchIds.includes(rootCategoryId)
      ) {
        return;
      }

      setCategoryLoadingKeys((previous) =>
        previous.includes(rootCategoryId) ? previous : [...previous, rootCategoryId]
      );

      try {
        const response = await resolveWithin(
          fetchMarketCategoryTree({
            cityCode: cityCode ?? undefined,
            rootCategoryId,
            depthLimit: 1,
            includeCounts: false,
            onlyActive: true,
          }),
          REMOTE_CATEGORY_TREE_TIMEOUT_MS
        );

        mergeCategoryNodes(response.nodes);
        setLoadedCategoryBranchIds((previous) =>
          previous.includes(rootCategoryId) ? previous : [...previous, rootCategoryId]
        );
      } catch (error) {
        console.warn('[PriceCompareScreen] category child load failed:', error);
      } finally {
        setCategoryLoadingKeys((previous) =>
          previous.filter((item) => item !== rootCategoryId)
        );
      }
    },
    [cityCode, loadedCategoryBranchIds, marketRuntime.isEnabled, mergeCategoryNodes]
  );

  const toggleCategoryNode = useCallback(
    (key: string) => {
      setExpandedCategoryKeys((previous) => {
        if (previous.includes(key)) {
          return previous.filter((item) => item !== key);
        }

        return [...previous, key];
      });

      void loadCategoryChildren(key);
    },
    [loadCategoryChildren]
  );

  const handleSearch = useCallback(async (
    categoryIdOverride?: string | null,
    queryOverride?: string
  ) => {
    const trimmedQuery = (queryOverride ?? query).trim();
    const effectiveCategoryId =
      categoryIdOverride === undefined ? selectedCategoryId : categoryIdOverride;
    const isCategoryBrowseMode =
      Boolean(effectiveCategoryId) && trimmedQuery.length < SEARCH_MIN_LENGTH;
    const effectiveQuery = trimmedQuery;

    if (effectiveQuery.length < SEARCH_MIN_LENGTH && !isCategoryBrowseMode) {
      setHasSearched(false);
      setSelectedCategoryId(effectiveCategoryId ?? null);
      setResults([]);
      setResultsNextCursor(null);
      setResultsBrowseCategoryId(null);
      setSelectedProduct(null);
      setOffersResponse(null);
      priceHistoryRequestRef.current += 1;
      setPriceHistoryResponse(null);
      setPriceHistoryError(null);
      setPriceHistoryLoading(false);
      setSearchError(
        tt(
          'price_compare_search_validation',
          'Lütfen en az 2 karakterlik barkod veya ürün adı girin.'
        )
      );
      return;
    }

    setSearchLoading(true);
    setSearchError(null);
    setHasSearched(true);
    setAutocompleteResults([]);
    setSelectedProduct(null);
    setOffersResponse(null);
    setOffersError(null);
    priceHistoryRequestRef.current += 1;
    setPriceHistoryResponse(null);
    setPriceHistoryError(null);
    setPriceHistoryLoading(false);
    setResultsNextCursor(null);
    setResultsBrowseCategoryId(null);

    try {
      const resolvedResults = isCategoryBrowseMode && effectiveCategoryId
        ? await loadCategoryBrowsePage(effectiveCategoryId, 0)
        : {
            results: await searchProducts(
              isCategoryBrowseMode ? '' : effectiveQuery,
              SEARCH_RESULTS_FETCH_LIMIT,
              'search',
              effectiveCategoryId
            ),
            nextCursor: null as number | null,
          };

      setResults(resolvedResults.results);
      setResultsPage(1);
      setResultsNextCursor(resolvedResults.nextCursor ?? null);
      setResultsBrowseCategoryId(isCategoryBrowseMode ? effectiveCategoryId : null);

      if (
        !isCategoryBrowseMode &&
        (resolvedResults.results.length === 1 || isBarcodeLikeQuery(effectiveQuery))
      ) {
        const exactMatch =
          resolvedResults.results.find((item) => item.barcode === effectiveQuery) ??
          resolvedResults.results[0];

        if (exactMatch) {
          void loadOffers(exactMatch);
        }
      }
    } catch (error) {
      console.error('[PriceCompareScreen] search failed:', error);
      setResults([]);
      setResultsNextCursor(null);
      setResultsBrowseCategoryId(null);
      setSearchError(
        tt(
          'price_compare_results_error',
          'Ürün araması şu anda yapılamadı. Daha sonra tekrar deneyin.'
        )
      );
    } finally {
      setSearchLoading(false);
    }
  }, [loadCategoryBrowsePage, loadOffers, query, searchProducts, selectedCategoryId, tt]);

  const handleResultsPageChange = useCallback(
    async (targetPage: number) => {
      const safeTargetPage = Math.max(1, Math.min(totalResultsPages, targetPage));

      if (safeTargetPage <= loadedResultsPages) {
        setResultsPage(safeTargetPage);
        return;
      }

      if (
        resultsPaginationLoading ||
        !resultsBrowseCategoryId ||
        resultsNextCursor == null
      ) {
        setResultsPage(Math.min(safeTargetPage, loadedResultsPages));
        return;
      }

      setResultsPaginationLoading(true);

      try {
        const response = await loadCategoryBrowsePage(resultsBrowseCategoryId, resultsNextCursor);

        if (response.results.length > 0) {
          setResults((previous) => dedupeSearchProducts([...previous, ...response.results]));
          setResultsNextCursor(response.nextCursor ?? null);
          setResultsPage(safeTargetPage);
          return;
        }

        setResultsNextCursor(null);
      } catch (error) {
        console.warn('[PriceCompareScreen] results page load failed:', error);
      } finally {
        setResultsPaginationLoading(false);
      }
    },
    [
      loadCategoryBrowsePage,
      loadedResultsPages,
      resultsBrowseCategoryId,
      resultsNextCursor,
      resultsPaginationLoading,
      totalResultsPages,
    ]
  );

  const resolveComparableProduct = useCallback(
    async (product: MarketSearchProduct): Promise<MarketSearchProduct> => {
      if (product.barcode) {
        return product;
      }

      if (!product.productId) {
        return product;
      }

      try {
        const inferredBarcode = await resolveWithin(
          resolveReferenceBarcodeForMarketProduct(product),
          REMOTE_SEARCH_TIMEOUT_MS
        );

        if (!inferredBarcode) {
          return product;
        }

        const enrichedProduct = {
          ...product,
          barcode: inferredBarcode,
        };

        setResults((previous) =>
          previous.map((item) =>
            getProductIdentity(item) === getProductIdentity(product) ? enrichedProduct : item
          )
        );

        return enrichedProduct;
      } catch (error) {
        console.warn('[PriceCompareScreen] comparable product resolve failed:', error);
        return product;
      }
    },
    []
  );

  const handleSelectProduct = useCallback(
    async (product: MarketSearchProduct) => {
      setQuery(product.productName);
      setSelectedCategoryId(product.normalizedCategoryId ?? null);
      setHasSearched(true);
      setResults((previous) => {
        const hasProduct = previous.some((item) => getProductIdentity(item) === getProductIdentity(product));
        return hasProduct ? previous : [product, ...previous];
      });
      setAutocompleteResults([]);
      const resolvedProduct =
        hasComparableBarcode(product) || hasComparableProductId(product)
          ? product
          : await resolveComparableProduct(product);
      await loadOffers(resolvedProduct);
    },
    [loadOffers, resolveComparableProduct]
  );

  const handleOpenPricingFromResult = useCallback(
    async (product: MarketSearchProduct) => {
      const resolvedProduct =
        hasComparableBarcode(product) || hasComparableProductId(product)
          ? product
          : await resolveComparableProduct(product);
      await loadOffers(resolvedProduct);
    },
    [loadOffers, resolveComparableProduct]
  );

  const handleOpenScoreFromResult = useCallback(
    async (product: MarketSearchProduct) => {
      const resolvedProduct = await resolveComparableProduct(product);

      if (resolvedProduct.barcode) {
        navigation.navigate('Detail', {
          barcode: resolvedProduct.barcode,
          entrySource: 'unknown',
          lookupMode: 'auto',
        });
        return;
      }

      await loadOffers(resolvedProduct);
    },
    [loadOffers, navigation, resolveComparableProduct]
  );

  const handleQuickAddFromResult = useCallback(
    async (product: MarketSearchProduct) => {
      const resolvedProduct =
        hasComparableBarcode(product) || hasComparableProductId(product)
          ? product
          : await resolveComparableProduct(product);
      const identity = getProductIdentity(resolvedProduct);
      const cartFallbackResponse =
        buildCartFallbackOffersResponseFromSearchProduct(resolvedProduct);

      if (!resolvedProduct.barcode && !resolvedProduct.productId) {
        setSelectedProduct(resolvedProduct);
        setOffersResponse(null);
        setOffersError(
          tt(
            'price_compare_quick_add_requires_live_offer',
            'Bu ürün önce canlı tekliflerle yüklenmeli. Fiyatlarını açıp tekrar deneyebilirsin.'
          )
        );
        return;
      }

      setQuickAddLoadingId(identity);

      try {
        if (!cartFallbackResponse) {
          setOffersError(
            tt(
              'price_compare_selected_no_live_offers',
              'Bu ürün için henüz canlı market teklifi bulunamadı.'
            )
          );
          return;
        }

        addOrIncrementEntry(resolvedProduct, cartFallbackResponse);

        if (!cartFallbackResponse.offers.length) {
          setOffersError(
            tt(
              'price_compare_cart_added_without_live_offers',
              'Ürün sepete eklendi. Canlı market teklifleri yüklenince fiyat karşılaştırması otomatik dolacak.'
            )
          );
        }

        void fetchComprehensiveOffersForProduct(resolvedProduct)
          .then((response) => {
            if (response?.offers.length) {
              updateEntryOffers(resolvedProduct, response);
            }
          })
          .catch((error) => {
            console.warn('[PriceCompareScreen] quick add enrichment failed:', error);
          });
      } catch (error) {
        console.warn('[PriceCompareScreen] quick add failed:', error);
        setOffersError(
          tt(
            'price_compare_offers_error',
            'Seçilen ürün için market teklifleri şu anda yüklenemedi.'
          )
        );
      } finally {
        setQuickAddLoadingId((current) => (current === identity ? null : current));
      }
    },
    [
      addOrIncrementEntry,
      fetchComprehensiveOffersForProduct,
      resolveComparableProduct,
      tt,
      updateEntryOffers,
    ]
  );

  const handleToggleFavoriteFromResult = useCallback(
    async (product: MarketSearchProduct) => {
      const resolvedProduct = await resolveComparableProduct(product);
      const favoriteKey = getPriceCompareFavoriteKey(resolvedProduct);

      if (!favoriteKey) {
        return;
      }

      const nextFavoriteState = await togglePriceCompareFavorite(resolvedProduct);
      const barcode = String(resolvedProduct.barcode || '').trim();

      if (barcode) {
        const currentlyFavoriteInDb = isFavoriteBarcode(barcode);

        if (nextFavoriteState && !currentlyFavoriteInDb) {
          addFavoriteBarcode(barcode);
        }

        if (!nextFavoriteState && currentlyFavoriteInDb) {
          removeFavoriteBarcode(barcode);
        }
      }

      setFavoriteKeys((previous) =>
        nextFavoriteState
          ? [favoriteKey, ...previous.filter((item) => item !== favoriteKey)]
          : previous.filter((item) => item !== favoriteKey)
      );
      setFavoriteProductsByKey((previous) => {
        const existing = previous[favoriteKey];
        const merged = existing ? mergeSearchProductDetails(existing, resolvedProduct) : resolvedProduct;

        if (existing === merged) {
          return previous;
        }

        const next = {
          ...previous,
          [favoriteKey]: merged,
        };

        if (!nextFavoriteState) {
          delete next[favoriteKey];
        }

        return next;
      });
    },
    [resolveComparableProduct]
  );

  const handleAddSelectedToCart = useCallback(() => {
    const effectiveResponse =
      offersResponse ??
      (selectedProduct ? buildCartFallbackOffersResponseFromSearchProduct(selectedProduct) : null);

    if (!selectedProduct || !effectiveResponse) {
      return;
    }

    addOrIncrementEntry(selectedProduct, effectiveResponse);
  }, [addOrIncrementEntry, offersResponse, selectedProduct]);

  useEffect(() => {
    if (
      !locationPermissionGranted ||
      canonicalProfileCity ||
      detectedLocationLoading ||
      detectedLocationResolved
    ) {
      return;
    }

    let isActive = true;

    const hydrateDetectedLocation = async () => {
      setDetectedLocationLoading(true);

      try {
        const snapshot = await getCurrentLocationContext();

        if (isActive) {
          setDetectedLocation(snapshot);
          setDetectedLocationResolved(true);
        }
      } catch (error) {
        console.warn('[PriceCompareScreen] current location resolve failed:', error);
        if (isActive) {
          setDetectedLocationResolved(true);
        }
      } finally {
        if (isActive) {
          setDetectedLocationLoading(false);
        }
      }
    };

    void hydrateDetectedLocation();

    return () => {
      isActive = false;
    };
  }, [
    canonicalProfileCity,
    detectedLocationLoading,
    detectedLocationResolved,
    locationPermissionGranted,
  ]);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < SEARCH_MIN_LENGTH) {
      setAutocompleteResults([]);
      setAutocompleteLoading(false);
      return;
    }

    let isActive = true;
    setAutocompleteLoading(true);

    const timeoutId = setTimeout(() => {
      void (async () => {
        try {
          const response = await searchProducts(trimmedQuery, 6, 'autocomplete');

          if (isActive) {
            setAutocompleteResults(response);
          }
        } catch (error) {
          if (isActive) {
            console.warn('[PriceCompareScreen] autocomplete search failed:', error);
            setAutocompleteResults([]);
          }
        } finally {
          if (isActive) {
            setAutocompleteLoading(false);
          }
        }
      })();
    }, 280);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [query, searchProducts]);

  useEffect(() => {
    const initialQuery = route.params?.initialQuery?.trim();

    if (!initialQuery) {
      return;
    }

    const queryToken = `${route.params?.initialQueryNonce ?? 'initial'}:${initialQuery}`;

    if (appliedInitialQueryRef.current === queryToken) {
      return;
    }

    appliedInitialQueryRef.current = queryToken;
    setQuery(initialQuery);
    setSelectedCategoryId(null);
    setCategoryTreeCollapsed(false);
    setAutocompleteResults([]);
    void handleSearch(null, initialQuery);
  }, [
    handleSearch,
    route.params?.initialQuery,
    route.params?.initialQueryNonce,
    route.params?.initialQuerySource,
  ]);

  const selectedEffectiveOffersResponse = useMemo(
    () =>
      offersResponse ??
      (selectedProduct ? buildCartFallbackOffersResponseFromSearchProduct(selectedProduct) : null),
    [offersResponse, selectedProduct]
  );

  const offerItems = useMemo(
    () => normalizeOffersForDisplay(selectedEffectiveOffersResponse?.offers ?? [], { cityCode }),
    [cityCode, selectedEffectiveOffersResponse]
  );

  const sortedOffers = useMemo(() => {
    const rankByType = (offer: MarketOffer): number => {
      if (offer.priceSourceType === 'local_market_price') return 0;
      if (offer.priceSourceType === 'national_reference_price') return 1;
      return 2;
    };

    return [...offerItems].sort((left, right) => {
      if (left.inStock !== right.inStock) {
        return Number(right.inStock) - Number(left.inStock);
      }

      const typeRank = rankByType(left) - rankByType(right);

      if (typeRank !== 0) {
        return typeRank;
      }

      return left.price - right.price;
    });
  }, [offerItems]);

  const pricingTableProductType = useMemo(() => {
    return inferMarketDisplayProductType(
      offerItems.flatMap((offer) => [offer.marketKey, offer.marketName])
    );
  }, [offerItems]);

  const pricingSubtitle = useMemo(() => {
    if (!selectedProduct) {
      return null;
    }

    if (offerItems.length) {
      return tt('market_pricing_offer_count', '{{location}} için {{count}} güncel teklif bulundu.')
        .replace('{{location}}', locationLabel || tt('location', 'Konum'))
        .replace('{{count}}', String(offerItems.length));
    }

    return tt(
      'price_compare_market_list_subtitle',
      'Seçilen ürün için market teklifleri burada sıralanır.'
    );
  }, [locationLabel, offerItems.length, selectedProduct, tt]);

  const selectedBestOffer = useMemo(() => {
    return getBestInStockOffer(offerItems.filter((offer) => offer.inStock));
  }, [offerItems]);

  const selectedDisplayProductName = useMemo(
    () => (selectedProduct ? toDisplayProductName(selectedProduct.productName) : ''),
    [selectedProduct]
  );

  const selectedDisplayBrand = useMemo(
    () => (selectedProduct?.brand ? toDisplayProductName(selectedProduct.brand) : null),
    [selectedProduct]
  );

  const selectedDisplayCategory = useMemo(
    () => (selectedProduct?.category ? toDisplayProductName(selectedProduct.category) : null),
    [selectedProduct]
  );

  const selectedDetailBarcode = useMemo(
    () => selectedProduct?.barcode ?? selectedReferenceProduct?.barcode ?? null,
    [selectedProduct?.barcode, selectedReferenceProduct?.barcode]
  );

  const selectedScorePreview = useMemo(
    () =>
      typeof selectedReferenceProduct?.score === 'number'
        ? Math.round(selectedReferenceProduct.score)
        : null,
    [selectedReferenceProduct?.score]
  );

  const weeklyPriceHistory = useMemo(
    () => buildWeeklyPriceHistory(priceHistoryResponse?.history ?? [], preferredLocale, 8),
    [preferredLocale, priceHistoryResponse?.history]
  );

  const cartItemCount = useMemo(
    () => comparisonCart.reduce((sum, entry) => sum + Math.max(1, entry.quantity), 0),
    [comparisonCart]
  );

  const selectedProductCartQuantity = useMemo(
    () =>
      selectedProduct
        ? comparisonCart.find(
            (entry) => getProductIdentity(entry.product) === getProductIdentity(selectedProduct)
          )?.quantity ?? 0
        : 0,
    [comparisonCart, selectedProduct]
  );

  const marketSheetDetails = useMemo(() => {
    if (!marketSheetState) {
      return null;
    }

    if (marketSheetState.kind === 'offer') {
      const { offer } = marketSheetState;
      const details = [
        {
          key: 'price',
          label: tt('price_compare_market_sheet_price', 'Fiyat'),
          value: formatLocalizedPrice(preferredLocale, offer.price, offer.currency),
        },
        typeof offer.unitPrice === 'number' && offer.unitPriceUnit
          ? {
              key: 'unit',
              label: tt('price_compare_market_sheet_unit_price', 'Birim fiyat'),
              value: tt('market_pricing_unit_price_template', '{{price}} / {{unit}}')
                .replace(
                  '{{price}}',
                  formatLocalizedPrice(preferredLocale, offer.unitPrice, offer.currency)
                )
                .replace('{{unit}}', offer.unitPriceUnit),
            }
          : null,
        {
          key: 'stock',
          label: tt('price_compare_market_sheet_stock', 'Durum'),
          value: offer.inStock
            ? tt('price_compare_stock_in', 'Stokta')
            : tt('price_compare_stock_out', 'Stokta değil'),
        },
        formatDistanceMeters(tt, offer.distanceMeters)
          ? {
              key: 'distance',
              label: tt('price_compare_market_sheet_distance', 'Mesafe'),
              value: formatDistanceMeters(tt, offer.distanceMeters) ?? '',
            }
          : null,
        offer.branchName
          ? {
              key: 'branch',
              label: tt('price_compare_market_sheet_branch', 'Şube'),
              value: offer.branchName,
            }
          : null,
        offer.districtName
          ? {
              key: 'district',
              label: tt('price_compare_market_sheet_district', 'İlçe'),
              value: offer.districtName,
            }
          : null,
        offer.cityName
          ? {
              key: 'city',
              label: tt('price_compare_market_sheet_city', 'Şehir'),
              value: offer.cityName,
            }
          : null,
        {
          key: 'source',
          label: tt('price_compare_market_sheet_type', 'Fiyat tipi'),
          value: getOfferToneLabel(tt, offer),
        },
      ].filter(Boolean) as { key: string; label: string; value: string }[];

      return {
        title: offer.marketName,
        subtitle:
          [offer.branchName, offer.districtName, offer.cityName].filter(Boolean).join(' • ') ||
          tt('price_compare_market_sheet_subtitle', 'Market detayı'),
        logoUrl: offer.marketLogoUrl,
        marketKey: offer.marketKey,
        canOpenSource: Boolean(offer.sourceUrl),
        canOpenMap:
          typeof offer.latitude === 'number' && typeof offer.longitude === 'number',
        details,
      };
    }

    return null;
  }, [marketSheetState, preferredLocale, tt]);

  const handleOpenMarketSource = useCallback(async () => {
    if (marketSheetState?.kind !== 'offer' || !marketSheetState.offer.sourceUrl) {
      return;
    }

    try {
      const supported = await Linking.canOpenURL(marketSheetState.offer.sourceUrl);

      if (supported) {
        await Linking.openURL(marketSheetState.offer.sourceUrl);
      }
    } catch (error) {
      console.warn('[PriceCompareScreen] source url open failed:', error);
    }
  }, [marketSheetState]);

  const handleOpenMarketMap = useCallback(async () => {
    const latitude =
      marketSheetState?.kind === 'offer' ? marketSheetState.offer.latitude : null;
    const longitude =
      marketSheetState?.kind === 'offer' ? marketSheetState.offer.longitude : null;

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

    try {
      const supported = await Linking.canOpenURL(url);

      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.warn('[PriceCompareScreen] market map open failed:', error);
    }
  }, [marketSheetState]);

  const handleOpenBasketScreen = useCallback(() => {
    void adService.prepareInterstitial();
    navigation.navigate('PriceCompareBasket');
  }, [navigation]);

  const handleOpenMarketBulletins = useCallback(() => {
    navigation.navigate('MarketBulletins');
  }, [navigation]);

  const handleOpenBarcodeScanner = useCallback(() => {
    setAutocompleteResults([]);
    navigation.navigate('Scanner', { returnTo: 'PriceCompare' });
  }, [navigation]);

  useEffect(() => {
    if (!selectedCategoryId || !hasSearched || searchLoading || !results.length) {
      return;
    }

    const timeoutId = setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(resultsSectionOffsetRef.current - 18, 0),
        animated: true,
      });
    }, 180);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [hasSearched, results.length, searchLoading, selectedCategoryId]);

  useEffect(() => {
    if (!selectedProduct || offersLoading) {
      return;
    }

    const timeoutId = setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(selectedSectionOffsetRef.current - 18, 0),
        animated: true,
      });
    }, 180);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [offersLoading, selectedProduct]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AmbientBackdrop colors={colors} variant="settings" />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: layout.headerTopPadding,
          paddingBottom: layout.contentBottomPadding + 92,
          paddingHorizontal: layout.horizontalPadding,
        }}
      >
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: isDark ? '#447B22' : '#63AE2E',
              borderColor: 'rgba(255,255,255,0.10)',
              shadowColor: colors.shadow,
            },
          ]}
        >
          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.heroEyebrow}>
                {tt('price_compare_hero_eyebrow', 'Canlı Fiyat')}
              </Text>
              <Text style={styles.headerTitle}>
                {tt('price_compare_screen_title', 'Market bazında fiyat kıyasla')}
              </Text>
              <Text style={styles.headerSubtitle}>
                {tt(
                  'price_compare_screen_subtitle',
                  'Barkod veya ürün adıyla arama yap, ardından market tekliflerini tek ekranda karşılaştır.'
                )}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handleOpenBasketScreen}
              style={[
                styles.cartIconButton,
                {
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  borderColor: 'rgba(255,255,255,0.18)',
                },
              ]}
            >
              <Ionicons name="basket-outline" size={22} color="#FFFFFF" />
              {cartItemCount ? (
                <View
                  style={[
                    styles.cartBadge,
                    {
                      backgroundColor: colors.primary,
                      borderColor: '#63AE2E',
                    },
                  ]}
                >
                  <Text style={[styles.cartBadgeText, { color: colors.primaryContrast }]}>
                    {cartItemCount > 99 ? '99+' : String(cartItemCount)}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </View>

          <View style={styles.locationPillRow}>
            <View
              style={[
                styles.locationPill,
                { backgroundColor: 'rgba(255,255,255,0.12)' },
              ]}
            >
              <Ionicons name="location-outline" size={14} color="#FFFFFF" />
              <Text style={styles.locationPillText}>
                {locationLabel ||
                  tt('price_compare_location_missing', 'Konum eklenmedi')}
              </Text>
            </View>
            <View
              style={[
                styles.locationPill,
                { backgroundColor: 'rgba(255,255,255,0.12)' },
              ]}
            >
              <Ionicons name="basket-outline" size={14} color="#FFFFFF" />
              <Text style={styles.locationPillText}>
                {tt('price_compare_cart_count_summary', '{{count}} ürün').replace(
                  '{{count}}',
                  String(cartItemCount)
                )}
              </Text>
            </View>
          </View>
        </View>

        {!cityCode ? (
          <InfoActionCard
            title={tt(
              'price_compare_missing_location_title',
              'Yerel market kıyaslaması için konum ekle'
            )}
            subtitle={tt(
              'price_compare_missing_location_subtitle',
              'Profiline şehir ve ilçe eklediğinde bulunduğun ildeki market fiyatlarını daha doğru karşılaştıracağız.'
            )}
            onPress={() => navigation.navigate('ProfileSettings')}
            colors={colors}
          />
        ) : null}

        {!marketRuntime.isEnabled ? (
          <View style={styles.runtimeNoticeWrap}>
            <NoticeCard
              text={tt(
                'price_compare_service_unavailable_notice',
                'Market fiyatları şu anda yüklenemiyor. Lütfen biraz sonra tekrar deneyin.'
              )}
              colors={colors}
            />
          </View>
        ) : null}

        <TouchableOpacity
          activeOpacity={0.88}
          onPress={handleOpenMarketBulletins}
          style={[
            styles.catalogShortcutCard,
            {
              backgroundColor: withAlpha(colors.card, 'FC'),
              borderColor: withAlpha(colors.border, '66'),
            },
          ]}
        >
          <View
            style={[
              styles.catalogShortcutIcon,
              { backgroundColor: withAlpha(colors.primary, '14') },
            ]}
          >
            <Ionicons name="newspaper-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.catalogShortcutTextWrap}>
            <Text style={[styles.catalogShortcutTitle, { color: colors.text }]}>
              {tt('price_compare_bulletins_shortcut_title', 'Aktüel kataloglar')}
            </Text>
            <Text
              style={[styles.catalogShortcutSubtitle, { color: colors.mutedText }]}
              numberOfLines={1}
            >
              {tt(
                'price_compare_bulletins_shortcut_subtitle',
                'Market kampanyalarını ve katalog ürünlerini görüntüle'
              )}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={19} color={colors.mutedText} />
        </TouchableOpacity>

        <View
          style={[
            styles.searchCard,
            {
              backgroundColor: withAlpha(colors.card, 'FC'),
              borderColor: withAlpha(colors.border, '66'),
            },
          ]}
        >
          <Text style={[styles.searchLabel, { color: colors.text }]}>
            {tt('price_compare_search_label', 'Barkod veya ürün adı')}
          </Text>
          <View style={styles.searchInputRow}>
            <TextInput
              value={query}
              onChangeText={(value) => {
                setQuery(value);
                setSelectedCategoryId(null);
                setCategoryTreeCollapsed(false);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={tt(
                'price_compare_search_placeholder',
                'Örn. 8690570012345 veya süt'
              )}
              placeholderTextColor={`${colors.text}55`}
              style={[
                styles.searchInput,
                {
                  color: colors.text,
                  borderColor: withAlpha(colors.border, 'C8'),
                  backgroundColor: withAlpha(colors.backgroundMuted, isDark ? 'D4' : 'F5'),
                },
              ]}
              onSubmitEditing={() => {
                void handleSearch();
              }}
            />
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handleOpenBarcodeScanner}
              style={[
                styles.searchScanButton,
                {
                  borderColor: withAlpha(colors.border, 'C8'),
                  backgroundColor: withAlpha(colors.backgroundMuted, isDark ? 'D4' : 'F5'),
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={tt(
                'price_compare_scan_barcode_button_label',
                'Barkod tarayarak fiyat araması yap'
              )}
            >
              <Ionicons name="barcode-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => {
                void handleSearch();
              }}
              disabled={searchLoading}
              style={[
                styles.searchButton,
                { backgroundColor: colors.primary, opacity: searchLoading ? 0.7 : 1 },
              ]}
            >
              {searchLoading ? (
                <ActivityIndicator size="small" color={colors.primaryContrast} />
              ) : (
                <Ionicons name="search-outline" size={18} color={colors.primaryContrast} />
              )}
            </TouchableOpacity>
          </View>
          <Text style={[styles.searchHint, { color: colors.mutedText }]}>
            {tt(
              'price_compare_search_hint',
              'Aynı ürün için farklı marketlerdeki fiyatları ve referans teklifleri karşılaştır.'
            )}
          </Text>

          {query.trim().length >= 2 ? (
            <View
              style={[
                styles.autocompleteWrap,
                {
                  backgroundColor: withAlpha(colors.card, 'F8'),
                  borderColor: withAlpha(colors.border, 'BC'),
                },
              ]}
            >
              {autocompleteLoading ? (
                <View style={styles.autocompleteLoadingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : autocompleteResults.length ? (
                autocompleteResults.map((item) => (
                  <TouchableOpacity
                    key={`autocomplete-${item.id}`}
                    activeOpacity={0.88}
                    onPress={() => {
                      void handleSelectProduct(item);
                    }}
                    style={[
                      styles.autocompleteRow,
                      { borderBottomColor: withAlpha(colors.border, '7A') },
                    ]}
                  >
                    <MarketBadge
                      marketKey={item.bestOffer?.marketKey}
                      marketName={item.bestOffer?.marketName || item.brand || item.productName}
                      logoUrl={item.bestOffer?.marketLogoUrl || item.marketLogoUrl}
                      size={30}
                    />
                    <View style={styles.autocompleteTextWrap}>
                      <Text style={[styles.autocompleteTitle, { color: colors.text }]}>
                        {item.productName}
                      </Text>
                      <Text
                        style={[styles.autocompleteMeta, { color: colors.mutedText }]}
                        numberOfLines={1}
                      >
                        {[item.brand, item.barcode].filter(Boolean).join(' • ')}
                      </Text>
                    </View>
                    {item.bestOffer ? (
                      <Text style={[styles.autocompletePrice, { color: colors.primary }]}>
                        {formatLocalizedPrice(
                          preferredLocale,
                          item.bestOffer.price,
                          item.bestOffer.currency
                        )}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ))
              ) : null}
            </View>
          ) : null}
        </View>

        {searchError ? <NoticeCard text={searchError} colors={colors} /> : null}

        {categoryTreeLoading ? (
          <View
            style={[
              styles.loadingCard,
              {
                backgroundColor: withAlpha(colors.card, 'FC'),
                borderColor: withAlpha(colors.border, '66'),
                marginBottom: 14,
              },
            ]}
          >
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : null}

        {!categoryTreeLoading && categoryTreeError && !categoryTreeUsesResultsFallback ? (
          <NoticeCard text={categoryTreeError} colors={colors} />
        ) : null}

        {!categoryTreeLoading && categoryTreeUsesResultsFallback ? (
          <NoticeCard
            text={tt(
              'price_compare_category_tree_fallback',
              'Canli reyon agaci geciktigi icin arama sonuclarindan kategori filtresi olusturuldu.'
            )}
            colors={colors}
          />
        ) : null}

        {!categoryTreeLoading && categoryTree.length ? (
          <SearchCategoryTreeSection
            nodes={categoryTree}
            selectedCategoryId={selectedCategoryId}
            selectedCategoryLabel={selectedCategoryLabel}
            expandedKeys={expandedCategoryKeys}
            loadingKeys={categoryLoadingKeys}
            collapsed={categoryTreeCollapsed}
            isDark={isDark}
            onToggleCollapsed={() => {
              setCategoryTreeCollapsed((current) => !current);
            }}
            onToggle={toggleCategoryNode}
            onSelect={(categoryId) => {
              if (categoryId && isSyntheticCategoryId(categoryId)) {
                return;
              }

              setSelectedCategoryId(categoryId);
              setCategoryTreeCollapsed(Boolean(categoryId));
              if (query.trim().length >= SEARCH_MIN_LENGTH || Boolean(categoryId)) {
                void handleSearch(categoryId);
              } else {
                setHasSearched(false);
                setResults([]);
                setSelectedProduct(null);
                setOffersResponse(null);
                setOffersError(null);
              }
            }}
            colors={colors}
            tt={tt}
          />
        ) : null}

        {hasSearched ? (
          <View
            onLayout={(event) => {
              resultsSectionOffsetRef.current = event.nativeEvent.layout.y;
            }}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {tt('price_compare_results_title', 'Arama Sonuçları')}
            </Text>

            {searchLoading ? (
              <View
                style={[
                  styles.loadingCard,
                  {
                    backgroundColor: withAlpha(colors.card, 'FC'),
                    borderColor: withAlpha(colors.border, '66'),
                  },
                ]}
              >
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : results.length ? (
              <>
                <View
                  style={[
                    styles.resultsGridWrap,
                    {
                      backgroundColor: withAlpha(colors.card, isDark ? 'E8' : 'F8'),
                      borderColor: withAlpha(colors.border, '5A'),
                    },
                  ]}
                >
                  <View style={styles.resultsGrid}>
                    {pagedResults.map((item) => (
                      <SearchResultCard
                        key={getProductIdentity(item)}
                        item={item}
                        selected={
                          selectedProduct ? getProductIdentity(selectedProduct) === getProductIdentity(item) : false
                        }
                        isFavorite={Boolean(
                          getPriceCompareFavoriteKey(item) &&
                            favoriteKeySet.has(getPriceCompareFavoriteKey(item)!)
                        )}
                        onOpenPricing={() => {
                          void handleOpenPricingFromResult(item);
                        }}
                        onOpenScore={() => {
                          void handleOpenScoreFromResult(item);
                        }}
                        onQuickAdd={() => {
                          void handleQuickAddFromResult(item);
                        }}
                        onToggleFavorite={() => {
                          void handleToggleFavoriteFromResult(item);
                        }}
                        quickAddDisabled={!canQuickAddSearchProduct(item)}
                        quickAddLoading={quickAddLoadingId === getProductIdentity(item)}
                        cardWidth={resultCardWidth}
                        colors={colors}
                        isDark={isDark}
                        locale={preferredLocale}
                        tt={tt}
                      />
                    ))}
                  </View>
                </View>
                {totalResultsPages > 1 ? (
                  <View
                    style={[
                      styles.resultsPaginationRow,
                      { borderTopColor: withAlpha(colors.border, '8F') },
                    ]}
                  >
                    <TouchableOpacity
                      activeOpacity={0.88}
                      onPress={() => {
                        void handleResultsPageChange(resultsPage - 1);
                      }}
                      disabled={resultsPage === 1}
                      style={[
                        styles.resultsPaginationButton,
                        {
                          borderColor: withAlpha(colors.border, '9A'),
                          backgroundColor: withAlpha(colors.cardElevated, 'FA'),
                          opacity: resultsPage === 1 ? 0.45 : 1,
                        },
                      ]}
                    >
                      <Ionicons name="chevron-back" size={14} color={colors.text} />
                    </TouchableOpacity>

                    {visibleResultsPageNumbers.map((pageNumber) => {
                      const isActive = pageNumber === resultsPage;

                      return (
                        <TouchableOpacity
                          key={`result-page-${pageNumber}`}
                          activeOpacity={0.88}
                          onPress={() => {
                            void handleResultsPageChange(pageNumber);
                          }}
                          style={[
                            styles.resultsPaginationButton,
                            {
                              borderColor: withAlpha(isActive ? colors.primary : colors.border, '9A'),
                              backgroundColor: withAlpha(
                                isActive ? colors.primary : colors.cardElevated,
                                isActive ? '18' : 'FA'
                              ),
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.resultsPaginationButtonText,
                              { color: isActive ? colors.primary : colors.text },
                            ]}
                          >
                            {pageNumber}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}

                    <TouchableOpacity
                      activeOpacity={0.88}
                      onPress={() => {
                        void handleResultsPageChange(resultsPage + 1);
                      }}
                      disabled={resultsPage === totalResultsPages}
                      style={[
                        styles.resultsPaginationButton,
                        {
                          borderColor: withAlpha(colors.border, '9A'),
                          backgroundColor: withAlpha(colors.cardElevated, 'FA'),
                          opacity: resultsPage === totalResultsPages ? 0.45 : 1,
                        },
                      ]}
                    >
                      <Ionicons name="chevron-forward" size={14} color={colors.text} />
                    </TouchableOpacity>
                    {resultsPaginationLoading ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.primary}
                        style={styles.resultsPaginationSpinner}
                      />
                    ) : null}
                  </View>
                ) : null}
                <AdBanner
                  visible={results.length > 0 && !searchLoading}
                  placement="price_compare_results"
                  containerStyle={styles.resultsAdBanner}
                />
              </>
            ) : (
              <NoticeCard
                text={tt(
                  'price_compare_results_empty',
                  'Bu sorgu için karşılaştırılabilir ürün bulunamadı.'
                )}
                colors={colors}
              />
            )}
          </View>
        ) : null}

        {favoriteProducts.length ? (
          <View style={styles.favoriteStripSection}>
            <View style={styles.favoriteStripHeader}>
              <View style={styles.favoriteStripHeaderText}>
                <Text style={[styles.sectionTitle, styles.favoriteStripTitleHeading, { color: colors.text }]}>
                  {tt('favorite_products', 'Favoriler')}
                </Text>
                <Text style={[styles.savedListsHelper, { color: colors.mutedText }]}>
                  {tt(
                    'favorite_products_subtitle',
                    'Sık baktığın ürünleri buradan hızlı aç.'
                  )}
                </Text>
              </View>
              <View
                style={[
                  styles.favoriteStripCountPill,
                  { backgroundColor: withAlpha(colors.primary, '12') },
                ]}
              >
                <Text style={[styles.favoriteStripCountText, { color: colors.primary }]}>
                  {favoriteProducts.length}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.favoriteStripWrap,
                {
                  backgroundColor: withAlpha(colors.cardElevated, isDark ? '8C' : '72'),
                  borderColor: withAlpha(colors.border, '62'),
                },
              ]}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.favoriteStripScrollContent}
              >
                {favoriteProducts.slice(0, SEARCH_RESULTS_PAGE_SIZE).map((item) => (
                  <FavoriteProductStripCard
                    key={`favorite-${getProductIdentity(item)}`}
                    item={item}
                    onOpen={() => {
                      void handleOpenPricingFromResult(item);
                    }}
                    onQuickAdd={() => {
                      void handleQuickAddFromResult(item);
                    }}
                    onToggleFavorite={() => {
                      void handleToggleFavoriteFromResult(item);
                    }}
                    quickAddDisabled={!canQuickAddSearchProduct(item)}
                    quickAddLoading={quickAddLoadingId === getProductIdentity(item)}
                    colors={colors}
                    locale={preferredLocale}
                    tt={tt}
                  />
                ))}
              </ScrollView>
            </View>
          </View>
        ) : null}

        {selectedProduct ? (
          <View
            onLayout={(event) => {
              selectedSectionOffsetRef.current = event.nativeEvent.layout.y;
            }}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {tt('price_compare_selected_section', 'Seçilen Ürün')}
            </Text>
            <View
              style={[
                styles.selectedProductCard,
                {
                  backgroundColor: withAlpha(colors.cardElevated, 'F1'),
                  borderColor: withAlpha(colors.border, 'BC'),
                  shadowColor: colors.shadow,
                },
              ]}
            >
              {selectedReferenceLoading ? (
                <View
                  style={[
                    styles.selectedScorePreview,
                    {
                      backgroundColor: withAlpha(colors.primary, '10'),
                      borderColor: withAlpha(colors.primary, '24'),
                    },
                  ]}
                >
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.selectedScorePreviewText, { color: colors.primary }]}>
                    {tt('price_compare_score_loading', 'Skor referansı aranıyor...')}
                  </Text>
                </View>
              ) : selectedScorePreview != null ? (
                <View
                  style={[
                    styles.selectedScorePreview,
                    {
                      backgroundColor: withAlpha(colors.primary, '10'),
                      borderColor: withAlpha(colors.primary, '24'),
                    },
                  ]}
                >
                  <Ionicons name="speedometer-outline" size={15} color={colors.primary} />
                  <Text style={[styles.selectedScorePreviewText, { color: colors.primary }]}>
                    {tt('price_compare_score_preview', 'Sağlık skoru: {{score}}/100').replace(
                      '{{score}}',
                      String(selectedScorePreview)
                    )}
                  </Text>
                </View>
              ) : null}

              <ProductSummaryCard
                imageUrl={selectedProduct.imageUrl}
                fallbackIconName="pricetags-outline"
                eyebrow={selectedDisplayBrand}
                title={selectedDisplayProductName}
                meta={[selectedDisplayCategory, selectedDetailBarcode].filter(Boolean).join(' • ')}
                supportingText={
                  selectedProductCartQuantity
                    ? tt('price_compare_selected_quantity', 'Sepette {{count}} adet var').replace(
                        '{{count}}',
                        String(selectedProductCartQuantity)
                      )
                    : selectedBestOffer
                      ? tt('price_compare_selected_best_offer', 'En iyi canlı fiyat: {{value}}').replace(
                          '{{value}}',
                          formatLocalizedPrice(
                            preferredLocale,
                            selectedBestOffer.price,
                            selectedBestOffer.currency
                          )
                        )
                      : offersResponse && !offersLoading
                        ? tt(
                            'price_compare_selected_no_live_offers',
                            'Bu ürün için henüz canlı market teklifi bulunamadı.'
                          )
                      : tt(
                          'price_compare_selected_pending',
                          'Canlı market teklifleri bu bölümde görünecek.'
                        )
                }
                supportingColor={
                  selectedProductCartQuantity ? colors.teal : colors.mutedText
                }
                eyebrowColor={colors.primary}
                titleColor={colors.text}
                metaColor={colors.mutedText}
                imageBackgroundColor={withAlpha(colors.primary, '12')}
                fallbackIconColor={colors.primary}
                alignItems="flex-start"
                imageSize={68}
                imageRadius={20}
                onPress={
                  selectedDetailBarcode
                    ? () => {
                        navigation.navigate('Detail', {
                          barcode: selectedDetailBarcode,
                          entrySource: 'unknown',
                          lookupMode: 'auto',
                        });
                      }
                    : undefined
                }
                trailing={
                  <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={handleAddSelectedToCart}
                    disabled={!selectedEffectiveOffersResponse || offersLoading}
                    style={[
                      styles.addToCartButton,
                      {
                        backgroundColor: colors.primary,
                        opacity:
                          !selectedEffectiveOffersResponse || offersLoading
                            ? 0.65
                            : 1,
                      },
                    ]}
                  >
                    <Ionicons name="basket-outline" size={16} color={colors.primaryContrast} />
                    <Text
                      style={[styles.addToCartButtonText, { color: colors.primaryContrast }]}
                    >
                      {tt('price_compare_add_to_cart', 'Sepete Ekle')}
                    </Text>
                  </TouchableOpacity>
                }
              />
            </View>

            {offersError ? <NoticeCard text={offersError} colors={colors} /> : null}

            {!offersError ? (
              <>
                <MarketPriceTableCard
                  title={tt('market_price_table_title', 'Market Fiyat Tablosu')}
                  subtitle={
                    pricingSubtitle ??
                    tt(
                      'market_price_table_subtitle',
                      'Ulusal marketleri ve konumundaki marketleri yana kaydırarak karşılaştır.'
                    )
                  }
                  offers={selectedEffectiveOffersResponse?.offers ?? []}
                  productType={pricingTableProductType}
                  locale={preferredLocale}
                  colors={colors}
                  tt={tt}
                  loading={offersLoading}
                />
                <PriceHistoryTrendCard
                  buckets={weeklyPriceHistory}
                  loading={priceHistoryLoading}
                  error={priceHistoryError}
                  locale={preferredLocale}
                  colors={colors}
                  tt={tt}
                />
                <Text style={[styles.marketCoverageHint, { color: colors.mutedText }]}>
                  {tt(
                    'price_compare_market_coverage_hint',
                    'Her üründe tüm marketlerde fiyat bulunmayabilir; barkod veya isim-gramaj eşleşmesi geldikçe kapsama genişler.'
                  )}
                </Text>
              </>
            ) : null}

            {sortedOffers.length ? (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {tt('price_compare_market_list_title', 'Market Bazlı Liste')}
                </Text>
                <View
                  style={[
                    styles.offerListCard,
                    {
                      backgroundColor: withAlpha(colors.cardElevated, 'F1'),
                      borderColor: withAlpha(colors.border, 'BC'),
                      shadowColor: colors.shadow,
                    },
                  ]}
                >
                  {sortedOffers.map((offer) => (
                    <TouchableOpacity
                      key={`${offer.marketKey || offer.marketName}-${offer.price}-${offer.capturedAt}`}
                      activeOpacity={0.88}
                      onPress={() => {
                        openOfferSheet(offer);
                      }}
                      style={[
                        styles.offerRow,
                        { borderBottomColor: withAlpha(colors.border, '80') },
                      ]}
                    >
                      <MarketBadge
                        marketKey={offer.marketKey}
                        marketName={offer.marketName}
                        logoUrl={offer.marketLogoUrl}
                        size={38}
                      />
                      <View style={styles.offerTextWrap}>
                        <Text style={[styles.offerTitle, { color: colors.text }]}>
                          {offer.marketName}
                        </Text>
                        <Text style={[styles.offerMeta, { color: colors.mutedText }]}>
                          {[
                            offer.branchName,
                            offer.districtName,
                            offer.cityName,
                          ]
                            .filter(Boolean)
                            .join(' • ') || getOfferToneLabel(tt, offer)}
                        </Text>
                      </View>

                      <View style={styles.offerPriceWrap}>
                        <Text style={[styles.offerPrice, { color: colors.text }]}>
                          {formatLocalizedPrice(preferredLocale, offer.price, offer.currency)}
                        </Text>
                        {typeof offer.unitPrice === 'number' && offer.unitPriceUnit ? (
                          <Text style={[styles.offerUnitPrice, { color: colors.mutedText }]}>
                            {tt('market_pricing_unit_price_template', '{{price}} / {{unit}}')
                              .replace(
                                '{{price}}',
                                formatLocalizedPrice(
                                  preferredLocale,
                                  offer.unitPrice,
                                  offer.currency
                                )
                              )
                              .replace('{{unit}}', offer.unitPriceUnit)}
                          </Text>
                        ) : null}
                        <View style={styles.offerSignalsRow}>
                          <Text
                            style={[
                              styles.offerStock,
                              { color: offer.inStock ? colors.success : colors.warning },
                            ]}
                          >
                            {offer.inStock
                              ? tt('price_compare_stock_in', 'Stokta')
                              : tt('price_compare_stock_out', 'Stokta değil')}
                          </Text>
                          {formatDistanceMeters(tt, offer.distanceMeters) ? (
                            <Text style={[styles.offerDistance, { color: colors.teal }]}>
                              {formatDistanceMeters(tt, offer.distanceMeters)}
                            </Text>
                          ) : null}
                        </View>
                        <Ionicons
                          name="chevron-forward-outline"
                          size={16}
                          color={colors.mutedText}
                        />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}
          </View>
        ) : null}

        <Text style={[styles.coverageHintText, { color: colors.mutedText }]}>
          {comparisonCart.length
            ? tt(
                'price_compare_cart_shortcut_subtitle',
                'Sepetinde {{count}} ürün var. Tüm işlemler sağ üstteki sepet ekranında.'
              ).replace('{{count}}', String(cartItemCount))
            : tt(
                'price_compare_market_coverage_hint',
                'Her üründe tüm marketlerde fiyat bulunmayabilir; barkod veya isim-gramaj eşleşmesi geldikçe kapsama genişler.'
              )}
        </Text>
      </ScrollView>

      <ScreenOnboardingOverlay
        visible={showOnboarding}
        icon="pricetags-outline"
        title={tt('price_onboarding_title', 'Fiyat karşılaştır burada')}
        body={tt(
          'price_onboarding_body',
          'Barkod veya ürün adıyla ara, marketleri yan yana kıyasla ve istersen ürünleri sepete ekleyip toplam farkı gör.'
        )}
        actionLabel={tt('onboarding_continue', 'Tamam')}
        colors={colors}
        onPress={handleDismissOnboarding}
      />

      <MarketOfferSheet
        visible={Boolean(marketSheetState && marketSheetDetails)}
        title={marketSheetDetails?.title || tt('price_compare_market_sheet_subtitle', 'Market detayı')}
        subtitle={marketSheetDetails?.subtitle || tt('price_compare_market_sheet_subtitle', 'Market detayı')}
        marketName={marketSheetDetails?.title}
        marketKey={marketSheetDetails?.marketKey}
        marketLogoUrl={marketSheetDetails?.logoUrl}
        details={marketSheetDetails?.details ?? []}
        actions={[
          ...(marketSheetDetails?.canOpenMap
            ? [
                {
                  key: 'map',
                  label: tt('price_compare_market_sheet_open_map', 'Haritada Aç'),
                  iconName: 'navigate-outline' as const,
                  tone: 'teal' as const,
                  onPress: () => {
                    void handleOpenMarketMap();
                  },
                },
              ]
            : []),
          ...(marketSheetDetails?.canOpenSource
            ? [
                {
                  key: 'source',
                  label: tt('price_compare_market_sheet_open_source', 'Kaynağı Aç'),
                  iconName: 'open-outline' as const,
                  tone: 'primary' as const,
                  onPress: () => {
                    void handleOpenMarketSource();
                  },
                },
              ]
            : []),
        ]}
        onClose={closeMarketSheet}
        colors={colors}
        isDark={isDark}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerTextWrap: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: 4,
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cartIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  cartBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
  },
  cartBadgeText: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '900',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    lineHeight: 19,
  },
  locationPillRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  locationPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  runtimeNoticeWrap: {
    marginBottom: 14,
  },
  catalogShortcutCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 13,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  catalogShortcutIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogShortcutTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  catalogShortcutTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  catalogShortcutSubtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  searchCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  searchLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  searchInputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  searchButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchScanButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchHint: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  listNameInput: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 15,
    fontSize: 14,
    marginTop: 8,
  },
  listActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  listActionButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  listActionButtonText: {
    fontSize: 12,
    fontWeight: '800',
  },
  listActionGhostButton: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  listActionGhostText: {
    fontSize: 12,
    fontWeight: '700',
  },
  savedListsWrap: {
    marginTop: 14,
    gap: 10,
  },
  savedListsTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  savedListsHelper: {
    fontSize: 11,
    lineHeight: 16,
  },
  savedListsStack: {
    gap: 8,
  },
  savedListCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  savedListMain: {
    flex: 1,
    gap: 2,
  },
  savedListTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savedListTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    flexShrink: 1,
  },
  savedListMeta: {
    fontSize: 11,
    lineHeight: 15,
  },
  savedListActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savedListActionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteStripSection: {
    marginTop: 14,
    marginBottom: 4,
  },
  favoriteStripHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginBottom: 8,
  },
  favoriteStripHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  favoriteStripTitleHeading: {
    marginTop: 0,
    marginBottom: 2,
  },
  favoriteStripCountPill: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  favoriteStripCountText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '900',
  },
  favoriteStripWrap: {
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  favoriteStripScrollContent: {
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  favoriteStripCard: {
    width: 218,
    minHeight: 92,
    borderWidth: 1,
    borderRadius: 16,
    padding: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  favoriteStripImageWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  favoriteStripImage: {
    width: '86%',
    height: '86%',
  },
  favoriteStripTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  favoriteStripTitle: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  favoriteStripMeta: {
    marginTop: 3,
    fontSize: 8.5,
    lineHeight: 11,
  },
  favoriteStripPrice: {
    marginTop: 5,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '900',
  },
  favoriteStripActions: {
    alignItems: 'center',
    gap: 6,
  },
  favoriteStripIconButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteStripAddButton: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 8,
  },
  marketCoverageHint: {
    fontSize: 11,
    lineHeight: 17,
    marginTop: 10,
    marginHorizontal: 4,
  },
  historyCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  historyCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
  },
  historyCardHeaderText: {
    flex: 1,
    gap: 4,
  },
  historyCardTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  historyCardSubtitle: {
    fontSize: 12,
    lineHeight: 18,
  },
  historyPeriodBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  historyPeriodBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  historyLoadingWrap: {
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historySummaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  historySummaryPill: {
    flex: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  historySummaryLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
  },
  historySummaryValue: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  historySummaryMeta: {
    fontSize: 11,
    lineHeight: 15,
  },
  historyChartWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 170,
  },
  historyBarColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  historyBarValue: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  historyBarTrack: {
    width: '100%',
    height: 126,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  historyBar: {
    width: '74%',
    borderRadius: 12,
    minHeight: 24,
  },
  historyBarLabel: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  historyFootnote: {
    marginTop: 12,
    fontSize: 11,
    lineHeight: 17,
  },
  loadingCard: {
    minHeight: 88,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsWrap: {
    gap: 0,
  },
  resultsGridWrap: {
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
    paddingHorizontal: RESULT_GRID_HORIZONTAL_PADDING,
    paddingVertical: 10,
  },
  resultsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: RESULT_GRID_GAP,
    justifyContent: 'flex-start',
    alignSelf: 'center',
  },
  resultsPaginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 12,
    paddingBottom: 4,
    marginTop: 8,
    borderTopWidth: 1,
  },
  resultsPaginationButton: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsPaginationButtonText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '800',
  },
  resultsPaginationSpinner: {
    marginLeft: 4,
  },
  resultsAdBanner: {
    marginTop: 14,
    marginBottom: 2,
  },
  resultsTableWrap: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  categoryTreeCard: {
    borderWidth: 1,
    borderRadius: 20,
    marginBottom: 12,
    overflow: 'hidden',
  },
  categoryTreeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  categoryTreeHeaderLead: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  categoryTreeHeaderIconWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  categoryTreeHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  categoryTreeHeaderTitle: {
    flex: 1,
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '700',
  },
  categoryTreeHeaderSubtitle: {
    maxWidth: 120,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
  categoryTreeList: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  categoryTreeNodeWrap: {
    gap: 0,
  },
  categoryTreeToggleButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTreeRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 6,
  },
  categoryTreeRow: {
    minHeight: 38,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryTreeRowAll: {
    marginBottom: 0,
  },
  categoryTreeMain: {
    flex: 1,
    minWidth: 0,
  },
  categoryTreeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryTreeTitle: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  categoryTreeRowValue: {
    maxWidth: 74,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  categoryTreePath: {
    fontSize: 10,
    lineHeight: 13,
  },
  categoryTreeChildren: {
    gap: 0,
    marginLeft: 0,
    paddingLeft: 0,
    borderLeftWidth: 0,
  },
  resultsTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultsTableHeaderText: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  resultsTableHeaderRightText: {
    textAlign: 'right',
  },
  resultTableRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  resultCompactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resultCompactThumbCol: {
    width: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultCompactImage: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
  },
  resultCompactFallback: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultCompactProductCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  resultCompactTitle: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
  },
  resultCompactMeta: {
    fontSize: 9,
    lineHeight: 12,
  },
  resultCompactMarketCol: {
    width: 120,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 1,
  },
  resultCompactMarket: {
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '700',
  },
  resultCompactMarketMeta: {
    fontSize: 8.5,
    lineHeight: 11,
  },
  resultCompactPriceCol: {
    width: 72,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  resultCompactPrice: {
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: '800',
    textAlign: 'right',
  },
  resultCompactActionCol: {
    width: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  resultCompactIconButton: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultGridCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 8,
    minHeight: 160,
    alignItems: 'center',
  },
  resultGridImageWrap: {
    width: '100%',
    height: 78,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 6,
  },
  resultGridWishButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  resultGridAddButton: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  resultGridImageInner: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  resultGridImage: {
    width: '86%',
    height: '86%',
    alignSelf: 'center',
  },
  resultGridFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultGridMarketBadge: {
    minHeight: 18,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 5,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
    maxWidth: '100%',
  },
  resultGridMarketBadgeText: {
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '800',
  },
  resultGridTitle: {
    width: '100%',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    minHeight: 26,
    textAlign: 'center',
  },
  resultGridMeta: {
    width: '100%',
    marginTop: 3,
    fontSize: 8,
    lineHeight: 11,
    minHeight: 11,
    textAlign: 'center',
  },
  resultGridMetaSpacer: {
    height: 11,
  },
  resultGridSubMeta: {
    width: '100%',
    marginTop: 2,
    fontSize: 7.5,
    lineHeight: 10,
    minHeight: 10,
    textAlign: 'center',
  },
  resultGridSubMetaSpacer: {
    height: 10,
  },
  resultGridPrice: {
    width: '100%',
    marginTop: 5,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  autocompleteWrap: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  autocompleteLoadingRow: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autocompleteRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  autocompleteTextWrap: {
    flex: 1,
    gap: 2,
  },
  autocompleteTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  autocompleteMeta: {
    fontSize: 11,
    lineHeight: 15,
  },
  autocompletePrice: {
    fontSize: 12,
    fontWeight: '800',
  },
  selectedProductCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    marginBottom: 6,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  selectedScorePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  selectedScorePreviewText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  selectedInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  selectedTextWrap: {
    flex: 1,
  },
  selectedTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  selectedMeta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
  },
  selectedBasketHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  addToCartButtonText: {
    fontSize: 12,
    fontWeight: '800',
  },
  coverageHintText: {
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 12,
  },
  cartSummaryCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  cartSummaryTopRow: {
    marginBottom: 8,
  },
  cartSummaryHeadingWrap: {
    gap: 4,
  },
  cartSummaryTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  cartSummarySubtitle: {
    fontSize: 12,
    lineHeight: 18,
  },
  cartMetricsStack: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cartMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cartMetricLabel: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  cartMetricValue: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
    textAlign: 'right',
  },
  cartDifferenceText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  cartHelperText: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
  },
  cartEmptyWrap: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: 'flex-start',
    gap: 8,
  },
  cartEmptyTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  cartEmptyText: {
    fontSize: 12,
    lineHeight: 18,
  },
  cartItemsWrap: {
    gap: 10,
    marginBottom: 12,
  },
  cartItemCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  cartItemTextWrap: {
    flex: 1,
    gap: 3,
  },
  cartItemActions: {
    alignItems: 'center',
    gap: 8,
  },
  cartItemTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  cartItemMeta: {
    fontSize: 11,
    lineHeight: 15,
  },
  cartRemoveButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityStepper: {
    minWidth: 104,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityValue: {
    minWidth: 18,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  offerListCard: {
    borderWidth: 1,
    borderRadius: 24,
    overflow: 'hidden',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
    marginBottom: 12,
  },
  offerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  offerTextWrap: {
    flex: 1,
    gap: 4,
  },
  offerTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  offerMeta: {
    fontSize: 12,
    lineHeight: 17,
  },
  offerUnitPrice: {
    fontSize: 11,
    lineHeight: 15,
  },
  offerSignalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
  },
  offerDistance: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  offerPriceWrap: {
    alignItems: 'flex-end',
    gap: 5,
  },
  offerPrice: {
    fontSize: 14,
    fontWeight: '800',
  },
  offerStock: {
    fontSize: 11,
    fontWeight: '700',
  },
  marketSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  marketSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.36)',
  },
  marketSheetWrap: {
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  marketSheetCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 18,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  marketSheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 999,
    marginBottom: 16,
  },
  marketSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  marketSheetHeaderMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  marketSheetHeaderTextWrap: {
    flex: 1,
    gap: 4,
  },
  marketSheetTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  marketSheetSubtitle: {
    fontSize: 12,
    lineHeight: 18,
  },
  marketSheetCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marketSheetDetailsWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  marketSheetDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  marketSheetDetailLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  marketSheetDetailValue: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'right',
  },
  marketSheetActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  marketSheetActionButton: {
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  marketSheetActionLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
});

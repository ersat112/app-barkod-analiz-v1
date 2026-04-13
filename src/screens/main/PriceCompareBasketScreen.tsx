import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Share,
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
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { AmbientBackdrop } from '../../components/ui/AmbientBackdrop';
import { useAppScreenLayout } from '../../components/layout/useAppScreenLayout';
import { MarketOfferSheet } from '../../components/MarketOfferSheet';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  getBestInStockOffer,
  getMarketOfferIdentity,
} from '../../services/marketPricingContract.service';
import {
  fetchMarketBasketCompare,
  fetchMarketProductOffers,
  fetchMarketProductOffersById,
  fetchMarketProductSearch,
} from '../../services/marketPricing.service';
import {
  deleteSavedPriceCompareList,
  duplicateSavedPriceCompareList,
  getDefaultPriceCompareListName,
  loadSavedPriceCompareLists,
  savePriceCompareList,
  togglePinSavedPriceCompareList,
  type SavedPriceCompareList,
} from '../../services/priceCompareShoppingList.service';
import {
  getCurrentLocationContext,
  type CurrentLocationContext,
} from '../../services/locationPermission.service';
import {
  resolveCanonicalCity,
  resolveCanonicalDistrict,
  resolveTurkeyCityCode,
  resolveTurkeyCitySlug,
} from '../../services/locationData';
import type {
  MarketBasketCompareResponse,
  MarketBasketMarketTotal,
  MarketOffer,
  MarketProductOffersResponse,
  MarketSearchProduct,
} from '../../types/marketPricing';
import { usePreferenceStore } from '../../store/usePreferenceStore';
import {
  usePriceCompareBasketStore,
  type PriceCompareCartEntry,
} from '../../store/usePriceCompareBasketStore';
import { withAlpha } from '../../utils/color';

type MarketSheetState =
  | {
      kind: 'basket';
      market: MarketBasketMarketTotal;
    }
  | null;

type EntryResolutionStatus = {
  loading: boolean;
  error: string | null;
  success: string | null;
  originalLabel?: string | null;
  matchedLabel?: string | null;
};

type BasketMatrixColumn = {
  id: string;
  marketKey?: string | null;
  marketName: string;
  marketLogoUrl?: string | null;
  total?: MarketBasketMarketTotal | null;
};

type BasketMatrixRow = {
  entry: PriceCompareCartEntry;
  entryId: string;
  title: string;
  subtitle: string | null;
  imageUrl?: string | null;
  cheapestMarketId?: string | null;
  marketOfferMap: Map<string, MarketOffer>;
};

const REMOTE_BASKET_TIMEOUT_MS = 6500;

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

const getProductIdentity = (product: PriceCompareCartEntry['product']): string =>
  product.productId || product.id || product.barcode || `${product.productName}-${product.brand || ''}`;

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

const formatLocalizedDateTime = (locale: string, value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat(locale || 'tr-TR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(parsed);
  } catch {
    return parsed.toISOString();
  }
};

const buildShareableBasketSummary = (
  locale: string,
  basketName: string,
  entries: PriceCompareCartEntry[],
  marketColumns: BasketMatrixColumn[],
  totals: {
    mixedCheapestTotal: number;
    bestSingleMarketTotal?: number | null;
  }
): string => {
  const lines: string[] = [];
  lines.push(basketName || 'Alisveris Listesi');
  lines.push('');

  entries.forEach((entry) => {
    const quantity = Math.max(1, entry.quantity);
    const title = toDisplayProductName(entry.product.productName);
    const bestOffer = normalizeOffersForDisplay(entry.offersResponse.offers)[0];
    const bestLine =
      bestOffer != null
        ? `${bestOffer.marketName} - ${formatLocalizedPrice(locale, bestOffer.price, bestOffer.currency)}`
        : 'Canli fiyat yok';

    lines.push(`• ${title} x${quantity}`);
    lines.push(`  ${bestLine}`);
  });

  lines.push('');
  lines.push(`Market sayisi: ${marketColumns.length}`);
  lines.push(
    `En ucuz karisik sepet: ${formatLocalizedPrice(locale, totals.mixedCheapestTotal || 0, 'TRY')}`
  );

  if (typeof totals.bestSingleMarketTotal === 'number') {
    lines.push(
      `Tek market toplami: ${formatLocalizedPrice(locale, totals.bestSingleMarketTotal, 'TRY')}`
    );
  }

  return lines.join('\n');
};

const toDisplayProductName = (value?: string | null): string =>
  (value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      if (token.length <= 2) {
        return token.toLocaleUpperCase('tr-TR');
      }

      return (
        token.charAt(0).toLocaleUpperCase('tr-TR') + token.slice(1).toLocaleLowerCase('tr-TR')
      );
    })
    .join(' ');

const getNormalizedMarketIdentity = (
  marketKey?: string | null,
  marketName?: string | null
): string =>
  normalizeComparableText(marketKey || marketName);

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
    .filter(Boolean);
};

const formatDistanceMeters = (tt: (key: string, fallback: string) => string, value?: number | null): string | null => {
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

const hasLiveOfferForEntry = (
  entry: PriceCompareCartEntry,
  cityCode?: string | null
): boolean =>
  normalizeOffersForDisplay(entry.offersResponse.offers, {
    cityCode,
  }).some((offer) => offer.inStock);

const mergeComparisonOffers = (
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
      getNormalizedMarketIdentity(offer.marketKey, offer.marketName) ||
      `${offer.marketName}-${offer.price}-${offer.capturedAt || ''}`;

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

const mergeOfferResponses = (
  responses: (MarketProductOffersResponse | null | undefined)[]
): MarketProductOffersResponse | null => {
  const fulfilledResponses = responses.filter(
    (response): response is MarketProductOffersResponse => Boolean(response)
  );

  if (!fulfilledResponses.length) {
    return null;
  }

  const mergedOffers = fulfilledResponses.reduce<MarketOffer[]>(
    (accumulator, response) => mergeComparisonOffers(accumulator, response.offers),
    []
  );
  const firstResponse = fulfilledResponses[0];
  const mergedWarnings = Array.from(
    new Set(fulfilledResponses.flatMap((response) => response.warnings ?? []))
  );
  const mergedCity =
    fulfilledResponses.find((response) => response.city?.code || response.city?.name)?.city ??
    firstResponse.city ??
    null;
  const mergedFreshness =
    fulfilledResponses.find((response) => response.dataFreshness != null)?.dataFreshness ??
    firstResponse.dataFreshness ??
    null;

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
    partial: fulfilledResponses.every((response) => Boolean(response.partial)),
    warnings: mergedWarnings,
    city: mergedCity,
    dataFreshness: mergedFreshness,
    offers: mergedOffers,
  };
};

const buildEntryComparisonOffers = (
  entry: PriceCompareCartEntry,
  compareOffers: MarketOffer[] | null | undefined,
  cityCode?: string | null
): MarketOffer[] => {
  const seededOffers = [
    ...(entry.product.bestOffer ? [entry.product.bestOffer] : []),
    ...(entry.product.seedOffers ?? []),
  ];
  const mergedOffers = mergeComparisonOffers(
    mergeComparisonOffers(compareOffers ?? [], entry.offersResponse.offers),
    seededOffers
  );

  return normalizeOffersForDisplay(mergedOffers, {
    cityCode,
  });
};

const normalizeComparableText = (value?: string | null): string =>
  (value || '')
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ığüşöç\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenizeComparableText = (value?: string | null): string[] =>
  normalizeComparableText(value)
    .split(' ')
    .filter(Boolean);

const buildEntrySearchQueries = (entry: PriceCompareCartEntry): string[] => {
  const brand = entry.product.brand?.trim();
  const name = entry.product.productName.trim();

  return Array.from(
    new Set(
      [`${brand || ''} ${name}`.trim(), name, entry.product.barcode || ''].filter(
        (value) => value && value.trim().length >= 2
      )
    )
  );
};

const scoreCandidateForEntry = (
  entry: PriceCompareCartEntry,
  candidate: MarketSearchProduct
): number => {
  const sourceTokens = new Set(
    tokenizeComparableText(`${entry.product.brand || ''} ${entry.product.productName}`)
  );
  const candidateTokens = tokenizeComparableText(`${candidate.brand || ''} ${candidate.productName}`);
  let score = 0;

  candidateTokens.forEach((token) => {
    if (sourceTokens.has(token)) {
      score += 12;
    }
  });

  if (
    entry.product.brand &&
    candidate.brand &&
    normalizeComparableText(entry.product.brand) === normalizeComparableText(candidate.brand)
  ) {
    score += 40;
  }

  if (
    normalizeComparableText(candidate.productName).includes(
      normalizeComparableText(entry.product.productName)
    ) ||
    normalizeComparableText(entry.product.productName).includes(
      normalizeComparableText(candidate.productName)
    )
  ) {
    score += 55;
  }

  if (candidate.inStockMarketCount > 0) {
    score += 25;
  }

  if (candidate.marketCount > 0) {
    score += 10;
  }

  return score;
};

export const PriceCompareBasketScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t, i18n } = useTranslation();
  const { colors, isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const { profile, user } = useAuth();
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
  const preferredLocale = i18n.language || 'tr-TR';
  const currentUserId = user?.uid ?? null;
  const locationPermissionGranted = usePreferenceStore(
    (state) => state.locationPermissionGranted
  );
  const entries = usePriceCompareBasketStore((state) => state.entries);
  const shoppingListName = usePriceCompareBasketStore((state) => state.shoppingListName);
  const activeSavedListId = usePriceCompareBasketStore((state) => state.activeSavedListId);
  const setShoppingListName = usePriceCompareBasketStore((state) => state.setShoppingListName);
  const setActiveSavedListId = usePriceCompareBasketStore(
    (state) => state.setActiveSavedListId
  );
  const clearEntries = usePriceCompareBasketStore((state) => state.clearEntries);
  const removeEntry = usePriceCompareBasketStore((state) => state.removeEntry);
  const increaseQuantity = usePriceCompareBasketStore((state) => state.increaseQuantity);
  const decreaseQuantity = usePriceCompareBasketStore((state) => state.decreaseQuantity);
  const replaceEntries = usePriceCompareBasketStore((state) => state.replaceEntries);

  const [savedLists, setSavedLists] = useState<SavedPriceCompareList[]>([]);
  const [shoppingListSaving, setShoppingListSaving] = useState(false);
  const [basketCompareResponse, setBasketCompareResponse] =
    useState<MarketBasketCompareResponse | null>(null);
  const [basketCompareLoading, setBasketCompareLoading] = useState(false);
  const [basketCompareError, setBasketCompareError] = useState<string | null>(null);
  const [marketSheetState, setMarketSheetState] = useState<MarketSheetState>(null);
  const [detectedLocation, setDetectedLocation] = useState<CurrentLocationContext | null>(null);
  const [detectedLocationLoading, setDetectedLocationLoading] = useState(false);
  const [detectedLocationResolved, setDetectedLocationResolved] = useState(false);
  const [showPricedOnly, setShowPricedOnly] = useState(false);
  const [entryResolutionState, setEntryResolutionState] = useState<
    Record<string, EntryResolutionStatus>
  >({});
  const hydratedOfferRequestKeysRef = useRef<Set<string>>(new Set());

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
  const citySlug = resolveTurkeyCitySlug(effectiveCity);
  const pricedEntries = useMemo(
    () => entries.filter((entry) => hasLiveOfferForEntry(entry, cityCode)),
    [cityCode, entries]
  );
  const analysisEntries = useMemo(
    () => (showPricedOnly ? pricedEntries : entries),
    [entries, pricedEntries, showPricedOnly]
  );
  const analysisRequestedCartQuantity = useMemo(
    () => analysisEntries.reduce((sum, entry) => sum + Math.max(1, entry.quantity), 0),
    [analysisEntries]
  );

  useEffect(() => {
    let isMounted = true;

    const hydrateSavedLists = async () => {
      const nextLists = await loadSavedPriceCompareLists({
        userId: currentUserId,
      });

      if (isMounted) {
        setSavedLists(nextLists);

        if (!shoppingListName.trim()) {
          setShoppingListName(getDefaultPriceCompareListName());
        }
      }
    };

    void hydrateSavedLists();

    return () => {
      isMounted = false;
    };
  }, [currentUserId, setShoppingListName, shoppingListName]);

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
        console.warn('[PriceCompareBasketScreen] current location resolve failed:', error);
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
    const comparableItems = analysisEntries.filter((entry) => Boolean(entry.product.barcode));

    if (!analysisEntries.length || !cityCode || comparableItems.length !== analysisEntries.length) {
      setBasketCompareResponse(null);
      setBasketCompareError(null);
      setBasketCompareLoading(false);
      return;
    }

    let isActive = true;
    setBasketCompareLoading(true);
    setBasketCompareError(null);

    void (async () => {
      try {
        const response = await resolveWithin(
          fetchMarketBasketCompare({
            cityCode,
            citySlug,
            districtName: effectiveDistrict ?? undefined,
            latitude: detectedLocation?.latitude,
            longitude: detectedLocation?.longitude,
            items: comparableItems.map((entry) => ({
              barcode: entry.product.barcode!,
              quantity: entry.quantity,
            })),
          }),
          REMOTE_BASKET_TIMEOUT_MS
        );

        if (isActive) {
          setBasketCompareResponse(response);
        }
      } catch (error) {
        console.warn('[PriceCompareBasketScreen] basket compare failed:', error);

        if (isActive) {
          setBasketCompareResponse(null);
          setBasketCompareError(
            tt(
              'price_compare_basket_compare_error',
              'Canlı sepet kıyası şu anda alınamadı. Yerel toplamlar gösteriliyor.'
            )
          );
        }
      } finally {
        if (isActive) {
          setBasketCompareLoading(false);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [
    analysisEntries,
    cityCode,
    citySlug,
    detectedLocation?.latitude,
    detectedLocation?.longitude,
    effectiveDistrict,
    tt,
  ]);

  useEffect(() => {
    const candidates = entries.filter((entry) => {
      if (!entry.product.barcode && !entry.product.productId) {
        return false;
      }

      const entryId = getProductIdentity(entry.product);
      const hydrationKey = [
        entryId,
        entry.product.barcode || entry.product.productId,
        cityCode ?? 'no-city',
        effectiveDistrict ?? 'no-district',
      ].join(':');

      if (hydratedOfferRequestKeysRef.current.has(hydrationKey)) {
        return false;
      }

      hydratedOfferRequestKeysRef.current.add(hydrationKey);
      return true;
    });

    if (!candidates.length) {
      return;
    }

    let isActive = true;

    void (async () => {
      const hydratedResponses = await Promise.allSettled(
        candidates.map(async (entry) => {
          const fetchOffersForEntry = (
            scope: 'district' | 'city'
          ): Promise<MarketProductOffersResponse | null> => {
            const districtName =
              scope === 'district' ? effectiveDistrict ?? undefined : undefined;
            const sharedParams = {
              cityCode: cityCode ?? undefined,
              districtName,
              includeOutOfStock: true,
              limit: 200,
              fallbackProductName: entry.product.productName,
              fallbackBrand: entry.product.brand ?? undefined,
              enableNameFallback: true,
            };

            if (entry.product.barcode) {
              return resolveWithin(
                fetchMarketProductOffers(entry.product.barcode, sharedParams),
                REMOTE_BASKET_TIMEOUT_MS
              ).catch(() => null);
            }

            if (entry.product.productId) {
              return resolveWithin(
                fetchMarketProductOffersById(entry.product.productId, sharedParams),
                REMOTE_BASKET_TIMEOUT_MS
              ).catch(() => null);
            }

            return Promise.resolve<MarketProductOffersResponse | null>(null);
          };

          const [districtScopedResponse, cityWideResponse] = await Promise.all([
            fetchOffersForEntry('district'),
            effectiveDistrict ? fetchOffersForEntry('city') : Promise.resolve<MarketProductOffersResponse | null>(null),
          ]);
          const response = mergeOfferResponses([
            districtScopedResponse,
            cityWideResponse,
            entry.offersResponse,
          ]);

          if (!response) {
            throw new Error('market_offers_hydration_empty');
          }

          return {
            entryId: getProductIdentity(entry.product),
            response,
          };
        })
      );

      if (!isActive) {
        return;
      }

      const responseMap = new Map<string, MarketProductOffersResponse>();

      hydratedResponses.forEach((result) => {
        if (result.status !== 'fulfilled') {
          return;
        }

        responseMap.set(result.value.entryId, result.value.response);
      });

      if (!responseMap.size) {
        return;
      }

      replaceEntries(
        entries.map((entry) => {
          const nextResponse = responseMap.get(getProductIdentity(entry.product));

          if (!nextResponse) {
            return entry;
          }

          return {
            ...entry,
            offersResponse: nextResponse,
          };
        })
      );
    })();

    return () => {
      isActive = false;
    };
  }, [cityCode, effectiveDistrict, entries, replaceEntries]);

  const handleSaveShoppingList = useCallback(async () => {
    if (!entries.length) {
      return;
    }

    setShoppingListSaving(true);

    try {
      const nextLists = await savePriceCompareList(
        {
          id: activeSavedListId,
          name: shoppingListName,
          entries,
        },
        {
          userId: currentUserId,
        }
      );

      const activeList =
        nextLists.find((item) => item.id === activeSavedListId) ??
        nextLists.find(
          (item) =>
            item.name === (shoppingListName.trim() || getDefaultPriceCompareListName())
        ) ??
        nextLists[0] ??
        null;

      setSavedLists(nextLists);
      setActiveSavedListId(activeList?.id ?? null);
      setShoppingListName(activeList?.name ?? shoppingListName);
    } catch (error) {
      console.warn('[PriceCompareBasketScreen] shopping list save failed:', error);
    } finally {
      setShoppingListSaving(false);
    }
  }, [
    activeSavedListId,
    currentUserId,
    entries,
    setActiveSavedListId,
    setShoppingListName,
    shoppingListName,
  ]);

  const handleLoadSavedList = useCallback(
    (list: SavedPriceCompareList) => {
      setActiveSavedListId(list.id);
      setShoppingListName(list.name);
      replaceEntries(
        list.entries.map((entry) => ({
          product: entry.product,
          offersResponse: entry.offersResponse,
          quantity: Math.max(1, entry.quantity),
        }))
      );
      setBasketCompareResponse(null);
      setBasketCompareError(null);
    },
    [replaceEntries, setActiveSavedListId, setShoppingListName]
  );

  const handleDeleteSavedList = useCallback(
    async (listId: string) => {
      try {
        const nextLists = await deleteSavedPriceCompareList(listId, {
          userId: currentUserId,
        });
        setSavedLists(nextLists);

        if (activeSavedListId === listId) {
          setActiveSavedListId(null);
        }
      } catch (error) {
        console.warn('[PriceCompareBasketScreen] shopping list delete failed:', error);
      }
    },
    [activeSavedListId, currentUserId, setActiveSavedListId]
  );

  const handleTogglePinSavedList = useCallback(
    async (listId: string) => {
      try {
        const nextLists = await togglePinSavedPriceCompareList(listId, {
          userId: currentUserId,
        });
        setSavedLists(nextLists);
      } catch (error) {
        console.warn('[PriceCompareBasketScreen] shopping list pin toggle failed:', error);
      }
    },
    [currentUserId]
  );

  const handleDuplicateSavedList = useCallback(
    async (listId: string) => {
      try {
        const nextLists = await duplicateSavedPriceCompareList(listId, {
          userId: currentUserId,
        });
        setSavedLists(nextLists);
      } catch (error) {
        console.warn('[PriceCompareBasketScreen] shopping list duplicate failed:', error);
      }
    },
    [currentUserId]
  );

  const openItemInPriceCompare = useCallback(
    (query: string) => {
      navigation.navigate('PriceCompare', {
        initialQuery: query,
      });
    },
    [navigation]
  );

  const handleResolveSimilarEntry = useCallback(
    async (entry: PriceCompareCartEntry) => {
      const entryId = getProductIdentity(entry.product);
      const originalLabel = [entry.product.productName, entry.product.barcode]
        .filter(Boolean)
        .join(' • ');
      setEntryResolutionState((previous) => ({
        ...previous,
        [entryId]: {
          loading: true,
          error: null,
          success: null,
          originalLabel,
          matchedLabel: null,
        },
      }));

      try {
        const queries = buildEntrySearchQueries(entry);
        const candidateMap = new Map<string, MarketSearchProduct>();

        for (const query of queries) {
          const response = await resolveWithin(
            fetchMarketProductSearch({
              query,
              cityCode: cityCode ?? undefined,
              limit: 6,
            }),
            4500
          );

          response.results.forEach((candidate) => {
            const key = candidate.id || candidate.barcode || candidate.productName;
            if (!key) {
              return;
            }
            if (!candidateMap.has(key)) {
              candidateMap.set(key, candidate);
            }
          });
        }

        const rankedCandidates = Array.from(candidateMap.values())
          .map((candidate) => ({
            candidate,
            score: scoreCandidateForEntry(entry, candidate),
          }))
          .sort((left, right) => right.score - left.score);

        let resolvedProduct: MarketSearchProduct | null = null;
        let resolvedOffers: MarketProductOffersResponse | null = null;

        for (const { candidate } of rankedCandidates.slice(0, 5)) {
          if (candidate.seedOffers?.length) {
            const seededInStock = normalizeOffersForDisplay(candidate.seedOffers, {
              cityCode,
            }).some((offer) => offer.inStock);

            if (seededInStock) {
              resolvedProduct = candidate;
              resolvedOffers = {
                barcode: candidate.barcode || candidate.id,
                productId: candidate.productId ?? null,
                product: {
                  productId: candidate.productId ?? null,
                  barcode: candidate.barcode ?? null,
                  productName: candidate.productName,
                  brand: candidate.brand ?? null,
                  imageUrl: candidate.imageUrl ?? null,
                },
                fetchedAt: new Date().toISOString(),
                requestId: null,
                partial: true,
                warnings: ['search_seed_offer_match'],
                city: cityCode && effectiveCity ? { code: cityCode, name: effectiveCity } : null,
                dataFreshness: candidate.dataFreshness ?? null,
                offers: candidate.seedOffers,
              };
              break;
            }
          }

          if (!candidate.barcode && !candidate.productId) {
            continue;
          }

          const offersResponse = candidate.barcode
            ? await resolveWithin(
                fetchMarketProductOffers(candidate.barcode, {
                  cityCode: cityCode ?? undefined,
                  districtName: effectiveDistrict ?? undefined,
                  includeOutOfStock: true,
                  limit: 24,
                }),
                4500
              )
            : await resolveWithin(
                fetchMarketProductOffersById(candidate.productId!, {
                  cityCode: cityCode ?? undefined,
                  districtName: effectiveDistrict ?? undefined,
                  includeOutOfStock: true,
                  limit: 24,
                  fallbackProductName: candidate.productName,
                  fallbackBrand: candidate.brand ?? undefined,
                  enableNameFallback: true,
                }),
                4500
              );

          const hasLiveOffers = normalizeOffersForDisplay(offersResponse.offers, {
            cityCode,
          }).some((offer) => offer.inStock);

          if (hasLiveOffers) {
            resolvedProduct = candidate;
            resolvedOffers = offersResponse;
            break;
          }
        }

        if (!resolvedProduct || !resolvedOffers) {
          setEntryResolutionState((previous) => ({
            ...previous,
            [entryId]: {
              loading: false,
              error: tt(
                'price_compare_try_similar_match_failed',
                'Benzer market eşleşmesi henüz bulunamadı.'
              ),
              success: null,
              originalLabel,
              matchedLabel: null,
            },
          }));
          return;
        }

        const matchedLabel = [resolvedProduct.productName, resolvedProduct.barcode]
          .filter(Boolean)
          .join(' • ');
        const nextEntryIdentity =
          resolvedProduct.id ||
          resolvedProduct.barcode ||
          `${resolvedProduct.productName}-${resolvedProduct.brand || ''}`;

        replaceEntries(
          entries.map((item) =>
            getProductIdentity(item.product) === entryId
              ? {
                  ...item,
                  product: {
                    ...item.product,
                    ...resolvedProduct,
                    barcode: resolvedProduct.barcode ?? item.product.barcode,
                    productName: resolvedProduct.productName || item.product.productName,
                    brand: resolvedProduct.brand ?? item.product.brand,
                    category: resolvedProduct.category ?? item.product.category,
                    imageUrl: resolvedProduct.imageUrl ?? item.product.imageUrl,
                    marketLogoUrl:
                      resolvedProduct.marketLogoUrl ?? item.product.marketLogoUrl,
                  },
                  offersResponse: resolvedOffers,
                }
              : item
          )
        );

        setEntryResolutionState((previous) => ({
          ...previous,
          [entryId]: {
            loading: false,
            error: null,
            success: tt(
              'price_compare_similar_match_success',
              'Benzer market eşleşmesi bulundu.'
            ),
            originalLabel,
            matchedLabel,
          },
          [nextEntryIdentity]: {
            loading: false,
            error: null,
            success: tt(
              'price_compare_similar_match_success',
              'Benzer market eşleşmesi bulundu.'
            ),
            originalLabel,
            matchedLabel,
          },
        }));
      } catch (error) {
        console.warn('[PriceCompareBasketScreen] similar match resolve failed:', error);
        setEntryResolutionState((previous) => ({
          ...previous,
          [entryId]: {
            loading: false,
            error: tt(
              'price_compare_try_similar_match_failed',
              'Benzer market eşleşmesi henüz bulunamadı.'
            ),
            success: null,
            originalLabel,
            matchedLabel: null,
          },
        }));
      }
    },
    [cityCode, effectiveCity, effectiveDistrict, entries, replaceEntries, tt]
  );

  const cartSummary = useMemo(() => {
    if (!analysisEntries.length) {
      return {
        cheapestTotal: 0,
        bestSingleMarket: null as null | {
          marketKey: string;
          marketName: string;
          marketLogoUrl?: string | null;
          total: number;
          coveredCount: number;
          distanceMeters?: number | null;
        },
        perMarketTotals: [] as {
          marketKey: string;
          marketName: string;
          marketLogoUrl?: string | null;
          total: number;
          coveredCount: number;
          distanceMeters?: number | null;
        }[],
      };
    }

    let cheapestTotal = 0;
    const marketMap = new Map<
      string,
      {
        marketKey: string;
        marketName: string;
        marketLogoUrl?: string | null;
        total: number;
        coveredCount: number;
        distanceMeters?: number | null;
      }
    >();

    analysisEntries.forEach((entry) => {
      const inStockOffers = normalizeOffersForDisplay(entry.offersResponse.offers, {
        cityCode,
      }).filter((offer) => offer.inStock);
      const cheapestOffer = getBestInStockOffer(inStockOffers);
      const quantity = Math.max(1, entry.quantity);

      if (cheapestOffer) {
        cheapestTotal += cheapestOffer.price * quantity;
      }

      const seenMarkets = new Set<string>();

      inStockOffers.forEach((offer) => {
        const id = offer.marketKey || offer.marketName;

        if (!id || seenMarkets.has(id)) {
          return;
        }

        seenMarkets.add(id);

        const existing = marketMap.get(id) ?? {
          marketKey: offer.marketKey || offer.marketName,
          marketName: offer.marketName,
          marketLogoUrl: offer.marketLogoUrl ?? null,
          total: 0,
          coveredCount: 0,
          distanceMeters: offer.distanceMeters ?? null,
        };

        existing.total += offer.price * quantity;
        existing.coveredCount += quantity;

        if (
          existing.distanceMeters == null &&
          typeof offer.distanceMeters === 'number' &&
          Number.isFinite(offer.distanceMeters)
        ) {
          existing.distanceMeters = offer.distanceMeters;
        }

        marketMap.set(id, existing);
      });
    });

    const perMarketTotals = Array.from(marketMap.values()).sort((left, right) => {
      if (left.coveredCount !== right.coveredCount) {
        return right.coveredCount - left.coveredCount;
      }

      if (
        typeof left.distanceMeters === 'number' &&
        typeof right.distanceMeters === 'number' &&
        left.distanceMeters !== right.distanceMeters
      ) {
        return left.distanceMeters - right.distanceMeters;
      }

      return left.total - right.total;
    });

    return {
      cheapestTotal,
      bestSingleMarket: perMarketTotals[0] ?? null,
      perMarketTotals,
    };
  }, [analysisEntries, cityCode]);

  const basketCoverageSummary = useMemo(() => {
    const summary = {
      pricedItemCount: 0,
      unpricedItemCount: 0,
      pricedQuantity: 0,
      unpricedQuantity: 0,
    };

    entries.forEach((entry) => {
      const quantity = Math.max(1, entry.quantity);
      const hasLiveOffer = hasLiveOfferForEntry(entry, cityCode);

      if (hasLiveOffer) {
        summary.pricedItemCount += 1;
        summary.pricedQuantity += quantity;
        return;
      }

      summary.unpricedItemCount += 1;
      summary.unpricedQuantity += quantity;
    });

    return summary;
  }, [cityCode, entries]);

  const basketDisplayTotals = useMemo(() => {
    if (basketCompareResponse) {
      return {
        mixedCheapestTotal: basketCompareResponse.mixedCheapestTotal,
        bestSingleMarketTotal:
          basketCompareResponse.bestSingleMarketTotal ??
          basketCompareResponse.marketTotals[0]?.basketTotal ??
          null,
        nearestMarketTotal: basketCompareResponse.nearestMarketTotal ?? null,
        marketTotals: basketCompareResponse.marketTotals,
        missingItems: basketCompareResponse.missingItems,
      };
    }

    return {
      mixedCheapestTotal: cartSummary.cheapestTotal,
      bestSingleMarketTotal: cartSummary.bestSingleMarket?.total ?? null,
      nearestMarketTotal: null,
      marketTotals: cartSummary.perMarketTotals.map((market) => ({
        marketKey: market.marketKey,
        marketName: market.marketName,
        marketLogoUrl: market.marketLogoUrl ?? null,
        distanceMeters: market.distanceMeters ?? null,
        branchId: null,
        branchName: null,
        latitude: null,
        longitude: null,
        basketTotal: market.total,
        availableItemCount: market.coveredCount,
        missingItemCount: Math.max(0, analysisRequestedCartQuantity - market.coveredCount),
      })),
      missingItems: [],
    };
  }, [analysisRequestedCartQuantity, basketCompareResponse, cartSummary]);

  const basketCompareItemMap = useMemo(() => {
    const nextMap = new Map<string, MarketBasketCompareResponse['items'][number]>();

    basketCompareResponse?.items.forEach((item) => {
      if (!item.barcode) {
        return;
      }

      nextMap.set(item.barcode, item);
    });

    return nextMap;
  }, [basketCompareResponse]);

  const comparisonMarketColumns = useMemo<BasketMatrixColumn[]>(() => {
    const columnMap = new Map<string, BasketMatrixColumn>();

    basketDisplayTotals.marketTotals.forEach((market) => {
      const identity = getNormalizedMarketIdentity(market.marketKey, market.marketName);

      if (!identity) {
        return;
      }

      columnMap.set(identity, {
        id: identity,
        marketKey: market.marketKey,
        marketName: market.marketName,
        marketLogoUrl: market.marketLogoUrl ?? null,
        total: market,
      });
    });

    analysisEntries.forEach((entry) => {
      const compareItem =
        entry.product.barcode != null ? basketCompareItemMap.get(entry.product.barcode) : null;
      buildEntryComparisonOffers(entry, compareItem?.offers, cityCode).forEach((offer) => {
        const identity =
          getMarketOfferIdentity(offer) ||
          getNormalizedMarketIdentity(offer.marketKey, offer.marketName);

        if (!identity) {
          return;
        }

        const existing = columnMap.get(identity);

        if (!existing) {
          columnMap.set(identity, {
            id: identity,
            marketKey: offer.marketKey,
            marketName: offer.marketName,
            marketLogoUrl: offer.marketLogoUrl ?? null,
            total: null,
          });
          return;
        }

        if (!existing.marketLogoUrl && offer.marketLogoUrl) {
          existing.marketLogoUrl = offer.marketLogoUrl;
        }

        if (!existing.marketKey && offer.marketKey) {
          existing.marketKey = offer.marketKey;
        }
      });
    });

    return Array.from(columnMap.values()).sort((left, right) => {
      const leftTotal = left.total?.basketTotal;
      const rightTotal = right.total?.basketTotal;

      if (typeof leftTotal === 'number' && typeof rightTotal === 'number' && leftTotal !== rightTotal) {
        return leftTotal - rightTotal;
      }

      if (typeof leftTotal === 'number' && typeof rightTotal !== 'number') {
        return -1;
      }

      if (typeof leftTotal !== 'number' && typeof rightTotal === 'number') {
        return 1;
      }

      return left.marketName.localeCompare(right.marketName, 'tr');
    });
  }, [analysisEntries, basketCompareItemMap, basketDisplayTotals.marketTotals, cityCode]);

  const matrixViewportWidth = useMemo(() => {
    const leadColumnWidth = 184;
    const marketColumnWidth = 116;
    const availableWidth = Math.max(260, windowWidth - layout.horizontalPadding * 2);
    const contentWidth = leadColumnWidth + comparisonMarketColumns.length * marketColumnWidth;

    return Math.min(availableWidth, Math.max(260, contentWidth));
  }, [comparisonMarketColumns.length, layout.horizontalPadding, windowWidth]);

  const comparisonRows = useMemo<BasketMatrixRow[]>(() => {
    return analysisEntries.map((entry) => {
      const entryId = getProductIdentity(entry.product);
      const compareItem =
        entry.product.barcode != null ? basketCompareItemMap.get(entry.product.barcode) : null;
      const displayOffers = buildEntryComparisonOffers(entry, compareItem?.offers, cityCode);
      const marketOfferMap = new Map<string, MarketOffer>();

      displayOffers.forEach((offer) => {
        const identity =
          getMarketOfferIdentity(offer) ||
          getNormalizedMarketIdentity(offer.marketKey, offer.marketName);

        if (!identity) {
          return;
        }

        marketOfferMap.set(identity, offer);
      });

      const cheapestOffer = getBestInStockOffer(displayOffers.filter((offer) => offer.inStock));
      const cheapestMarketId = cheapestOffer
        ? getMarketOfferIdentity(cheapestOffer) ||
          getNormalizedMarketIdentity(cheapestOffer.marketKey, cheapestOffer.marketName)
        : null;

      return {
        entry,
        entryId,
        title: toDisplayProductName(entry.product.productName),
        subtitle: [entry.product.brand, entry.product.barcode].filter(Boolean).join(' • ') || null,
        imageUrl: entry.product.imageUrl ?? null,
        cheapestMarketId,
        marketOfferMap,
      };
    });
  }, [analysisEntries, basketCompareItemMap, cityCode]);

  const highestMarketTotalValue = useMemo(() => {
    if (!basketDisplayTotals.marketTotals.length) {
      return null;
    }

    return basketDisplayTotals.marketTotals.reduce<number | null>((highest, market) => {
      if (typeof highest !== 'number') {
        return market.basketTotal;
      }

      return Math.max(highest, market.basketTotal);
    }, null);
  }, [basketDisplayTotals.marketTotals]);

  const hasBasketPricing = useMemo(() => {
    return (
      basketDisplayTotals.marketTotals.length > 0 ||
      typeof basketDisplayTotals.bestSingleMarketTotal === 'number' ||
      typeof basketDisplayTotals.nearestMarketTotal === 'number' ||
      basketDisplayTotals.mixedCheapestTotal > 0
    );
  }, [basketDisplayTotals]);

  const cartDifferenceValue = useMemo(() => {
    if (
      analysisEntries.length &&
      basketCompareResponse != null &&
      typeof basketCompareResponse.bestSingleMarketTotal === 'number'
    ) {
      return Math.max(
        0,
        basketCompareResponse.bestSingleMarketTotal - basketCompareResponse.mixedCheapestTotal
      );
    }

    if (!analysisEntries.length || !cartSummary.bestSingleMarket) {
      return null;
    }

    return Math.max(0, cartSummary.bestSingleMarket.total - cartSummary.cheapestTotal);
  }, [
    basketCompareResponse,
    cartSummary.bestSingleMarket,
    cartSummary.cheapestTotal,
    analysisEntries.length,
  ]);

  const cartSummaryRows = useMemo(
    () => [
      {
        key: 'mix',
        label: tt('price_compare_cart_best_mix', 'En ucuz karışık sepet'),
        value: hasBasketPricing
          ? formatLocalizedPrice(preferredLocale, basketDisplayTotals.mixedCheapestTotal, 'TRY')
          : '-',
      },
      {
        key: 'single',
        label: tt('price_compare_cart_single_market', 'Tek market toplamı'),
        value:
          typeof basketDisplayTotals.bestSingleMarketTotal === 'number'
            ? formatLocalizedPrice(preferredLocale, basketDisplayTotals.bestSingleMarketTotal, 'TRY')
            : '-',
      },
      {
        key: 'highest',
        label: tt('price_compare_cart_highest_market', 'En yüksek market toplamı'),
        value:
          typeof highestMarketTotalValue === 'number'
            ? formatLocalizedPrice(preferredLocale, highestMarketTotalValue, 'TRY')
            : '-',
      },
      {
        key: 'nearest',
        label: tt('price_compare_cart_nearest_market', 'En yakın market'),
        value:
          typeof basketDisplayTotals.nearestMarketTotal === 'number'
            ? formatLocalizedPrice(preferredLocale, basketDisplayTotals.nearestMarketTotal, 'TRY')
            : tt('price_compare_nearest_pending', 'Hazır değil'),
      },
    ],
    [basketDisplayTotals, hasBasketPricing, highestMarketTotalValue, preferredLocale, tt]
  );

  const marketSheetDetails = useMemo(() => {
    if (!marketSheetState) {
      return [];
    }

    const { market } = marketSheetState;

    return [
      {
        key: 'total',
        label: tt('price_compare_market_sheet_total', 'Toplam'),
        value: formatLocalizedPrice(preferredLocale, market.basketTotal, 'TRY'),
      },
      {
        key: 'coverage',
        label: tt('price_compare_market_sheet_coverage', 'Kapsama'),
        value: tt('price_compare_cart_coverage', '{{covered}}/{{total}} ürün')
          .replace('{{covered}}', String(market.availableItemCount))
          .replace('{{total}}', String(analysisRequestedCartQuantity)),
      },
      {
        key: 'missing',
        label: tt('price_compare_market_sheet_missing', 'Eksik ürün'),
        value: String(market.missingItemCount),
      },
      formatDistanceMeters(tt, market.distanceMeters)
        ? {
            key: 'distance',
            label: tt('price_compare_market_sheet_distance', 'Mesafe'),
            value: formatDistanceMeters(tt, market.distanceMeters) ?? '',
          }
        : null,
      market.branchName
        ? {
            key: 'branch',
            label: tt('price_compare_market_sheet_branch', 'Şube'),
            value: market.branchName,
          }
        : null,
    ].filter(Boolean) as { key: string; label: string; value: string }[];
  }, [analysisRequestedCartQuantity, marketSheetState, preferredLocale, tt]);

  const marketSheetActions = useMemo(() => {
    if (!marketSheetState) {
      return [];
    }

    const market = marketSheetState.market;
    const actions: {
      key: string;
      label: string;
      onPress: () => void;
      iconName?: keyof typeof Ionicons.glyphMap;
      tone?: 'primary' | 'teal';
    }[] = [];

    if (typeof market.latitude === 'number' && typeof market.longitude === 'number') {
      actions.push({
        key: 'maps',
        label: tt('price_compare_market_sheet_open_map', 'Haritada Aç'),
        iconName: 'navigate-outline',
        tone: 'teal',
        onPress: () => {
          const url = `https://www.google.com/maps/search/?api=1&query=${market.latitude},${market.longitude}`;
          void Linking.openURL(url);
        },
      });
    }

    return actions;
  }, [marketSheetState, tt]);

  const openBasketEntryDetail = useCallback(
    (entry: PriceCompareCartEntry) => {
      if (entry.product.barcode) {
        navigation.navigate('Detail', {
          barcode: entry.product.barcode,
          entrySource: 'unknown',
          lookupMode: 'auto',
        });
        return;
      }

      openItemInPriceCompare(entry.product.productName);
    },
    [navigation, openItemInPriceCompare]
  );

  const handleShareBasket = useCallback(async () => {
    try {
      await Share.share({
        title: shoppingListName.trim() || tt('price_compare_cart_title', 'Karşılaştırma Sepeti'),
        message: buildShareableBasketSummary(
          preferredLocale,
          shoppingListName.trim() || tt('price_compare_cart_title', 'Karşılaştırma Sepeti'),
          analysisEntries,
          comparisonMarketColumns,
          {
            mixedCheapestTotal: basketDisplayTotals.mixedCheapestTotal,
            bestSingleMarketTotal: basketDisplayTotals.bestSingleMarketTotal,
          }
        ),
      });
    } catch (error) {
      console.warn('[PriceCompareBasketScreen] share basket failed:', error);
    }
  }, [
    analysisEntries,
    basketDisplayTotals.bestSingleMarketTotal,
    basketDisplayTotals.mixedCheapestTotal,
    comparisonMarketColumns,
    preferredLocale,
    shoppingListName,
    tt,
  ]);

  const handlePrintBasket = useCallback(async () => {
    try {
      await Share.share({
        title: `${shoppingListName.trim() || tt('price_compare_cart_title', 'Karşılaştırma Sepeti')} - Yazdir`,
        message: buildShareableBasketSummary(
          preferredLocale,
          shoppingListName.trim() || tt('price_compare_cart_title', 'Karşılaştırma Sepeti'),
          analysisEntries,
          comparisonMarketColumns,
          {
            mixedCheapestTotal: basketDisplayTotals.mixedCheapestTotal,
            bestSingleMarketTotal: basketDisplayTotals.bestSingleMarketTotal,
          }
        ),
      });
    } catch (error) {
      console.warn('[PriceCompareBasketScreen] print basket failed:', error);
    }
  }, [
    analysisEntries,
    basketDisplayTotals.bestSingleMarketTotal,
    basketDisplayTotals.mixedCheapestTotal,
    comparisonMarketColumns,
    preferredLocale,
    shoppingListName,
    tt,
  ]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AmbientBackdrop colors={colors} variant="settings" />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: layout.headerTopPadding,
          paddingBottom: layout.contentBottomPadding,
          paddingHorizontal: layout.horizontalPadding,
        }}
      >
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: withAlpha(colors.card, isDark ? 'F1' : 'FC'),
              borderColor: withAlpha(colors.border, 'BC'),
              shadowColor: colors.shadow,
            },
          ]}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={[
                styles.backButtonCompact,
                { backgroundColor: withAlpha(colors.primary, '10') },
              ]}
              onPress={() => navigation.goBack()}
              activeOpacity={0.85}
            >
              <Ionicons name="chevron-back" size={18} color={colors.primary} />
            </TouchableOpacity>

            <View style={styles.headerTextWrap}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                {tt('price_compare_basket_page_title', 'Alışveriş Sepeti')}
              </Text>
              <Text style={[styles.headerSubtitle, { color: colors.mutedText }]}>
                {tt(
                  'price_compare_basket_page_subtitle',
                  'Ürünlerini, market toplamlarını ve tasarruf farkını bu ekranda yönet.'
                )}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor: withAlpha(colors.cardElevated, 'F1'),
              borderColor: withAlpha(colors.border, 'BC'),
              shadowColor: colors.shadow,
            },
          ]}
        >
          <Text style={[styles.summaryTitle, { color: colors.text }]}>
            {shoppingListName.trim() || tt('price_compare_cart_title', 'Karşılaştırma Sepeti')}
          </Text>
          <Text style={[styles.summarySubtitle, { color: colors.mutedText }]}>
            {entries.length
              ? `${tt(
                  'price_compare_basket_count_summary',
                  'Bu sepette {{count}} ürün var'
                ).replace('{{count}}', String(entries.length))} • ${tt(
                  'price_compare_cart_subtitle_compact',
                  'Karışık sepet, tek market ve yakın market toplamlarını tek yerde gör.'
                )}`
              : tt(
                  'price_compare_cart_empty_subtitle',
                  'Fiyat ekranından ürün ekleyerek alışveriş listeni oluşturmaya başla.'
                )}
          </Text>

          {entries.length ? (
            <View style={styles.summaryCoverageRow}>
              <View
                style={[
                  styles.summaryCoveragePill,
                  { backgroundColor: withAlpha(colors.teal, '16') },
                ]}
              >
                <Text style={[styles.summaryCoverageValue, { color: colors.teal }]}>
                  {basketCoverageSummary.pricedItemCount}
                </Text>
                <Text style={[styles.summaryCoverageLabel, { color: colors.teal }]}>
                  {tt('price_compare_basket_priced_items', 'Canlı fiyat bulunan ürün')}
                </Text>
              </View>
              <View
                style={[
                  styles.summaryCoveragePill,
                  { backgroundColor: withAlpha(colors.warning, '18') },
                ]}
              >
                <Text style={[styles.summaryCoverageValue, { color: colors.warning }]}>
                  {basketCoverageSummary.unpricedItemCount}
                </Text>
                <Text style={[styles.summaryCoverageLabel, { color: colors.warning }]}>
                  {tt('price_compare_basket_pending_items', 'Canlı fiyat bekleyen ürün')}
                </Text>
              </View>
            </View>
          ) : null}

          <Text style={[styles.searchLabel, { color: colors.text }]}>
            {tt('price_compare_list_name_label', 'Alışveriş listesi')}
          </Text>
          <TextInput
            value={shoppingListName}
            onChangeText={setShoppingListName}
            placeholder={tt('price_compare_list_name_placeholder', 'Örn. Haftalık Market Listesi')}
            placeholderTextColor={`${colors.text}55`}
            style={[
              styles.listNameInput,
              {
                color: colors.text,
                borderColor: withAlpha(colors.border, 'C8'),
                backgroundColor: withAlpha(colors.backgroundMuted, isDark ? 'D4' : 'F5'),
              },
            ]}
          />

          <View style={styles.listActionRow}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => {
                void handleSaveShoppingList();
              }}
              disabled={!entries.length || shoppingListSaving}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: colors.primary,
                  opacity: !entries.length || shoppingListSaving ? 0.6 : 1,
                },
              ]}
            >
              <Ionicons name="save-outline" size={16} color={colors.primaryContrast} />
              <Text style={[styles.primaryButtonText, { color: colors.primaryContrast }]}>
                {shoppingListSaving
                  ? tt('price_compare_list_saving', 'Kaydediliyor...')
                  : activeSavedListId
                    ? tt('price_compare_list_update', 'Listeyi Güncelle')
                    : tt('price_compare_list_save', 'Listeyi Kaydet')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.88}
              onPress={clearEntries}
              disabled={!entries.length}
              style={[
                styles.secondaryButton,
                {
                  borderColor: withAlpha(colors.border, 'BC'),
                  backgroundColor: withAlpha(colors.backgroundMuted, isDark ? 'A8' : 'F5'),
                  opacity: !entries.length ? 0.55 : 1,
                },
              ]}
            >
              <Ionicons name="trash-outline" size={16} color={colors.text} />
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                {tt('price_compare_list_clear', 'Listeyi Temizle')}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.coverageHint, { color: colors.mutedText }]}>
            {tt(
              'price_compare_market_coverage_hint',
              'Her üründe tüm marketlerde fiyat bulunmayabilir; eşleşen barkod veya isim-gramaj verisi geldikçe kapsama genişler.'
            )}
          </Text>
        </View>

        {savedLists.length ? (
          <View style={styles.savedListsWrap}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {tt('price_compare_saved_lists_title', 'Kayıtlı Listeler')}
            </Text>
            <View style={styles.savedListsStack}>
              {savedLists.map((list) => (
                <View
                  key={list.id}
                  style={[
                    styles.savedListCard,
                    {
                      backgroundColor: withAlpha(colors.card, 'F8'),
                      borderColor: withAlpha(
                        activeSavedListId === list.id ? colors.primary : colors.border,
                        activeSavedListId === list.id ? 'FF' : 'BC'
                      ),
                    },
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => {
                      handleLoadSavedList(list);
                    }}
                    style={styles.savedListMain}
                  >
                    <View style={styles.savedListTitleRow}>
                      <Text style={[styles.savedListTitle, { color: colors.text }]} numberOfLines={1}>
                        {list.name}
                      </Text>
                      {list.isPinned ? (
                        <Ionicons name="bookmark" size={14} color={colors.primary} />
                      ) : null}
                    </View>
                    <Text style={[styles.savedListMeta, { color: colors.mutedText }]} numberOfLines={1}>
                      {tt('price_compare_saved_list_meta', '{{count}} ürün').replace(
                        '{{count}}',
                        String(list.itemCount)
                      )}
                      {formatLocalizedDateTime(preferredLocale, list.updatedAt)
                        ? ` • ${formatLocalizedDateTime(preferredLocale, list.updatedAt)}`
                        : ''}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.savedListActions}>
                    <TouchableOpacity
                      activeOpacity={0.88}
                      onPress={() => {
                        void handleTogglePinSavedList(list.id);
                      }}
                      style={[
                        styles.savedListActionButton,
                        { backgroundColor: withAlpha(colors.primary, '10') },
                      ]}
                    >
                      <Ionicons
                        name={list.isPinned ? 'bookmark' : 'bookmark-outline'}
                        size={16}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.88}
                      onPress={() => {
                        void handleDuplicateSavedList(list.id);
                      }}
                      style={[
                        styles.savedListActionButton,
                        { backgroundColor: withAlpha(colors.teal, '10') },
                      ]}
                    >
                      <Ionicons name="copy-outline" size={16} color={colors.teal} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.88}
                      onPress={() => {
                        void handleDeleteSavedList(list.id);
                      }}
                      style={[
                        styles.savedListActionButton,
                        { backgroundColor: withAlpha(colors.danger, '10') },
                      ]}
                    >
                      <Ionicons name="close-outline" size={18} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {entries.length ? (
          <>
            <View style={styles.filterToggleRow}>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => {
                  setShowPricedOnly(false);
                }}
                style={[
                  styles.filterTogglePill,
                  {
                    backgroundColor: !showPricedOnly
                      ? withAlpha(colors.primary, '18')
                      : withAlpha(colors.backgroundMuted, isDark ? 'B8' : 'F5'),
                    borderColor: !showPricedOnly
                      ? withAlpha(colors.primary, '60')
                      : withAlpha(colors.border, 'BC'),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterToggleText,
                    { color: !showPricedOnly ? colors.primary : colors.text },
                  ]}
                >
                  {tt('price_compare_filter_all_items', 'Tüm ürünler')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => {
                  if (pricedEntries.length) {
                    setShowPricedOnly(true);
                  }
                }}
                style={[
                  styles.filterTogglePill,
                  {
                    backgroundColor: showPricedOnly
                      ? withAlpha(colors.teal, '18')
                      : withAlpha(colors.backgroundMuted, isDark ? 'B8' : 'F5'),
                    borderColor: showPricedOnly
                      ? withAlpha(colors.teal, '60')
                      : withAlpha(colors.border, 'BC'),
                    opacity: pricedEntries.length ? 1 : 0.55,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterToggleText,
                    { color: showPricedOnly ? colors.teal : colors.text },
                  ]}
                >
                  {tt('price_compare_filter_priced_items', 'Yalnız fiyatı bulunanlar')}
                </Text>
              </TouchableOpacity>
            </View>

            {showPricedOnly && analysisEntries.length !== entries.length ? (
              <Text style={[styles.coverageHint, { color: colors.teal }]}>
                {tt(
                  'price_compare_filter_priced_summary',
                  'Hızlı analiz yalnız fiyatı bulunan {{count}} ürün üzerinden yapılıyor.'
                ).replace('{{count}}', String(analysisEntries.length))}
              </Text>
            ) : null}

            <View
              style={[
                styles.metricsCard,
                {
                  backgroundColor: withAlpha(colors.cardElevated, 'F1'),
                  borderColor: withAlpha(colors.border, 'BC'),
                },
              ]}
            >
              {cartSummaryRows.map((row) => (
                <View
                  key={row.key}
                  style={[
                    styles.metricRow,
                    { borderBottomColor: withAlpha(colors.border, '80') },
                  ]}
                >
                  <Text style={[styles.metricLabel, { color: colors.mutedText }]}>
                    {row.label}
                  </Text>
                  <Text style={[styles.metricValue, { color: colors.text }]}>{row.value}</Text>
                </View>
              ))}
            </View>

            {typeof cartDifferenceValue === 'number' ? (
              <Text style={[styles.coverageHint, { color: colors.teal }]}>
                {tt(
                  'price_compare_cart_difference',
                  'Parça parça en ucuzları alırsan {{value}} avantaj var.'
                ).replace(
                  '{{value}}',
                  formatLocalizedPrice(preferredLocale, cartDifferenceValue, 'TRY')
                )}
              </Text>
            ) : null}

            {basketCompareLoading ? (
              <Text style={[styles.coverageHint, { color: colors.mutedText }]}>
                {tt('price_compare_basket_loading', 'Canlı sepet kıyası hazırlanıyor...')}
              </Text>
            ) : null}

            {basketCompareError ? (
              <Text style={[styles.coverageHint, { color: colors.warning }]}>
                {basketCompareError}
              </Text>
            ) : null}

            {!basketCompareLoading && !hasBasketPricing ? (
              <Text style={[styles.coverageHint, { color: colors.warning }]}>
                {tt(
                  'price_compare_basket_no_live_prices',
                  'Bu listedeki ürünler için henüz canlı market fiyatı bulunamadı.'
                )}
              </Text>
            ) : null}

            <View style={styles.matrixSectionHeader}>
              <View style={styles.matrixSectionTitleWrap}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {tt('price_compare_cart_matrix_title', 'Fiyatları Karşılaştır')}
                </Text>
                <View
                  style={[
                    styles.matrixNewBadge,
                    { backgroundColor: withAlpha(colors.primary, '18') },
                  ]}
                >
                  <Text style={[styles.matrixNewBadgeText, { color: colors.primary }]}>
                    {tt('price_compare_new_badge', 'Yeni!')}
                  </Text>
                </View>
              </View>

              <View style={styles.matrixHeaderActions}>
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => {
                    void handleShareBasket();
                  }}
                  style={[
                    styles.matrixHeaderButton,
                    {
                      borderColor: withAlpha(colors.primary, '44'),
                      backgroundColor: withAlpha(colors.primary, '10'),
                    },
                  ]}
                >
                  <Ionicons name="share-social-outline" size={15} color={colors.primary} />
                  <Text style={[styles.matrixHeaderButtonText, { color: colors.primary }]}>
                    {tt('price_compare_share_list', 'Listeyi paylaş')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => {
                    void handlePrintBasket();
                  }}
                  style={[
                    styles.matrixHeaderButton,
                    {
                      borderColor: withAlpha(colors.primary, '44'),
                      backgroundColor: withAlpha(colors.backgroundMuted, isDark ? 'B8' : 'FC'),
                    },
                  ]}
                >
                  <Ionicons name="print-outline" size={15} color={colors.primary} />
                  <Text style={[styles.matrixHeaderButtonText, { color: colors.primary }]}>
                    {tt('price_compare_print_list', 'Listeyi Yazdır')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <View
              style={[
                styles.matrixCard,
                {
                  backgroundColor: withAlpha(colors.cardElevated, 'F1'),
                  borderColor: withAlpha(colors.border, 'BC'),
                  width: matrixViewportWidth,
                  alignSelf: 'flex-start',
                },
              ]}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator
                contentContainerStyle={styles.matrixScrollContent}
              >
                <View>
                  <View
                    style={[
                      styles.matrixHeaderRow,
                      { borderBottomColor: withAlpha(colors.border, 'A0') },
                    ]}
                  >
                    <View
                      style={[
                        styles.matrixHeaderLeadCell,
                        {
                          backgroundColor: withAlpha(colors.backgroundMuted, isDark ? '88' : 'F6'),
                          borderRightColor: withAlpha(colors.border, '90'),
                          shadowColor: '#000',
                          shadowOpacity: isDark ? 0.18 : 0.08,
                          shadowRadius: 10,
                          shadowOffset: { width: 6, height: 0 },
                          elevation: 3,
                          zIndex: 2,
                        },
                      ]}
                    >
                      <Text style={[styles.matrixHeaderLeadValue, { color: colors.text }]}>
                        {tt('price_compare_basket_market_count', '{{count}} market listeleniyor').replace(
                          '{{count}}',
                          String(comparisonMarketColumns.length)
                        )}
                      </Text>
                    </View>

                    {comparisonMarketColumns.map((column) => (
                      <TouchableOpacity
                        key={`market-head-${column.id}`}
                        activeOpacity={column.total ? 0.88 : 1}
                        onPress={() => {
                          if (column.total) {
                            setMarketSheetState({ kind: 'basket', market: column.total });
                          }
                        }}
                        style={[
                          styles.matrixMarketHeaderCell,
                          {
                            borderRightColor: withAlpha(colors.border, '90'),
                            backgroundColor: withAlpha(colors.backgroundMuted, isDark ? '70' : 'FC'),
                          },
                        ]}
                      >
                        {column.marketLogoUrl ? (
                          <Image
                            source={{ uri: column.marketLogoUrl }}
                            style={styles.matrixMarketLogo}
                            resizeMode="contain"
                          />
                        ) : (
                          <Text style={[styles.matrixMarketHeaderText, { color: colors.text }]}>
                            {column.marketName}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>

                  {comparisonRows.map((row) => {
                    const resolution = entryResolutionState[row.entryId];

                    return (
                      <View
                        key={`matrix-row-${row.entryId}`}
                        style={[
                          styles.matrixRow,
                          { borderBottomColor: withAlpha(colors.border, '90') },
                        ]}
                      >
                        <TouchableOpacity
                          activeOpacity={0.9}
                          onPress={() => {
                            openBasketEntryDetail(row.entry);
                          }}
                          style={[
                            styles.matrixProductCell,
                            {
                              borderRightColor: withAlpha(colors.border, '90'),
                              backgroundColor: withAlpha(
                                colors.backgroundMuted,
                                isDark ? '78' : 'FB'
                              ),
                              shadowColor: '#000',
                              shadowOpacity: isDark ? 0.18 : 0.08,
                              shadowRadius: 10,
                              shadowOffset: { width: 6, height: 0 },
                              elevation: 3,
                              zIndex: 2,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.matrixProductImageWrap,
                              {
                                backgroundColor: withAlpha(
                                  colors.backgroundMuted,
                                  isDark ? 'A0' : 'F5'
                                ),
                              },
                            ]}
                          >
                            {row.imageUrl ? (
                              <Image
                                source={{ uri: row.imageUrl }}
                                style={styles.matrixProductImage}
                                resizeMode="contain"
                              />
                            ) : (
                              <Ionicons name="basket-outline" size={24} color={colors.primary} />
                            )}
                          </View>

                          <Text style={[styles.matrixProductTitle, { color: colors.text }]} numberOfLines={3}>
                            {row.title}
                          </Text>
                          {row.subtitle ? (
                            <Text
                              style={[styles.matrixProductMeta, { color: colors.mutedText }]}
                              numberOfLines={2}
                            >
                              {row.subtitle}
                            </Text>
                          ) : null}

                          {resolution?.success ? (
                            <View
                              style={[
                                styles.matrixStatusBadge,
                                { backgroundColor: withAlpha(colors.teal, '12') },
                              ]}
                            >
                              <Text style={[styles.matrixStatusBadgeText, { color: colors.teal }]}>
                                {tt('price_compare_similar_match_success_short', 'Eşleşti')}
                              </Text>
                            </View>
                          ) : null}

                          <View
                            style={[
                              styles.matrixQuantityRow,
                              {
                                borderColor: withAlpha(colors.border, 'B8'),
                                backgroundColor: withAlpha(
                                  colors.backgroundMuted,
                                  isDark ? 'B8' : 'F8'
                                ),
                              },
                            ]}
                          >
                            <TouchableOpacity
                              activeOpacity={0.88}
                              onPress={() => {
                                decreaseQuantity(row.entryId);
                              }}
                              style={styles.matrixQuantityButton}
                            >
                              <Ionicons name="remove" size={16} color={colors.primary} />
                            </TouchableOpacity>
                            <Text style={[styles.matrixQuantityValue, { color: colors.text }]}>
                              {row.entry.quantity}
                            </Text>
                            <TouchableOpacity
                              activeOpacity={0.88}
                              onPress={() => {
                                increaseQuantity(row.entryId);
                              }}
                              style={styles.matrixQuantityButton}
                            >
                              <Ionicons name="add" size={16} color={colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              activeOpacity={0.88}
                              onPress={() => {
                                removeEntry(row.entryId);
                              }}
                              style={styles.matrixRemoveButton}
                            >
                              <Ionicons name="trash-outline" size={15} color={colors.danger} />
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>

                        {comparisonMarketColumns.map((column) => {
                          const offer = row.marketOfferMap.get(column.id);
                          const isBestPrice = Boolean(offer && row.cheapestMarketId === column.id);

                          return (
                            <View
                              key={`matrix-cell-${row.entryId}-${column.id}`}
                              style={[
                                styles.matrixValueCell,
                                {
                                  borderRightColor: withAlpha(colors.border, '90'),
                                  backgroundColor: isBestPrice
                                    ? withAlpha(colors.primary, isDark ? '1A' : '10')
                                    : 'transparent',
                                },
                              ]}
                            >
                              {offer ? (
                                <>
                                  <Text style={[styles.matrixCellPrice, { color: colors.text }]}>
                                    {formatLocalizedPrice(preferredLocale, offer.price, offer.currency)}
                                  </Text>
                                  <Text
                                    style={[styles.matrixCellMeta, { color: colors.mutedText }]}
                                    numberOfLines={1}
                                  >
                                    {offer.unitPrice && offer.unitPriceUnit
                                      ? `${offer.unitPrice.toFixed(2)} ${offer.currency}/${offer.unitPriceUnit}`
                                      : offer.branchName || offer.marketName}
                                  </Text>
                                  {isBestPrice ? (
                                    <View
                                      style={[
                                        styles.matrixStatusBadge,
                                        { backgroundColor: withAlpha(colors.teal, '12') },
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.matrixStatusBadgeText,
                                          { color: colors.teal },
                                        ]}
                                      >
                                        {tt('price_compare_market_best_short', 'En ucuz')}
                                      </Text>
                                    </View>
                                  ) : null}
                                </>
                              ) : (
                                <>
                                  <Ionicons
                                    name="cart-outline"
                                    size={24}
                                    color={withAlpha(colors.mutedText, '88')}
                                  />
                                  <TouchableOpacity
                                    activeOpacity={0.88}
                                    onPress={() => {
                                      if (!hasLiveOfferForEntry(row.entry, cityCode)) {
                                        void handleResolveSimilarEntry(row.entry);
                                        return;
                                      }

                                      openItemInPriceCompare(
                                        row.entry.product.barcode || row.entry.product.productName
                                      );
                                    }}
                                    disabled={resolution?.loading}
                                    style={[
                                      styles.matrixAltButton,
                                      {
                                        borderColor: withAlpha(colors.primary, '44'),
                                        backgroundColor: withAlpha(colors.primary, '10'),
                                        opacity: resolution?.loading ? 0.7 : 1,
                                      },
                                    ]}
                                  >
                                    <Text style={[styles.matrixAltButtonText, { color: colors.primary }]}>
                                      {resolution?.loading
                                        ? tt('price_compare_trying_similar_match_short', 'Aranıyor')
                                        : tt('price_compare_alternative_pick_short', 'Alternatif')}
                                    </Text>
                                  </TouchableOpacity>
                                </>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}

                  <View
                    style={[
                      styles.matrixFooterRow,
                      {
                        borderTopColor: withAlpha(colors.border, 'A0'),
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.matrixFooterLeadCell,
                        {
                          backgroundColor: withAlpha(colors.backgroundMuted, isDark ? '88' : 'F6'),
                          borderRightColor: withAlpha(colors.border, '90'),
                          shadowColor: '#000',
                          shadowOpacity: isDark ? 0.18 : 0.08,
                          shadowRadius: 10,
                          shadowOffset: { width: 6, height: 0 },
                          elevation: 3,
                          zIndex: 2,
                        },
                      ]}
                    >
                      <Text style={[styles.matrixFooterTitle, { color: colors.text }]}>
                        {tt('price_compare_market_sheet_total', 'Toplam')}
                      </Text>
                    </View>

                    {comparisonMarketColumns.map((column) => (
                      <TouchableOpacity
                        key={`market-total-${column.id}`}
                        activeOpacity={column.total ? 0.88 : 1}
                        onPress={() => {
                          if (column.total) {
                            setMarketSheetState({ kind: 'basket', market: column.total });
                          }
                        }}
                        style={[
                          styles.matrixFooterCell,
                          {
                            borderRightColor: withAlpha(colors.border, '90'),
                            backgroundColor:
                              column.total &&
                              typeof basketDisplayTotals.bestSingleMarketTotal === 'number' &&
                              column.total.basketTotal === basketDisplayTotals.bestSingleMarketTotal
                                ? withAlpha(colors.teal, isDark ? '18' : '10')
                                : 'transparent',
                          },
                        ]}
                      >
                        {column.total ? (
                          <>
                            <Text style={[styles.matrixCellPrice, { color: colors.text }]}>
                              {formatLocalizedPrice(
                                preferredLocale,
                                column.total.basketTotal,
                                'TRY'
                              )}
                            </Text>
                            <Text
                              style={[styles.matrixCellMeta, { color: colors.mutedText }]}
                              numberOfLines={2}
                            >
                              {tt('price_compare_cart_coverage', '{{covered}}/{{total}} ürün')
                                .replace('{{covered}}', String(column.total.availableItemCount))
                                .replace('{{total}}', String(analysisRequestedCartQuantity))}
                            </Text>
                          </>
                        ) : (
                          <Text style={[styles.matrixCellMeta, { color: colors.mutedText }]}>-</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </ScrollView>
            </View>

            <View
              style={[
                styles.matrixNotesCard,
                {
                  backgroundColor: withAlpha(colors.cardElevated, 'F1'),
                  borderColor: withAlpha(colors.border, 'BC'),
                },
              ]}
            >
              {[
                tt(
                  'price_compare_note_out_of_stock',
                  'Ürün ilgili markette yoksa hücrede alternatif aksiyonu görünür.'
                ),
                tt(
                  'price_compare_note_coverage',
                  'Konum veya barkod eşleşmesi eksikse bazı market sütunları boş kalabilir.'
                ),
                tt(
                  'price_compare_note_best_mix',
                  'Toplam satırı karışık en ucuz sepet ile tek market toplamını hızlı karşılaştırman için özetlenir.'
                ),
              ].map((note) => (
                <View key={note} style={styles.matrixNoteRow}>
                  <Text style={[styles.matrixNoteBullet, { color: colors.primary }]}>•</Text>
                  <Text style={[styles.matrixNoteText, { color: colors.mutedText }]}>{note}</Text>
                </View>
              ))}
            </View>

            {basketDisplayTotals.missingItems.length ? (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {tt('price_compare_missing_items_title', 'Eksik Ürünler')}
                </Text>
                <View style={styles.stack}>
                  {basketDisplayTotals.missingItems.map((item) => {
                    const sourceEntry = analysisEntries.find(
                      (entry) => entry.product.barcode === item.barcode
                    );
                    const matchedProduct = sourceEntry?.product;

                    return (
                      <View
                        key={`missing-${item.barcode}`}
                        style={[
                          styles.cartItemCard,
                          {
                            backgroundColor: withAlpha(colors.cardElevated, 'F1'),
                            borderColor: withAlpha(colors.warning, '40'),
                          },
                        ]}
                      >
                        <View style={styles.cartItemTextWrap}>
                          <Text
                            style={[styles.cartItemTitle, { color: colors.text }]}
                            numberOfLines={2}
                          >
                            {matchedProduct?.productName || item.barcode}
                          </Text>
                          <Text style={[styles.cartItemMeta, { color: colors.mutedText }]}>
                            {tt('price_compare_missing_item_quantity', '{{count}} adet eksik').replace(
                              '{{count}}',
                              String(item.quantity)
                            )}
                          </Text>
                          {sourceEntry &&
                          entryResolutionState[getProductIdentity(sourceEntry.product)]?.success ? (
                            <View
                              style={[
                                styles.successBadge,
                                { backgroundColor: withAlpha(colors.teal, '14') },
                              ]}
                            >
                              <Ionicons name="checkmark-circle" size={14} color={colors.teal} />
                              <Text style={[styles.successBadgeText, { color: colors.teal }]}>
                                {entryResolutionState[getProductIdentity(sourceEntry.product)]?.success}
                              </Text>
                            </View>
                          ) : null}
                          {sourceEntry &&
                          entryResolutionState[getProductIdentity(sourceEntry.product)]?.success &&
                          entryResolutionState[getProductIdentity(sourceEntry.product)]?.originalLabel &&
                          entryResolutionState[getProductIdentity(sourceEntry.product)]?.matchedLabel ? (
                            <Text style={[styles.cartItemHint, { color: colors.mutedText }]}>
                              {tt(
                                'price_compare_similar_match_detail',
                                'Orijinal: {{original}} • Eslesti: {{matched}}'
                              )
                                .replace(
                                  '{{original}}',
                                  entryResolutionState[getProductIdentity(sourceEntry.product)]?.originalLabel || ''
                                )
                                .replace(
                                  '{{matched}}',
                                  entryResolutionState[getProductIdentity(sourceEntry.product)]?.matchedLabel || ''
                                )}
                            </Text>
                          ) : null}
                          <TouchableOpacity
                            activeOpacity={0.88}
                            onPress={() => {
                              if (sourceEntry) {
                                void handleResolveSimilarEntry(sourceEntry);
                                return;
                              }

                              openItemInPriceCompare(matchedProduct?.barcode || matchedProduct?.productName || item.barcode);
                            }}
                            disabled={
                              sourceEntry
                                ? entryResolutionState[getProductIdentity(sourceEntry.product)]?.loading
                                : false
                            }
                            style={[
                              styles.researchButton,
                              {
                                backgroundColor: withAlpha(colors.warning, '12'),
                                borderColor: withAlpha(colors.warning, '44'),
                                opacity:
                                  sourceEntry &&
                                  entryResolutionState[getProductIdentity(sourceEntry.product)]?.loading
                                    ? 0.7
                                    : 1,
                              },
                            ]}
                          >
                            <Ionicons name="search-outline" size={14} color={colors.warning} />
                            <Text style={[styles.researchButtonText, { color: colors.warning }]}>
                              {sourceEntry &&
                              entryResolutionState[getProductIdentity(sourceEntry.product)]?.loading
                                ? tt(
                                    'price_compare_trying_similar_match',
                                    'Benzer eşleşme aranıyor...'
                                  )
                                : tt(
                                    'price_compare_try_similar_match',
                                    'Benzer eşleşmeyi dene'
                                  )}
                            </Text>
                          </TouchableOpacity>
                          {sourceEntry &&
                          entryResolutionState[getProductIdentity(sourceEntry.product)]?.error ? (
                            <Text style={[styles.cartItemHint, { color: colors.warning }]}>
                              {entryResolutionState[getProductIdentity(sourceEntry.product)]?.error}
                            </Text>
                          ) : null}
                        </View>
                        <Ionicons name="alert-circle-outline" size={20} color={colors.warning} />
                      </View>
                    );
                  })}
                </View>
              </>
            ) : null}
          </>
        ) : (
          <View
            style={[
              styles.emptyState,
              {
                borderColor: withAlpha(colors.border, '80'),
                backgroundColor: withAlpha(colors.backgroundMuted, isDark ? 'A8' : 'F3'),
              },
            ]}
          >
            <Ionicons name="basket-outline" size={24} color={colors.primary} />
            <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
              {tt('price_compare_cart_empty_title', 'Sepetin henüz boş')}
            </Text>
            <Text style={[styles.emptyStateText, { color: colors.mutedText }]}>
              {tt(
                'price_compare_basket_page_empty_body',
                'Fiyat ekranından ürün eklediğinde burada toplam analizleri ve market kıyaslarını göreceksin.'
              )}
            </Text>
          </View>
        )}
      </ScrollView>

      <MarketOfferSheet
        visible={Boolean(marketSheetState)}
        title={marketSheetState?.market.marketName || ''}
        subtitle={tt('price_compare_market_sheet_basket_subtitle', 'Sepet toplamı ve kapsama detayı')}
        marketName={marketSheetState?.market.marketName || ''}
        marketKey={marketSheetState?.market.marketKey || null}
        marketLogoUrl={marketSheetState?.market.marketLogoUrl || null}
        details={marketSheetDetails}
        actions={marketSheetActions}
        onClose={() => {
          setMarketSheetState(null);
        }}
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
    borderRadius: 28,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  backButtonCompact: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  summaryCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  summarySubtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  summaryCoverageRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  summaryCoveragePill: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  summaryCoverageValue: {
    fontSize: 20,
    fontWeight: '900',
  },
  summaryCoverageLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  filterToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  filterTogglePill: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  filterToggleText: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  searchLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  listNameInput: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 12,
  },
  listActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  coverageHint: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  matrixSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  matrixSectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  matrixNewBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  matrixNewBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  matrixHeaderActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  matrixHeaderButton: {
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  matrixHeaderButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  savedListsWrap: {
    marginBottom: 18,
  },
  savedListsStack: {
    gap: 10,
  },
  savedListCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  savedListMain: {
    flex: 1,
    minWidth: 0,
  },
  savedListTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  savedListTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  savedListMeta: {
    fontSize: 12,
  },
  savedListActions: {
    flexDirection: 'row',
    gap: 8,
  },
  savedListActionButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsCard: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 6,
    marginBottom: 12,
  },
  metricRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  metricLabel: {
    flex: 1,
    fontSize: 13,
    paddingRight: 12,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  stack: {
    gap: 10,
    marginBottom: 18,
  },
  matrixCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 18,
  },
  matrixNotesCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginBottom: 18,
  },
  matrixNoteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  matrixNoteBullet: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '800',
  },
  matrixNoteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  matrixScrollContent: {
    paddingBottom: 6,
  },
  matrixHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  matrixHeaderLeadCell: {
    width: 184,
    minHeight: 68,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRightWidth: 1,
  },
  matrixHeaderLeadValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  matrixMarketHeaderCell: {
    width: 116,
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRightWidth: 1,
  },
  matrixMarketLogo: {
    width: 72,
    height: 24,
  },
  matrixMarketHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  matrixRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  matrixProductCell: {
    width: 184,
    minHeight: 168,
    padding: 12,
    borderRightWidth: 1,
  },
  matrixProductImageWrap: {
    width: 58,
    height: 58,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  matrixProductImage: {
    width: 50,
    height: 50,
  },
  matrixProductTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  matrixProductMeta: {
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 6,
  },
  matrixStatusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginBottom: 6,
  },
  matrixStatusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  matrixQuantityRow: {
    marginTop: 'auto',
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    gap: 2,
  },
  matrixQuantityButton: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matrixQuantityValue: {
    minWidth: 24,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  matrixRemoveButton: {
    marginLeft: 'auto',
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matrixValueCell: {
    width: 116,
    minHeight: 168,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRightWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  matrixCellPrice: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  matrixCellMeta: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  },
  matrixAltButton: {
    minHeight: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  matrixAltButtonText: {
    fontSize: 10,
    fontWeight: '800',
  },
  matrixFooterRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  matrixFooterLeadCell: {
    width: 184,
    minHeight: 82,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRightWidth: 1,
  },
  matrixFooterTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  matrixFooterCell: {
    width: 116,
    minHeight: 82,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRightWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  cartItemCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cartItemTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  cartItemTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  cartItemMeta: {
    fontSize: 12,
  },
  cartItemHint: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
  },
  successBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  successBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  researchButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    minHeight: 32,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  researchButtonText: {
    fontSize: 12,
    fontWeight: '800',
  },
  cartItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityStepper: {
    minWidth: 112,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  removeButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marketTotalRow: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  marketTotalTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  marketTotalTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  marketTotalMeta: {
    fontSize: 12,
  },
  marketTotalPriceWrap: {
    alignItems: 'flex-end',
  },
  marketTotalPrice: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  emptyStateText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import type { RootStackParamList } from '../../navigation/AppNavigator';
import { MarketPriceTableCard } from '../../components/MarketPriceTableCard';
import { inferMarketDisplayProductType } from '../../config/marketDisplay';
import { useAuth } from '../../context/AuthContext';
import { useTheme, type ThemeColors } from '../../context/ThemeContext';
import { useAppScreenLayout } from '../../components/layout/useAppScreenLayout';
import { AmbientBackdrop } from '../../components/ui/AmbientBackdrop';
import {
  getBestInStockOffer,
  partitionOffersByPriceSourceType,
} from '../../services/marketPricingContract.service';
import {
  fetchLegacyMarketOfferSearch,
  fetchLegacyMarketProductOffers,
  fetchMarketBarcodeLookup,
  fetchMarketBasketCompare,
  fetchMarketProductOffers,
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
  resolveTurkeyCitySlug,
} from '../../services/locationData';
import {
  InfoActionCard,
  NoticeCard,
  PricingHighlightsSection,
  type PricingHighlightItem,
} from './detail/DetailSections';
import type {
  MarketBasketCompareResponse,
  MarketDataFreshness,
  MarketOffer,
  MarketProductOffersResponse,
  MarketSearchProduct,
} from '../../types/marketPricing';
import { usePreferenceStore } from '../../store/usePreferenceStore';
import { withAlpha } from '../../utils/color';
import { MARKET_GELSIN_RUNTIME } from '../../config/marketGelsinRuntime';
import { searchLocalPriceCompareProducts } from '../../services/priceCompareSearch.service';

type PriceCompareRoute = RouteProp<RootStackParamList, 'PriceCompare'>;
type TranslateFn = (key: string, fallback: string) => string;
type ComparisonCartEntry = {
  product: MarketSearchProduct;
  offersResponse: MarketProductOffersResponse;
  quantity: number;
};

const SEARCH_MIN_LENGTH = 2;
const REMOTE_SEARCH_TIMEOUT_MS = 2500;
const REMOTE_AUTOCOMPLETE_TIMEOUT_MS = 1800;
const REMOTE_OFFERS_TIMEOUT_MS = 2500;
const REMOTE_BASKET_TIMEOUT_MS = 3000;

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

const buildSearchVariants = (query: string): string[] => {
  const trimmed = query.trim();
  const loose = normalizeLooseSearchValue(trimmed);
  return Array.from(new Set([trimmed, loose].filter((item) => item.length >= SEARCH_MIN_LENGTH)));
};

const isBarcodeLikeQuery = (query: string): boolean =>
  /^\d{8,14}$/.test(query.trim());

const dedupeSearchProducts = (items: MarketSearchProduct[]): MarketSearchProduct[] => {
  const map = new Map<string, MarketSearchProduct>();

  items.forEach((item) => {
    const key = item.barcode || `${item.productName}-${item.brand || ''}`;
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

const MARKET_BRAND_ACCENTS = [
  '#167A78',
  '#B97719',
  '#A855F7',
  '#2563EB',
  '#DC2626',
  '#0F766E',
  '#7C3AED',
];

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

const formatLocalizedDateTime = (locale: string, value?: string | null): string => {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return '';
  }

  try {
    return new Intl.DateTimeFormat(locale || 'tr-TR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return value;
  }
};

const buildMarketOfferMeta = (
  tt: TranslateFn,
  locale: string,
  offer?: MarketOffer | null
): string => {
  if (!offer) {
    return '';
  }

  const parts: string[] = [];

  if (typeof offer.unitPrice === 'number' && offer.unitPriceUnit) {
    parts.push(
      tt('market_pricing_unit_price_template', '{{price}} / {{unit}}')
        .replace('{{price}}', formatLocalizedPrice(locale, offer.unitPrice, offer.currency))
        .replace('{{unit}}', offer.unitPriceUnit)
    );
  }

  const updatedAt = formatLocalizedDateTime(locale, offer.capturedAt);

  if (updatedAt) {
    parts.push(
      tt('market_pricing_updated_template', 'Güncellendi {{value}}').replace(
        '{{value}}',
        updatedAt
      )
    );
  }

  return parts.join(' • ');
};

const getMarketFreshnessModeLabel = (
  tt: TranslateFn,
  freshness?: MarketDataFreshness | null
): string => {
  switch (freshness?.mode) {
    case 'weekly_crawl':
      return tt('market_pricing_freshness_weekly', 'Haftalık tarama');
    case 'hot_refresh':
      return tt('market_pricing_freshness_hot', 'Sıcak yenileme');
    case 'mixed':
      return tt('market_pricing_freshness_mixed', 'Karma yenileme');
    default:
      return tt('market_pricing_freshness_unknown', 'Güncellik bilgisi');
  }
};

const buildMarketFreshnessMeta = (
  tt: TranslateFn,
  locale: string,
  freshness?: MarketDataFreshness | null
): string => {
  if (!freshness) {
    return '';
  }

  const parts: string[] = [];
  const fullRefreshAt = formatLocalizedDateTime(locale, freshness.lastFullRefreshAt);
  const hotRefreshAt = formatLocalizedDateTime(locale, freshness.lastHotRefreshAt);

  if (fullRefreshAt) {
    parts.push(
      tt('market_pricing_full_refresh_template', 'Tam tarama {{value}}').replace(
        '{{value}}',
        fullRefreshAt
      )
    );
  }

  if (hotRefreshAt) {
    parts.push(
      tt('market_pricing_hot_refresh_template', 'Hot refresh {{value}}').replace(
        '{{value}}',
        hotRefreshAt
      )
    );
  }

  return parts.join(' • ');
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

const resolveMarketAccent = (marketKey?: string | null, marketName?: string | null): string => {
  const seed = `${marketKey || ''}${marketName || ''}`;
  const hash = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return MARKET_BRAND_ACCENTS[hash % MARKET_BRAND_ACCENTS.length] ?? MARKET_BRAND_ACCENTS[0];
};

const buildMarketMonogram = (marketName?: string | null): string => {
  const parts = String(marketName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return 'M';
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
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

  if (logoUrl) {
    return (
      <Image
        source={{ uri: logoUrl }}
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

const SearchResultCard: React.FC<{
  item: MarketSearchProduct;
  selected: boolean;
  onPress: () => void;
  colors: ThemeColors;
  locale: string;
  tt: TranslateFn;
}> = ({ item, selected, onPress, colors, locale, tt }) => {
  const bestOfferLabel =
    item.bestOffer != null
      ? formatLocalizedPrice(locale, item.bestOffer.price, item.bestOffer.currency)
      : null;

  const metaParts = [item.brand, item.category, item.barcode].filter(Boolean);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[
        styles.resultCard,
        {
          backgroundColor: withAlpha(colors.cardElevated, 'F1'),
          borderColor: withAlpha(selected ? colors.primary : colors.border, selected ? 'FF' : 'BC'),
          shadowColor: colors.shadow,
        },
      ]}
    >
      <View style={styles.resultCardRow}>
        <View style={styles.resultVisualStack}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.resultImage} />
          ) : (
            <View
              style={[
                styles.resultImageFallback,
                { backgroundColor: withAlpha(colors.primary, '12') },
              ]}
            >
              <Ionicons name="pricetags-outline" size={20} color={colors.primary} />
            </View>
          )}
          {item.bestOffer ? (
            <View style={styles.resultLogoBadge}>
              <MarketBadge
                marketKey={item.bestOffer.marketKey}
                marketName={item.bestOffer.marketName}
                logoUrl={item.bestOffer.marketLogoUrl || item.marketLogoUrl}
                size={26}
              />
            </View>
          ) : null}
        </View>

        <View style={styles.resultTextWrap}>
          <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={2}>
            {item.productName}
          </Text>
          {metaParts.length ? (
            <Text style={[styles.resultMeta, { color: colors.mutedText }]} numberOfLines={2}>
              {metaParts.join(' • ')}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.resultFooterRow}>
        {bestOfferLabel ? (
          <View
            style={[
              styles.resultPill,
              { backgroundColor: withAlpha(colors.teal, '12') },
            ]}
          >
            <Text style={[styles.resultPillText, { color: colors.teal }]}>
              {bestOfferLabel}
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.resultPill,
            { backgroundColor: withAlpha(colors.primary, '12') },
          ]}
        >
          <Text style={[styles.resultPillText, { color: colors.primary }]}>
            {tt('price_compare_result_market_count', '{{count}} market')
              .replace('{{count}}', String(item.marketCount))}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export const PriceCompareScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<PriceCompareRoute>();
  const { t, i18n } = useTranslation();
  const { colors, isDark } = useTheme();
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

  const preferredLocale = i18n.language || 'tr-TR';
  const [detectedLocation, setDetectedLocation] = useState<CurrentLocationContext | null>(null);
  const [detectedLocationLoading, setDetectedLocationLoading] = useState(false);
  const [detectedLocationResolved, setDetectedLocationResolved] = useState(false);
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
  const locationLabel = effectiveDistrict
    ? `${effectiveDistrict}, ${effectiveCity ?? profile?.city ?? detectedLocation?.city ?? ''}`
    : effectiveCity || profile?.city || detectedLocation?.city || null;

  const [query, setQuery] = useState(route.params?.initialQuery ?? '');
  const [searchLoading, setSearchLoading] = useState(false);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<MarketSearchProduct[]>([]);
  const [autocompleteResults, setAutocompleteResults] = useState<MarketSearchProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<MarketSearchProduct | null>(null);
  const [offersResponse, setOffersResponse] = useState<MarketProductOffersResponse | null>(null);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState<string | null>(null);
  const [comparisonCart, setComparisonCart] = useState<ComparisonCartEntry[]>([]);
  const [basketCompareResponse, setBasketCompareResponse] =
    useState<MarketBasketCompareResponse | null>(null);
  const [basketCompareLoading, setBasketCompareLoading] = useState(false);
  const [basketCompareError, setBasketCompareError] = useState<string | null>(null);

  const loadOffers = useCallback(
    async (product: MarketSearchProduct) => {
      setSelectedProduct(product);
      setOffersLoading(true);
      setOffersError(null);

      try {
        const response = await resolveWithin(
          fetchMarketProductOffers(product.barcode, {
            cityCode: cityCode ?? undefined,
            districtName: effectiveDistrict ?? undefined,
            includeOutOfStock: true,
            limit: 24,
          }),
          REMOTE_OFFERS_TIMEOUT_MS
        );

        setOffersResponse(response);
      } catch (error) {
        console.warn('[PriceCompareScreen] primary offer load failed, trying legacy:', error);

        try {
          const legacyResponse = await resolveWithin(
            fetchLegacyMarketProductOffers({
              barcode: product.barcode,
              citySlug: citySlug ?? undefined,
              limit: 24,
            }),
            REMOTE_OFFERS_TIMEOUT_MS
          );

          setOffersResponse(legacyResponse);
        } catch (legacyError) {
          console.error('[PriceCompareScreen] offer load failed:', legacyError);
          setOffersResponse(null);
          setOffersError(
            tt(
              'price_compare_offers_error',
              'Seçilen ürün için market teklifleri şu anda yüklenemedi.'
            )
          );
        }
      } finally {
        setOffersLoading(false);
      }
    },
    [cityCode, citySlug, effectiveDistrict, tt]
  );

  const searchProducts = useCallback(
    async (rawQuery: string, limit: number, mode: 'search' | 'autocomplete') => {
      const trimmedQuery = rawQuery.trim();

      if (trimmedQuery.length < SEARCH_MIN_LENGTH) {
        return [];
      }

      const localResults = searchLocalPriceCompareProducts(trimmedQuery, limit);
      const variants = buildSearchVariants(trimmedQuery);
      const timeoutMs =
        mode === 'autocomplete' ? REMOTE_AUTOCOMPLETE_TIMEOUT_MS : REMOTE_SEARCH_TIMEOUT_MS;
      const remoteTasks: Promise<MarketSearchProduct[]>[] = [];

      if (isBarcodeLikeQuery(trimmedQuery)) {
        remoteTasks.push(
          resolveWithin(fetchMarketBarcodeLookup(trimmedQuery), timeoutMs)
            .then((result) => (result ? [result] : []))
            .catch((error) => {
              console.warn('[PriceCompareScreen] barcode lookup failed:', error);
              return [];
            })
        );
      }

      variants.forEach((variant) => {
        remoteTasks.push(
          resolveWithin(
            fetchMarketProductSearch({
              query: variant,
              cityCode: cityCode ?? undefined,
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

      if (citySlug) {
        remoteTasks.push(
          resolveWithin(
            fetchLegacyMarketOfferSearch({
              query: trimmedQuery,
              citySlug,
              barcode: isBarcodeLikeQuery(trimmedQuery) ? trimmedQuery : undefined,
              limit,
            }),
            timeoutMs
          )
            .then((response) => response.results)
            .catch((error) => {
              console.warn('[PriceCompareScreen] legacy search failed:', error);
              return [];
            })
        );
      }

      const settled = await Promise.allSettled(remoteTasks);
      const remoteResults = settled.flatMap((result) =>
        result.status === 'fulfilled' ? result.value : []
      );

      return dedupeSearchProducts([...localResults, ...remoteResults]).slice(0, limit);
    },
    [cityCode, citySlug]
  );

  const handleSearch = useCallback(async () => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < SEARCH_MIN_LENGTH) {
      setHasSearched(false);
      setResults([]);
      setSelectedProduct(null);
      setOffersResponse(null);
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

    try {
      const resolvedResults = await searchProducts(trimmedQuery, 12, 'search');

      setResults(resolvedResults);

      if (resolvedResults.length === 1 || isBarcodeLikeQuery(trimmedQuery)) {
        const exactMatch =
          resolvedResults.find((item) => item.barcode === trimmedQuery) ?? resolvedResults[0];

        if (exactMatch) {
          void loadOffers(exactMatch);
        }
      }
    } catch (error) {
      console.error('[PriceCompareScreen] search failed:', error);
      setResults([]);
      setSearchError(
        tt(
          'price_compare_results_error',
          'Ürün araması şu anda yapılamadı. Daha sonra tekrar deneyin.'
        )
      );
    } finally {
      setSearchLoading(false);
    }
  }, [loadOffers, query, searchProducts, tt]);

  const handleSelectProduct = useCallback(
    async (product: MarketSearchProduct) => {
      setQuery(product.productName);
      setHasSearched(true);
      setResults((previous) => {
        const hasProduct = previous.some((item) => item.barcode === product.barcode);
        return hasProduct ? previous : [product, ...previous];
      });
      setAutocompleteResults([]);
      await loadOffers(product);
    },
    [loadOffers]
  );

  const handleAddSelectedToCart = useCallback(() => {
    if (!selectedProduct || !offersResponse) {
      return;
    }

    setComparisonCart((previous) => {
      const existingIndex = previous.findIndex(
        (item) => item.product.barcode === selectedProduct.barcode
      );

      if (existingIndex === -1) {
        return [
          ...previous,
          {
            product: selectedProduct,
            offersResponse,
            quantity: 1,
          },
        ];
      }

      return previous.map((item, index) =>
        index === existingIndex
          ? {
              ...item,
              offersResponse,
              quantity: item.quantity + 1,
            }
          : item
      );
    });
  }, [offersResponse, selectedProduct]);

  const handleRemoveFromCart = useCallback((barcode: string) => {
    setComparisonCart((previous) =>
      previous.filter((item) => item.product.barcode !== barcode)
    );
  }, []);

  const handleIncreaseCartQuantity = useCallback((barcode: string) => {
    setComparisonCart((previous) =>
      previous.map((item) =>
        item.product.barcode === barcode
          ? {
              ...item,
              quantity: item.quantity + 1,
            }
          : item
      )
    );
  }, []);

  const handleDecreaseCartQuantity = useCallback((barcode: string) => {
    setComparisonCart((previous) =>
      previous.flatMap((item) => {
        if (item.product.barcode !== barcode) {
          return [item];
        }

        if (item.quantity <= 1) {
          return [];
        }

        return [
          {
            ...item,
            quantity: item.quantity - 1,
          },
        ];
      })
    );
  }, []);

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

    if (initialQuery && !hasSearched && initialQuery === query.trim()) {
      void handleSearch();
    }
  }, [handleSearch, hasSearched, query, route.params?.initialQuery]);

  useEffect(() => {
    if (!comparisonCart.length || !cityCode) {
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
            items: comparisonCart.map((entry) => ({
              barcode: entry.product.barcode,
              quantity: entry.quantity,
            })),
          }),
          REMOTE_BASKET_TIMEOUT_MS
        );

        if (isActive) {
          setBasketCompareResponse(response);
        }
      } catch (error) {
        console.warn('[PriceCompareScreen] basket compare failed:', error);

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
    cityCode,
    citySlug,
    comparisonCart,
    detectedLocation?.latitude,
    detectedLocation?.longitude,
    effectiveDistrict,
    tt,
  ]);

  const offerItems = useMemo(() => offersResponse?.offers ?? [], [offersResponse?.offers]);

  const pricingSummary = useMemo(() => {
    if (!offerItems.length) {
      return {
        bestLocalOffer: null as MarketOffer | null,
        bestReferenceOffer: null as MarketOffer | null,
        bestFallbackOffer: null as MarketOffer | null,
      };
    }

    const partitioned = partitionOffersByPriceSourceType(offerItems);

    return {
      bestLocalOffer: getBestInStockOffer(partitioned.localMarketOffers),
      bestReferenceOffer: getBestInStockOffer(partitioned.nationalReferenceOffers),
      bestFallbackOffer: getBestInStockOffer(offerItems),
    };
  }, [offerItems]);

  const pricingHighlightItems = useMemo<PricingHighlightItem[]>(() => {
    const items: PricingHighlightItem[] = [];
    const inStockCount = offerItems.filter((offer) => offer.inStock).length;

    if (pricingSummary.bestLocalOffer) {
      items.push({
        key: 'local-offer',
        badge: tt('market_pricing_local_badge', 'Şehrindeki fiyat'),
        title: pricingSummary.bestLocalOffer.marketName,
        priceLabel: formatLocalizedPrice(
          preferredLocale,
          pricingSummary.bestLocalOffer.price,
          pricingSummary.bestLocalOffer.currency
        ),
        helper: buildMarketOfferMeta(tt, preferredLocale, pricingSummary.bestLocalOffer),
        meta: locationLabel || undefined,
        tone: 'local',
      });
    }

    if (pricingSummary.bestReferenceOffer) {
      items.push({
        key: 'reference-offer',
        badge: tt('market_pricing_reference_badge', 'Ulusal referans'),
        title: pricingSummary.bestReferenceOffer.marketName,
        priceLabel: formatLocalizedPrice(
          preferredLocale,
          pricingSummary.bestReferenceOffer.price,
          pricingSummary.bestReferenceOffer.currency
        ),
        helper: buildMarketOfferMeta(tt, preferredLocale, pricingSummary.bestReferenceOffer),
        meta: tt('market_pricing_reference_meta', 'Referans fiyat'),
        tone: 'reference',
      });
    }

    if (!items.length && pricingSummary.bestFallbackOffer) {
      items.push({
        key: 'best-offer',
        badge: tt('market_pricing_best_badge', 'En iyi teklif'),
        title: pricingSummary.bestFallbackOffer.marketName,
        priceLabel: formatLocalizedPrice(
          preferredLocale,
          pricingSummary.bestFallbackOffer.price,
          pricingSummary.bestFallbackOffer.currency
        ),
        helper: buildMarketOfferMeta(tt, preferredLocale, pricingSummary.bestFallbackOffer),
        meta: locationLabel || undefined,
        tone: 'best',
      });
    }

    if (offerItems.length) {
      items.push({
        key: 'coverage',
        badge: tt('market_pricing_coverage_badge', 'Kapsama'),
        title: tt('market_pricing_coverage_title', '{{count}} market izlendi').replace(
          '{{count}}',
          String(offerItems.length)
        ),
        priceLabel: getMarketFreshnessModeLabel(tt, offersResponse?.dataFreshness),
        helper:
          buildMarketFreshnessMeta(tt, preferredLocale, offersResponse?.dataFreshness) ||
          tt('market_pricing_coverage_helper', '{{inStock}} markette stokta görünüyor').replace(
            '{{inStock}}',
            String(inStockCount)
          ),
        meta: tt(
          'market_pricing_coverage_meta',
          '{{location}} için {{inStock}} markette stok var'
        )
          .replace('{{location}}', locationLabel || tt('location', 'Konum'))
          .replace('{{inStock}}', String(inStockCount)),
        tone: 'coverage',
      });
    }

    return items;
  }, [
    locationLabel,
    offerItems,
    offersResponse?.dataFreshness,
    preferredLocale,
    pricingSummary.bestFallbackOffer,
    pricingSummary.bestLocalOffer,
    pricingSummary.bestReferenceOffer,
    tt,
  ]);

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

  const cartSummary = useMemo(() => {
    if (!comparisonCart.length) {
      return {
        cheapestTotal: 0,
        cheapestCoveredCount: 0,
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
    let cheapestCoveredCount = 0;
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

    comparisonCart.forEach((entry) => {
      const inStockOffers = entry.offersResponse.offers.filter((offer) => offer.inStock);
      const cheapestOffer = getBestInStockOffer(inStockOffers);
      const quantity = Math.max(1, entry.quantity);

      if (cheapestOffer) {
        cheapestTotal += cheapestOffer.price * quantity;
        cheapestCoveredCount += quantity;
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
      cheapestCoveredCount,
      bestSingleMarket: perMarketTotals[0] ?? null,
      perMarketTotals,
    };
  }, [comparisonCart]);

  const cartDifferenceValue = useMemo(() => {
    if (
      comparisonCart.length &&
      basketCompareResponse != null &&
      typeof basketCompareResponse.bestSingleMarketTotal === 'number'
    ) {
      return Math.max(
        0,
        basketCompareResponse.bestSingleMarketTotal - basketCompareResponse.mixedCheapestTotal
      );
    }

    if (!comparisonCart.length || !cartSummary.bestSingleMarket) {
      return null;
    }

    return Math.max(0, cartSummary.bestSingleMarket.total - cartSummary.cheapestTotal);
  }, [
    basketCompareResponse,
    cartSummary.bestSingleMarket,
    cartSummary.cheapestTotal,
    comparisonCart.length,
  ]);

  const basketDisplayTotals = useMemo(() => {
    const totalRequestedQuantity = comparisonCart.reduce(
      (sum, entry) => sum + Math.max(1, entry.quantity),
      0
    );

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
        missingItemCount: Math.max(0, totalRequestedQuantity - market.coveredCount),
      })),
      missingItems: [],
    };
  }, [basketCompareResponse, cartSummary, comparisonCart]);

  const totalRequestedCartQuantity = useMemo(
    () => comparisonCart.reduce((sum, entry) => sum + Math.max(1, entry.quantity), 0),
    [comparisonCart]
  );

  const selectedProductCartQuantity = useMemo(
    () =>
      selectedProduct
        ? comparisonCart.find((entry) => entry.product.barcode === selectedProduct.barcode)?.quantity ?? 0
        : 0,
    [comparisonCart, selectedProduct]
  );

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
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: withAlpha(colors.primary, '10') }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Ionicons name="chevron-back" size={18} color={colors.primary} />
            <Text style={[styles.backButtonText, { color: colors.primary }]}>
              {tt('back', 'Geri')}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.heroEyebrow, { color: colors.primary }]}>
            {tt('price_compare_title', 'Fiyat Karşılaştır')}
          </Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            {tt('price_compare_screen_title', 'Market bazında fiyat kıyasla')}
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.mutedText }]}>
            {tt(
              'price_compare_screen_subtitle',
              'Barkod veya ürün adıyla arama yap, ardından market tekliflerini tek ekranda karşılaştır.'
            )}
          </Text>

          <View style={styles.locationPillRow}>
            <View
              style={[
                styles.locationPill,
                { backgroundColor: withAlpha(colors.teal, '12') },
              ]}
            >
              <Ionicons name="location-outline" size={14} color={colors.teal} />
              <Text style={[styles.locationPillText, { color: colors.teal }]}>
                {locationLabel ||
                  tt('price_compare_location_missing', 'Konum eklenmedi')}
              </Text>
            </View>
            <View
              style={[
                styles.locationPill,
                { backgroundColor: withAlpha(colors.primary, '12') },
              ]}
            >
              <Ionicons name="server-outline" size={14} color={colors.primary} />
              <Text style={[styles.locationPillText, { color: colors.primary }]}>
                {MARKET_GELSIN_RUNTIME.isEnabled
                  ? tt('price_compare_live_runtime', 'Canlı fiyat akışı')
                  : tt('price_compare_runtime_disabled', 'Fiyat servisi kapalı')}
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

        {!MARKET_GELSIN_RUNTIME.isEnabled ? (
          <NoticeCard
            text={tt(
              'price_compare_runtime_disabled_notice',
              'Fiyat servisi şu anda bağlı değil. Yerel ürün eşleşmelerini göstermeye devam ediyoruz.'
            )}
            colors={colors}
          />
        ) : null}

        <View
          style={[
            styles.searchCard,
            {
              backgroundColor: withAlpha(colors.cardElevated, 'F1'),
              borderColor: withAlpha(colors.border, 'BC'),
              shadowColor: colors.shadow,
            },
          ]}
        >
          <Text style={[styles.searchLabel, { color: colors.text }]}>
            {tt('price_compare_search_label', 'Barkod veya ürün adı')}
          </Text>
          <View style={styles.searchInputRow}>
            <TextInput
              value={query}
              onChangeText={setQuery}
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
                    key={`autocomplete-${item.barcode}`}
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

        {hasSearched ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {tt('price_compare_results_title', 'Arama Sonuçları')}
            </Text>

            {searchLoading ? (
              <View
                style={[
                  styles.loadingCard,
                  {
                    backgroundColor: withAlpha(colors.cardElevated, 'F1'),
                    borderColor: withAlpha(colors.border, 'BC'),
                  },
                ]}
              >
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : results.length ? (
              <View style={styles.resultsWrap}>
                {results.map((item) => (
                  <SearchResultCard
                    key={item.barcode}
                    item={item}
                    selected={selectedProduct?.barcode === item.barcode}
                    onPress={() => {
                      void loadOffers(item);
                    }}
                    colors={colors}
                    locale={preferredLocale}
                    tt={tt}
                  />
                ))}
              </View>
            ) : (
              <NoticeCard
                text={tt(
                  'price_compare_results_empty',
                  'Bu sorgu için karşılaştırılabilir ürün bulunamadı.'
                )}
                colors={colors}
              />
            )}
          </>
        ) : null}

        {selectedProduct ? (
          <>
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
              <Text style={[styles.selectedTitle, { color: colors.text }]}>
                {selectedProduct.productName}
              </Text>
              <Text style={[styles.selectedMeta, { color: colors.mutedText }]}>
                {[selectedProduct.brand, selectedProduct.category, selectedProduct.barcode]
                  .filter(Boolean)
                  .join(' • ')}
              </Text>
              {selectedProductCartQuantity ? (
                <Text style={[styles.selectedBasketHint, { color: colors.teal }]}>
                  {tt('price_compare_selected_quantity', 'Sepette {{count}} adet var').replace(
                    '{{count}}',
                    String(selectedProductCartQuantity)
                  )}
                </Text>
              ) : null}
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={handleAddSelectedToCart}
                disabled={!offersResponse || offersLoading}
                style={[
                  styles.addToCartButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: !offersResponse || offersLoading ? 0.65 : 1,
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
            </View>

            {offersError ? <NoticeCard text={offersError} colors={colors} /> : null}

            <PricingHighlightsSection
              title={tt('market_pricing_title', 'Fiyat ve Bulunabilirlik')}
              subtitle={pricingSubtitle ?? undefined}
              items={pricingHighlightItems}
              loading={offersLoading}
              emptyLabel={
                !offersLoading
                  ? tt(
                      'market_pricing_empty',
                      'Bu ürün için şu anda fiyat teklifi bulunamadı.'
                    )
                  : undefined
              }
              colors={colors}
            />

            {!offersError ? (
              <MarketPriceTableCard
                title={tt('market_price_table_title', 'Market Fiyat Tablosu')}
                subtitle={tt(
                  'market_price_table_subtitle',
                  'Ulusal marketleri ve konumundaki marketleri yana kaydırarak karşılaştır.'
                )}
                offers={offersResponse?.offers ?? []}
                productType={pricingTableProductType}
                locale={preferredLocale}
                colors={colors}
                tt={tt}
                loading={offersLoading}
              />
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
                    <View
                      key={`${offer.marketKey || offer.marketName}-${offer.price}-${offer.capturedAt}`}
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
                          {getOfferToneLabel(tt, offer)}
                          {offer.districtName ? ` • ${offer.districtName}` : ''}
                          {offer.cityName ? ` • ${offer.cityName}` : ''}
                        </Text>
                        <Text style={[styles.offerHelper, { color: colors.mutedText }]}>
                          {buildMarketOfferMeta(tt, preferredLocale, offer)}
                        </Text>
                        {formatDistanceMeters(tt, offer.distanceMeters) ? (
                          <Text style={[styles.offerDistance, { color: colors.teal }]}>
                            {formatDistanceMeters(tt, offer.distanceMeters)}
                          </Text>
                        ) : null}
                      </View>

                      <View style={styles.offerPriceWrap}>
                        <Text style={[styles.offerPrice, { color: colors.text }]}>
                          {formatLocalizedPrice(preferredLocale, offer.price, offer.currency)}
                        </Text>
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
                      </View>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </>
        ) : null}

        {comparisonCart.length ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {tt('price_compare_cart_title', 'Karşılaştırma Sepeti')}
            </Text>
            <View
              style={[
                styles.cartSummaryCard,
                {
                  backgroundColor: withAlpha(colors.cardElevated, 'F1'),
                  borderColor: withAlpha(colors.border, 'BC'),
                  shadowColor: colors.shadow,
                },
              ]}
            >
              <View style={styles.cartMetricsRow}>
                <View style={styles.cartMetricBox}>
                  <Text style={[styles.cartMetricLabel, { color: colors.mutedText }]}>
                    {tt('price_compare_cart_best_mix', 'En ucuz karışık sepet')}
                  </Text>
                  <Text style={[styles.cartMetricValue, { color: colors.text }]}>
                    {formatLocalizedPrice(
                      preferredLocale,
                      basketDisplayTotals.mixedCheapestTotal,
                      'TRY'
                    )}
                  </Text>
                </View>
                <View style={styles.cartMetricBox}>
                  <Text style={[styles.cartMetricLabel, { color: colors.mutedText }]}>
                    {tt('price_compare_cart_single_market', 'Tek market toplamı')}
                  </Text>
                  <Text style={[styles.cartMetricValue, { color: colors.text }]}>
                    {typeof basketDisplayTotals.bestSingleMarketTotal === 'number'
                      ? formatLocalizedPrice(
                          preferredLocale,
                          basketDisplayTotals.bestSingleMarketTotal,
                          'TRY'
                        )
                      : '-'}
                  </Text>
                </View>
                <View style={styles.cartMetricBox}>
                  <Text style={[styles.cartMetricLabel, { color: colors.mutedText }]}>
                    {tt('price_compare_cart_nearest_market', 'En yakın market')}
                  </Text>
                  <Text style={[styles.cartMetricValue, { color: colors.text }]}>
                    {typeof basketDisplayTotals.nearestMarketTotal === 'number'
                      ? formatLocalizedPrice(
                          preferredLocale,
                          basketDisplayTotals.nearestMarketTotal,
                          'TRY'
                        )
                      : tt('price_compare_nearest_pending', 'Hazır değil')}
                  </Text>
                </View>
              </View>

              {typeof cartDifferenceValue === 'number' ? (
                <Text style={[styles.cartDifferenceText, { color: colors.teal }]}>
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
                <Text style={[styles.cartHelperText, { color: colors.mutedText }]}>
                  {tt(
                    'price_compare_basket_loading',
                    'Canlı sepet kıyası hazırlanıyor...'
                  )}
                </Text>
              ) : null}

              {basketCompareError ? (
                <Text style={[styles.cartHelperText, { color: colors.warning }]}>
                  {basketCompareError}
                </Text>
              ) : null}

              <Text style={[styles.cartHelperText, { color: colors.mutedText }]}>
                {tt(
                  'price_compare_cart_helper',
                  'Yakın market metriği API tarafında mesafe verisi geldiğinde otomatik aktive olacak.'
                )}
              </Text>
            </View>

            <View style={styles.cartItemsWrap}>
              {comparisonCart.map((entry) => (
                <View
                  key={`cart-${entry.product.barcode}`}
                  style={[
                    styles.cartItemCard,
                    {
                      backgroundColor: withAlpha(colors.cardElevated, 'F1'),
                      borderColor: withAlpha(colors.border, 'BC'),
                    },
                  ]}
                >
                  <View style={styles.cartItemTextWrap}>
                    <Text style={[styles.cartItemTitle, { color: colors.text }]} numberOfLines={2}>
                      {entry.product.productName}
                    </Text>
                    <Text style={[styles.cartItemMeta, { color: colors.mutedText }]} numberOfLines={1}>
                      {[entry.product.brand, entry.product.barcode].filter(Boolean).join(' • ')}
                    </Text>
                  </View>
                  <View style={styles.cartItemActions}>
                    <View
                      style={[
                        styles.quantityStepper,
                        {
                          backgroundColor: withAlpha(colors.backgroundMuted, isDark ? 'B8' : 'F5'),
                          borderColor: withAlpha(colors.border, 'B8'),
                        },
                      ]}
                    >
                      <TouchableOpacity
                        activeOpacity={0.88}
                        onPress={() => {
                          handleDecreaseCartQuantity(entry.product.barcode);
                        }}
                        style={styles.quantityButton}
                      >
                        <Ionicons name="remove-outline" size={18} color={colors.text} />
                      </TouchableOpacity>
                      <Text style={[styles.quantityValue, { color: colors.text }]}>
                        {entry.quantity}
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.88}
                        onPress={() => {
                          handleIncreaseCartQuantity(entry.product.barcode);
                        }}
                        style={styles.quantityButton}
                      >
                        <Ionicons name="add-outline" size={18} color={colors.text} />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.88}
                      onPress={() => {
                        handleRemoveFromCart(entry.product.barcode);
                      }}
                      style={[
                        styles.cartRemoveButton,
                        { backgroundColor: withAlpha(colors.danger, '12') },
                      ]}
                    >
                      <Ionicons name="close-outline" size={18} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>

            {basketDisplayTotals.missingItems.length ? (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {tt('price_compare_missing_items_title', 'Eksik Ürünler')}
                </Text>
                <View style={styles.cartItemsWrap}>
                  {basketDisplayTotals.missingItems.map((item) => {
                    const matchedProduct = comparisonCart.find(
                      (entry) => entry.product.barcode === item.barcode
                    )?.product;

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
                          <Text style={[styles.cartItemTitle, { color: colors.text }]} numberOfLines={2}>
                            {matchedProduct?.productName || item.barcode}
                          </Text>
                          <Text style={[styles.cartItemMeta, { color: colors.mutedText }]} numberOfLines={1}>
                            {tt('price_compare_missing_item_quantity', '{{count}} adet eksik')
                              .replace('{{count}}', String(item.quantity))}
                          </Text>
                        </View>
                        <Ionicons name="alert-circle-outline" size={20} color={colors.warning} />
                      </View>
                    );
                  })}
                </View>
              </>
            ) : null}

            {basketDisplayTotals.marketTotals.length ? (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {tt('price_compare_cart_market_totals', 'Market Toplamları')}
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
                  {basketDisplayTotals.marketTotals.map((market) => (
                    <View
                      key={`cart-market-${market.marketKey}-${market.branchId || 'default'}`}
                      style={[
                        styles.offerRow,
                        { borderBottomColor: withAlpha(colors.border, '80') },
                      ]}
                    >
                      <MarketBadge
                        marketKey={market.marketKey}
                        marketName={market.marketName}
                        logoUrl={market.marketLogoUrl}
                        size={38}
                      />
                      <View style={styles.offerTextWrap}>
                        <Text style={[styles.offerTitle, { color: colors.text }]}>
                          {market.marketName}
                        </Text>
                        <Text style={[styles.offerMeta, { color: colors.mutedText }]}>
                          {tt('price_compare_cart_coverage', '{{covered}}/{{total}} ürün')
                            .replace('{{covered}}', String(market.availableItemCount))
                            .replace('{{total}}', String(totalRequestedCartQuantity))}
                        </Text>
                        {market.branchName ? (
                          <Text style={[styles.offerHelper, { color: colors.mutedText }]}>
                            {market.branchName}
                          </Text>
                        ) : null}
                        {formatDistanceMeters(tt, market.distanceMeters) ? (
                          <Text style={[styles.offerDistance, { color: colors.teal }]}>
                            {formatDistanceMeters(tt, market.distanceMeters)}
                          </Text>
                        ) : null}
                      </View>

                      <View style={styles.offerPriceWrap}>
                        <Text style={[styles.offerPrice, { color: colors.text }]}>
                          {formatLocalizedPrice(preferredLocale, market.basketTotal, 'TRY')}
                        </Text>
                        {market.missingItemCount ? (
                          <Text style={[styles.offerStock, { color: colors.warning }]}>
                            {tt('price_compare_missing_count', '{{count}} eksik')
                              .replace('{{count}}', String(market.missingItemCount))}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 22,
    marginBottom: 18,
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 18,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  heroEyebrow: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    marginBottom: 10,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 22,
  },
  locationPillRow: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  },
  searchCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
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
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  searchButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchHint: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 12,
  },
  loadingCard: {
    minHeight: 88,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsWrap: {
    gap: 12,
  },
  resultCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  resultCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resultVisualStack: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultImage: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
  },
  resultImageFallback: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultLogoBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
  },
  resultTextWrap: {
    flex: 1,
    gap: 4,
  },
  resultTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  resultMeta: {
    fontSize: 12,
    lineHeight: 18,
  },
  resultFooterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  resultPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  resultPillText: {
    fontSize: 12,
    fontWeight: '700',
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
  selectedTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  selectedMeta: {
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
    marginTop: 14,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addToCartButtonText: {
    fontSize: 12,
    fontWeight: '800',
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
  cartMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  cartMetricBox: {
    minWidth: '30%',
    flexGrow: 1,
    gap: 6,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  cartMetricLabel: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  cartMetricValue: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
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
  offerHelper: {
    fontSize: 11,
    lineHeight: 16,
  },
  offerDistance: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  offerPriceWrap: {
    alignItems: 'flex-end',
    gap: 4,
  },
  offerPrice: {
    fontSize: 14,
    fontWeight: '800',
  },
  offerStock: {
    fontSize: 11,
    fontWeight: '700',
  },
});

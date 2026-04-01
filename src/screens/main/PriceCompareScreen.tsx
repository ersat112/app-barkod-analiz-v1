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
import { useAuth } from '../../context/AuthContext';
import { useTheme, type ThemeColors } from '../../context/ThemeContext';
import { useAppScreenLayout } from '../../components/layout/useAppScreenLayout';
import { AmbientBackdrop } from '../../components/ui/AmbientBackdrop';
import {
  getBestInStockOffer,
  partitionOffersByPriceSourceType,
} from '../../services/marketPricingContract.service';
import {
  fetchMarketProductOffers,
  fetchMarketProductSearch,
} from '../../services/marketPricing.service';
import {
  resolveCanonicalCity,
  resolveCanonicalDistrict,
  resolveTurkeyCityCode,
} from '../../services/locationData';
import {
  InfoActionCard,
  NoticeCard,
  PricingHighlightsSection,
  type PricingHighlightItem,
} from './detail/DetailSections';
import type {
  MarketDataFreshness,
  MarketOffer,
  MarketProductOffersResponse,
  MarketSearchProduct,
} from '../../types/marketPricing';
import { withAlpha } from '../../utils/color';

type PriceCompareRoute = RouteProp<RootStackParamList, 'PriceCompare'>;
type TranslateFn = (key: string, fallback: string) => string;

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
  const layout = useAppScreenLayout({
    topInsetExtra: 18,
    topInsetMin: 72,
    contentBottomExtra: 42,
    contentBottomMin: 96,
  });

  const tt = useCallback(
    (key: string, fallback: string) => {
      const value = t(key, { defaultValue: fallback });
      return value === key ? fallback : value;
    },
    [t]
  );

  const preferredLocale = i18n.language || 'tr-TR';
  const canonicalCity = resolveCanonicalCity(profile?.city);
  const canonicalDistrict = resolveCanonicalDistrict(profile?.city, profile?.district);
  const cityCode = resolveTurkeyCityCode(canonicalCity);
  const locationLabel = canonicalDistrict
    ? `${canonicalDistrict}, ${canonicalCity ?? profile?.city ?? ''}`
    : canonicalCity || profile?.city || null;

  const [query, setQuery] = useState(route.params?.initialQuery ?? '');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<MarketSearchProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<MarketSearchProduct | null>(null);
  const [offersResponse, setOffersResponse] = useState<MarketProductOffersResponse | null>(null);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState<string | null>(null);

  const loadOffers = useCallback(
    async (product: MarketSearchProduct) => {
      setSelectedProduct(product);
      setOffersLoading(true);
      setOffersError(null);

      try {
        const response = await fetchMarketProductOffers(product.barcode, {
          cityCode: cityCode ?? undefined,
          districtName: canonicalDistrict ?? undefined,
          includeOutOfStock: true,
          limit: 24,
        });

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
    [canonicalDistrict, cityCode, tt]
  );

  const handleSearch = useCallback(async () => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
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
    setSelectedProduct(null);
    setOffersResponse(null);
    setOffersError(null);

    try {
      const response = await fetchMarketProductSearch({
        query: trimmedQuery,
        cityCode: cityCode ?? undefined,
        limit: 12,
      });

      setResults(response.results);

      if (response.results.length === 1) {
        void loadOffers(response.results[0]);
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
  }, [cityCode, loadOffers, query, tt]);

  useEffect(() => {
    const initialQuery = route.params?.initialQuery?.trim();

    if (initialQuery && !hasSearched && initialQuery === query.trim()) {
      void handleSearch();
    }
  }, [handleSearch, hasSearched, query, route.params?.initialQuery]);

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

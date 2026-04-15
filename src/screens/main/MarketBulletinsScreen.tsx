import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useAppScreenLayout } from '../../components/layout/useAppScreenLayout';
import { AmbientBackdrop } from '../../components/ui/AmbientBackdrop';
import {
  buildMarketMonogram,
  resolveMarketAccent,
  resolveMarketLogoUrl,
} from '../../config/marketBranding';
import { useTheme } from '../../context/ThemeContext';
import {
  fetchMarketBulletin,
  fetchMarketBulletins,
} from '../../services/marketPricing.service';
import type {
  MarketBulletin,
  MarketBulletinItem,
} from '../../types/marketPricing';
import { withAlpha } from '../../utils/color';

type MarketFilter = {
  key: string | null;
  label: string;
};

const MARKET_FILTERS: MarketFilter[] = [
  { key: null, label: 'Tümü' },
  { key: 'bim_market', label: 'BİM' },
  { key: 'cepte_sok', label: 'Şok' },
  { key: 'migros_sanal_market', label: 'Migros' },
  { key: 'tarim_kredi_koop_market', label: 'Tarım Kredi' },
  { key: 'bizim_toptan_online', label: 'Bizim Toptan' },
  { key: 'carrefoursa_online_market', label: 'CarrefourSA' },
];

const BULLETIN_LIST_LIMIT = 20;
const BULLETIN_DETAIL_LIMIT = 120;

const formatPrice = (value?: number | null): string | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
};

const formatDate = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
  });
};

const formatBulletinDateRange = (bulletin: MarketBulletin): string => {
  const startsAt = formatDate(bulletin.startsAt);
  const endsAt = formatDate(bulletin.endsAt);
  const publishedAt = formatDate(bulletin.publishedAt);

  if (startsAt && endsAt) {
    return `${startsAt} - ${endsAt}`;
  }

  return publishedAt || 'Tarih belirtilmedi';
};

const buildItemKey = (item: MarketBulletinItem, index: number): string =>
  item.barcode ||
  item.sourceProductId ||
  [item.displayName, item.activePrice ?? item.promoPrice ?? item.listedPrice ?? '', index]
    .join(':')
    .trim();

export const MarketBulletinsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const layout = useAppScreenLayout({
    horizontalPadding: 16,
    contentBottomExtra: 44,
  });
  const [selectedMarketKey, setSelectedMarketKey] = useState<string | null>(null);
  const [bulletins, setBulletins] = useState<MarketBulletin[]>([]);
  const [selectedBulletin, setSelectedBulletin] = useState<MarketBulletin | null>(null);
  const [items, setItems] = useState<MarketBulletinItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [detailNextCursor, setDetailNextCursor] = useState<number | null>(null);

  const tt = useCallback(
    (key: string, fallback: string) => {
      const value = t(key, { defaultValue: fallback });
      return value === key ? fallback : value;
    },
    [t]
  );

  const selectedMarketLabel = useMemo(
    () =>
      MARKET_FILTERS.find((item) => item.key === selectedMarketKey)?.label ||
      tt('market_bulletins_all_markets', 'Tümü'),
    [selectedMarketKey, tt]
  );

  const loadBulletinDetail = useCallback(
    async (
      bulletin: MarketBulletin,
      cursor?: number | null,
      append = false
    ) => {
      setDetailLoading(true);
      setDetailError(null);

      try {
        const response = await fetchMarketBulletin({
          bulletinId: bulletin.bulletinId,
          limit: BULLETIN_DETAIL_LIMIT,
          cursor: cursor ?? null,
        });

        setSelectedBulletin(response.bulletin ?? bulletin);
        setItems((current) => (append ? [...current, ...response.items] : response.items));
        setDetailNextCursor(response.nextCursor ?? null);
      } catch (requestError) {
        console.warn('[MarketBulletinsScreen] get bulletin failed:', requestError);
        setDetailError(
          tt(
            'market_bulletins_detail_error',
            'Bu katalogdaki ürünler şu anda yüklenemedi.'
          )
        );
        if (!append) {
          setItems([]);
          setDetailNextCursor(null);
        }
      } finally {
        setDetailLoading(false);
      }
    },
    [tt]
  );

  const loadBulletins = useCallback(
    async (cursor?: string | null) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetchMarketBulletins({
          marketKey: selectedMarketKey,
          limit: BULLETIN_LIST_LIMIT,
          cursor: cursor ?? null,
        });

        setBulletins((current) =>
          cursor ? [...current, ...response.bulletins] : response.bulletins
        );
        setNextCursor(response.nextCursor ?? null);

        if (!cursor) {
          const firstBulletin = response.bulletins[0] ?? null;
          setSelectedBulletin(firstBulletin);
          setItems([]);
          setDetailNextCursor(null);

          if (firstBulletin) {
            void loadBulletinDetail(firstBulletin, null, false);
          }
        }
      } catch (requestError) {
        console.warn('[MarketBulletinsScreen] list bulletins failed:', requestError);
        setError(
          tt(
            'market_bulletins_load_error',
            'Aktüel kataloglar şu anda yüklenemedi. Lütfen biraz sonra tekrar deneyin.'
          )
        );
        setBulletins([]);
        setSelectedBulletin(null);
        setItems([]);
        setNextCursor(null);
      } finally {
        setLoading(false);
      }
    },
    [loadBulletinDetail, selectedMarketKey, tt]
  );

  const handleSelectBulletin = useCallback(
    (bulletin: MarketBulletin) => {
      setSelectedBulletin(bulletin);
      setItems([]);
      setDetailNextCursor(null);
      void loadBulletinDetail(bulletin, null, false);
    },
    [loadBulletinDetail]
  );

  const handleOpenItemInPriceCompare = useCallback(
    (item: MarketBulletinItem) => {
      navigation.navigate('PriceCompare', {
        initialQuery: item.barcode || item.displayName,
        initialQueryNonce: Date.now(),
        initialQuerySource: 'manual',
      });
    },
    [navigation]
  );

  const handleOpenSource = useCallback((url?: string | null) => {
    if (!url) {
      return;
    }

    void Linking.openURL(url);
  }, []);

  useEffect(() => {
    void loadBulletins(null);
  }, [loadBulletins]);

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
              backgroundColor: withAlpha(colors.card, 'F8'),
              borderColor: withAlpha(colors.border, '70'),
            },
          ]}
        >
          <View style={styles.heroTopRow}>
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => navigation.goBack()}
              style={[
                styles.backButton,
                { backgroundColor: withAlpha(colors.backgroundMuted, 'E8') },
              ]}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.heroTextWrap}>
              <Text style={[styles.heroEyebrow, { color: colors.primary }]}>
                {tt('market_bulletins_eyebrow', 'Market Katalogları')}
              </Text>
              <Text style={[styles.heroTitle, { color: colors.text }]}>
                {tt('market_bulletins_title', 'Aktüel kataloglar')}
              </Text>
              <Text style={[styles.heroSubtitle, { color: colors.mutedText }]}>
                {tt(
                  'market_bulletins_subtitle',
                  'BİM, Şok, Migros ve diğer marketlerin kampanya ürünlerini tek yerde görüntüle.'
                )}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.marketFilterRow}
        >
          {MARKET_FILTERS.map((market) => {
            const isSelected = selectedMarketKey === market.key;

            return (
              <TouchableOpacity
                key={market.key || 'all'}
                activeOpacity={0.86}
                onPress={() => {
                  setSelectedMarketKey(market.key);
                  setSelectedBulletin(null);
                  setItems([]);
                  setDetailNextCursor(null);
                }}
                style={[
                  styles.marketChip,
                  {
                    backgroundColor: isSelected
                      ? withAlpha(colors.primary, '18')
                      : withAlpha(colors.card, 'F6'),
                    borderColor: isSelected
                      ? withAlpha(colors.primary, '90')
                      : withAlpha(colors.border, '72'),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.marketChipText,
                    { color: isSelected ? colors.primary : colors.text },
                  ]}
                >
                  {market.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {tt('market_bulletins_list_title', 'Kataloglar')}
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.mutedText }]}>
              {selectedMarketLabel}
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => {
              void loadBulletins(null);
            }}
            style={[
              styles.refreshButton,
              { backgroundColor: withAlpha(colors.card, 'F6'), borderColor: withAlpha(colors.border, '70') },
            ]}
          >
            <Ionicons name="refresh-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {loading && !bulletins.length ? (
          <View
            style={[
              styles.stateCard,
              { backgroundColor: withAlpha(colors.card, 'F8'), borderColor: withAlpha(colors.border, '70') },
            ]}
          >
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.stateText, { color: colors.mutedText }]}>
              {tt('market_bulletins_loading', 'Kataloglar yükleniyor...')}
            </Text>
          </View>
        ) : null}

        {error ? (
          <View
            style={[
              styles.stateCard,
              { backgroundColor: withAlpha(colors.card, 'F8'), borderColor: withAlpha(colors.border, '70') },
            ]}
          >
            <Ionicons name="alert-circle-outline" size={20} color={colors.warning} />
            <Text style={[styles.stateText, { color: colors.text }]}>{error}</Text>
          </View>
        ) : null}

        {bulletins.length ? (
          <View style={styles.bulletinList}>
            {bulletins.map((bulletin) => {
              const isSelected = selectedBulletin?.bulletinId === bulletin.bulletinId;
              const accent = resolveMarketAccent(bulletin.marketKey, bulletin.marketName);
              const logoUrl = resolveMarketLogoUrl(bulletin.marketKey, bulletin.marketName);

              return (
                <TouchableOpacity
                  key={bulletin.bulletinId}
                  activeOpacity={0.88}
                  onPress={() => handleSelectBulletin(bulletin)}
                  style={[
                    styles.bulletinCard,
                    {
                      backgroundColor: isSelected
                        ? withAlpha(colors.primary, isDark ? '22' : '12')
                        : withAlpha(colors.card, 'F8'),
                      borderColor: isSelected
                        ? withAlpha(colors.primary, '90')
                        : withAlpha(colors.border, '70'),
                    },
                  ]}
                >
                  <View style={styles.bulletinImageWrap}>
                    {bulletin.imageUrl ? (
                      <Image
                        source={{ uri: bulletin.imageUrl }}
                        resizeMode="cover"
                        style={styles.bulletinImage}
                      />
                    ) : (
                      <View style={[styles.bulletinImageFallback, { backgroundColor: withAlpha(accent, '16') }]}>
                        <Ionicons name="newspaper-outline" size={24} color={accent} />
                      </View>
                    )}
                  </View>
                  <View style={styles.bulletinTextWrap}>
                    <View style={styles.marketLogoRow}>
                      {logoUrl ? (
                        <Image source={{ uri: logoUrl }} resizeMode="contain" style={styles.marketLogo} />
                      ) : (
                        <View style={[styles.marketMonogram, { backgroundColor: withAlpha(accent, '16') }]}>
                          <Text style={[styles.marketMonogramText, { color: accent }]}>
                            {buildMarketMonogram(bulletin.marketName)}
                          </Text>
                        </View>
                      )}
                      <Text style={[styles.bulletinMarketName, { color: colors.mutedText }]} numberOfLines={1}>
                        {bulletin.marketName}
                      </Text>
                    </View>
                    <Text style={[styles.bulletinTitle, { color: colors.text }]} numberOfLines={2}>
                      {bulletin.title}
                    </Text>
                    <Text style={[styles.bulletinMeta, { color: colors.mutedText }]} numberOfLines={1}>
                      {formatBulletinDateRange(bulletin)} · {bulletin.itemCount || 0} ürün
                    </Text>
                  </View>
                  <Ionicons
                    name={isSelected ? 'checkmark-circle' : 'chevron-forward'}
                    size={20}
                    color={isSelected ? colors.primary : colors.mutedText}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {nextCursor ? (
          <TouchableOpacity
            activeOpacity={0.86}
            disabled={loading}
            onPress={() => {
              void loadBulletins(nextCursor);
            }}
            style={[
              styles.loadMoreButton,
              { backgroundColor: withAlpha(colors.primary, '12'), borderColor: withAlpha(colors.primary, '52') },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Text style={[styles.loadMoreText, { color: colors.primary }]}>
                  {tt('market_bulletins_load_more', 'Daha fazla katalog')}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.primary} />
              </>
            )}
          </TouchableOpacity>
        ) : null}

        <View style={styles.detailHeaderRow}>
          <View style={styles.detailTitleWrap}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {tt('market_bulletins_products_title', 'Katalog ürünleri')}
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.mutedText }]} numberOfLines={1}>
              {selectedBulletin?.title || tt('market_bulletins_select_prompt', 'Bir katalog seç')}
            </Text>
          </View>
          {selectedBulletin?.sourceUrl ? (
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => handleOpenSource(selectedBulletin.sourceUrl)}
              style={[
                styles.sourceButton,
                { backgroundColor: withAlpha(colors.card, 'F6'), borderColor: withAlpha(colors.border, '70') },
              ]}
            >
              <Ionicons name="open-outline" size={17} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {detailLoading && !items.length ? (
          <View
            style={[
              styles.stateCard,
              { backgroundColor: withAlpha(colors.card, 'F8'), borderColor: withAlpha(colors.border, '70') },
            ]}
          >
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.stateText, { color: colors.mutedText }]}>
              {tt('market_bulletins_products_loading', 'Katalog ürünleri yükleniyor...')}
            </Text>
          </View>
        ) : null}

        {detailError ? (
          <View
            style={[
              styles.stateCard,
              { backgroundColor: withAlpha(colors.card, 'F8'), borderColor: withAlpha(colors.border, '70') },
            ]}
          >
            <Ionicons name="alert-circle-outline" size={20} color={colors.warning} />
            <Text style={[styles.stateText, { color: colors.text }]}>{detailError}</Text>
          </View>
        ) : null}

        {items.length ? (
          <View style={styles.itemGrid}>
            {items.map((item, index) => {
              const activePrice = formatPrice(item.activePrice ?? item.promoPrice ?? item.listedPrice);
              const oldPrice =
                item.listedPrice &&
                item.activePrice &&
                item.listedPrice > item.activePrice
                  ? formatPrice(item.listedPrice)
                  : null;
              const imageUrl = item.imageUrl || selectedBulletin?.imageUrl || null;

              return (
                <TouchableOpacity
                  key={buildItemKey(item, index)}
                  activeOpacity={0.88}
                  onPress={() => handleOpenItemInPriceCompare(item)}
                  style={[
                    styles.itemCard,
                    {
                      backgroundColor: withAlpha(colors.card, 'F8'),
                      borderColor: withAlpha(colors.border, '70'),
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.itemImageWrap,
                      { backgroundColor: withAlpha(colors.backgroundMuted, 'E8') },
                    ]}
                  >
                    {imageUrl ? (
                      <Image source={{ uri: imageUrl }} resizeMode="contain" style={styles.itemImage} />
                    ) : (
                      <Ionicons name="image-outline" size={24} color={colors.mutedText} />
                    )}
                  </View>
                  <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={2}>
                    {item.displayName}
                  </Text>
                  {activePrice ? (
                    <Text style={[styles.itemPrice, { color: colors.text }]}>{activePrice}</Text>
                  ) : (
                    <Text style={[styles.itemMeta, { color: colors.mutedText }]}>
                      {tt('market_bulletins_no_price', 'Fiyat bekleniyor')}
                    </Text>
                  )}
                  {oldPrice ? (
                    <Text style={[styles.itemOldPrice, { color: colors.mutedText }]}>
                      {oldPrice}
                    </Text>
                  ) : null}
                  <View style={styles.itemFooterRow}>
                    <Text style={[styles.itemMeta, { color: colors.mutedText }]} numberOfLines={1}>
                      {item.barcode ? item.barcode : tt('market_bulletins_no_barcode', 'Barkodsuz')}
                    </Text>
                    <Ionicons name="search-outline" size={15} color={colors.primary} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {detailNextCursor && selectedBulletin ? (
          <TouchableOpacity
            activeOpacity={0.86}
            disabled={detailLoading}
            onPress={() => {
              void loadBulletinDetail(selectedBulletin, detailNextCursor, true);
            }}
            style={[
              styles.loadMoreButton,
              { backgroundColor: withAlpha(colors.primary, '12'), borderColor: withAlpha(colors.primary, '52') },
            ]}
          >
            {detailLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Text style={[styles.loadMoreText, { color: colors.primary }]}>
                  {tt('market_bulletins_load_more_products', 'Daha fazla ürün')}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.primary} />
              </>
            )}
          </TouchableOpacity>
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
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  heroTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
  },
  heroSubtitle: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  marketFilterRow: {
    gap: 8,
    paddingBottom: 12,
  },
  marketChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  marketChipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 10,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
  },
  sectionSubtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stateText: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  bulletinList: {
    gap: 10,
    marginBottom: 16,
  },
  bulletinCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  bulletinImageWrap: {
    width: 76,
    height: 76,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bulletinImage: {
    width: '100%',
    height: '100%',
  },
  bulletinImageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletinTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  marketLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  marketLogo: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  marketMonogram: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marketMonogramText: {
    fontSize: 9,
    fontWeight: '900',
  },
  bulletinMarketName: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontWeight: '800',
  },
  bulletinTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  bulletinMeta: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  loadMoreButton: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: '900',
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 2,
    marginBottom: 10,
  },
  detailTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  sourceButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  itemCard: {
    width: '48.5%',
    borderWidth: 1,
    borderRadius: 18,
    padding: 10,
    minHeight: 214,
  },
  itemImageWrap: {
    height: 94,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    overflow: 'hidden',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
    minHeight: 36,
  },
  itemPrice: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  itemOldPrice: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    textDecorationLine: 'line-through',
  },
  itemFooterRow: {
    marginTop: 'auto',
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  itemMeta: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
});

import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { AdBanner } from '../../components/AdBanner';
import { useAppScreenLayout } from '../../components/layout/useAppScreenLayout';
import { AmbientBackdrop } from '../../components/ui/AmbientBackdrop';
import { useHomeScreenController } from '../../hooks/useHomeScreenController';
import { useWhoNews } from '../../hooks/useWhoNews';
import { withAlpha } from '../../utils/color';
import {
  HomeLoadingState,
  LastProductCard,
  LiveInsightCard,
  QuickInsightsStrip,
  RecentProductsCarousel,
  StatCard,
  SummaryCard,
} from './home/HomeSections';

const FALLBACK_IMAGE = 'https://via.placeholder.com/100?text=No+Image';

export const HomeScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { locale } = useLanguage();
  const layout = useAppScreenLayout({
    topInsetExtra: 18,
    topInsetMin: 70,
    contentBottomExtra: 40,
    contentBottomMin: 100,
    horizontalPadding: 25,
  });

  const {
    tt,
    snapshot,
    loading,
    refreshing,
    loadError,
    rescanSnapshot,
    rescanLoading,
    rescanRefreshing,
    rescanLoadError,
    handleRefresh,
    openBarcodeDetail,
    openScanner,
    openSettingsFromProfileGate,
    toggleFavorite,
    displayName,
    greeting,
    streakText,
    quickInsights,
    liveInsightItems,
    profileCompletion,
    shouldShowProfileCompletionGate,
    profileCompletionSummaryText,
  } = useHomeScreenController();
  const {
    snapshot: whoNewsSnapshot,
    refreshing: whoNewsRefreshing,
    refresh: refreshWhoNews,
  } = useWhoNews(locale);

  const formatWhoNewsDate = useCallback(
    (publishedAt: string | null) => {
      if (!publishedAt) {
        return tt('who_news_recent', 'Güncel');
      }

      const parsed = new Date(`${publishedAt}T00:00:00Z`);

      if (Number.isNaN(parsed.getTime())) {
        return tt('who_news_recent', 'Güncel');
      }

      return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
      }).format(parsed);
    },
    [locale, tt]
  );

  const mapWhoTypeIcon = useCallback((type: string) => {
    const normalized = type.toLowerCase();

    if (normalized.includes('release') || normalized.includes('communiqu')) {
      return 'newspaper-outline' as const;
    }

    if (normalized.includes('update')) {
      return 'pulse-outline' as const;
    }

    return 'globe-outline' as const;
  }, []);

  const openWhoNewsItem = useCallback(
    async (url: string) => {
      try {
        await Linking.openURL(url);
      } catch (error) {
        console.error('WHO news link open failed:', error);
      }
    },
    []
  );

  const liveCardItems = useMemo(() => {
    if (whoNewsSnapshot?.items?.length) {
      return whoNewsSnapshot.items.map((item) => ({
        icon: mapWhoTypeIcon(item.type),
        title: item.title,
        meta: `${item.type} • ${formatWhoNewsDate(item.publishedAt)}`,
        text: tt('who_news_card_text', 'Dünya Sağlık Örgütü haber odasından canlı başlık'),
        onPress: () => {
          void openWhoNewsItem(item.url);
        },
      }));
    }

    return liveInsightItems;
  }, [
    formatWhoNewsDate,
    liveInsightItems,
    mapWhoTypeIcon,
    openWhoNewsItem,
    tt,
    whoNewsSnapshot?.items,
  ]);

  const liveCardBadgeLabel = whoNewsSnapshot?.items?.length
    ? tt('who_news_badge', 'WHO Haberleri')
    : tt('live_updates_label', 'Canlı Bilgi');

  const liveCardHelperText = useMemo(() => {
    if (!whoNewsSnapshot?.items?.length) {
      return tt('tap_for_next_insight', 'Dokunarak bir sonraki bilgi kartına geçin');
    }

    if (whoNewsSnapshot.isFallback) {
      return tt(
        'who_news_fallback_notice',
        'WHO bu uygulama dili için resmi newsroom sunmadığı için başlıklar İngilizce kaynaktan gösteriliyor.'
      );
    }

    return tt(
      'who_news_tap_helper',
      'Habere gitmek için karta dokunun, sağ üstten sonraki başlığa geçin.'
    );
  }, [tt, whoNewsSnapshot]);

  if (loading) {
    return <HomeLoadingState label={tt('home', 'Ana Sayfa')} colors={colors} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AmbientBackdrop colors={colors} variant="home" />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          ...styles.scrollContent,
          paddingTop: layout.headerTopPadding,
          paddingBottom: layout.contentBottomPadding,
          paddingHorizontal: layout.horizontalPadding,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || rescanRefreshing || whoNewsRefreshing}
            onRefresh={() => {
              void Promise.all([handleRefresh(), refreshWhoNews()]);
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View
          style={[
            styles.dashboardHero,
            {
              backgroundColor: withAlpha(colors.card, isDark ? 'F0' : 'FA'),
              borderColor: withAlpha(colors.border, 'BC'),
              shadowColor: colors.shadow,
            },
          ]}
        >
          <View style={styles.dashboardHeroTopRow}>
            <View style={styles.dashboardHeroTextWrap}>
              <Text style={[styles.eyebrow, { color: colors.primary }]}>
                {tt('dashboard_eyebrow', 'Barkod analiz paneli')}
              </Text>
              <Text style={[styles.welcomeText, { color: colors.mutedText }]}>
                {greeting},
              </Text>
              <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={[styles.subtitle, { color: colors.mutedText }]}>
                {tt(
                  'home_subtitle_refined',
                  'Son taramalarınıza, favorilerinize ve canlı içgörülere tek ekrandan ulaşın.'
                )}
              </Text>
            </View>

            <View
              style={[
                styles.heroStatusPill,
                {
                  backgroundColor: withAlpha(colors.primary, '14'),
                  borderColor: withAlpha(colors.primary, '2A'),
                },
              ]}
            >
              <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
              <Text style={[styles.heroStatusPillText, { color: colors.primary }]}>
                {shouldShowProfileCompletionGate
                  ? `%${profileCompletion.score}`
                  : tt('ready_label', 'Hazir')}
              </Text>
            </View>
          </View>

          <View style={styles.dashboardMetricRow}>
            <View
              style={[
                styles.heroMetricCard,
                { backgroundColor: withAlpha(colors.primary, '10') },
              ]}
            >
              <Text style={[styles.heroMetricLabel, { color: colors.mutedText }]}>
                {tt('today_short', 'Bugun')}
              </Text>
              <Text style={[styles.heroMetricValue, { color: colors.text }]}>
                {snapshot.todayCount}
              </Text>
            </View>
            <View
              style={[
                styles.heroMetricCard,
                { backgroundColor: withAlpha(colors.teal, '11') },
              ]}
            >
              <Text style={[styles.heroMetricLabel, { color: colors.mutedText }]}>
                {tt('streak_short', 'Seri')}
              </Text>
              <Text style={[styles.heroMetricValue, { color: colors.text }]}>
                {snapshot.streakCount}
              </Text>
            </View>
            <View
              style={[
                styles.heroMetricCard,
                { backgroundColor: withAlpha(colors.border, '42') },
              ]}
            >
              <Text style={[styles.heroMetricLabel, { color: colors.mutedText }]}>
                {tt('archive_short', 'Arsiv')}
              </Text>
              <Text style={[styles.heroMetricValue, { color: colors.text }]}>
                {snapshot.totalHistoryCount}
              </Text>
            </View>
          </View>

          <View style={styles.dashboardActionRow}>
            <TouchableOpacity
              style={[styles.heroPrimaryAction, { backgroundColor: colors.primary }]}
              onPress={openScanner}
              activeOpacity={0.92}
            >
              <Ionicons name="scan-outline" size={20} color={colors.primaryContrast} />
              <Text style={[styles.heroPrimaryActionText, { color: colors.primaryContrast }]}>
                {tt('scan_now', 'Simdi Tara')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {shouldShowProfileCompletionGate ? (
          <View
            style={[
              styles.profileGateCard,
              {
                backgroundColor: withAlpha(colors.cardElevated, isDark ? 'F2' : 'FC'),
                borderColor: withAlpha(colors.border, 'B6'),
              },
            ]}
          >
          <View style={styles.profileGateHeader}>
            <View style={styles.profileGateHeaderTextWrap}>
              <Text style={[styles.profileGateTitle, { color: colors.text }]}>
                {tt('complete_profile_title', 'Profilini Tamamla')}
              </Text>
              <Text style={[styles.profileGateSubtitle, { color: colors.mutedText }]}>
                {profileCompletionSummaryText}
              </Text>
            </View>

            <View
              style={[
                styles.profileGateScoreBadge,
                { backgroundColor: withAlpha(colors.primary, '12') },
              ]}
            >
              <Text style={[styles.profileGateScoreText, { color: colors.primary }]}>
                %{profileCompletion.score}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.profileGateProgressTrack,
              { backgroundColor: withAlpha(colors.border, '72') },
            ]}
          >
            <View
              style={[
                styles.profileGateProgressFill,
                {
                  width: `${profileCompletion.score}%`,
                  backgroundColor: colors.primary,
                },
              ]}
            />
          </View>

          <TouchableOpacity
            style={[styles.profileGateButton, { backgroundColor: colors.primary }]}
            onPress={openSettingsFromProfileGate}
            activeOpacity={0.9}
          >
            <Ionicons name="person-circle-outline" size={18} color={colors.primaryContrast} />
            <Text style={[styles.profileGateButtonText, { color: colors.primaryContrast }]}>
              {tt('complete_profile_cta', 'Profili Tamamla')}
            </Text>
          </TouchableOpacity>
          </View>
        ) : null}

      <AdBanner
        placement="home_mid_feed"
        containerStyle={{ marginBottom: 18 }}
      />

      <View style={styles.statsRow}>
        <StatCard
          icon="scan-outline"
          value={snapshot.todayCount}
          label={tt('today_scans', 'Bugünkü Taramalar')}
          colors={colors}
        />
        <StatCard
          icon="cube-outline"
          value={snapshot.todayUniqueCount}
          label={tt('today_unique_products', 'Bugünkü Benzersiz Ürün')}
          colors={colors}
        />
      </View>

      <View style={styles.statsRow}>
        <StatCard
          icon="flame-outline"
          value={snapshot.streakCount}
          label={streakText}
          colors={colors}
        />
        <StatCard
          icon="ribbon-outline"
          value={snapshot.bestScoreToday ?? '-'}
          label={tt('best_score_today', 'Günün En İyi Skoru')}
          colors={colors}
        />
      </View>

      <QuickInsightsStrip items={quickInsights} colors={colors} />

      <SummaryCard
        icon="stats-chart-outline"
        title={tt('history_overview', 'Geçmiş Özeti')}
        description={
          loadError
            ? tt('error_generic', 'Veriler yüklenemedi')
            : `${snapshot.totalHistoryCount} ${tt('products_label', 'ürün kaydı')} geçmişte saklanıyor.`
        }
        colors={colors}
      />

      <LiveInsightCard
        items={liveCardItems}
        badgeLabel={liveCardBadgeLabel}
        helperText={liveCardHelperText}
        colors={colors}
      />

      {snapshot.lastScannedProduct ? (
        <LastProductCard
          item={snapshot.lastScannedProduct}
          title={tt('last_scanned_product', 'Son Taranan Ürün')}
          subtitle={tt('continue_where_left_off', 'Kaldığın yerden devam et')}
          barcodeLabel={tt('barcode_label', 'Barkod')}
          scoreLabel={tt('score_label', 'Skor')}
          fallbackBrand={tt('unknown_brand', 'Bilinmeyen Marka')}
          fallbackName={tt('unnamed_product', 'İsimsiz Ürün')}
          onPress={() => openBarcodeDetail(snapshot.lastScannedProduct!.barcode)}
          colors={colors}
        />
      ) : null}

      <View
        style={[
          styles.shortcutsSurface,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderTextWrap}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {tt('favorite_products', 'Favoriler')}
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.text }]}>
              {tt(
                'favorite_products_subtitle',
                'Sık baktığınız ürünleri yıldızlayın ve buradan tek dokunuşla açın.'
              )}
            </Text>
          </View>

          <View style={[styles.sectionCountBadge, { backgroundColor: `${colors.primary}12` }]}>
            <Text style={[styles.sectionCountText, { color: colors.primary }]}>
              {rescanSnapshot.favoriteItems.length}
            </Text>
          </View>
        </View>

        {rescanLoading && !rescanSnapshot.favoriteItems.length ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : rescanLoadError && !rescanSnapshot.favoriteItems.length ? (
          <View style={styles.sectionEmptyWrap}>
            <Text style={[styles.sectionEmptyText, { color: colors.text }]}>
              {tt('favorites_load_error', 'Favoriler yüklenemedi. Yenileyip tekrar deneyin.')}
            </Text>
          </View>
        ) : rescanSnapshot.favoriteItems.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.favoriteScrollContent}
          >
            {rescanSnapshot.favoriteItems.map((item) => (
              <View
                key={item.barcode}
                style={[
                  styles.favoriteCard,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.favoriteCardTopRow}>
                  <Image
                    source={{ uri: item.image_url || FALLBACK_IMAGE }}
                    style={styles.favoriteImage}
                  />

                  <TouchableOpacity
                    style={[
                      styles.favoriteIconButton,
                      {
                        backgroundColor: `${colors.primary}12`,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => {
                      void toggleFavorite(item.barcode);
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="star" size={18} color={colors.primary} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.favoriteBrand, { color: colors.primary }]} numberOfLines={1}>
                  {item.brand || tt('unknown_brand', 'Bilinmeyen Marka')}
                </Text>

                <Text style={[styles.favoriteName, { color: colors.text }]} numberOfLines={2}>
                  {item.name || tt('unnamed_product', 'İsimsiz Ürün')}
                </Text>

                <View style={styles.favoriteMetaRow}>
                  <View style={[styles.metaChip, { backgroundColor: `${colors.primary}12` }]}>
                    <Text style={[styles.metaChipText, { color: colors.primary }]}>
                      {item.score ?? '-'} / 100
                    </Text>
                  </View>
                  <View style={[styles.metaChip, { backgroundColor: `${colors.primary}12` }]}>
                    <Text style={[styles.metaChipText, { color: colors.primary }]}>
                      {item.type === 'beauty'
                        ? tt('beauty_label', 'Kozmetik')
                        : tt('food_label', 'Gıda')}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryShortcutButton, { backgroundColor: colors.primary }]}
                  onPress={() => openBarcodeDetail(item.barcode)}
                  activeOpacity={0.9}
                >
                  <Ionicons name="scan-outline" size={16} color="#000" />
                  <Text style={styles.primaryShortcutButtonText}>
                    {tt('rescan_now', 'Yeniden Sorgula')}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.sectionEmptyWrap}>
            <Text style={[styles.sectionEmptyText, { color: colors.text }]}>
              {tt(
                'favorites_empty',
                'Henüz favori ürün yok. Geçmiş ekranında yıldız simgesiyle favori ekleyebilirsiniz.'
              )}
            </Text>
          </View>
        )}
      </View>

      <RecentProductsCarousel
        title={tt('recent_products', 'Son Ürünler')}
        subtitle={tt('recent_products_subtitle', 'Son taradığınız ürünlere hızlı dönün')}
        items={snapshot.recentProducts}
        fallbackBrand={tt('unknown_brand', 'Bilinmeyen Marka')}
        fallbackName={tt('unnamed_product', 'İsimsiz Ürün')}
        onItemPress={openBarcodeDetail}
        colors={colors}
      />
        <View style={styles.footerBrand}>
        <Ionicons name="shield-checkmark-sharp" size={16} color={colors.primary} />
        <Text style={[styles.footerText, { color: colors.text }]}>
          {tt('ai_food_safety', 'AI DESTEKLİ BARKOD ANALİZİ')}
        </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {},
  dashboardHero: {
    borderWidth: 1,
    borderRadius: 32,
    padding: 22,
    marginBottom: 20,
    shadowOpacity: 0.16,
    shadowRadius: 28,
    shadowOffset: {
      width: 0,
      height: 18,
    },
    elevation: 10,
  },
  dashboardHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  dashboardHeroTextWrap: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  heroStatusPill: {
    minHeight: 38,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  heroStatusPillText: {
    fontSize: 12,
    fontWeight: '900',
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '500',
  },
  userName: {
    fontSize: 33,
    fontWeight: '900',
    textTransform: 'capitalize',
    letterSpacing: -0.9,
    marginTop: 4,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 23,
  },
  dashboardMetricRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
  },
  heroMetricCard: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 13,
    minHeight: 84,
    justifyContent: 'space-between',
  },
  heroMetricLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroMetricValue: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 10,
  },
  dashboardActionRow: {
    flexDirection: 'row',
    marginTop: 18,
  },
  heroPrimaryAction: {
    width: '100%',
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heroPrimaryActionText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  profileGateCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    marginBottom: 20,
  },
  profileGateHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  profileGateHeaderTextWrap: {
    flex: 1,
  },
  profileGateTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  profileGateSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
  },
  profileGateScoreBadge: {
    minWidth: 56,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  profileGateScoreText: {
    fontSize: 13,
    fontWeight: '900',
  },
  profileGateProgressTrack: {
    width: '100%',
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 14,
  },
  profileGateProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  profileGateButton: {
    marginTop: 14,
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  profileGateButtonText: {
    fontSize: 13,
    fontWeight: '900',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 18,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 18,
  },
  shortcutsSurface: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    marginBottom: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionHeaderTextWrap: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  sectionSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.68,
  },
  sectionCountBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  sectionCountText: {
    fontSize: 12,
    fontWeight: '900',
  },
  inlineLoading: {
    paddingVertical: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionEmptyWrap: {
    paddingTop: 18,
  },
  sectionEmptyText: {
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.72,
  },
  favoriteScrollContent: {
    paddingTop: 18,
    paddingRight: 4,
    gap: 12,
  },
  favoriteCard: {
    width: 228,
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
  },
  favoriteCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  favoriteImage: {
    width: 64,
    height: 64,
    borderRadius: 18,
    resizeMode: 'cover',
  },
  favoriteIconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  favoriteBrand: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  favoriteName: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
    minHeight: 42,
  },
  favoriteMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  metaChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  metaChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  primaryShortcutButton: {
    marginTop: 14,
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryShortcutButtonText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '900',
  },
  quickShortcutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 18,
  },
  quickShortcutCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  quickShortcutHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  quickShortcutTextWrap: {
    flex: 1,
  },
  quickShortcutBrand: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  quickShortcutName: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  secondaryShortcutButton: {
    marginTop: 14,
    minHeight: 40,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryShortcutButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  footerBrand: {
    marginTop: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    opacity: 0.3,
  },
  footerText: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
});

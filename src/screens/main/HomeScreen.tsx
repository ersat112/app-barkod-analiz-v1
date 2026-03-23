import React from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../context/ThemeContext';
import { AdBanner } from '../../components/AdBanner';
import { useAppScreenLayout } from '../../components/layout/useAppScreenLayout';
import { useHomeScreenController } from '../../hooks/useHomeScreenController';
import {
  ChallengeCard,
  DidYouKnowCard,
  HomeLoadingState,
  InsightCard,
  LastProductCard,
  MissionCard,
  QuickActionCard,
  QuickInsightsStrip,
  RecentProductsCarousel,
  StatCard,
  SummaryCard,
} from './home/HomeSections';

const FALLBACK_IMAGE = 'https://via.placeholder.com/100?text=No+Image';

export const HomeScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
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
    openHistory,
    openSettings,
    openSettingsFromProfileGate,
    toggleFavorite,
    displayName,
    greeting,
    todayKey,
    dailyMission,
    dailyInsight,
    insightText,
    missionProgress,
    missionProgressText,
    motivationText,
    weeklyProgress,
    streakText,
    weeklyChallengeText,
    quickInsights,
    profileCompletion,
    shouldShowProfileCompletionGate,
    profileCompletionSummaryText,
  } = useHomeScreenController();

  if (loading) {
    return <HomeLoadingState label={tt('home', 'Ana Sayfa')} colors={colors} />;
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        ...styles.scrollContent,
        paddingTop: layout.headerTopPadding,
        paddingBottom: layout.contentBottomPadding,
        paddingHorizontal: layout.horizontalPadding,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing || rescanRefreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <Text style={[styles.welcomeText, { color: colors.text }]}>{greeting},</Text>
        <Text style={[styles.userName, { color: colors.primary }]} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={[styles.subtitle, { color: colors.text }]}>
          {tt('home_subtitle', 'Bugünkü barkod analiz özeti ve hızlı işlemler burada.')}
        </Text>
      </View>

      {shouldShowProfileCompletionGate ? (
        <View
          style={[
            styles.profileGateCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.profileGateHeader}>
            <View style={styles.profileGateHeaderTextWrap}>
              <Text style={[styles.profileGateTitle, { color: colors.text }]}>
                {tt('complete_profile_title', 'Profilini Tamamla')}
              </Text>
              <Text style={[styles.profileGateSubtitle, { color: colors.text }]}>
                {profileCompletionSummaryText}
              </Text>
            </View>

            <View style={[styles.profileGateScoreBadge, { backgroundColor: `${colors.primary}12` }]}>
              <Text style={[styles.profileGateScoreText, { color: colors.primary }]}>
                %{profileCompletion.score}
              </Text>
            </View>
          </View>

          <View style={[styles.profileGateProgressTrack, { backgroundColor: colors.border }]}>
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
            <Ionicons name="person-circle-outline" size={18} color="#000" />
            <Text style={styles.profileGateButtonText}>
              {tt('complete_profile_cta', 'Profili Tamamla')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <MissionCard
        icon={dailyMission.icon}
        title={dailyMission.title}
        description={dailyMission.text}
        progressLabel={missionProgressText}
        progressMeta={todayKey}
        progressValue={missionProgress}
        motivationText={motivationText}
        actionLabel={tt('scan_now', 'Şimdi Tara')}
        onActionPress={openScanner}
        colors={colors}
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

      <ChallengeCard
        title={tt('weekly_mini_challenge', 'Haftalık Mini Challenge')}
        subtitle={tt('weekly_active_days', `Son 7 günde ${snapshot.weeklyActiveDays} aktif günün var.`).replace(
          '{{count}}',
          String(snapshot.weeklyActiveDays)
        )}
        progressLabel={weeklyChallengeText}
        progressMeta={tt('weekly_goal', 'Hedef: 10').replace('{{count}}', '10')}
        progressValue={weeklyProgress}
        footerText={
          snapshot.weeklyScanTotal >= 10
            ? tt('weekly_goal_done_message', 'Haftalık hedefi tamamladın. Yeni rekor için devam et.')
            : tt(
                'weekly_goal_remaining_message',
                `Bu hafta hedefe ulaşmak için ${10 - snapshot.weeklyScanTotal} tarama daha yapabilirsin.`
              ).replace('{{count}}', String(10 - snapshot.weeklyScanTotal))
        }
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
              {tt('quick_rescan', 'Hızlı Yeniden Sorgula')}
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.text }]}>
              {tt(
                'quick_rescan_subtitle',
                'Son baktığınız ürünleri tekrar açmak için aşağıdaki kısayolları kullanın.'
              )}
            </Text>
          </View>
        </View>

        {rescanLoading && !rescanSnapshot.recentItems.length ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : rescanLoadError && !rescanSnapshot.recentItems.length ? (
          <View style={styles.sectionEmptyWrap}>
            <Text style={[styles.sectionEmptyText, { color: colors.text }]}>
              {tt('rescan_shortcuts_error', 'Kısayollar yüklenemedi. Yenileyip tekrar deneyin.')}
            </Text>
          </View>
        ) : rescanSnapshot.recentItems.length ? (
          <View style={styles.quickShortcutGrid}>
            {rescanSnapshot.recentItems.map((item) => (
              <View
                key={item.barcode}
                style={[
                  styles.quickShortcutCard,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.quickShortcutHeader}>
                  <View style={styles.quickShortcutTextWrap}>
                    <Text
                      style={[styles.quickShortcutBrand, { color: colors.primary }]}
                      numberOfLines={1}
                    >
                      {item.brand || tt('unknown_brand', 'Bilinmeyen Marka')}
                    </Text>
                    <Text
                      style={[styles.quickShortcutName, { color: colors.text }]}
                      numberOfLines={2}
                    >
                      {item.name || tt('unnamed_product', 'İsimsiz Ürün')}
                    </Text>
                  </View>

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
                    <Ionicons
                      name={item.isFavorite ? 'star' : 'star-outline'}
                      size={18}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                </View>

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
                  style={[
                    styles.secondaryShortcutButton,
                    {
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => openBarcodeDetail(item.barcode)}
                  activeOpacity={0.9}
                >
                  <Ionicons name="refresh-outline" size={16} color={colors.primary} />
                  <Text style={[styles.secondaryShortcutButtonText, { color: colors.text }]}>
                    {tt('open_again', 'Tekrar Aç')}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.sectionEmptyWrap}>
            <Text style={[styles.sectionEmptyText, { color: colors.text }]}>
              {tt(
                'quick_rescan_empty',
                'Tarama geçmişiniz büyüdükçe burada hızlı yeniden sorgulama kısayolları görünür.'
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

      <View style={styles.quickActionsRow}>
        <QuickActionCard
          icon="time-outline"
          title={tt('history', 'Geçmiş')}
          description={tt(
            'history_card_desc',
            'Önceki barkod taramalarınızı görüntüleyin.'
          )}
          onPress={openHistory}
          colors={colors}
        />

        <QuickActionCard
          icon="settings-outline"
          title={tt('settings', 'Ayarlar')}
          description={tt(
            'settings_card_desc',
            'Dil, tema ve hesap tercihlerinizi yönetin.'
          )}
          onPress={openSettings}
          colors={colors}
        />
      </View>

      <InsightCard
        icon={dailyInsight.icon}
        title={dailyInsight.title}
        text={dailyInsight.text}
        colors={colors}
      />

      <DidYouKnowCard
        title={tt('did_you_know', 'Biliyor muydunuz?')}
        text={insightText}
        colors={colors}
      />

      <AdBanner containerStyle={{ marginTop: 24 }} />

      <View style={styles.footerBrand}>
        <Ionicons name="shield-checkmark-sharp" size={16} color={colors.primary} />
        <Text style={[styles.footerText, { color: colors.text }]}>
          {tt('ai_food_safety', 'AI DESTEKLİ BARKOD ANALİZİ')}
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {},
  header: {
    marginBottom: 24,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '300',
    opacity: 0.8,
  },
  userName: {
    fontSize: 32,
    fontWeight: '900',
    textTransform: 'capitalize',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.65,
  },
  profileGateCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    marginBottom: 18,
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
    opacity: 0.72,
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
    color: '#000',
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
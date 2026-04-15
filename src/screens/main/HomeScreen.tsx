import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { AmbientBackdrop } from '../../components/ui/AmbientBackdrop';
import { ScreenOnboardingOverlay } from '../../components/ScreenOnboardingOverlay';
import { useAppScreenLayout } from '../../components/layout/useAppScreenLayout';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getHistoryPage, type HistoryEntry } from '../../services/db';
import {
  getFamilyAllergenDefinitions,
  getHomeAdditiveSpotlights,
} from '../../services/familyHealthProfile.service';
import {
  hasSeenScreenOnboarding,
  markScreenOnboardingSeen,
} from '../../services/screenOnboarding.service';
import { usePreferenceStore } from '../../store/usePreferenceStore';
import { buildUserDisplayName } from '../../services/userPresentation.service';
import { parseHistoryCreatedAt } from '../../types/history';
import { withAlpha } from '../../utils/color';

const getScoreAccent = (score?: number | null): string => {
  if (typeof score !== 'number') {
    return '#8892A6';
  }

  if (score >= 85) return '#18B56A';
  if (score >= 70) return '#74C947';
  if (score >= 55) return '#E3B341';
  if (score >= 35) return '#F08A24';
  return '#D94B45';
};

const formatHistoryMeta = (entry: HistoryEntry, locale: string, tt: (key: string, fallback: string) => string): string => {
  const { timePart, datePart } = parseHistoryCreatedAt(entry.created_at);
  const rawDate = datePart ? new Date(`${datePart}T00:00:00`) : null;
  const formattedDate =
    rawDate && Number.isFinite(rawDate.getTime())
      ? new Intl.DateTimeFormat(locale || 'tr-TR', {
          day: 'numeric',
          month: 'short',
        }).format(rawDate)
      : datePart;

  const typeLabel =
    entry.type === 'beauty'
      ? tt('beauty_label', 'Kozmetik')
      : entry.type === 'medicine'
        ? tt('medicine_label', 'İlaç')
        : tt('food_label', 'Gıda');

  return [typeLabel, formattedDate, timePart].filter(Boolean).join(' • ');
};

const resolveLookupModeFromType = (
  type: HistoryEntry['type']
): 'food' | 'beauty' | 'medicine' => {
  if (type === 'medicine') {
    return 'medicine';
  }

  if (type === 'beauty') {
    return 'beauty';
  }

  return 'food';
};

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t, i18n } = useTranslation();
  const { colors, isDark } = useTheme();
  const { user, profile, qaBypassEnabled } = useAuth();
  const familyHealthProfile = usePreferenceStore((state) => state.familyHealthProfile);
  const layout = useAppScreenLayout({
    topInsetExtra: 16,
    topInsetMin: 32,
    contentBottomExtra: 32,
    contentBottomMin: 90,
    horizontalPadding: 24,
  });
  const homeListCardSurface = useMemo(
    () => ({
      backgroundColor: isDark ? withAlpha(colors.card, 'F7') : '#FFFFFF',
      borderColor: withAlpha(colors.border, isDark ? '70' : '64'),
    }),
    [colors.border, colors.card, isDark]
  );

  const tt = useCallback(
    (key: string, fallback: string) => {
      const value = t(key, { defaultValue: fallback });
      return value === key ? fallback : value;
    },
    [t]
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentItems, setRecentItems] = useState<HistoryEntry[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const familyAllergenDefinitions = useMemo(
    () => getFamilyAllergenDefinitions(i18n.language),
    [i18n.language]
  );

  const load = useCallback(async () => {
    try {
      const recentPage = await Promise.resolve(
        getHistoryPage({
          limit: 10,
          offset: 0,
          query: '',
          type: 'all',
        })
      );
      setRecentItems(recentPage.items);
    } catch (error) {
      console.error('[HomeScreen] load failed:', error);
      setRecentItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();

      let cancelled = false;

      const loadOnboarding = async () => {
        const hasSeen = await hasSeenScreenOnboarding('home');

        if (!cancelled) {
          setShowOnboarding(!hasSeen);
        }
      };

      void loadOnboarding();

      return () => {
        cancelled = true;
      };
    }, [load])
  );

  const handleDismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    void markScreenOnboardingSeen('home');
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
  }, [load]);

  const displayName = useMemo(() => {
    return buildUserDisplayName({
      user,
      profile,
      fallback: tt('default_user_name', 'Kullanıcı'),
    });
  }, [profile, tt, user]);

  const trackedSignalCount = useMemo(() => {
    return (
      familyHealthProfile.allergens.length +
      familyHealthProfile.watchedAdditives.length +
      familyHealthProfile.healthGoals.length
    );
  }, [familyHealthProfile]);

  const familySummary = useMemo(() => {
    return tt(
      'family_home_summary',
      '{{allergenCount}} alerjen, {{additiveCount}} katkı ve {{goalCount}} sağlık odağı izleniyor.'
    )
      .replace('{{allergenCount}}', String(familyHealthProfile.allergens.length))
      .replace('{{additiveCount}}', String(familyHealthProfile.watchedAdditives.length))
      .replace('{{goalCount}}', String(familyHealthProfile.healthGoals.length));
  }, [familyHealthProfile, tt]);

  const homeAdditives = useMemo(() => getHomeAdditiveSpotlights(), []);
  const qaDetailShortcuts = useMemo(
    () => [
      { barcode: '5449000000996', label: 'Coca-Cola' },
      { barcode: '3017620422003', label: 'Nutella' },
      { barcode: '7622210449283', label: 'Prince' },
    ],
    []
  );

  if (loading) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.background }]}>
        <AmbientBackdrop colors={colors} variant="home" />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AmbientBackdrop colors={colors} variant="home" />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: layout.headerTopPadding,
          paddingBottom: layout.contentBottomPadding,
          paddingHorizontal: layout.horizontalPadding,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void handleRefresh();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View
          style={[
            styles.homeHeroCard,
            {
              backgroundColor: isDark ? '#447B22' : '#63AE2E',
              shadowColor: colors.shadow,
            },
          ]}
        >
          <View style={styles.homeHeroTopRow}>
            <View style={styles.homeHeroTextWrap}>
              <Text style={styles.homeHeroEyebrow}>
                {tt('home_hero_eyebrow', 'Günlük Özet')}
              </Text>
              <Text style={styles.homeHeroTitle}>
                {tt('home_title_simple', 'Bugün neye dikkat etmeliyim?')}
              </Text>
              <Text style={styles.homeHeroSubtitle}>
                {trackedSignalCount > 0
                  ? familySummary
                  : tt(
                      'family_home_empty',
                      'Alerjenlerini ve hassasiyetlerini ekleyerek uyarıları kişiselleştir.'
                    )}
              </Text>
            </View>

            <View style={styles.homeHeroProfileWrap}>
              <Text style={styles.homeHeroProfileLabel}>
                {tt('default_user_name', 'Kullanıcı')}
              </Text>
              <Text style={styles.homeHeroProfileValue} numberOfLines={2}>
                {displayName}
              </Text>
            </View>
          </View>

          <View style={styles.homeHeroStatsRow}>
            <View style={styles.homeHeroStat}>
              <Text style={styles.homeHeroStatLabel}>
                {tt('home_hero_stat_signals', 'Takip')}
              </Text>
              <Text style={styles.homeHeroStatValue}>{trackedSignalCount}</Text>
            </View>
            <View style={styles.homeHeroDivider} />
            <View style={styles.homeHeroStat}>
              <Text style={styles.homeHeroStatLabel}>
                {tt('recent_scans_title', 'Son 10 Tarama')}
              </Text>
              <Text style={styles.homeHeroStatValue}>{recentItems.length}</Text>
            </View>
          </View>

          <View style={styles.homeHeroActionRow}>
            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.homeHeroAction}
              onPress={() => navigation.navigate('FamilyHealthProfile')}
            >
              <Ionicons name="people-outline" size={16} color="#FFFFFF" />
              <Text style={styles.homeHeroActionText}>
                {tt('family_health_profile', 'Aile ve Sağlık Profili')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.homeHeroAction}
              onPress={() => navigation.navigate('History')}
            >
              <Ionicons name="search-outline" size={16} color="#FFFFFF" />
              <Text style={styles.homeHeroActionText}>
                {tt('search_history', 'Geçmişte Ara')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {qaBypassEnabled ? (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderTextWrap}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  QA Detail Tests
                </Text>
                <Text style={[styles.sectionSubtitleCompact, { color: colors.mutedText }]}>
                  Red-score product detail shortcuts
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.listCard,
                homeListCardSurface,
              ]}
            >
              {qaDetailShortcuts.map((item, index) => (
                <TouchableOpacity
                  key={item.barcode}
                  style={[
                    styles.listRow,
                    index < qaDetailShortcuts.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: withAlpha(colors.border, '80'),
                    },
                  ]}
                  activeOpacity={0.86}
                  onPress={() =>
                    navigation.navigate('Detail', {
                      barcode: item.barcode,
                      entrySource: 'home',
                      lookupMode: 'food',
                    })
                  }
                >
                  <View
                    style={[
                      styles.listRowAccent,
                      { backgroundColor: withAlpha(colors.danger, '18') },
                    ]}
                  >
                    <Ionicons name="bug-outline" size={16} color={colors.danger} />
                  </View>
                  <View style={styles.listRowTextWrap}>
                    <Text style={[styles.listRowTitle, { color: colors.text }]}>
                      {item.label}
                    </Text>
                    <Text style={[styles.listRowSubtitle, { color: colors.mutedText }]}>
                      {item.barcode}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderTextWrap}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {tt('critical_allergens_title', 'Dikkat Gerektiren Alerjenler')}
              </Text>
              <Text style={[styles.sectionSubtitleCompact, { color: colors.mutedText }]}>
                {tt(
                  'critical_allergens_subtitle_compact',
                  'Detay ve ekleme için dokun.'
                )}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.listCard,
              homeListCardSurface,
            ]}
          >
            {familyAllergenDefinitions.map((item, index) => (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.listRow,
                  index < familyAllergenDefinitions.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: withAlpha(colors.border, '80'),
                  },
                ]}
                activeOpacity={0.86}
                onPress={() =>
                  navigation.navigate('RiskInsightDetail', {
                    kind: 'allergen',
                    id: item.key,
                  })
                }
              >
                <View style={[styles.listRowAccent, { backgroundColor: withAlpha(colors.warning, '20') }]}>
                  <Ionicons name="warning-outline" size={16} color={colors.warning} />
                </View>
                <View style={styles.listRowTextWrap}>
                  <Text style={[styles.listRowTitle, { color: colors.text }]}>{item.label}</Text>
                  <Text style={[styles.listRowSubtitle, { color: colors.mutedText }]}>
                    {item.shortDescription}
                  </Text>
                </View>
                {familyHealthProfile.allergens.includes(item.key) ? (
                  <View style={[styles.inlineBadge, { backgroundColor: withAlpha(colors.primary, '14') }]}>
                    <Text style={[styles.inlineBadgeText, { color: colors.primary }]}>
                      {tt('active_short', 'Aktif')}
                    </Text>
                  </View>
                ) : null}
                <Ionicons name="chevron-forward" size={18} color={colors.primary} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderTextWrap}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {tt('critical_additives_title', 'Yüksek Riskli Katki Kodlari')}
              </Text>
              <Text style={[styles.sectionSubtitleCompact, { color: colors.mutedText }]}>
                {tt(
                  'critical_additives_subtitle_compact',
                  'Kod detayını açmak için dokun.'
                )}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.listCard,
              homeListCardSurface,
            ]}
          >
            {homeAdditives.map((item, index) => (
              <TouchableOpacity
                key={item.code}
                style={[
                  styles.listRow,
                  index < homeAdditives.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: withAlpha(colors.border, '80'),
                  },
                ]}
                activeOpacity={0.86}
                onPress={() =>
                  navigation.navigate('RiskInsightDetail', {
                    kind: 'additive',
                    id: item.code,
                  })
                }
              >
                <View style={[styles.listRowAccent, { backgroundColor: withAlpha(colors.danger, '18') }]}>
                  <Ionicons name="flask-outline" size={16} color={colors.danger} />
                </View>
                <View style={styles.listRowTextWrap}>
                  <Text style={[styles.listRowTitle, { color: colors.text }]}>
                    {item.code} • {item.name}
                  </Text>
                  <Text style={[styles.listRowSubtitle, { color: colors.mutedText }]}>
                    {item.impact}
                  </Text>
                </View>
                {familyHealthProfile.watchedAdditives.includes(item.code) ? (
                  <View style={[styles.inlineBadge, { backgroundColor: withAlpha(colors.primary, '14') }]}>
                    <Text style={[styles.inlineBadgeText, { color: colors.primary }]}>
                      {tt('watching_short', 'Izleniyor')}
                    </Text>
                  </View>
                ) : null}
                <Ionicons name="chevron-forward" size={18} color={colors.primary} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderTextWrap}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {tt('recent_scans_title', 'Son 10 Tarama')}
              </Text>
              <Text style={[styles.sectionSubtitleCompact, { color: colors.mutedText }]}>
                {tt(
                  'recent_scans_subtitle_compact',
                  'Daha detaylı arama için geçmişe geç.'
                )}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.sectionAction, { backgroundColor: withAlpha(colors.primary, '12') }]}
              activeOpacity={0.86}
              onPress={() => navigation.navigate('History')}
            >
              <Ionicons name="search-outline" size={15} color={colors.primary} />
              <Text style={[styles.sectionActionText, { color: colors.primary }]}>
                {tt('search_history', 'Geçmişte Ara')}
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.listCard,
              homeListCardSurface,
            ]}
          >
            {recentItems.length ? (
              recentItems.map((item, index) => {
                const accent = getScoreAccent(item.score);
                const meta = formatHistoryMeta(item, i18n.resolvedLanguage || 'tr-TR', tt);

                return (
                  <TouchableOpacity
                    key={`${item.id}-${item.barcode}`}
                    style={[
                      styles.scanRow,
                      index < recentItems.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: withAlpha(colors.border, '80'),
                      },
                    ]}
                    activeOpacity={0.88}
                    onPress={() =>
                      navigation.navigate('Detail', {
                        barcode: item.barcode,
                        entrySource: 'home',
                        prefetchedProduct: item,
                        lookupMode: resolveLookupModeFromType(item.type),
                      })
                    }
                  >
                    <View style={styles.scanRowTextWrap}>
                      <Text style={[styles.scanRowName, { color: colors.text }]} numberOfLines={2}>
                        {item.name || tt('unnamed_product', 'İsimsiz Ürün')}
                      </Text>
                      <Text style={[styles.scanRowMeta, { color: colors.mutedText }]} numberOfLines={1}>
                        {item.brand || tt('unknown_brand', 'Bilinmeyen Marka')} • {meta}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.scoreBubble,
                        {
                          backgroundColor: withAlpha(accent, '16'),
                          borderColor: withAlpha(accent, '42'),
                        },
                      ]}
                    >
                      <Text style={[styles.scoreValue, { color: accent }]}>
                        {item.type === 'medicine' ? 'Rx' : Math.round(item.score ?? 0)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyHistoryWrap}>
                <Text style={[styles.emptyHistoryTitle, { color: colors.text }]}>
                  {tt('history_empty', 'Henüz bir tarama yapmadınız.')}
                </Text>
                <Text style={[styles.emptyHistorySubtitle, { color: colors.mutedText }]}>
                  {tt(
                    'home_empty_history_help',
                    'Tarama yaptikca son urunler burada birikir ve tek dokunusla tekrar acilabilir.'
                  )}
                </Text>
                <TouchableOpacity
                  style={[styles.inlinePrimary, { backgroundColor: colors.primary }]}
                  activeOpacity={0.88}
                  onPress={() => navigation.navigate('Scanner')}
                >
                  <Ionicons name="scan-outline" size={18} color={colors.primaryContrast} />
                  <Text style={[styles.inlinePrimaryText, { color: colors.primaryContrast }]}>
                    {tt('scan_now', 'Şimdi Tara')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <ScreenOnboardingOverlay
        visible={showOnboarding}
        icon="home-outline"
        title={tt('home_onboarding_title', 'Ana sayfa özeti')}
        body={tt(
          'home_onboarding_body',
          'Burada dikkat gerektiren alerjenleri, riskli katkı kodlarını ve son 10 taramayı tek bakışta görürsün.'
        )}
        actionLabel={tt('onboarding_continue', 'Tamam')}
        colors={colors}
        onPress={handleDismissOnboarding}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeHeroCard: {
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 18,
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 8,
    },
  },
  homeHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  homeHeroTextWrap: {
    flex: 1,
  },
  homeHeroEyebrow: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  homeHeroTitle: {
    marginTop: 6,
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
  },
  homeHeroSubtitle: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  homeHeroProfileWrap: {
    minWidth: 88,
    alignItems: 'flex-end',
  },
  homeHeroProfileLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  homeHeroProfileValue: {
    marginTop: 6,
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
    textAlign: 'right',
  },
  homeHeroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  homeHeroStat: {
    flex: 1,
  },
  homeHeroStatLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  homeHeroStatValue: {
    marginTop: 5,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  homeHeroDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 14,
  },
  homeHeroActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  homeHeroAction: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  homeHeroActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  sectionBlock: {
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  sectionHeaderTextWrap: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  sectionSubtitleCompact: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 15,
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  sectionActionText: {
    fontSize: 12,
    fontWeight: '800',
  },
  listCard: {
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  listRow: {
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listRowAccent: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listRowTextWrap: {
    flex: 1,
  },
  listRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 17,
  },
  listRowSubtitle: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 15,
  },
  inlineBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inlineBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  scanRow: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scanRowTextWrap: {
    flex: 1,
  },
  scanRowName: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 17,
  },
  scanRowMeta: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 15,
  },
  scoreBubble: {
    minWidth: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  scoreValue: {
    fontSize: 15,
    fontWeight: '900',
  },
  emptyHistoryWrap: {
    padding: 16,
  },
  emptyHistoryTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptyHistorySubtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
  },
  inlinePrimary: {
    marginTop: 16,
    alignSelf: 'flex-start',
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlinePrimaryText: {
    fontSize: 14,
    fontWeight: '900',
  },
});

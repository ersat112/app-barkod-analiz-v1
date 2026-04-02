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

import { AdBanner } from '../../components/AdBanner';
import { AmbientBackdrop } from '../../components/ui/AmbientBackdrop';
import { useAppScreenLayout } from '../../components/layout/useAppScreenLayout';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getHistoryPage, type HistoryEntry } from '../../services/db';
import {
  FAMILY_ALLERGEN_DEFINITIONS,
  getHomeAdditiveSpotlights,
} from '../../services/familyHealthProfile.service';
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
  const { user, profile } = useAuth();
  const familyHealthProfile = usePreferenceStore((state) => state.familyHealthProfile);
  const layout = useAppScreenLayout({
    topInsetExtra: 16,
    topInsetMin: 32,
    contentBottomExtra: 32,
    contentBottomMin: 90,
    horizontalPadding: 24,
  });

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
      return undefined;
    }, [load])
  );

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
        <View style={styles.headerWrap}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>
            {tt('home_eyebrow', 'BarkodAnaliz')}
          </Text>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {tt('home_title_simple', 'Bugün neye dikkat etmeliyim?')}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedText }]}>
            {tt(
              'home_subtitle_simple',
              'En kritik alerjenleri, yüksek riskli katkı kodlarını ve son taramalarını tek ekranda gör.'
            )}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.familyCard,
            {
              backgroundColor: withAlpha(colors.card, isDark ? 'F2' : 'FC'),
              borderColor: withAlpha(colors.border, 'BC'),
              shadowColor: colors.shadow,
            },
          ]}
          activeOpacity={0.9}
          onPress={() => navigation.navigate('FamilyHealthProfile')}
        >
          <View style={[styles.familyIcon, { backgroundColor: withAlpha(colors.primary, '14') }]}>
            <Ionicons name="people-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.familyTextWrap}>
            <Text style={[styles.familyTitle, { color: colors.text }]}>
              {displayName
                ? `${displayName} • ${tt('family_health_profile', 'Aile ve Sağlık Profili')}`
                : tt('family_health_profile', 'Aile ve Sağlık Profili')}
            </Text>
            <Text style={[styles.familySubtitle, { color: colors.mutedText }]}>
              {familySummary}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </TouchableOpacity>

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderTextWrap}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {tt('critical_allergens_title', 'Dikkat Gerektiren Alerjenler')}
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.mutedText }]}>
                {tt(
                  'critical_allergens_subtitle',
                  'Aile profiline eklemek icin herhangi birine dokun.'
                )}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.listCard,
              {
                backgroundColor: withAlpha(colors.cardElevated, 'F2'),
                borderColor: withAlpha(colors.border, 'BC'),
              },
            ]}
          >
            {FAMILY_ALLERGEN_DEFINITIONS.map((item, index) => (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.listRow,
                  index < FAMILY_ALLERGEN_DEFINITIONS.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: withAlpha(colors.border, '88'),
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
              <Text style={[styles.sectionSubtitle, { color: colors.mutedText }]}>
                {tt(
                  'critical_additives_subtitle',
                  'Kodun ne anlama geldigini gormek ve izlemeye almak icin dokun.'
                )}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.listCard,
              {
                backgroundColor: withAlpha(colors.cardElevated, 'F2'),
                borderColor: withAlpha(colors.border, 'BC'),
              },
            ]}
          >
            {homeAdditives.map((item, index) => (
              <TouchableOpacity
                key={item.code}
                style={[
                  styles.listRow,
                  index < homeAdditives.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: withAlpha(colors.border, '88'),
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
              <Text style={[styles.sectionSubtitle, { color: colors.mutedText }]}>
                {tt(
                  'recent_scans_subtitle',
                  'Daha detayli arama icin Gecmis ekranina gec.'
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
              {
                backgroundColor: withAlpha(colors.cardElevated, 'F2'),
                borderColor: withAlpha(colors.border, 'BC'),
              },
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
                        borderBottomWidth: 1,
                        borderBottomColor: withAlpha(colors.border, '88'),
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

        <View style={styles.footerSpace}>
          <AdBanner placement="home_footer" />
        </View>
      </ScrollView>
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
  headerWrap: {
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  headerTitle: {
    marginTop: 8,
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 38,
  },
  headerSubtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 24,
    maxWidth: 520,
  },
  familyCard: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  familyIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  familyTextWrap: {
    flex: 1,
  },
  familyTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  familySubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionBlock: {
    marginTop: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  sectionHeaderTextWrap: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  sectionSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
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
    borderRadius: 24,
    overflow: 'hidden',
  },
  listRow: {
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  listRowAccent: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listRowTextWrap: {
    flex: 1,
  },
  listRowTitle: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  listRowSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
  },
  inlineBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  inlineBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  scanRow: {
    minHeight: 76,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  scanRowTextWrap: {
    flex: 1,
  },
  scanRowName: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
  },
  scanRowMeta: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
  },
  scoreBubble: {
    minWidth: 58,
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  emptyHistoryWrap: {
    padding: 20,
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
  footerSpace: {
    marginTop: 28,
  },
});

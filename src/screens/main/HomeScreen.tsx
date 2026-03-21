import React, { useMemo, useState, useCallback } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import {
  getTodayScanCount,
  getTodayUniqueProductCount,
  getHistoryCount,
  getLastScannedProduct,
  getBestScoreToday,
  getWeeklyScanCount,
  getWeeklyActiveDayCount,
  getCurrentStreakDays,
  type HistoryEntry,
} from '../../services/db';
import { AdBanner } from '../../components/AdBanner';

type ThemeColors = {
  background: string;
  card: string;
  text: string;
  primary: string;
  border: string;
};

type QuickActionCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
  colors: ThemeColors;
};

const DAILY_GOAL = 3;
const WEEKLY_GOAL = 10;

const formatDisplayName = (rawName: string): string =>
  rawName
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter((word: string) => word.length > 0)
    .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

const getTodayKey = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-${`${now.getDate()}`.padStart(2, '0')}`;
};

const getMissionIndex = (): number => new Date().getDate() % 4;
const getInsightIndex = (): number => new Date().getDay() % 4;

const getTimeBasedGreetingKey = (): string => {
  const hour = new Date().getHours();

  if (hour < 12) return 'good_morning';
  if (hour < 18) return 'good_afternoon';
  return 'good_evening';
};

const QuickActionCard: React.FC<QuickActionCardProps> = ({
  icon,
  title,
  description,
  onPress,
  colors,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.quickActionCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <Ionicons name={icon} size={24} color={colors.primary} />
      <Text
        style={[styles.quickActionTitle, { color: colors.text }]}
        numberOfLines={2}
      >
        {title}
      </Text>
      <Text
        style={[styles.quickActionText, { color: colors.text }]}
        numberOfLines={3}
      >
        {description}
      </Text>
    </TouchableOpacity>
  );
};

export const HomeScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();

  const tt = useCallback(
    (key: string, fallback: string) => {
      const value = t(key, { defaultValue: fallback });
      return value === key ? fallback : value;
    },
    [t]
  );

  const [todayCount, setTodayCount] = useState(0);
  const [todayUniqueCount, setTodayUniqueCount] = useState(0);
  const [totalHistoryCount, setTotalHistoryCount] = useState(0);
  const [lastScannedProduct, setLastScannedProduct] = useState<HistoryEntry | null>(null);
  const [bestScoreToday, setBestScoreToday] = useState<number | null>(null);
  const [weeklyScanTotal, setWeeklyScanTotal] = useState(0);
  const [weeklyActiveDays, setWeeklyActiveDays] = useState(0);
  const [streakCount, setStreakCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const displayName = useMemo(() => {
    const rawName = user?.displayName?.trim() || user?.email?.split('@')[0]?.trim() || '';

    if (!rawName) {
      return tt('default_user_name', 'Kullanıcı');
    }

    return formatDisplayName(rawName);
  }, [tt, user?.displayName, user?.email]);

  const greeting = useMemo(() => {
    const key = getTimeBasedGreetingKey();
    const fallback =
      key === 'good_morning'
        ? 'Günaydın'
        : key === 'good_afternoon'
          ? 'İyi günler'
          : 'İyi akşamlar';

    return tt(key, fallback);
  }, [tt]);

  const todayKey = useMemo(() => getTodayKey(), []);

  const dailyMission = useMemo(() => {
    const index = getMissionIndex();

    const map = [
      {
        title: tt('mission_today_1_title', 'Bugünün Görevi'),
        text: tt('mission_today_1_text', 'En az 3 ürün tarayıp içerik farkındalığını artır.'),
        icon: 'trophy-outline' as keyof typeof Ionicons.glyphMap,
      },
      {
        title: tt('mission_today_2_title', 'Sağlıklı Seçim Görevi'),
        text: tt('mission_today_2_text', 'Bugün en az 1 üründe katkı maddelerini incele.'),
        icon: 'leaf-outline' as keyof typeof Ionicons.glyphMap,
      },
      {
        title: tt('mission_today_3_title', 'Bilinçli Tüketim Görevi'),
        text: tt('mission_today_3_text', 'Yeni bir ürün barkodu tara ve geçmişini büyüt.'),
        icon: 'scan-outline' as keyof typeof Ionicons.glyphMap,
      },
      {
        title: tt('mission_today_4_title', 'Günün Mini Challenge’ı'),
        text: tt('mission_today_4_text', 'Aynı gün içinde 2 farklı kategoriden ürün analiz et.'),
        icon: 'flash-outline' as keyof typeof Ionicons.glyphMap,
      },
    ];

    return map[index];
  }, [tt]);

  const dailyInsight = useMemo(() => {
    const index = getInsightIndex();

    const map = [
      {
        title: tt('insight_1_title', 'Günün İpucu'),
        text: tt(
          'insight_1_text',
          'İçerik listesinde ilk sıralarda yer alan maddeler, üründe en yüksek oranda bulunan bileşenlerdir.'
        ),
        icon: 'bulb-outline' as keyof typeof Ionicons.glyphMap,
      },
      {
        title: tt('insight_2_title', 'Akıllı Hatırlatma'),
        text: tt(
          'insight_2_text',
          'Aynı markanın farklı ürünlerinde içerik profili ciddi şekilde değişebilir. Her ürünü ayrı incele.'
        ),
        icon: 'sparkles-outline' as keyof typeof Ionicons.glyphMap,
      },
      {
        title: tt('insight_3_title', 'Bugünkü Bilgi'),
        text: tt(
          'insight_3_text',
          'Yüksek riskli katkılar her kullanıcıda aynı etkiyi göstermeyebilir, ama düzenli takip daha bilinçli seçim sağlar.'
        ),
        icon: 'shield-checkmark-outline' as keyof typeof Ionicons.glyphMap,
      },
      {
        title: tt('insight_4_title', 'Küçük Ama Önemli'),
        text: tt(
          'insight_4_text',
          'Barkod menşei bilgisi her zaman gerçek üretim yeri anlamına gelmeyebilir; ürün detayını ayrıca kontrol et.'
        ),
        icon: 'information-circle-outline' as keyof typeof Ionicons.glyphMap,
      },
    ];

    return map[index];
  }, [tt]);

  const loadStats = useCallback(async () => {
    try {
      setStatsError(null);

      const today = await Promise.resolve(getTodayScanCount());
      const todayUnique = await Promise.resolve(getTodayUniqueProductCount());
      const total = await Promise.resolve(getHistoryCount());
      const lastProduct = await Promise.resolve(getLastScannedProduct());
      const bestToday = await Promise.resolve(getBestScoreToday());
      const weeklyTotal = await Promise.resolve(getWeeklyScanCount());
      const weeklyDays = await Promise.resolve(getWeeklyActiveDayCount());
      const streak = await Promise.resolve(getCurrentStreakDays());

      setTodayCount(Number.isFinite(today) ? today : 0);
      setTodayUniqueCount(Number.isFinite(todayUnique) ? todayUnique : 0);
      setTotalHistoryCount(Number.isFinite(total) ? total : 0);
      setLastScannedProduct(lastProduct);
      setBestScoreToday(bestToday);
      setWeeklyScanTotal(Number.isFinite(weeklyTotal) ? weeklyTotal : 0);
      setWeeklyActiveDays(Number.isFinite(weeklyDays) ? weeklyDays : 0);
      setStreakCount(Number.isFinite(streak) ? streak : 0);
    } catch (error) {
      console.error('Home stats load failed:', error);
      setStatsError(tt('error_generic', 'Veriler yüklenemedi'));
      setTodayCount(0);
      setTodayUniqueCount(0);
      setTotalHistoryCount(0);
      setLastScannedProduct(null);
      setBestScoreToday(null);
      setWeeklyScanTotal(0);
      setWeeklyActiveDays(0);
      setStreakCount(0);
    }
  }, [tt]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadStats();
    setIsRefreshing(false);
  }, [loadStats]);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  const insightText = useMemo(() => {
    if (todayCount === 0) {
      return tt(
        'home_insight_zero',
        'Henüz bugün barkod analizi yapılmadı. İlk taramayı başlatıp ürün içeriğini ve skorunu saniyeler içinde inceleyebilirsiniz.'
      );
    }

    if (todayCount < 5) {
      return tt(
        'home_insight_low',
        'Düzenli barkod taraması, katkı maddelerini ve ürün risk seviyelerini daha erken fark etmenize yardımcı olur.'
      );
    }

    return tt(
      'home_insight_high',
      'Harika gidiyorsunuz. Sık analiz yapmak, alışveriş tercihlerinizi daha bilinçli hale getirir.'
    );
  }, [todayCount, tt]);

  const missionProgress = useMemo(() => Math.min(todayCount / DAILY_GOAL, 1), [todayCount]);

  const missionProgressText = useMemo(() => {
    if (todayCount >= DAILY_GOAL) {
      return tt('daily_mission_completed', 'Görev tamamlandı');
    }

    return tt('daily_mission_progress', `${todayCount}/${DAILY_GOAL} tarama tamamlandı`)
      .replace('{{current}}', String(todayCount))
      .replace('{{goal}}', String(DAILY_GOAL));
  }, [todayCount, tt]);

  const motivationText = useMemo(() => {
    if (todayCount === 0) {
      return tt('daily_mission_start', 'Bugünün ilk analizini yap ve günlük görevi başlat.');
    }

    if (todayCount < DAILY_GOAL) {
      return tt(
        'daily_mission_remaining',
        `Hedefe çok yakınsın. ${DAILY_GOAL - todayCount} tarama daha yapman yeterli.`
      ).replace('{{count}}', String(DAILY_GOAL - todayCount));
    }

    return tt(
      'daily_mission_done_message',
      'Bugünkü hedef tamamlandı. İstersen yeni ürünler keşfetmeye devam et.'
    );
  }, [todayCount, tt]);

  const weeklyProgress = useMemo(() => {
    return Math.min(weeklyScanTotal / WEEKLY_GOAL, 1);
  }, [weeklyScanTotal]);

  const streakText = useMemo(() => {
    if (streakCount <= 0) return tt('streak_start', 'Seri başlat');
    if (streakCount === 1) return tt('streak_one_day', '1 günlük seri');

    return tt('streak_days', `${streakCount} günlük seri`).replace('{{count}}', String(streakCount));
  }, [streakCount, tt]);

  const weeklyChallengeText = useMemo(() => {
    if (weeklyScanTotal >= WEEKLY_GOAL) {
      return tt('weekly_goal_completed', 'Haftalık challenge tamamlandı');
    }

    return tt(
      'weekly_goal_progress',
      `${weeklyScanTotal}/${WEEKLY_GOAL} haftalık tarama tamamlandı`
    )
      .replace('{{current}}', String(weeklyScanTotal))
      .replace('{{goal}}', String(WEEKLY_GOAL));
  }, [weeklyScanTotal, tt]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <Text style={[styles.welcomeText, { color: colors.text }]}>
          {greeting},
        </Text>
        <Text style={[styles.userName, { color: colors.primary }]} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={[styles.subtitle, { color: colors.text }]}>
          {tt('home_subtitle', 'Bugünkü barkod analiz özeti ve hızlı işlemler burada.')}
        </Text>
      </View>

      <View
        style={[
          styles.heroCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.heroTopRow}>
          <View style={[styles.heroIconBox, { backgroundColor: `${colors.primary}15` }]}>
            <Ionicons name={dailyMission.icon} size={26} color={colors.primary} />
          </View>
          <View style={styles.heroTextArea}>
            <Text style={[styles.heroTitle, { color: colors.text }]} numberOfLines={2}>
              {dailyMission.title}
            </Text>
            <Text style={[styles.heroSubtitle, { color: colors.text }]} numberOfLines={3}>
              {dailyMission.text}
            </Text>
          </View>
        </View>

        <View style={styles.progressHeader}>
          <Text style={[styles.progressLabel, { color: colors.text }]}>
            {missionProgressText}
          </Text>
          <Text style={[styles.progressDate, { color: colors.text }]}>
            {todayKey}
          </Text>
        </View>

        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${missionProgress * 100}%`,
                backgroundColor: colors.primary,
              },
            ]}
          />
        </View>

        <Text style={[styles.motivationText, { color: colors.text }]}>
          {motivationText}
        </Text>

        <TouchableOpacity
          style={[styles.mainActionBtn, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('Scanner')}
          activeOpacity={0.9}
        >
          <View style={styles.btnContent}>
            <Ionicons name="barcode-outline" size={30} color="#000" />
            <Text style={styles.mainActionText}>
              {tt('scan_now', 'Şimdi Tara').toUpperCase()}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={22} color="#000" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View
          style={[
            styles.statCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Ionicons name="scan-outline" size={24} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.primary }]}>{todayCount}</Text>
          
          <Text style={[styles.statLabel, { color: colors.text }]}>
            {tt('today_scans', 'Bugünkü Taramalar')}
          </Text>
        </View>

        <View
          style={[
            styles.statCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Ionicons name="cube-outline" size={24} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.primary }]}>{todayUniqueCount}</Text>
          
          <Text style={[styles.statLabel, { color: colors.text }]}>
            {tt('today_unique_products', 'Bugünkü Benzersiz Ürün')}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View
          style={[
            styles.statCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Ionicons name="flame-outline" size={24} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.primary }]}>{streakCount}</Text>
          <Text style={[styles.statLabel, { color: colors.text }]}>{streakText}</Text>
        </View>

        <View
          style={[
            styles.statCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Ionicons name="ribbon-outline" size={24} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.primary }]}>
            {bestScoreToday ?? '-'}
          </Text>
          <Text style={[styles.statLabel, { color: colors.text }]}>
            {tt('best_score_today', 'Günün En İyi Skoru')}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.largeCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.largeCardHeader}>
          <View style={[styles.iconBox, { backgroundColor: `${colors.primary}15` }]}>
            <Ionicons name="stats-chart-outline" size={26} color={colors.primary} />
          </View>
          <View style={styles.largeCardInfo}>
            <Text style={[styles.largeCardTitle, { color: colors.text }]}>
              {tt('history_overview', 'Geçmiş Özeti')}
            </Text>
            <Text style={[styles.largeCardHint, { color: colors.text }]}>
              {statsError
                ? statsError
                : `${totalHistoryCount} ${tt('products_label', 'ürün kaydı')} geçmişte saklanıyor.`}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.challengeCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.challengeHeader}>
          <View style={[styles.challengeIconBox, { backgroundColor: `${colors.primary}15` }]}>
            <Ionicons name="medal-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.challengeTextBox}>
            <Text style={[styles.challengeTitle, { color: colors.text }]}>
              {tt('weekly_mini_challenge', 'Haftalık Mini Challenge')}
            </Text>
            <Text style={[styles.challengeSubtitle, { color: colors.text }]}>
              {tt('weekly_active_days', `Son 7 günde ${weeklyActiveDays} aktif günün var.`).replace('{{count}}', String(weeklyActiveDays))}
            </Text>
          </View>
        </View>

        <View style={styles.progressHeader}>
          <Text style={[styles.progressLabel, { color: colors.text }]}>
            {weeklyChallengeText}
          </Text>
          <Text style={[styles.progressDate, { color: colors.text }]}>
            {tt('weekly_goal', `Hedef: ${WEEKLY_GOAL}`).replace('{{count}}', String(WEEKLY_GOAL))}
          </Text>
        </View>

        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${weeklyProgress * 100}%`,
                backgroundColor: colors.primary,
              },
            ]}
          />
        </View>

        <Text style={[styles.challengeFooterText, { color: colors.text }]}>
          {weeklyScanTotal >= WEEKLY_GOAL
            ? tt('weekly_goal_done_message', 'Haftalık hedefi tamamladın. Yeni rekor için devam et.')
            : tt(
                'weekly_goal_remaining_message',
                `Bu hafta hedefe ulaşmak için ${WEEKLY_GOAL - weeklyScanTotal} tarama daha yapabilirsin.`
              ).replace('{{count}}', String(WEEKLY_GOAL - weeklyScanTotal))}
        </Text>
      </View>

      {lastScannedProduct ? (
        <TouchableOpacity
          style={[
            styles.lastProductCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          activeOpacity={0.88}
          onPress={() =>
            navigation.navigate('Detail', { barcode: lastScannedProduct.barcode })
          }
        >
          <View style={styles.lastProductHeader}>
            <View style={[styles.challengeIconBox, { backgroundColor: `${colors.primary}15` }]}>
              <Ionicons name="time-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.challengeTextBox}>
              <Text style={[styles.challengeTitle, { color: colors.text }]}>
                {tt('last_scanned_product', 'Son Taranan Ürün')}
              </Text>
              <Text style={[styles.challengeSubtitle, { color: colors.text }]}>
                {tt('continue_where_left_off', 'Kaldığın yerden devam et')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.border} />
          </View>

          <Text style={[styles.lastProductBrand, { color: colors.primary }]} numberOfLines={1}>
            {lastScannedProduct.brand || tt('unknown_brand', 'Bilinmeyen Marka')}
          </Text>
          <Text style={[styles.lastProductName, { color: colors.text }]} numberOfLines={2}>
            {lastScannedProduct.name || tt('unnamed_product', 'İsimsiz Ürün')}
          </Text>

          <View style={styles.lastProductMetaRow}>
            <View style={[styles.inlineBadge, { backgroundColor: `${colors.primary}12` }]}>
              <Text style={[styles.inlineBadgeText, { color: colors.primary }]} numberOfLines={1}>
                {tt('barcode_label', 'Barkod')}: {lastScannedProduct.barcode}
              </Text>
            </View>

            <View style={[styles.inlineBadge, { backgroundColor: `${colors.primary}12` }]}>
              <Text style={[styles.inlineBadgeText, { color: colors.primary }]} numberOfLines={1}>
                {tt('score_label', 'Skor')}: {lastScannedProduct.score ?? '-'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      ) : null}

      <View style={styles.quickActionsRow}>
        <QuickActionCard
          icon="time-outline"
          title={tt('history', 'Geçmiş')}
          description={tt(
            'history_card_desc',
            'Önceki barkod taramalarınızı görüntüleyin.'
          )}
          onPress={() => navigation.navigate('History')}
          colors={colors}
        />

        <QuickActionCard
          icon="settings-outline"
          title={tt('settings', 'Ayarlar')}
          description={tt(
            'settings_card_desc',
            'Dil, tema ve hesap tercihlerinizi yönetin.'
          )}
          onPress={() => navigation.navigate('Settings')}
          colors={colors}
        />
      </View>

      <View
        style={[
          styles.activityCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.activityHeader}>
          <Ionicons name={dailyInsight.icon} size={20} color={colors.primary} />
          <Text style={[styles.activityTitle, { color: colors.primary }]}>
            {dailyInsight.title}
          </Text>
        </View>

        <Text style={[styles.activityText, { color: colors.text }]}>
          {dailyInsight.text}
        </Text>
      </View>

      <View
        style={[
          styles.insightBox,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.insightHeader}>
          <Ionicons name="bulb-outline" size={20} color={colors.primary} />
          <Text style={[styles.insightTitle, { color: colors.primary }]}>
            {tt('did_you_know', 'Biliyor muydunuz?')}
          </Text>
        </View>

        <Text style={[styles.insightText, { color: colors.text }]}>
          {insightText}
        </Text>
      </View>

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
  scrollContent: {
    padding: 25,
    paddingTop: 70,
    paddingBottom: 100,
  },
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
  heroCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  heroIconBox: {
    width: 54,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTextArea: {
    flex: 1,
    marginLeft: 14,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.75,
  },
  progressHeader: {
    marginTop: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.8,
  },
  progressDate: {
    fontSize: 11,
    opacity: 0.55,
  },
  progressTrack: {
    width: '100%',
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  motivationText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.76,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    alignItems: 'flex-start',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
    marginTop: 8,
  },
  statLabel: {
    marginTop: 6,
    fontSize: 12,
    opacity: 0.7,
    lineHeight: 18,
  },
  largeCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
  },
  largeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeCardInfo: {
    flex: 1,
    marginLeft: 14,
  },
  largeCardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  largeCardHint: {
    marginTop: 5,
    fontSize: 12,
    opacity: 0.65,
    lineHeight: 18,
  },
  mainActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderRadius: 20,
    marginTop: 16,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  mainActionText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '900',
    marginLeft: 14,
    letterSpacing: 0.8,
  },
  challengeCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  challengeIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  challengeTextBox: {
    flex: 1,
    marginLeft: 12,
  },
  challengeTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  challengeSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.68,
  },
  challengeFooterText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.75,
  },
  lastProductCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
  },
  lastProductHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastProductBrand: {
    marginTop: 14,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  lastProductName: {
    marginTop: 4,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 24,
  },
  lastProductMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  inlineBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  inlineBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    flexShrink: 1,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 18,
  },
  quickActionCard: {
    flex: 1,
    minHeight: 150,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    justifyContent: 'space-between',
  },
  quickActionTitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '800',
    minHeight: 40,
    lineHeight: 20,
  },
  quickActionText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.7,
    minHeight: 58,
  },
  activityCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  activityText: {
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.8,
  },
  insightBox: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderLeftWidth: 6,
    borderLeftColor: '#FFD700',
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  insightTitle: {
    fontWeight: 'bold',
    fontSize: 15,
    textTransform: 'uppercase',
  },
  insightText: {
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.8,
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
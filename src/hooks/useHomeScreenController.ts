import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../context/AuthContext';
import { useHomeDashboard } from './useHomeDashboard';
import { useRescanActions } from './useRescanActions';
import { buildUserDisplayName } from '../services/userPresentation.service';
import { calculateProfileCompletion } from '../services/profileCompletion.service';
import { authAnalyticsService } from '../services/authAnalytics.service';

const DAILY_GOAL = 3;
const WEEKLY_GOAL = 10;

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

export const useHomeScreenController = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { user, profile } = useAuth();
  const trackedProfileGateRef = useRef<string>('');

  const {
    snapshot,
    loading,
    refreshing,
    loadError,
    load,
    refresh,
  } = useHomeDashboard();

  const {
    snapshot: rescanSnapshot,
    loading: rescanLoading,
    refreshing: rescanRefreshing,
    loadError: rescanLoadError,
    load: loadRescanActions,
    refresh: refreshRescanActions,
    toggleFavorite,
  } = useRescanActions();

  const tt = useCallback(
    (key: string, fallback: string) => {
      const value = t(key, { defaultValue: fallback });
      return value === key ? fallback : value;
    },
    [t]
  );

  useFocusEffect(
    useCallback(() => {
      void load();
      void loadRescanActions();

      return undefined;
    }, [load, loadRescanActions])
  );

  const handleRefresh = useCallback(async () => {
    await Promise.all([refresh(), refreshRescanActions()]);
  }, [refresh, refreshRescanActions]);

  const openBarcodeDetail = useCallback(
    (barcode: string) => {
      navigation.navigate('Detail', { barcode });
    },
    [navigation]
  );

  const openScanner = useCallback(() => {
    navigation.navigate('Scanner');
  }, [navigation]);

  const openHistory = useCallback(() => {
    navigation.navigate('History');
  }, [navigation]);

  const openSettings = useCallback(() => {
    navigation.navigate('Settings');
  }, [navigation]);

  const displayName = useMemo(() => {
    return buildUserDisplayName({
      profile,
      user,
      fallback: tt('default_user_name', 'Kullanıcı'),
    });
  }, [profile, tt, user]);

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

  const profileCompletion = useMemo(() => {
    return calculateProfileCompletion({
      profile,
      user,
    });
  }, [profile, user]);

  const profileCompletionMissingLabels = useMemo(() => {
    const fieldLabelMap: Record<string, string> = {
      firstName: tt('first_name', 'Ad'),
      lastName: tt('last_name', 'Soyad'),
      phone: tt('phone', 'Telefon'),
      city: tt('city', 'Şehir'),
      district: tt('district', 'İlçe'),
      address: tt('address', 'Adres'),
    };

    return profileCompletion.missingFields.map((field) => fieldLabelMap[field]);
  }, [profileCompletion.missingFields, tt]);

  const shouldShowProfileCompletionGate = useMemo(() => {
    return Boolean(user) && !profileCompletion.isComplete;
  }, [profileCompletion.isComplete, user]);

  const profileCompletionSummaryText = useMemo(() => {
    if (profileCompletion.isComplete) {
      return tt('profile_complete_summary', 'Profil bilgilerin tamamlandı.');
    }

    const visibleLabels = profileCompletionMissingLabels.slice(0, 2);
    const extraCount = Math.max(profileCompletionMissingLabels.length - visibleLabels.length, 0);
    const extraSuffix = extraCount > 0 ? ` +${extraCount}` : '';

    return tt(
      'profile_completion_gate_summary',
      `Profilin %${profileCompletion.score} tamamlandı. Eksik alanlar: ${visibleLabels.join(', ')}${extraSuffix}.`
    );
  }, [profileCompletion.isComplete, profileCompletion.score, profileCompletionMissingLabels, tt]);

  useEffect(() => {
    if (!shouldShowProfileCompletionGate) {
      trackedProfileGateRef.current = '';
      return;
    }

    const signature = `${profileCompletion.score}:${profileCompletion.missingFields.join(',')}`;

    if (trackedProfileGateRef.current === signature) {
      return;
    }

    trackedProfileGateRef.current = signature;

    void authAnalyticsService.trackProfileCompletionGateViewed({
      surface: 'home',
      completionScore: profileCompletion.score,
      missingFields: profileCompletion.missingFields,
    });
  }, [
    profileCompletion.missingFields,
    profileCompletion.score,
    shouldShowProfileCompletionGate,
  ]);

  const openSettingsFromProfileGate = useCallback(() => {
    void authAnalyticsService.trackProfileCompletionCtaTapped({
      surface: 'home',
      completionScore: profileCompletion.score,
      missingFields: profileCompletion.missingFields,
    });

    openSettings();
  }, [openSettings, profileCompletion.missingFields, profileCompletion.score]);

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

  const insightText = useMemo(() => {
    if (snapshot.todayCount === 0) {
      return tt(
        'home_insight_zero',
        'Henüz bugün barkod analizi yapılmadı. İlk taramayı başlatıp ürün içeriğini ve skorunu saniyeler içinde inceleyebilirsiniz.'
      );
    }

    if (snapshot.todayCount < 5) {
      return tt(
        'home_insight_low',
        'Düzenli barkod taraması, katkı maddelerini ve ürün risk seviyelerini daha erken fark etmenize yardımcı olur.'
      );
    }

    return tt(
      'home_insight_high',
      'Harika gidiyorsunuz. Sık analiz yapmak, alışveriş tercihlerinizi daha bilinçli hale getirir.'
    );
  }, [snapshot.todayCount, tt]);

  const missionProgress = useMemo(() => {
    return Math.min(snapshot.todayCount / DAILY_GOAL, 1);
  }, [snapshot.todayCount]);

  const missionProgressText = useMemo(() => {
    if (snapshot.todayCount >= DAILY_GOAL) {
      return tt('daily_mission_completed', 'Görev tamamlandı');
    }

    return tt(
      'daily_mission_progress',
      `${snapshot.todayCount}/${DAILY_GOAL} tarama tamamlandı`
    )
      .replace('{{current}}', String(snapshot.todayCount))
      .replace('{{goal}}', String(DAILY_GOAL));
  }, [snapshot.todayCount, tt]);

  const motivationText = useMemo(() => {
    if (snapshot.todayCount === 0) {
      return tt('daily_mission_start', 'Bugünün ilk analizini yap ve günlük görevi başlat.');
    }

    if (snapshot.todayCount < DAILY_GOAL) {
      return tt(
        'daily_mission_remaining',
        `Hedefe çok yakınsın. ${DAILY_GOAL - snapshot.todayCount} tarama daha yapman yeterli.`
      ).replace('{{count}}', String(DAILY_GOAL - snapshot.todayCount));
    }

    return tt(
      'daily_mission_done_message',
      'Bugünkü hedef tamamlandı. İstersen yeni ürünler keşfetmeye devam et.'
    );
  }, [snapshot.todayCount, tt]);

  const weeklyProgress = useMemo(() => {
    return Math.min(snapshot.weeklyScanTotal / WEEKLY_GOAL, 1);
  }, [snapshot.weeklyScanTotal]);

  const streakText = useMemo(() => {
    if (snapshot.streakCount <= 0) return tt('streak_start', 'Seri başlat');
    if (snapshot.streakCount === 1) return tt('streak_one_day', '1 günlük seri');

    return tt('streak_days', `${snapshot.streakCount} günlük seri`).replace(
      '{{count}}',
      String(snapshot.streakCount)
    );
  }, [snapshot.streakCount, tt]);

  const weeklyChallengeText = useMemo(() => {
    if (snapshot.weeklyScanTotal >= WEEKLY_GOAL) {
      return tt('weekly_goal_completed', 'Haftalık challenge tamamlandı');
    }

    return tt(
      'weekly_goal_progress',
      `${snapshot.weeklyScanTotal}/${WEEKLY_GOAL} haftalık tarama tamamlandı`
    )
      .replace('{{current}}', String(snapshot.weeklyScanTotal))
      .replace('{{goal}}', String(WEEKLY_GOAL));
  }, [snapshot.weeklyScanTotal, tt]);

  const quickInsights = useMemo(
    () => [
      {
        icon: 'albums-outline' as keyof typeof Ionicons.glyphMap,
        value: String(snapshot.totalHistoryCount),
        label: tt('products_label', 'Toplam Kayıt'),
      },
      {
        icon: 'calendar-outline' as keyof typeof Ionicons.glyphMap,
        value: String(snapshot.weeklyActiveDays),
        label: tt('weekly_active_days_short', 'Aktif Gün'),
      },
      {
        icon: 'bar-chart-outline' as keyof typeof Ionicons.glyphMap,
        value: String(snapshot.weeklyScanTotal),
        label: tt('weekly_scans_short', 'Haftalık Tarama'),
      },
    ],
    [snapshot.totalHistoryCount, snapshot.weeklyActiveDays, snapshot.weeklyScanTotal, tt]
  );

  return {
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
  };
};
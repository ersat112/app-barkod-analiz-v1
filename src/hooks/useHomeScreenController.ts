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

  const streakText = useMemo(() => {
    if (snapshot.streakCount <= 0) return tt('streak_start', 'Seri başlat');
    if (snapshot.streakCount === 1) return tt('streak_one_day', '1 günlük seri');

    return tt('streak_days', `${snapshot.streakCount} günlük seri`).replace(
      '{{count}}',
      String(snapshot.streakCount)
    );
  }, [snapshot.streakCount, tt]);

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

  const liveInsightItems = useMemo(
    () => [
      dailyInsight,
      {
        icon:
          snapshot.todayCount > 0
            ? ('scan-circle-outline' as keyof typeof Ionicons.glyphMap)
            : ('sparkles-outline' as keyof typeof Ionicons.glyphMap),
        title: tt('today_brief_title', 'Bugünkü Durum'),
        text:
          snapshot.todayCount > 0
            ? tt(
                'today_brief_progress',
                'Bugün {{count}} tarama tamamlandı. En iyi skor {{score}} olarak görünüyor.'
              )
                .replace('{{count}}', String(snapshot.todayCount))
                .replace('{{score}}', String(snapshot.bestScoreToday ?? '-'))
            : tt(
                'today_brief_empty',
                'Henüz bugün tarama yapılmadı. Şimdi Tara ile ilk analizi başlatabilirsiniz.'
              ),
      },
      {
        icon: 'flame-outline' as keyof typeof Ionicons.glyphMap,
        title: tt('streak_focus_title', 'Seri Durumu'),
        text:
          snapshot.streakCount > 0
            ? tt(
                'streak_focus_active',
                '{{count}} günlük seri devam ediyor. Son 7 günde {{days}} aktif gün kaydedildi.'
              )
                .replace('{{count}}', String(snapshot.streakCount))
                .replace('{{days}}', String(snapshot.weeklyActiveDays))
            : tt(
                'streak_focus_empty',
                'Yeni bir seri başlatmak için bugün bir ürün tarayın.'
              ),
      },
      {
        icon: 'bulb-outline' as keyof typeof Ionicons.glyphMap,
        title: tt('did_you_know', 'Biliyor muydunuz?'),
        text: insightText,
      },
    ],
    [
      dailyInsight,
      insightText,
      snapshot.bestScoreToday,
      snapshot.streakCount,
      snapshot.todayCount,
      snapshot.weeklyActiveDays,
      tt,
    ]
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
  };
};

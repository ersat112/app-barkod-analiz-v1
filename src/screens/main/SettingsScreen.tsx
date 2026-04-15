import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { sendEmailVerification, signOut } from 'firebase/auth';

import { getEmailVerificationActionSettings } from '../../config/authRuntime';
import { auth } from '../../config/firebase';
import {
  LEGAL_VERSION_LABEL,
  buildCurrentLegalAcceptance,
} from '../../config/legalRuntime';
import { FEATURES } from '../../config/features';
import { useAuth } from '../../context/AuthContext';
import { useTheme, type ThemeColors } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { ScreenOnboardingOverlay } from '../../components/ScreenOnboardingOverlay';
import { AmbientBackdrop } from '../../components/ui/AmbientBackdrop';
import { SearchableSelectSheet } from '../../components/ui/SearchableSelectSheet';
import { useAppScreenLayout } from '../../components/layout/useAppScreenLayout';
import { useOperabilityDiagnostics } from '../../hooks/useOperabilityDiagnostics';
import { useMonetizationStatus } from '../../hooks/useMonetizationStatus';
import { ALL_E_CODES } from '../../services/eCodesData';
import {
  disableEngagementNotifications,
  syncEngagementNotifications,
} from '../../services/engagementNotifications.service';
import { analyticsService } from '../../services/analytics.service';
import { clearMonetizationFlowLogs } from '../../services/purchaseFlowLog.service';
import {
  hasSeenScreenOnboarding,
  markScreenOnboardingSeen,
} from '../../services/screenOnboarding.service';
import { updateCurrentUserLegalAcceptance } from '../../services/userProfile.service';
import { usePreferenceStore } from '../../store/usePreferenceStore';
import {
  buildAvatarLetter,
  buildUserDisplayName,
  buildUserMetaText,
} from '../../services/userPresentation.service';
import { withAlpha } from '../../utils/color';

const APP_VERSION = 'v1.0.1';
const SETTINGS_FOOTER_FAVICON = require('../../../assets/favicon-transparent.png');

type SettingsItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  value?: string;
  badgeLabel?: string;
  onPress?: () => void;
  danger?: boolean;
  grouped?: 'single' | 'first' | 'middle' | 'last';
  children?: React.ReactNode;
  colors: ThemeColors;
};

const SettingsItem: React.FC<SettingsItemProps> = ({
  icon,
  label,
  subtitle,
  value,
  badgeLabel,
  onPress,
  danger = false,
  grouped = 'single',
  children,
  colors,
}) => (
  <TouchableOpacity
    style={[
      styles.item,
      {
        borderBottomColor: withAlpha(colors.border, '80'),
        borderBottomWidth: grouped === 'single' || grouped === 'last' ? 0 : StyleSheet.hairlineWidth,
      },
    ]}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={onPress ? 0.82 : 1}
  >
    <View style={styles.itemLeft}>
      <View style={styles.itemGlyphWrap}>
        <Ionicons
          name={icon}
          size={18}
          color={danger ? '#D64545' : colors.text}
        />
      </View>
      <View style={styles.itemTextWrap}>
        <Text
          style={[styles.itemLabel, { color: danger ? '#D64545' : colors.text }]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.itemSubtitle, { color: colors.mutedText }]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>

    {children ? (
      children
    ) : (
      <View style={styles.itemRight}>
        {badgeLabel ? (
          <View
            style={[
              styles.itemBadge,
              {
                backgroundColor: withAlpha(danger ? '#D64545' : colors.primary, '12'),
              },
            ]}
          >
            <Text
              style={[
                styles.itemBadgeText,
                { color: danger ? '#D64545' : colors.primary },
              ]}
              numberOfLines={1}
            >
              {badgeLabel}
            </Text>
          </View>
        ) : null}
        {!!value && (
          <Text
            style={[styles.itemValue, { color: danger ? '#D64545' : colors.mutedText }]}
            numberOfLines={1}
          >
            {value}
          </Text>
        )}
        {onPress ? (
          <Ionicons
            name="chevron-forward"
            size={18}
            color={danger ? '#D64545' : colors.mutedText}
          />
        ) : null}
      </View>
    )}
  </TouchableOpacity>
);

function formatDuration(ms: number): string {
  if (ms <= 0) {
    return '0 dk';
  }

  const totalMinutes = Math.round(ms / 1000 / 60);

  if (totalMinutes < 60) {
    return `${totalMinutes} dk`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!minutes) {
    return `${hours} sa`;
  }

  return `${hours} sa ${minutes} dk`;
}

function formatTimeValue(value?: string | number | null): string {
  if (value === null || value === undefined) {
    return '-';
  }

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

function formatDateTimeValue(value?: string | number | null): string {
  if (value === null || value === undefined) {
    return '-';
  }

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

function boolStateText(value?: boolean | null): string {
  if (typeof value !== 'boolean') {
    return '-';
  }

  return value ? 'ON' : 'OFF';
}

function formatOptionalText(value?: string | number | null): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  return '-';
}

function formatTryPrice(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDiagnosticsList(items: string[]): string {
  if (!items.length) {
    return '-';
  }

  return items.map((item) => `• ${item}`).join('\n');
}

function formatNumberedDiagnosticsList(items: string[]): string {
  if (!items.length) {
    return '-';
  }

  return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

function formatShortDiagnosticId(value?: string | null): string {
  if (typeof value !== 'string' || !value.trim()) {
    return '-';
  }

  const normalized = value.trim();

  if (normalized.length <= 18) {
    return normalized;
  }

  return `${normalized.slice(0, 8)}...${normalized.slice(-4)}`;
}

function formatDiagnosticDateTime(value?: string | null): string {
  if (!value) {
    return '-';
  }

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleString(undefined, {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

function trimDiagnosticsText(value: string, maxLength = 84): string {
  const normalized = value.trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

function formatSmokeTestChecklist(
  items: { title: string; status: 'blocked' | 'ready' | 'manual'; detail: string }[]
): string {
  if (!items.length) {
    return '-';
  }

  const statusLabel = {
    ready: '[READY]',
    blocked: '[BLOCKED]',
    manual: '[MANUAL]',
  } as const;

  return items
    .map((item) => `${statusLabel[item.status]} ${item.title}: ${item.detail}`)
    .join('\n');
}

function formatRecentMonetizationFlowLogs(
  items: {
    createdAt: string;
    action: 'purchase' | 'restore';
    stage: 'started' | 'result' | 'error';
    status: string;
    source: 'scan_limit' | 'settings' | 'unknown' | 'service';
    providerName: string;
    customerId: string | null;
    transactionId: string | null;
    message: string;
    identityMismatch: boolean;
  }[]
): string {
  if (!items.length) {
    return '-';
  }

  return items
    .map((item) => {
      const mismatchSuffix = item.identityMismatch ? ' | mismatch' : '';

      return [
        `${formatDiagnosticDateTime(item.createdAt)} ${item.action}/${item.stage}/${item.status}`,
        `provider:${item.providerName} source:${item.source} customer:${formatShortDiagnosticId(item.customerId)} tx:${formatShortDiagnosticId(item.transactionId)}${mismatchSuffix}`,
        trimDiagnosticsText(item.message),
      ].join(' | ');
    })
    .join('\n');
}

export const SettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { user, profile, loading: authLoading, refreshProfile, disableQaBypass } =
    useAuth();
  const { colors, isDark, setIsDark, toggleTheme } = useTheme();
  const { locale, changeLanguage, supportedLanguages, ready: languageReady } = useLanguage();
  const notificationsEnabled = usePreferenceStore((state) => state.notificationsEnabled);
  const nutritionPreferences = usePreferenceStore((state) => state.nutritionPreferences);
  const setNotificationsEnabled = usePreferenceStore(
    (state) => state.setNotificationsEnabled
  );

  const layout = useAppScreenLayout({
    topInsetExtra: 16,
    topInsetMin: 32,
    contentBottomExtra: 28,
    contentBottomMin: 40,
    horizontalPadding: 25,
  });
  const settingsMenuCardSurface = useMemo(
    () => ({
      backgroundColor: isDark ? withAlpha(colors.card, 'F7') : '#FFFFFF',
      borderColor: withAlpha(colors.border, isDark ? '70' : '64'),
      marginHorizontal: layout.horizontalPadding,
    }),
    [colors.border, colors.card, isDark, layout.horizontalPadding]
  );

  const showInternalDiagnostics = false;
  const adDiagnosticsEnabled =
    showInternalDiagnostics && FEATURES.ads.diagnosticsLoggingEnabled;
  const firebaseDiagnosticsEnabled =
    showInternalDiagnostics && FEATURES.firebase.diagnosticsLoggingEnabled;
  const monetizationDiagnosticsEnabled =
    showInternalDiagnostics && FEATURES.monetization.diagnosticsLoggingEnabled;
  const operabilityDiagnosticsEnabled =
    adDiagnosticsEnabled ||
    firebaseDiagnosticsEnabled ||
    monetizationDiagnosticsEnabled;

  const {
    snapshot: operabilityDiagnostics,
    loading: operabilityLoading,
    refreshing: operabilityRefreshing,
    error: operabilityError,
    refresh: refreshOperabilityDiagnostics,
  } = useOperabilityDiagnostics({
    enabled: operabilityDiagnosticsEnabled,
  });

  const monetization = useMonetizationStatus();

  const tt = useCallback(
    (key: string, fallback: string) => {
      const value = t(key, { defaultValue: fallback });
      return value === key ? fallback : value;
    },
    [t]
  );

  const [refreshing, setRefreshing] = useState(false);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [languagePickerSearch, setLanguagePickerSearch] = useState('');
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [flowLogResetting, setFlowLogResetting] = useState(false);
  const [notificationSyncing, setNotificationSyncing] = useState(false);
  const [legalAcceptanceUpdating, setLegalAcceptanceUpdating] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const handleOpenPaywall = useCallback(() => {
    void analyticsService.track(
      'monetization_settings_premium_tapped',
      {
        source: 'settings',
        entitlementPlan: monetization.entitlement?.plan ?? 'free',
        isPremium: monetization.entitlement?.isPremium ?? false,
        annualProductId: monetization.policy?.annualProductId ?? null,
      },
      { flush: false }
    );

    navigation.navigate('Paywall', { source: 'settings' });
  }, [
    monetization.entitlement?.isPremium,
    monetization.entitlement?.plan,
    monetization.policy?.annualProductId,
    navigation,
  ]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const loadOnboarding = async () => {
        const hasSeen = await hasSeenScreenOnboarding('profile');

        if (!cancelled) {
          setShowOnboarding(!hasSeen);
        }
      };

      void loadOnboarding();

      return () => {
        cancelled = true;
      };
    }, [])
  );

  const handleDismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    void markScreenOnboardingSeen('profile');
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const tasks: Promise<unknown>[] = [refreshProfile(), monetization.refresh()];

    if (showInternalDiagnostics) {
      tasks.push(refreshOperabilityDiagnostics());
    }

    await Promise.all(tasks);
    setRefreshing(false);
  }, [monetization, refreshOperabilityDiagnostics, refreshProfile, showInternalDiagnostics]);

  const handleResetMonetizationFlowLogs = useCallback(() => {
    Alert.alert(
      tt('clear_logs_title', 'Test loglarını temizle'),
      tt(
        'clear_logs_message',
        'Purchase / restore test logları temizlenecek. Devam etmek istiyor musun?'
      ),
      [
        {
          text: tt('cancel', 'İptal'),
          style: 'cancel',
        },
        {
          text: tt('clear', 'Temizle'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setFlowLogResetting(true);

              try {
                await clearMonetizationFlowLogs();
                await refreshOperabilityDiagnostics();
              } catch (error) {
                Alert.alert(
                  tt('error_title', 'Hata'),
                  error instanceof Error && error.message.trim()
                    ? error.message
                    : tt('clear_logs_error', 'Test logları temizlenemedi.')
                );
              } finally {
                setFlowLogResetting(false);
              }
            })();
          },
        },
      ]
    );
  }, [refreshOperabilityDiagnostics, tt]);

  const handleSafeOpenUrl = useCallback(
    async (url: string, fallbackMessage?: string) => {
      try {
        const supported = await Linking.canOpenURL(url);

        if (!supported) {
          Alert.alert(
            tt('error_title', 'Hata'),
            fallbackMessage || tt('link_open_error', 'Bağlantı açılamadı')
          );
          return;
        }

        await Linking.openURL(url);
      } catch (error) {
        console.error('Open URL failed:', error);
        Alert.alert(
          tt('error_title', 'Hata'),
          fallbackMessage || tt('link_open_error', 'Bağlantı açılamadı')
        );
      }
    },
    [tt]
  );

  const handleOpenAboutApp = useCallback(() => {
    Alert.alert(
      tt('about_app', 'Uygulama Hakkında'),
      [
        `${tt(
          'about_app_summary',
          'BarkodAnaliz; gıda, kozmetik ve ilaç barkodlarını hızlıca çözümleyip skor, içerik sinyalleri ve resmi kaynak bağlantılarını tek yerde sunar.'
        )}`,
        '',
        `${tt('app_version_short', 'Sürüm')}: ${APP_VERSION}`,
        'OpenFoodFacts • OpenBeautyFacts • TITCK • E-Code',
      ].join('\n')
    );
  }, [tt]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      tt('logout_title', 'Çıkış Yap'),
      tt('logout_confirm_msg', 'Hesabınızdan çıkış yapmak istediğinize emin misiniz?'),
      [
        { text: tt('cancel', 'İptal'), style: 'cancel' },
        {
          text: tt('logout', 'Çıkış Yap'),
          style: 'destructive',
          onPress: async () => {
            try {
              setLogoutLoading(true);
              await signOut(auth);
              await disableQaBypass();
            } catch (error) {
              console.error('Logout Error:', error);
              Alert.alert(
                tt('error_title', 'Hata'),
                tt('logout_error', 'Çıkış işlemi başarısız oldu.')
              );
            } finally {
              setLogoutLoading(false);
            }
          },
        },
      ]
    );
  }, [disableQaBypass, tt]);

  const handleOpenProfileSettings = useCallback(() => {
    navigation.navigate('ProfileSettings');
  }, [navigation]);

  const handleOpenNutritionPreferences = useCallback(() => {
    navigation.navigate('NutritionPreferences');
  }, [navigation]);

  const handleOpenFamilyHealthProfile = useCallback(() => {
    navigation.navigate('FamilyHealthProfile');
  }, [navigation]);

  const handleOpenPriceCompare = useCallback(() => {
    navigation.navigate('PriceCompare');
  }, [navigation]);

  const handleOpenMarketBulletins = useCallback(() => {
    navigation.navigate('MarketBulletins');
  }, [navigation]);

  const handleOpenLegalDocument = useCallback(
    (
      documentKey: 'terms' | 'privacy' | 'medical' | 'premium' | 'independence'
    ) => {
      navigation.navigate('LegalDocument', { documentKey });
    },
    [navigation]
  );

  const displayName = useMemo(() => {
    return buildUserDisplayName({
      profile,
      user,
      fallback: tt('default_user_name', 'Kullanıcı'),
    });
  }, [profile, tt, user]);

  const displayMeta = useMemo(() => {
    return buildUserMetaText({
      profile,
      user,
      fallback: tt('location_not_set', 'Konum bilgisi eklenmemiş'),
    });
  }, [profile, tt, user]);

  const avatarLetter = useMemo(() => {
    return buildAvatarLetter(displayName);
  }, [displayName]);

  const verifiedText = useMemo(() => {
    const emailVerified = profile?.emailVerified ?? user?.emailVerified;

    return emailVerified
      ? tt('email_verified', 'E-posta doğrulandı')
      : tt('email_not_verified', 'E-posta doğrulanmadı');
  }, [profile?.emailVerified, tt, user?.emailVerified]);

  const [verificationLoading, setVerificationLoading] = useState(false);

  const startupDiagnostics = operabilityDiagnostics?.bootstrap.data ?? null;
  const startupDiagnosticsError =
    operabilityDiagnostics?.bootstrap.error ?? operabilityError;

  const marketPricingDiagnostics =
    operabilityDiagnostics?.marketPricing.data ?? null;
  const marketPricingDiagnosticsError =
    operabilityDiagnostics?.marketPricing.error ?? operabilityError;

  const adDiagnostics = operabilityDiagnostics?.ad.data ?? null;
  const adDiagnosticsError =
    operabilityDiagnostics?.ad.error ?? operabilityError;

  const monetizationDiagnostics = operabilityDiagnostics?.monetization.data ?? null;
  const monetizationDiagnosticsError =
    operabilityDiagnostics?.monetization.error ?? operabilityError;

  const firebaseDiagnostics = operabilityDiagnostics?.remoteCache.data ?? null;
  const firebaseAccessDiagnostics =
    operabilityDiagnostics?.firebaseAccess.data ?? null;
  const firebaseServicesDiagnostics =
    operabilityDiagnostics?.firebaseServices.data ?? null;

  const firebaseDiagnosticsError =
    operabilityDiagnostics?.remoteCache.error ??
    operabilityDiagnostics?.firebaseAccess.error ??
    operabilityDiagnostics?.firebaseServices.error ??
    operabilityError;

  const startupFetchedAtText = useMemo(() => {
    return formatTimeValue(startupDiagnostics?.fetchedAt);
  }, [startupDiagnostics?.fetchedAt]);

  const adDiagnosticsFetchedAtText = useMemo(() => {
    return formatTimeValue(adDiagnostics?.fetchedAt);
  }, [adDiagnostics?.fetchedAt]);

  const marketPricingDiagnosticsFetchedAtText = useMemo(() => {
    return formatTimeValue(marketPricingDiagnostics?.fetchedAt);
  }, [marketPricingDiagnostics?.fetchedAt]);

  const monetizationDiagnosticsFetchedAtText = useMemo(() => {
    return formatTimeValue(monetizationDiagnostics?.fetchedAt);
  }, [monetizationDiagnostics?.fetchedAt]);

  const firebaseDiagnosticsFetchedAtText = useMemo(() => {
    return formatTimeValue(firebaseDiagnostics?.fetchedAt);
  }, [firebaseDiagnostics?.fetchedAt]);

  const languageOptions = useMemo(() => {
    return supportedLanguages.map((code) => ({
      code,
      label:
        code === 'tr'
          ? tt('language_option_tr', 'Türkçe')
          : code === 'en'
            ? tt('language_option_en', 'English')
            : code === 'de'
              ? tt('language_option_de', 'Deutsch')
              : tt('language_option_fr', 'Français'),
    }));
  }, [supportedLanguages, tt]);

  const selectedLanguageLabel = useMemo(() => {
    return (
      languageOptions.find((option) => option.code === locale)?.label ??
      locale.toUpperCase()
    );
  }, [languageOptions, locale]);

  const languagePickerItems = useMemo(() => {
    const query = languagePickerSearch.trim().toLocaleLowerCase('tr');

    return languageOptions
      .filter((option) => {
        if (!query) {
          return true;
        }

        return (
          option.label.toLocaleLowerCase('tr').includes(query) ||
          option.code.toLocaleLowerCase('tr').includes(query)
        );
      })
      .map((option) => option.label);
  }, [languageOptions, languagePickerSearch]);

  const handleLanguageSelect = useCallback(
    (label: string) => {
      const selectedLanguage = languageOptions.find((item) => item.label === label);

      setLanguagePickerVisible(false);

      if (!selectedLanguage) {
        return;
      }

      void (async () => {
        await changeLanguage(selectedLanguage.code);
        await syncEngagementNotifications({ force: true, reason: 'language_change' });
      })();
    },
    [changeLanguage, languageOptions]
  );

  const handleNotificationToggle = useCallback(
    (value: boolean) => {
      setNotificationsEnabled(value);
      setNotificationSyncing(true);

      void (async () => {
        try {
          if (value) {
            await syncEngagementNotifications({
              force: true,
              reason: 'notifications_enabled',
            });
          } else {
            await disableEngagementNotifications();
          }
        } catch (error) {
          console.error('[SettingsScreen] notification toggle failed:', error);
          Alert.alert(
            tt('error_title', 'Hata'),
            tt(
              'smart_notifications_error',
              'Bildirim tercihleri güncellenemedi. Lütfen tekrar deneyin.'
            )
          );
        } finally {
          setNotificationSyncing(false);
        }
      })();
    },
    [setNotificationsEnabled, tt]
  );

  const premiumTitle = monetization.entitlement?.isPremium
    ? tt('premium_active', 'Premium aktif')
    : tt('premium_title', 'BarkodAnaliz Premium');

  const premiumStatusLabel = monetization.entitlement?.isPremium
    ? tt('premium_badge_active', 'Aktif')
    : tt('premium_badge_available', 'Hazır');

  const nutritionPreferenceCount = useMemo(() => {
    return Object.values(nutritionPreferences).filter(Boolean).length;
  }, [nutritionPreferences]);

  const nutritionPreferencesBadge = nutritionPreferenceCount
    ? tt('nutrition_preferences_summary_count', `${nutritionPreferenceCount} aktif`).replace(
        '{{count}}',
        String(nutritionPreferenceCount)
      )
    : tt('nutrition_preferences_summary_none', 'Tercih seçilmedi');

  const acceptedLegalVersion = profile?.legalAcceptance?.versionLabel ?? null;
  const legalVersionMatches = acceptedLegalVersion === LEGAL_VERSION_LABEL;

  const legalStatusLabel = legalVersionMatches
    ? tt('legal_version_current_badge', 'Güncel')
    : tt('legal_version_update_badge', 'Güncelle');

  const handleRefreshLegalAcceptance = useCallback(() => {
    Alert.alert(
      tt('legal_reaccept_title', 'Güncel belge setini onayla'),
      tt(
        'legal_reaccept_message',
        'Güncel Şartlar, Gizlilik ve Tıbbi Uyarı setini incelediğinizi profile kaydedeceğiz. Devam etmek istiyor musunuz?'
      ),
      [
        { text: tt('cancel', 'İptal'), style: 'cancel' },
        {
          text: tt('confirm', 'Onayla'),
          onPress: () => {
            void (async () => {
              try {
                setLegalAcceptanceUpdating(true);
                await updateCurrentUserLegalAcceptance(
                  buildCurrentLegalAcceptance('manual_refresh')
                );
                await refreshProfile();
              } catch (error) {
                console.error('[SettingsScreen] legal acceptance refresh failed:', error);
                Alert.alert(
                  tt('error_title', 'Hata'),
                  tt(
                    'legal_reaccept_error',
                    'Hukuk belge onayı güncellenemedi. Lütfen tekrar deneyin.'
                  )
                );
              } finally {
                setLegalAcceptanceUpdating(false);
              }
            })();
          },
        },
      ]
    );
  }, [refreshProfile, tt]);

  const handleResendVerificationEmail = useCallback(async () => {
    if (!auth.currentUser) {
      return;
    }

    try {
      setVerificationLoading(true);
      await auth.currentUser.reload();

      if (auth.currentUser.emailVerified) {
        await refreshProfile();
        Alert.alert(
          tt('success_title', 'Başarılı'),
          tt(
            'email_verification_already_completed',
            'Bu hesabın e-postası zaten doğrulanmış görünüyor.'
          )
        );
        return;
      }

      const actionSettings = getEmailVerificationActionSettings();

      if (actionSettings) {
        await sendEmailVerification(auth.currentUser, actionSettings);
      } else {
        await sendEmailVerification(auth.currentUser);
      }

      Alert.alert(
        tt('success_title', 'Başarılı'),
        tt(
          'email_verification_resent',
          'Doğrulama e-postasını yeniden gönderdik. Spam klasörünü de kontrol edin.'
        )
      );
    } catch (error) {
      console.error('[SettingsScreen] resend verification failed:', error);
      Alert.alert(
        tt('error_title', 'Hata'),
        tt(
          'email_verification_resend_failed',
          'Doğrulama e-postası şu anda yeniden gönderilemedi.'
        )
      );
    } finally {
      setVerificationLoading(false);
    }
  }, [refreshProfile, tt]);

  const handleRefreshVerificationStatus = useCallback(async () => {
    if (!auth.currentUser) {
      return;
    }

    try {
      setVerificationLoading(true);
      await auth.currentUser.reload();
      await refreshProfile();

      Alert.alert(
        tt('success_title', 'Başarılı'),
        auth.currentUser.emailVerified
          ? tt(
              'email_verification_status_confirmed',
              'E-posta doğrulama durumu güncellendi. Hesabın doğrulanmış görünüyor.'
            )
          : tt(
              'email_verification_status_pending',
              'E-posta doğrulaması henüz tamamlanmamış görünüyor.'
            )
      );
    } catch (error) {
      console.error('[SettingsScreen] verification refresh failed:', error);
      Alert.alert(
        tt('error_title', 'Hata'),
        tt(
          'email_verification_status_refresh_failed',
          'E-posta doğrulama durumu şu anda yenilenemedi.'
        )
      );
    } finally {
      setVerificationLoading(false);
    }
  }, [refreshProfile, tt]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AmbientBackdrop colors={colors} variant="settings" />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: layout.contentBottomPadding }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View
          style={[
            styles.header,
            {
              paddingTop: layout.headerTopPadding,
              paddingHorizontal: layout.horizontalPadding,
            },
          ]}
        >
          <View
            style={[
              styles.accountHero,
              {
                backgroundColor: isDark ? '#447B22' : '#63AE2E',
                shadowColor: colors.shadow,
              },
            ]}
          >
            <View style={styles.accountHeroTopRow}>
              <View style={[styles.accountHeroAvatar, { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
                <Text style={styles.accountHeroAvatarText}>{avatarLetter}</Text>
              </View>

              <View style={styles.accountHeroTextWrap}>
                {authLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.accountHeroName} numberOfLines={2}>
                      {displayName}
                    </Text>
                    <Text style={styles.accountHeroMeta} numberOfLines={2}>
                      {displayMeta}
                    </Text>
                    <Text style={styles.accountHeroSubmeta} numberOfLines={1}>
                      {verifiedText}
                    </Text>
                  </>
                )}
              </View>

              <View style={styles.accountHeroBadgeWrap}>
                <Text style={styles.accountHeroBadgeEyebrow}>
                  {tt('membership_label', 'Üyelik')}
                </Text>
                <Text style={styles.accountHeroBadgeValue} numberOfLines={1}>
                  {premiumStatusLabel}
                </Text>
              </View>
            </View>

            <View style={styles.accountHeroStatsRow}>
              <View style={styles.accountHeroStat}>
                <Text style={styles.accountHeroStatLabel}>
                  {tt('language_label_short', 'Dil')}
                </Text>
                <Text style={styles.accountHeroStatValue}>{locale.toUpperCase()}</Text>
              </View>
              <View style={styles.accountHeroDivider} />
              <View style={styles.accountHeroStat}>
                <Text style={styles.accountHeroStatLabel}>
                  {tt('app_version_short', 'Sürüm')}
                </Text>
                <Text style={styles.accountHeroStatValue}>{APP_VERSION}</Text>
              </View>
            </View>
          </View>
        </View>

        {!(profile?.emailVerified ?? user?.emailVerified) ? (
          <View
            style={[
              styles.verificationActionsRow,
              { marginHorizontal: layout.horizontalPadding },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.verificationActionButton,
                {
                  backgroundColor: withAlpha(colors.primary, '12'),
                  borderColor: withAlpha(colors.primary, '30'),
                },
              ]}
              onPress={handleResendVerificationEmail}
              disabled={verificationLoading}
              activeOpacity={0.85}
            >
              {verificationLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="mail-unread-outline" size={16} color={colors.primary} />
                  <Text style={[styles.verificationActionText, { color: colors.primary }]}>
                    {tt(
                      'email_verification_resend_action',
                      'Doğrulama e-postasını yeniden gönder'
                    )}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.verificationActionButton,
                {
                  backgroundColor: withAlpha(colors.teal, '12'),
                  borderColor: withAlpha(colors.teal, '30'),
                },
              ]}
              onPress={handleRefreshVerificationStatus}
              disabled={verificationLoading}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh-outline" size={16} color={colors.teal} />
              <Text style={[styles.verificationActionText, { color: colors.teal }]}>
                {tt('email_verification_refresh_action', 'Durumu yenile')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <Text
          style={[
            styles.sectionTitle,
            { color: colors.text, marginHorizontal: layout.horizontalPadding },
          ]}
        >
          {tt('my_account', 'Hesabım')}
        </Text>

        <View
          style={[
            styles.menuCard,
            settingsMenuCardSurface,
          ]}
        >
          <SettingsItem
            icon="person-circle-outline"
            label={tt('profile_information', 'Profil Bilgileri')}
            value={displayName}
            onPress={handleOpenProfileSettings}
            colors={colors}
            grouped="first"
          />
          <SettingsItem
            icon="diamond-outline"
            label={premiumTitle}
            value={monetization.loading ? tt('loading', 'Yükleniyor') : premiumStatusLabel}
            onPress={handleOpenPaywall}
            colors={colors}
            grouped="middle"
          />
          <SettingsItem
            icon="people-outline"
            label={tt('family_health_profile', 'Aile ve Sağlık Profili')}
            value={tt('family_health_profile_badge', 'Aile odaklı')}
            onPress={handleOpenFamilyHealthProfile}
            colors={colors}
            grouped="middle"
          />
          <SettingsItem
            icon="leaf-outline"
            label={tt('nutrition_preferences', 'Beslenme Tercihleri')}
            value={nutritionPreferencesBadge}
            onPress={handleOpenNutritionPreferences}
            colors={colors}
            grouped="middle"
          />
          <SettingsItem
            icon="notifications-outline"
            label={tt('smart_notifications', 'Akıllı Bildirimler')}
            value={
              notificationSyncing
                ? tt('loading', 'Yükleniyor')
                : notificationsEnabled
                  ? tt('smart_notifications_enabled', 'Açık')
                  : tt('smart_notifications_disabled', 'Kapalı')
            }
            onPress={() => handleNotificationToggle(!notificationsEnabled)}
            colors={colors}
            grouped="middle"
          />
          <SettingsItem
            icon="language-outline"
            label={tt('language_options', 'Dil Seçenekleri')}
            value={languageReady ? selectedLanguageLabel : tt('loading', 'Yükleniyor')}
            onPress={() => {
              setLanguagePickerSearch('');
              setLanguagePickerVisible(true);
            }}
            colors={colors}
            grouped="last"
          />
        </View>

        {monetization.error ? (
          <Text
            style={[
              styles.monetizationErrorText,
              { marginHorizontal: layout.horizontalPadding },
            ]}
          >
            {monetization.error}
          </Text>
        ) : null}

        <Text
          style={[
            styles.sectionTitle,
            { color: colors.text, marginHorizontal: layout.horizontalPadding },
          ]}
        >
          {tt('application_section_title', 'Uygulama')}
        </Text>

        <View
          style={[
            styles.menuCard,
            settingsMenuCardSurface,
          ]}
        >
          <SettingsItem
            icon="color-palette-outline"
            label={tt('theme_change', 'Tema Değiştir')}
            value={isDark ? tt('dark_theme', 'Karanlık Tema') : tt('light_theme', 'Aydınlık Tema')}
            onPress={() => {
              if (toggleTheme) {
                toggleTheme();
              } else {
                setIsDark(!isDark);
              }
            }}
            colors={colors}
            grouped="first"
          />
          <SettingsItem
            icon="help-circle-outline"
            label={tt('help_center', 'Yardım Merkezi')}
            onPress={() => navigation.navigate('HelpCenter')}
            colors={colors}
            grouped="middle"
          />
          <SettingsItem
            icon="logo-google"
            label={tt('google_sign_in_info', 'Google ile Giriş')}
            subtitle={tt(
              'google_sign_in_info_subtitle',
              'Google oturumu, Firebase eşleşmesi ve giriş sınırları'
            )}
            onPress={() => navigation.navigate('HelpArticle', { articleKey: 'googleSignIn' })}
            colors={colors}
            grouped="middle"
          />
          <SettingsItem
            icon="megaphone-outline"
            label={tt('ads_and_premium_info', 'Reklamlar ve Premium')}
            subtitle={tt(
              'ads_and_premium_info_subtitle',
              'Banner, geçiş, ödüllü reklam ve premium modeli'
            )}
            onPress={() => navigation.navigate('HelpArticle', { articleKey: 'adsAndPremium' })}
            colors={colors}
            grouped="middle"
          />
          <SettingsItem
            icon="flask-outline"
            label={tt('ecode_catalog', 'Katkı Kataloğu')}
            value={tt('ecode_catalog_value', `${ALL_E_CODES.length} kayıt`)}
            onPress={() => navigation.navigate('ECodeCatalog')}
            colors={colors}
            grouped="middle"
          />
          <SettingsItem
            icon="library-outline"
            label={tt('methodology_sources', 'Metodoloji ve Kaynaklar')}
            onPress={() => navigation.navigate('MethodologySources')}
            colors={colors}
            grouped="middle"
          />
          <SettingsItem
            icon="pricetags-outline"
            label={tt('price_compare_title', 'Fiyat Karşılaştır')}
            value={tt('price_compare_short_value', 'Market bazında')}
            onPress={handleOpenPriceCompare}
            colors={colors}
            grouped="middle"
          />
          <SettingsItem
            icon="newspaper-outline"
            label={tt('market_bulletins_title', 'Aktüel Kataloglar')}
            value={tt('market_bulletins_short_value', 'Market kampanyaları')}
            onPress={handleOpenMarketBulletins}
            colors={colors}
            grouped="last"
          />
        </View>

        <Text
          style={[
            styles.sectionTitle,
            { color: colors.text, marginHorizontal: layout.horizontalPadding, marginTop: 10 },
          ]}
        >
          {tt('legal_and_trust', 'Yasal ve Güven')}
        </Text>

        <View
          style={[
            styles.menuCard,
            settingsMenuCardSurface,
          ]}
        >
          <SettingsItem
            icon="document-lock-outline"
            label={tt('legal_version_status_title', 'Belge Sürümü ve Onay')}
            value={legalStatusLabel}
            onPress={handleRefreshLegalAcceptance}
            colors={colors}
            grouped="first"
          />
          <SettingsItem
            icon="document-text-outline"
            label={tt('terms_and_conditions', 'Şartlar ve Koşullar')}
            onPress={() => handleOpenLegalDocument('terms')}
            colors={colors}
            grouped="middle"
          />
          <SettingsItem
            icon="shield-checkmark-outline"
            label={tt('privacy_policy', 'Gizlilik Politikası')}
            onPress={() => handleOpenLegalDocument('privacy')}
            colors={colors}
            grouped="middle"
          />
          <SettingsItem
            icon="medkit-outline"
            label={tt('medical_disclaimer', 'Tıbbi ve Bilgilendirme Uyarısı')}
            onPress={() => handleOpenLegalDocument('medical')}
            colors={colors}
            grouped="middle"
          />
          <SettingsItem
            icon="diamond-outline"
            label={tt('premium_terms', 'Premium Koşulları')}
            onPress={() => handleOpenLegalDocument('premium')}
            colors={colors}
            grouped="middle"
          />
          <SettingsItem
            icon="compass-outline"
            label={tt('independence_policy', 'Bağımsızlık Politikası')}
            onPress={() => handleOpenLegalDocument('independence')}
            colors={colors}
            grouped="last"
          />
        </View>

        {legalAcceptanceUpdating ? (
          <View
            style={[
              styles.premiumLoadingCard,
              {
                backgroundColor: withAlpha(colors.cardElevated, 'F1'),
                borderColor: withAlpha(colors.border, 'B8'),
                marginHorizontal: layout.horizontalPadding,
              },
            ]}
          >
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : null}

        <View
          style={[
            styles.menuCard,
            settingsMenuCardSurface,
          ]}
        >
          <SettingsItem
            icon="mail-outline"
            label={tt('contact_us', 'Bize Ulaşın')}
            colors={colors}
            onPress={() =>
              handleSafeOpenUrl(
                'mailto:destekerenesal@gmail.com',
                tt('contact_open_error', 'E-posta uygulaması açılamadı')
              )
            }
            grouped="single"
          />
        </View>

        <View
          style={[
            styles.menuCard,
            settingsMenuCardSurface,
          ]}
        >
          <SettingsItem
            icon="information-circle-outline"
            label={tt('about_app', 'Uygulama Hakkında')}
            subtitle={tt(
              'about_app_summary_short',
              'Sürüm, veri kaynakları ve uygulama özeti.'
            )}
            value={APP_VERSION}
            colors={colors}
            onPress={handleOpenAboutApp}
            grouped="single"
          />
        </View>

      {operabilityDiagnosticsEnabled ? (
        <>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.text, marginHorizontal: layout.horizontalPadding, marginTop: 10 },
            ]}
          >
            {tt('operability_diagnostics', 'Operability / Startup Tanılama')}
          </Text>

          <View
            style={[
              styles.diagnosticsCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                marginHorizontal: layout.horizontalPadding,
              },
            ]}
          >
            <View style={styles.diagnosticsHeader}>
              <View style={styles.diagnosticsHeaderLeft}>
                <View style={[styles.iconBox, { backgroundColor: `${colors.primary}15` }]}>
                  <Ionicons name="build-outline" size={20} color={colors.primary} />
                </View>

                <View style={styles.diagnosticsHeaderTextWrap}>
                  <Text style={[styles.diagnosticsTitle, { color: colors.text }]}>
                    {tt('startup_runtime_state', 'Bootstrap + runtime + auth')}
                  </Text>
                  <Text style={[styles.diagnosticsSubtitle, { color: colors.text }]}>
                    {tt('last_refresh', 'Son yenileme')}: {startupFetchedAtText}
                  </Text>
                </View>
              </View>

              <View style={styles.diagnosticsHeaderActions}>
                <TouchableOpacity
                  style={[
                    styles.diagnosticsRefreshButton,
                    (operabilityRefreshing || flowLogResetting) &&
                      styles.diagnosticsRefreshButtonDisabled,
                    {
                      borderColor: colors.border,
                      backgroundColor: '#D6454514',
                    },
                  ]}
                  onPress={handleResetMonetizationFlowLogs}
                  disabled={operabilityRefreshing || flowLogResetting}
                  activeOpacity={0.85}
                >
                  {flowLogResetting ? (
                    <ActivityIndicator size="small" color="#D64545" />
                  ) : (
                    <Ionicons name="trash-outline" size={18} color="#D64545" />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.diagnosticsRefreshButton,
                    (operabilityRefreshing || flowLogResetting) &&
                      styles.diagnosticsRefreshButtonDisabled,
                    {
                      borderColor: colors.border,
                      backgroundColor: `${colors.primary}10`,
                    },
                  ]}
                  onPress={() => {
                    void refreshOperabilityDiagnostics();
                  }}
                  disabled={operabilityRefreshing || flowLogResetting}
                  activeOpacity={0.85}
                >
                  {operabilityRefreshing ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="refresh" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {operabilityLoading ? (
              <View style={styles.diagnosticsLoadingWrap}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null}

            {startupDiagnosticsError ? (
              <Text style={styles.diagnosticsErrorText}>{startupDiagnosticsError}</Text>
            ) : null}

            {operabilityDiagnostics ? (
              <>
                <View style={styles.diagnosticsPillsRow}>
                  <View
                    style={[
                      styles.diagnosticsPill,
                      {
                        backgroundColor: operabilityDiagnostics.summary.bootstrapReady
                          ? `${colors.primary}14`
                          : '#FF444414',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.diagnosticsPillText,
                        {
                          color: operabilityDiagnostics.summary.bootstrapReady
                            ? colors.primary
                            : '#FF4444',
                        },
                      ]}
                    >
                      Bootstrap: {boolStateText(operabilityDiagnostics.summary.bootstrapReady)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.diagnosticsPill,
                      {
                        backgroundColor: operabilityDiagnostics.summary.runtimeReady
                          ? `${colors.primary}14`
                          : '#FF444414',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.diagnosticsPillText,
                        {
                          color: operabilityDiagnostics.summary.runtimeReady
                            ? colors.primary
                            : '#FF4444',
                        },
                      ]}
                    >
                      Runtime: {boolStateText(operabilityDiagnostics.summary.runtimeReady)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.diagnosticsPill,
                      {
                        backgroundColor: operabilityDiagnostics.summary.isAuthenticated
                          ? `${colors.primary}14`
                          : `${colors.border}55`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.diagnosticsPillText,
                        {
                          color: operabilityDiagnostics.summary.isAuthenticated
                            ? colors.primary
                            : colors.text,
                        },
                      ]}
                    >
                      Auth: {boolStateText(operabilityDiagnostics.summary.isAuthenticated)}
                    </Text>
                  </View>
                </View>

                <View style={styles.diagnosticsGrid}>
                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Local bootstrap
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {boolStateText(startupDiagnostics?.localBootstrapCompleted ?? false)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Database ready
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {boolStateText(startupDiagnostics?.databaseReady ?? false)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Queue lifecycle
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {boolStateText(startupDiagnostics?.queueLifecycleAttached ?? false)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      AdMob initialized
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {boolStateText(startupDiagnostics?.admobInitialized ?? false)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Firestore runtime resolved
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {boolStateText(startupDiagnostics?.firestoreRuntimeConfigResolved ?? false)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Shared cache flush
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {startupDiagnostics?.sharedCacheFlushCount ?? 0}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Analytics flush
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {startupDiagnostics?.analyticsFlushCount ?? 0}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Ad policy synced
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {boolStateText(startupDiagnostics?.adPolicySynced ?? false)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      market_gelsin runtime
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {boolStateText(
                        startupDiagnostics?.marketGelsinRuntimeResolved ?? false
                      )}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Auth UID
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {formatOptionalText(startupDiagnostics?.authUid)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Last bootstrap error
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {formatOptionalText(operabilityDiagnostics.summary.lastBootstrapError)}
                    </Text>
                  </View>
                </View>
              </>
            ) : null}
          </View>
        </>
      ) : null}

      {operabilityDiagnosticsEnabled ? (
        <>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.text, marginHorizontal: layout.horizontalPadding, marginTop: 10 },
            ]}
          >
            {tt('market_pricing_diagnostics', 'Market Fiyat Tanılama')}
          </Text>

          <View
            style={[
              styles.diagnosticsCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                marginHorizontal: layout.horizontalPadding,
              },
            ]}
          >
            <View style={styles.diagnosticsHeader}>
              <View style={styles.diagnosticsHeaderLeft}>
                <View style={[styles.iconBox, { backgroundColor: `${colors.primary}15` }]}>
                  <Ionicons name="server-outline" size={20} color={colors.primary} />
                </View>

                <View style={styles.diagnosticsHeaderTextWrap}>
                  <Text style={[styles.diagnosticsTitle, { color: colors.text }]}>
                    {tt('market_pricing_runtime_state', 'market_gelsin runtime + API')}
                  </Text>
                  <Text style={[styles.diagnosticsSubtitle, { color: colors.text }]}>
                    {tt('last_refresh', 'Son yenileme')}: {marketPricingDiagnosticsFetchedAtText}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.diagnosticsRefreshButton,
                  operabilityRefreshing && styles.diagnosticsRefreshButtonDisabled,
                  {
                    borderColor: colors.border,
                    backgroundColor: `${colors.primary}10`,
                  },
                ]}
                onPress={() => {
                  void refreshOperabilityDiagnostics();
                }}
                disabled={operabilityRefreshing}
                activeOpacity={0.85}
              >
                {operabilityRefreshing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="refresh" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            </View>

            {operabilityLoading ? (
              <View style={styles.diagnosticsLoadingWrap}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null}

            {marketPricingDiagnosticsError ? (
              <Text style={styles.diagnosticsErrorText}>
                {marketPricingDiagnosticsError}
              </Text>
            ) : null}

            {marketPricingDiagnostics ? (
              <>
                <View style={styles.diagnosticsPillsRow}>
                  <View
                    style={[
                      styles.diagnosticsPill,
                      {
                        backgroundColor: marketPricingDiagnostics.runtimeEnabled
                          ? `${colors.primary}14`
                          : '#FF444414',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.diagnosticsPillText,
                        {
                          color: marketPricingDiagnostics.runtimeEnabled
                            ? colors.primary
                            : '#FF4444',
                        },
                      ]}
                    >
                      Runtime: {boolStateText(marketPricingDiagnostics.runtimeEnabled)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.diagnosticsPill,
                      {
                        backgroundColor: marketPricingDiagnostics.apiReachable
                          ? `${colors.primary}14`
                          : `${colors.border}55`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.diagnosticsPillText,
                        {
                          color: marketPricingDiagnostics.apiReachable
                            ? colors.primary
                            : colors.text,
                        },
                      ]}
                    >
                      API: {boolStateText(marketPricingDiagnostics.apiReachable)}
                    </Text>
                  </View>
                </View>

                <View style={styles.diagnosticsGrid}>
                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Runtime source
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {marketPricingDiagnostics.runtimeSource}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Runtime version
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {marketPricingDiagnostics.runtimeVersion}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Base URL
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {formatOptionalText(marketPricingDiagnostics.baseUrl)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Timeout
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {marketPricingDiagnostics.timeoutMs} ms
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Disable reason
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {formatOptionalText(marketPricingDiagnostics.disableReason)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Active markets
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {formatOptionalText(marketPricingDiagnostics.activeMarkets)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Live adapters
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {formatOptionalText(marketPricingDiagnostics.liveAdapters)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      SQLite / Postgres / Firebase
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {[
                        boolStateText(marketPricingDiagnostics.sqliteEnabled),
                        boolStateText(marketPricingDiagnostics.postgresEnabled),
                        boolStateText(marketPricingDiagnostics.firebaseEnabled),
                      ].join(' / ')}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Runtime fetched at
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {formatOptionalText(marketPricingDiagnostics.runtimeFetchedAt)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Status error
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {formatOptionalText(marketPricingDiagnostics.statusError)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Integrations error
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {formatOptionalText(marketPricingDiagnostics.integrationsError)}
                    </Text>
                  </View>
                </View>
              </>
            ) : null}
          </View>
        </>
      ) : null}

      {adDiagnosticsEnabled ? (
        <>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.text, marginHorizontal: layout.horizontalPadding, marginTop: 10 },
            ]}
          >
            {tt('ad_diagnostics', 'Reklam Tanılama')}
          </Text>

          <View
            style={[
              styles.diagnosticsCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                marginHorizontal: layout.horizontalPadding,
              },
            ]}
          >
            <View style={styles.diagnosticsHeader}>
              <View style={styles.diagnosticsHeaderLeft}>
                <View style={[styles.iconBox, { backgroundColor: `${colors.primary}15` }]}>
                  <Ionicons name="analytics-outline" size={20} color={colors.primary} />
                </View>

                <View style={styles.diagnosticsHeaderTextWrap}>
                  <Text style={[styles.diagnosticsTitle, { color: colors.text }]}>
                    {tt('ad_runtime_state', 'Remote policy + analytics')}
                  </Text>
                  <Text style={[styles.diagnosticsSubtitle, { color: colors.text }]}>
                    {tt('last_refresh', 'Son yenileme')}: {adDiagnosticsFetchedAtText}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.diagnosticsRefreshButton,
                  operabilityRefreshing && styles.diagnosticsRefreshButtonDisabled,
                  {
                    borderColor: colors.border,
                    backgroundColor: `${colors.primary}10`,
                  },
                ]}
                onPress={() => {
                  void refreshOperabilityDiagnostics();
                }}
                disabled={operabilityRefreshing}
                activeOpacity={0.85}
              >
                {operabilityRefreshing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="refresh" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            </View>

            {operabilityLoading ? (
              <View style={styles.diagnosticsLoadingWrap}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null}

            {adDiagnosticsError ? (
              <Text style={styles.diagnosticsErrorText}>{adDiagnosticsError}</Text>
            ) : null}

            {adDiagnostics ? (
              <>
                <View style={styles.diagnosticsPillsRow}>
                  <View
                    style={[
                      styles.diagnosticsPill,
                      { backgroundColor: adDiagnostics.policy.enabled ? `${colors.primary}14` : '#FF444414' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.diagnosticsPillText,
                        { color: adDiagnostics.policy.enabled ? colors.primary : '#FF4444' },
                      ]}
                    >
                      {adDiagnostics.policy.enabled
                        ? tt('ads_enabled', 'Ads ON')
                        : tt('ads_disabled', 'Ads OFF')}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.diagnosticsPill,
                      {
                        backgroundColor: adDiagnostics.policy.interstitialEnabled
                          ? `${colors.primary}14`
                          : `${colors.border}55`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.diagnosticsPillText,
                        {
                          color: adDiagnostics.policy.interstitialEnabled
                            ? colors.primary
                            : colors.text,
                        },
                      ]}
                    >
                      {tt('interstitial', 'Interstitial')}: {boolStateText(adDiagnostics.policy.interstitialEnabled)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.diagnosticsPill,
                      {
                        backgroundColor: adDiagnostics.policy.bannerEnabled
                          ? `${colors.primary}14`
                          : `${colors.border}55`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.diagnosticsPillText,
                        {
                          color: adDiagnostics.policy.bannerEnabled
                            ? colors.primary
                            : colors.text,
                        },
                      ]}
                    >
                      {tt('banner', 'Banner')}: {boolStateText(adDiagnostics.policy.bannerEnabled)}
                    </Text>
                  </View>
                </View>

                <View style={styles.diagnosticsGrid}>
                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      {tt('policy_source', 'Policy source')}
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {adDiagnostics.policy.source}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      {tt('policy_version', 'Policy version')}
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      v{adDiagnostics.policy.version}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      {tt('warmup_successful_scans', 'Warmup')}
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {adDiagnostics.policy.warmupSuccessfulScans}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      {tt('interstitial_cadence', 'Cadence')}
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {adDiagnostics.policy.scansBetweenInterstitials}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      {tt('interstitial_cooldown', 'Cooldown')}
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {formatDuration(adDiagnostics.policy.minInterstitialCooldownMs)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      {tt('daily_interstitial_cap', 'Günlük cap')}
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {adDiagnostics.policy.maxDailyInterstitials}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      {tt('successful_scan_count', 'Başarılı tarama')}
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {adDiagnostics.stats.successfulScanCount}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      {tt('daily_interstitial_count', 'Bugünkü interstitial')}
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {adDiagnostics.stats.dailyInterstitialCount}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      {tt('analytics_queue_size', 'Analytics queue')}
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {adDiagnostics.analyticsQueueSize}
                    </Text>
                  </View>
                </View>
              </>
            ) : null}
          </View>
        </>
      ) : null}

      {monetizationDiagnosticsEnabled ? (
        <>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.text, marginHorizontal: layout.horizontalPadding, marginTop: 10 },
            ]}
          >
            {tt('monetization_diagnostics', 'Premium / Monetization Tanılama')}
          </Text>

          <View
            style={[
              styles.diagnosticsCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                marginHorizontal: layout.horizontalPadding,
              },
            ]}
          >
            <View style={styles.diagnosticsHeader}>
              <View style={styles.diagnosticsHeaderLeft}>
                <View style={[styles.iconBox, { backgroundColor: `${colors.primary}15` }]}>
                  <Ionicons name="diamond-outline" size={20} color={colors.primary} />
                </View>

                <View style={styles.diagnosticsHeaderTextWrap}>
                  <Text style={[styles.diagnosticsTitle, { color: colors.text }]}>
                    {tt('monetization_runtime_state', 'Policy + entitlement + free scan')}
                  </Text>
                  <Text style={[styles.diagnosticsSubtitle, { color: colors.text }]}>
                    {tt('last_refresh', 'Son yenileme')}: {monetizationDiagnosticsFetchedAtText}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.diagnosticsRefreshButton,
                  operabilityRefreshing && styles.diagnosticsRefreshButtonDisabled,
                  {
                    borderColor: colors.border,
                    backgroundColor: `${colors.primary}10`,
                  },
                ]}
                onPress={() => {
                  void refreshOperabilityDiagnostics();
                }}
                disabled={operabilityRefreshing}
                activeOpacity={0.85}
              >
                {operabilityRefreshing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="refresh" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            </View>

            {operabilityLoading ? (
              <View style={styles.diagnosticsLoadingWrap}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null}

            {monetizationDiagnosticsError ? (
              <Text style={styles.diagnosticsErrorText}>{monetizationDiagnosticsError}</Text>
            ) : null}

            {monetizationDiagnostics ? (
              <>
                <View style={styles.diagnosticsPillsRow}>
                  <View
                    style={[
                      styles.diagnosticsPill,
                      {
                        backgroundColor: monetizationDiagnostics.isPremium
                          ? `${colors.primary}14`
                          : `${colors.border}55`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.diagnosticsPillText,
                        {
                          color: monetizationDiagnostics.isPremium
                            ? colors.primary
                            : colors.text,
                        },
                      ]}
                    >
                      Plan: {monetizationDiagnostics.entitlementPlan.toUpperCase()}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.diagnosticsPill,
                      {
                        backgroundColor: monetizationDiagnostics.providerDiagnostics.isConfigured
                          ? `${colors.primary}14`
                          : `${colors.border}55`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.diagnosticsPillText,
                        {
                          color: monetizationDiagnostics.providerDiagnostics.isConfigured
                            ? colors.primary
                            : colors.text,
                        },
                      ]}
                    >
                      Provider: {monetizationDiagnostics.providerDiagnostics.providerName}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.diagnosticsPill,
                      {
                        backgroundColor: monetizationDiagnostics.providerDiagnostics.supportsNativePurchases
                          ? `${colors.primary}14`
                          : `${colors.border}55`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.diagnosticsPillText,
                        {
                          color: monetizationDiagnostics.providerDiagnostics.supportsNativePurchases
                            ? colors.primary
                            : colors.text,
                        },
                      ]}
                    >
                      Native IAP: {boolStateText(monetizationDiagnostics.providerDiagnostics.supportsNativePurchases)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.diagnosticsPill,
                      {
                        backgroundColor: monetizationDiagnostics.readiness.storeSmokeTestReady
                          ? `${colors.primary}14`
                          : '#C25B0016',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.diagnosticsPillText,
                        {
                          color: monetizationDiagnostics.readiness.storeSmokeTestReady
                            ? colors.primary
                            : '#C25B00',
                        },
                      ]}
                    >
                      Smoke: {monetizationDiagnostics.readiness.storeSmokeTestReady ? 'READY' : 'BLOCKED'}
                    </Text>
                  </View>
                </View>

                <View style={styles.diagnosticsGrid}>
                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Smoke readiness
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {monetizationDiagnostics.readiness.summary}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Store smoke ready / blockers
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {boolStateText(monetizationDiagnostics.readiness.storeSmokeTestReady)} /{' '}
                      {monetizationDiagnostics.readiness.blockerCount}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Policy source / version
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {monetizationDiagnostics.policySource} / v{monetizationDiagnostics.policyVersion}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Annual price
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {formatTryPrice(monetizationDiagnostics.annualPriceTry)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Annual product id
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {formatOptionalText(monetizationDiagnostics.annualProductId)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Purchase provider enabled
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {boolStateText(monetizationDiagnostics.purchaseProviderEnabled)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Provider configured
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {boolStateText(monetizationDiagnostics.providerDiagnostics.isConfigured)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Provider runtime ready
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {boolStateText(monetizationDiagnostics.providerDiagnostics.runtimeReady)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      SDK module present
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {boolStateText(monetizationDiagnostics.providerDiagnostics.sdkModulePresent)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Provider runtime source
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {monetizationDiagnostics.providerDiagnostics.runtimeSource}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Platform / Expo Go
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {monetizationDiagnostics.providerDiagnostics.platform} / {boolStateText(monetizationDiagnostics.providerDiagnostics.isExpoGo)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Active API key present
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {boolStateText(monetizationDiagnostics.providerDiagnostics.activePlatformApiKeyPresent)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Auth UID / configured user
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {formatOptionalText(monetizationDiagnostics.providerDiagnostics.authUid)} /{' '}
                      {formatOptionalText(monetizationDiagnostics.providerDiagnostics.configuredAppUserId)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Identity mode / synced
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {monetizationDiagnostics.providerDiagnostics.identityMode} /{' '}
                      {boolStateText(monetizationDiagnostics.providerDiagnostics.identitySynced)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Identity mismatch
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {boolStateText(monetizationDiagnostics.providerDiagnostics.identityMismatch)}
                    </Text>
                  </View>

                  {monetizationDiagnostics.providerDiagnostics.identityMismatchReason ? (
                    <View style={styles.diagnosticsRow}>
                      <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                        Identity mismatch reason
                      </Text>
                      <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                        {monetizationDiagnostics.providerDiagnostics.identityMismatchReason}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Entitlement / offering
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {monetizationDiagnostics.providerDiagnostics.entitlementIdentifier} / {monetizationDiagnostics.providerDiagnostics.offeringIdentifier}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Offerings smoke check
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {boolStateText(monetizationDiagnostics.providerDiagnostics.smokeCheckSuccess)} /{' '}
                      {monetizationDiagnostics.providerDiagnostics.smokeCheckSummary}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Smoke offering/package
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {formatOptionalText(
                        monetizationDiagnostics.providerDiagnostics.smokeCheckResolvedOfferingId
                      )}{' '}
                      /{' '}
                      {formatOptionalText(
                        monetizationDiagnostics.providerDiagnostics.smokeCheckResolvedPackageId
                      )}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Smoke product / annual match
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {formatOptionalText(
                        monetizationDiagnostics.providerDiagnostics.smokeCheckResolvedProductId
                      )}{' '}
                      /{' '}
                      {boolStateText(
                        monetizationDiagnostics.providerDiagnostics.smokeCheckMatchedAnnualProductId
                      )}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Smoke package count
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {monetizationDiagnostics.providerDiagnostics.smokeCheckAvailablePackagesCount}
                    </Text>
                  </View>

                  {monetizationDiagnostics.providerDiagnostics.smokeCheckError ? (
                    <View style={styles.diagnosticsRow}>
                      <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                        Smoke check error
                      </Text>
                      <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                        {monetizationDiagnostics.providerDiagnostics.smokeCheckError}
                      </Text>
                    </View>
                  ) : null}

                  {monetizationDiagnostics.readiness.blockers.length ? (
                    <View style={[styles.diagnosticsRow, styles.diagnosticsRowTopAligned]}>
                      <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                        Readiness blockers
                      </Text>
                      <Text
                        style={[
                          styles.diagnosticsValue,
                          styles.diagnosticsValueMultiline,
                          { color: colors.text },
                        ]}
                      >
                        {formatDiagnosticsList(monetizationDiagnostics.readiness.blockers)}
                      </Text>
                    </View>
                  ) : null}

                  {monetizationDiagnostics.readiness.recommendedActions.length ? (
                    <View style={[styles.diagnosticsRow, styles.diagnosticsRowTopAligned]}>
                      <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                        Next actions
                      </Text>
                      <Text
                        style={[
                          styles.diagnosticsValue,
                          styles.diagnosticsValueMultiline,
                          { color: colors.text },
                        ]}
                      >
                        {formatDiagnosticsList(
                          monetizationDiagnostics.readiness.recommendedActions
                        )}
                      </Text>
                    </View>
                  ) : null}

                  <View style={[styles.diagnosticsRow, styles.diagnosticsRowTopAligned]}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Smoke test checklist
                    </Text>
                    <Text
                      style={[
                        styles.diagnosticsValue,
                        styles.diagnosticsValueMultiline,
                        { color: colors.text },
                      ]}
                    >
                      {formatSmokeTestChecklist(
                        monetizationDiagnostics.readiness.smokeTestChecklist
                      )}
                    </Text>
                  </View>

                  <View style={[styles.diagnosticsRow, styles.diagnosticsRowTopAligned]}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Smoke test scenarios
                    </Text>
                    <Text
                      style={[
                        styles.diagnosticsValue,
                        styles.diagnosticsValueMultiline,
                        { color: colors.text },
                      ]}
                    >
                      {formatNumberedDiagnosticsList(
                        monetizationDiagnostics.readiness.smokeTestScenarios
                      )}
                    </Text>
                  </View>

                  <View style={[styles.diagnosticsRow, styles.diagnosticsRowTopAligned]}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Recent purchase / restore logs
                    </Text>
                    <Text
                      style={[
                        styles.diagnosticsValue,
                        styles.diagnosticsValueMultiline,
                        { color: colors.text },
                      ]}
                    >
                      {formatRecentMonetizationFlowLogs(
                        monetizationDiagnostics.recentFlowLogs
                      )}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Free daily scan limit
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {monetizationDiagnostics.freeDailyScanLimit}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Used / remaining
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {monetizationDiagnostics.freeScanUsedCount} /{' '}
                      {monetizationDiagnostics.freeScanRemainingCount ?? '-'}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Activated at
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {formatDateTimeValue(monetizationDiagnostics.activatedAt)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Expires at
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {formatDateTimeValue(monetizationDiagnostics.expiresAt)}
                    </Text>
                  </View>

                  {monetizationDiagnostics.providerDiagnostics.missingKeys.length ? (
                    <View style={styles.diagnosticsRow}>
                      <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                        Missing keys
                      </Text>
                      <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                        {monetizationDiagnostics.providerDiagnostics.missingKeys.join(', ')}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </>
            ) : null}
          </View>
        </>
      ) : null}

      {firebaseDiagnosticsEnabled ? (
        <>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.text, marginHorizontal: layout.horizontalPadding, marginTop: 10 },
            ]}
          >
            {tt('firebase_shared_cache_diagnostics', 'Firebase / Shared Cache Tanılama')}
          </Text>

          <View
            style={[
              styles.diagnosticsCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                marginHorizontal: layout.horizontalPadding,
              },
            ]}
          >
            <View style={styles.diagnosticsHeader}>
              <View style={styles.diagnosticsHeaderLeft}>
                <View style={[styles.iconBox, { backgroundColor: `${colors.primary}15` }]}>
                  <Ionicons name="server-outline" size={20} color={colors.primary} />
                </View>

                <View style={styles.diagnosticsHeaderTextWrap}>
                  <Text style={[styles.diagnosticsTitle, { color: colors.text }]}>
                    {tt('firebase_shared_cache_runtime', 'Runtime + queue state')}
                  </Text>
                  <Text style={[styles.diagnosticsSubtitle, { color: colors.text }]}>
                    {tt('last_refresh', 'Son yenileme')}: {firebaseDiagnosticsFetchedAtText}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.diagnosticsRefreshButton,
                  operabilityRefreshing && styles.diagnosticsRefreshButtonDisabled,
                  {
                    borderColor: colors.border,
                    backgroundColor: `${colors.primary}10`,
                  },
                ]}
                onPress={() => {
                  void refreshOperabilityDiagnostics();
                }}
                disabled={operabilityRefreshing}
                activeOpacity={0.85}
              >
                {operabilityRefreshing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="refresh" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            </View>

            {operabilityLoading ? (
              <View style={styles.diagnosticsLoadingWrap}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null}

            {firebaseDiagnosticsError ? (
              <Text style={styles.diagnosticsErrorText}>{firebaseDiagnosticsError}</Text>
            ) : null}

            {firebaseDiagnostics ? (
              <>
                <View style={styles.diagnosticsPillsRow}>
                  <View
                    style={[
                      styles.diagnosticsPill,
                      {
                        backgroundColor: firebaseDiagnostics.runtimeReady
                          ? `${colors.primary}14`
                          : '#FF444414',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.diagnosticsPillText,
                        {
                          color: firebaseDiagnostics.runtimeReady
                            ? colors.primary
                            : '#FF4444',
                        },
                      ]}
                    >
                      Runtime: {boolStateText(firebaseDiagnostics.runtimeReady)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.diagnosticsPill,
                      {
                        backgroundColor: firebaseDiagnostics.sharedCacheWriteAllowed
                          ? `${colors.primary}14`
                          : `${colors.border}55`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.diagnosticsPillText,
                        {
                          color: firebaseDiagnostics.sharedCacheWriteAllowed
                            ? colors.primary
                            : colors.text,
                        },
                      ]}
                    >
                      Shared write: {boolStateText(firebaseDiagnostics.sharedCacheWriteAllowed)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.diagnosticsPill,
                      {
                        backgroundColor:
                          firebaseDiagnostics.queueSize > 0
                            ? `${colors.border}55`
                            : `${colors.primary}14`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.diagnosticsPillText,
                        {
                          color:
                            firebaseDiagnostics.queueSize > 0
                              ? colors.text
                              : colors.primary,
                        },
                      ]}
                    >
                      Queue: {firebaseDiagnostics.queueSize}
                    </Text>
                  </View>
                </View>

                <View style={styles.diagnosticsGrid}>
                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Project
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {formatOptionalText(
                        firebaseServicesDiagnostics?.projectId ?? firebaseDiagnostics.projectId
                      )}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Runtime source
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {firebaseDiagnostics.runtimeSource}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Effective runtime source
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {formatOptionalText(firebaseAccessDiagnostics?.runtimeEffectiveSource)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Authenticated user
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {boolStateText(firebaseAccessDiagnostics?.isAuthenticated ?? false)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Read feature
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {boolStateText(firebaseDiagnostics.readFeatureEnabled)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Write feature
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {boolStateText(firebaseDiagnostics.writeFeatureEnabled)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Shared cache read allowed
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {boolStateText(firebaseDiagnostics.sharedCacheReadAllowed)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Shared cache write allowed
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {boolStateText(firebaseDiagnostics.sharedCacheWriteAllowed)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Analytics write allowed
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {boolStateText(firebaseAccessDiagnostics?.analyticsWriteAllowed ?? false)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Ad policy read allowed
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {boolStateText(firebaseAccessDiagnostics?.adPolicyReadAllowed ?? false)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Read validation
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {boolStateText(firebaseDiagnostics.readValidationEnabled)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Write validation
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {boolStateText(firebaseDiagnostics.writeValidationEnabled)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Rollout source / version
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {firebaseDiagnostics.rolloutSource} / v{firebaseDiagnostics.rolloutVersion}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Queue ready / blocked
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {firebaseDiagnostics.readyQueueSize} / {firebaseDiagnostics.blockedQueueSize}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Lifecycle attached
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {boolStateText(firebaseDiagnostics.lifecycleAttached)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Last flush
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {formatTimeValue(firebaseDiagnostics.lastFlushAt)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Last flush reason
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {formatOptionalText(firebaseDiagnostics.lastFlushReason)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Consecutive failures
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {firebaseDiagnostics.consecutiveFailureCount}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Last read failure
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {formatOptionalText(firebaseDiagnostics.lastReadFailure)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Last write failure
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {formatOptionalText(firebaseDiagnostics.lastWriteFailure)}
                    </Text>
                  </View>

                  <View style={styles.diagnosticsRow}>
                    <Text style={[styles.diagnosticsLabel, { color: colors.text }]}>
                      Queue flush error
                    </Text>
                    <Text style={[styles.diagnosticsValue, { color: colors.text }]}>
                      {formatOptionalText(firebaseDiagnostics.lastFlushError)}
                    </Text>
                  </View>
                </View>
              </>
            ) : null}
          </View>
        </>
      ) : null}

      <TouchableOpacity
        style={[styles.logoutBtn, logoutLoading && styles.logoutBtnDisabled]}
        onPress={handleLogout}
        disabled={logoutLoading}
      >
        {logoutLoading ? (
          <ActivityIndicator size="small" color="#FF4444" />
        ) : (
          <Ionicons name="log-out-outline" size={22} color="#FF4444" />
        )}
        <Text style={styles.logoutText}>{tt('logout', 'Çıkış Yap')}</Text>
      </TouchableOpacity>

      <View
        style={[
          styles.footer,
          { paddingHorizontal: layout.horizontalPadding },
        ]}
      >
        <Image source={SETTINGS_FOOTER_FAVICON} style={styles.footerLogo} resizeMode="contain" />
        <Text style={[styles.footerText, { color: colors.text }]}>
          ErEnesAl® {APP_VERSION}
        </Text>
        <Text style={[styles.footerSub, { color: colors.text }]}>
          {tt('footer_slogan', 'Sağlık için akıllı seçimler')}
        </Text>
      </View>
      </ScrollView>

      <SearchableSelectSheet
        visible={languagePickerVisible}
        title={tt('language_picker_title', 'Dil seçin')}
        searchPlaceholder={tt('language_picker_search', 'Dil ara')}
        searchValue={languagePickerSearch}
        onSearchChange={setLanguagePickerSearch}
        items={languagePickerItems}
        selectedValue={selectedLanguageLabel}
        emptyText={tt('language_picker_empty', 'Aramanıza uygun dil bulunamadı.')}
        onSelect={handleLanguageSelect}
        onClose={() => setLanguagePickerVisible(false)}
        colors={colors}
        isDark={isDark}
      />

      <ScreenOnboardingOverlay
        visible={showOnboarding}
        icon="settings-outline"
        title={tt('profile_onboarding_title', 'Profil ve ayarlar burada')}
        body={tt(
          'profile_onboarding_body',
          'Aile profili, beslenme tercihleri, yardım merkezi ve güven ayarlarını buradan yönetirsin.'
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
  container: { flex: 1 },
  header: {
    marginBottom: 20,
  },
  settingsHero: {
    borderWidth: 1,
    borderRadius: 30,
    padding: 20,
    shadowOpacity: 0.16,
    shadowRadius: 28,
    shadowOffset: {
      width: 0,
      height: 18,
    },
  },
  settingsHeroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingsHeroTextWrap: {
    flex: 1,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  headerStatusChip: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  headerStatusChipText: {
    fontSize: 12,
    fontWeight: '900',
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  heroMetaPill: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroMetaPillText: {
    fontSize: 12,
    fontWeight: '900',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 1,
  },
  headerSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.65,
  },
  accountHero: {
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 22,
    paddingBottom: 20,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 6,
    },
  },
  accountHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  accountHeroAvatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  accountHeroAvatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  accountHeroTextWrap: {
    flex: 1,
    paddingRight: 10,
  },
  accountHeroName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 24,
  },
  accountHeroMeta: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.84)',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  accountHeroSubmeta: {
    marginTop: 5,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '700',
  },
  accountHeroBadgeWrap: {
    alignItems: 'flex-end',
    minWidth: 72,
  },
  accountHeroBadgeEyebrow: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  accountHeroBadgeValue: {
    marginTop: 6,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  accountHeroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.18)',
  },
  accountHeroStat: {
    flex: 1,
  },
  accountHeroStatLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  accountHeroStatValue: {
    marginTop: 5,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  accountHeroDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginHorizontal: 14,
  },
  profileCard: {
    padding: 20,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 22,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: 14,
    },
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#000',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 15,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  userMeta: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
    lineHeight: 18,
  },
  profileErrorText: {
    marginTop: 8,
    color: '#FF4444',
    fontSize: 12,
    fontWeight: '600',
  },
  verificationActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    marginBottom: 22,
  },
  verificationActionButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  verificationActionText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
    marginBottom: 7,
    marginTop: 2,
  },
  menuCard: {
    borderWidth: 1,
    borderRadius: 20,
    marginBottom: 12,
    overflow: 'hidden',
  },
  premiumLoadingCard: {
    minHeight: 116,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: {
      width: 0,
      height: 14,
    },
  },
  premiumHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  premiumIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumHeaderTextWrap: {
    flex: 1,
  },
  premiumTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  premiumSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.72,
  },
  premiumStatusBadge: {
    minHeight: 32,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumStatusText: {
    fontSize: 12,
    fontWeight: '900',
  },
  premiumFeatureRow: {
    marginTop: 14,
    gap: 10,
  },
  premiumFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  premiumFeatureText: {
    fontSize: 13,
    fontWeight: '700',
  },
  premiumFooter: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  premiumMetaText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    opacity: 0.72,
  },
  premiumCtaButton: {
    minHeight: 40,
    borderRadius: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumCtaText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '900',
  },
  monetizationErrorText: {
    marginTop: 10,
    color: '#FF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  actionCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 10,
    },
  },
  actionCardTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  actionCardTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  actionCardSubtitle: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
  },
  actionCardRight: {
    marginLeft: 'auto',
    alignItems: 'flex-end',
    gap: 8,
    flexShrink: 0,
  },
  actionCardBadge: {
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 112,
  },
  actionCardBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  profileEditorCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 22,
  },
  profileEditorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  profileEditorHeaderTextWrap: {
    flex: 1,
  },
  profileEditorTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  profileEditorSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.68,
  },
  profileEditIconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readonlyProfileList: {
    marginTop: 16,
    gap: 12,
  },
  readonlyProfileRow: {
    gap: 4,
  },
  readonlyProfileLabel: {
    fontSize: 12,
    fontWeight: '800',
    opacity: 0.62,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  readonlyProfileValue: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  profileFieldRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  profileFieldHalf: {
    flex: 1,
  },
  profileFieldGroup: {
    marginTop: 16,
  },
  profileFieldHelper: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  profileFieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  profileInput: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    minHeight: 52,
  },
  profileInputMultiline: {
    minHeight: 92,
  },
  profileSuggestionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  profileSuggestionChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  profileSuggestionChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  profileSaveErrorText: {
    marginTop: 12,
    color: '#FF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  profileActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  secondaryProfileButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  secondaryProfileButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  primaryProfileButton: {
    flex: 1.2,
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  primaryProfileButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  legalMetaCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
    marginBottom: 18,
  },
  legalMetaText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    paddingRight: 10,
    flex: 1,
  },
  itemGlyphWrap: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  itemTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  itemLabel: {
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '700',
    flexShrink: 1,
  },
  itemSubtitle: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 6,
  },
  itemValue: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
    maxWidth: 128,
    textAlign: 'right',
  },
  itemBadge: {
    minHeight: 26,
    borderRadius: 999,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  aboutCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  aboutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aboutHeaderTextWrap: {
    flex: 1,
  },
  aboutTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  aboutVersion: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '800',
  },
  aboutText: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  aboutBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    marginBottom: 4,
  },
  aboutBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  aboutBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  aboutDetailLine: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  languageBox: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 10,
    marginHorizontal: 25,
  },
  langOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    gap: 8,
  },
  langBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    alignItems: 'center',
  },
  langText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  diagnosticsCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 8,
  },
  diagnosticsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  diagnosticsHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  diagnosticsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  diagnosticsHeaderTextWrap: {
    flex: 1,
  },
  diagnosticsTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  diagnosticsSubtitle: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.62,
  },
  diagnosticsRefreshButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diagnosticsRefreshButtonDisabled: {
    opacity: 0.7,
  },
  diagnosticsLoadingWrap: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diagnosticsPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
    marginBottom: 14,
  },
  diagnosticsPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  diagnosticsPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  diagnosticsGrid: {
    gap: 10,
  },
  diagnosticsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  diagnosticsRowTopAligned: {
    alignItems: 'flex-start',
  },
  diagnosticsLabel: {
    flex: 1,
    fontSize: 13,
    opacity: 0.72,
  },
  diagnosticsValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  diagnosticsValueMultiline: {
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'left',
  },
  diagnosticsErrorText: {
    marginTop: 14,
    color: '#FF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    padding: 20,
    borderRadius: 18,
  },
  logoutBtnDisabled: {
    opacity: 0.7,
  },
  logoutText: {
    color: '#FF4444',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
    opacity: 0.3,
  },
  footerLogo: {
    width: 88,
    height: 46,
    marginBottom: 10,
  },
  footerText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  footerSub: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
});

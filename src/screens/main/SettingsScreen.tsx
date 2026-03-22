import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Switch,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { auth, db } from '../../config/firebase';
import { FEATURES } from '../../config/features';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { AdBanner } from '../../components/AdBanner';
import { useAppScreenLayout } from '../../components/layout/useAppScreenLayout';
import { useOperabilityDiagnostics } from '../../hooks/useOperabilityDiagnostics';

const APP_VERSION = 'v1.0.4';

type UserProfile = {
  firstName?: string;
  lastName?: string;
  city?: string;
  district?: string;
  phone?: string;
  address?: string;
};

type ThemeColors = {
  background: string;
  card: string;
  text: string;
  border: string;
  primary: string;
};

type SettingsItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  children?: React.ReactNode;
  colors: ThemeColors;
};

const SettingsItem: React.FC<SettingsItemProps> = ({
  icon,
  label,
  value,
  onPress,
  children,
  colors,
}) => (
  <TouchableOpacity
    style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border }]}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={onPress ? 0.82 : 1}
  >
    <View style={styles.itemLeft}>
      <View style={[styles.iconBox, { backgroundColor: `${colors.primary}15` }]}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <Text style={[styles.itemLabel, { color: colors.text }]} numberOfLines={2}>
        {label}
      </Text>
    </View>

    {children ? (
      children
    ) : (
      <View style={styles.itemRight}>
        {!!value && (
          <Text style={[styles.itemValue, { color: colors.text }]} numberOfLines={1}>
            {value}
          </Text>
        )}
        <Ionicons name="chevron-forward" size={18} color={colors.border} />
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

    return date.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

function boolStateText(value: boolean): string {
  return value ? 'ON' : 'OFF';
}

function formatOptionalText(value?: string | null): string {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  return '-';
}

export const SettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { colors, isDark, setIsDark, toggleTheme } = useTheme();
  const { locale, changeLanguage, supportedLanguages, ready: languageReady } = useLanguage();

  const layout = useAppScreenLayout({
    topInsetExtra: 16,
    topInsetMin: 32,
    contentBottomExtra: 28,
    contentBottomMin: 40,
    horizontalPadding: 25,
  });

  const adDiagnosticsEnabled = FEATURES.ads.diagnosticsLoggingEnabled;
  const firebaseDiagnosticsEnabled = FEATURES.firebase.diagnosticsLoggingEnabled;
  const operabilityDiagnosticsEnabled =
    adDiagnosticsEnabled || firebaseDiagnosticsEnabled;

  const {
    snapshot: operabilityDiagnostics,
    loading: operabilityLoading,
    refreshing: operabilityRefreshing,
    error: operabilityError,
    refresh: refreshOperabilityDiagnostics,
  } = useOperabilityDiagnostics({
    enabled: operabilityDiagnosticsEnabled,
  });

  const tt = useCallback(
    (key: string, fallback: string) => {
      const value = t(key, { defaultValue: fallback });
      return value === key ? fallback : value;
    },
    [t]
  );

  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const loadUserProfile = useCallback(async () => {
    try {
      setProfileError(null);

      if (!user) {
        setUserData(null);
        return;
      }

      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setUserData(docSnap.data() as UserProfile);
      } else {
        setUserData(null);
      }
    } catch (error) {
      console.error('Profile Fetch Error:', error);
      setProfileError(tt('error_generic', 'Profil bilgileri yüklenemedi'));
    } finally {
      setLoadingProfile(false);
    }
  }, [tt, user]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const fetchProfile = async () => {
        setLoadingProfile(true);

        try {
          if (!isActive) {
            return;
          }

          await loadUserProfile();
        } catch {
          if (!isActive) {
            return;
          }
        }
      };

      void fetchProfile();

      return () => {
        isActive = false;
      };
    }, [loadUserProfile])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadUserProfile(),
      refreshOperabilityDiagnostics(),
    ]);
    setRefreshing(false);
  }, [loadUserProfile, refreshOperabilityDiagnostics]);

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
  }, [tt]);

  const displayName = useMemo(() => {
    const firstName = userData?.firstName?.trim();
    const lastName = userData?.lastName?.trim();

    if (firstName || lastName) {
      return `${firstName || ''} ${lastName || ''}`.trim();
    }

    const emailName = user?.email?.split('@')[0]?.trim();
    if (emailName) {
      return emailName
        .replace(/[._-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .split(' ')
        .filter((word: string) => word.length > 0)
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }

    return tt('default_user_name', 'Kullanıcı');
  }, [tt, user?.email, userData?.firstName, userData?.lastName]);

  const displayMeta = useMemo(() => {
    const city = userData?.city?.trim();
    const district = userData?.district?.trim();

    if (city && district) {
      return `${city} / ${district}`;
    }

    if (city) {
      return city;
    }

    if (district) {
      return district;
    }

    return user?.email || tt('location_not_set', 'Konum bilgisi eklenmemiş');
  }, [tt, user?.email, userData?.city, userData?.district]);

  const avatarLetter = useMemo(() => {
    return displayName?.charAt(0)?.toUpperCase() || 'U';
  }, [displayName]);

  const verifiedText = useMemo(() => {
    return user?.emailVerified
      ? tt('email_verified', 'E-posta doğrulandı')
      : tt('email_not_verified', 'E-posta doğrulanmadı');
  }, [tt, user?.emailVerified]);

  const startupDiagnostics = operabilityDiagnostics?.bootstrap.data ?? null;
  const startupDiagnosticsError =
    operabilityDiagnostics?.bootstrap.error ?? operabilityError;

  const adDiagnostics = operabilityDiagnostics?.ad.data ?? null;
  const adDiagnosticsError =
    operabilityDiagnostics?.ad.error ?? operabilityError;

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

  const firebaseDiagnosticsFetchedAtText = useMemo(() => {
    return formatTimeValue(firebaseDiagnostics?.fetchedAt);
  }, [firebaseDiagnostics?.fetchedAt]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
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
        <Text style={[styles.headerTitle, { color: colors.primary }]}>
          {tt('settings', 'Ayarlar')}
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.text }]}>
          {tt(
            'settings_subtitle',
            'Uygulama tercihlerinizi ve hesap bilgilerinizi yönetin.'
          )}
        </Text>
      </View>

      <View
        style={[
          styles.profileCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            marginHorizontal: layout.horizontalPadding,
          },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>{avatarLetter}</Text>
        </View>

        <View style={styles.profileInfo}>
          {loadingProfile ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={[styles.userMeta, { color: colors.text }]} numberOfLines={2}>
                {displayMeta}
              </Text>
              <Text style={[styles.userMeta, { color: colors.text }]} numberOfLines={1}>
                {verifiedText}
              </Text>
              {profileError ? (
                <Text style={styles.profileErrorText}>{profileError}</Text>
              ) : null}
            </>
          )}
        </View>
      </View>

      <Text
        style={[
          styles.sectionTitle,
          { color: colors.text, marginHorizontal: layout.horizontalPadding },
        ]}
      >
        {tt('application_settings', 'Uygulama Ayarları')}
      </Text>

      <SettingsItem
        icon="moon-outline"
        label={tt('dark_mode', 'Karanlık Mod')}
        colors={colors}
      >
        <Switch
          value={isDark}
          onValueChange={() => {
            if (toggleTheme) {
              toggleTheme();
            } else {
              setIsDark(!isDark);
            }
          }}
          trackColor={{ false: '#767577', true: colors.primary }}
          thumbColor={Platform.OS === 'ios' ? '#FFF' : isDark ? colors.primary : '#f4f3f4'}
        />
      </SettingsItem>

      <View
        style={[
          styles.languageBox,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            marginHorizontal: layout.horizontalPadding,
          },
        ]}
      >
        <View style={styles.itemLeft}>
          <View style={[styles.iconBox, { backgroundColor: `${colors.primary}15` }]}>
            <Ionicons name="globe-outline" size={20} color={colors.primary} />
          </View>
          <Text style={[styles.itemLabel, { color: colors.text }]}>
            {tt('language', 'Dil')}
          </Text>
        </View>

        <View style={styles.langOptions}>
          {!languageReady ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            supportedLanguages.map((lang) => {
              const isSelected = locale === lang;

              return (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.langBtn,
                    {
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected ? `${colors.primary}10` : 'transparent',
                    },
                  ]}
                  onPress={() => changeLanguage(lang)}
                >
                  <Text
                    style={[
                      styles.langText,
                      { color: isSelected ? colors.primary : colors.text },
                    ]}
                  >
                    {lang.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </View>

      <Text
        style={[
          styles.sectionTitle,
          { color: colors.text, marginHorizontal: layout.horizontalPadding },
        ]}
      >
        {tt('support_info', 'Destek ve Bilgi')}
      </Text>

      <SettingsItem
        icon="shield-checkmark-outline"
        label={tt('privacy_policy', 'Gizlilik Politikası')}
        colors={colors}
        onPress={() =>
          handleSafeOpenUrl(
            'https://ersat112.github.io/barkodanaliz-policy/',
            tt('privacy_policy_open_error', 'Gizlilik politikası açılamadı')
          )
        }
      />

      <SettingsItem
        icon="information-circle-outline"
        label={tt('about_app', 'Uygulama Hakkında')}
        colors={colors}
        value={APP_VERSION}
      />

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
      />

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

      <View style={styles.adBox}>
        <AdBanner
          placement="settings_footer"
          showPlaceholderWhenUnavailable={adDiagnosticsEnabled}
        />
      </View>

      <View
        style={[
          styles.footer,
          { paddingHorizontal: layout.horizontalPadding },
        ]}
      >
        <Text style={[styles.footerText, { color: colors.text }]}>
          ErEnesAl® {APP_VERSION}
        </Text>
        <Text style={[styles.footerSub, { color: colors.text }]}>
          {tt('footer_slogan', 'Sağlık için akıllı seçimler')}
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    marginBottom: 20,
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
  profileCard: {
    padding: 20,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 30,
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
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    opacity: 0.5,
    letterSpacing: 1,
    marginBottom: 12,
  },
  item: {
    marginHorizontal: 25,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    paddingRight: 12,
    flex: 1,
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
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  itemValue: {
    fontSize: 14,
    opacity: 0.5,
    marginRight: 8,
    maxWidth: 110,
  },
  languageBox: {
    padding: 16,
    borderRadius: 16,
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
  adBox: {
    marginTop: 8,
    paddingHorizontal: 12,
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
    opacity: 0.3,
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
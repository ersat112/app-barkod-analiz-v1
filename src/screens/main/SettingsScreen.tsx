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
  TextInput,
  TouchableOpacity,
  View,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';

import { auth } from '../../config/firebase';
import { FEATURES } from '../../config/features';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { AdBanner } from '../../components/AdBanner';
import { useAppScreenLayout } from '../../components/layout/useAppScreenLayout';
import { useOperabilityDiagnostics } from '../../hooks/useOperabilityDiagnostics';
import { useSettingsProfileEditor } from '../../hooks/useSettingsProfileEditor';
import { useMonetizationStatus } from '../../hooks/useMonetizationStatus';
import { analyticsService } from '../../services/analytics.service';
import {
  buildAvatarLetter,
  buildUserDisplayName,
  buildUserMetaText,
} from '../../services/userPresentation.service';

const APP_VERSION = 'v1.0.4';

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

type ProfileFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  colors: ThemeColors;
  isDark: boolean;
  multiline?: boolean;
};

type PremiumCardProps = {
  title: string;
  subtitle: string;
  statusLabel: string;
  ctaLabel: string;
  metaLabel: string;
  onPress: () => void;
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

const ProfileField: React.FC<ProfileFieldProps> = ({
  label,
  value,
  placeholder,
  onChangeText,
  colors,
  isDark,
  multiline = false,
}) => {
  return (
    <View style={styles.profileFieldGroup}>
      <Text style={[styles.profileFieldLabel, { color: colors.text }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={`${colors.text}55`}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[
          styles.profileInput,
          multiline && styles.profileInputMultiline,
          {
            color: colors.text,
            borderColor: colors.border,
            backgroundColor: isDark ? '#181818' : '#FAFAFA',
          },
        ]}
      />
    </View>
  );
};

const PremiumCard: React.FC<PremiumCardProps> = ({
  title,
  subtitle,
  statusLabel,
  ctaLabel,
  metaLabel,
  onPress,
  colors,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.premiumCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.premiumHeader}>
        <View style={[styles.premiumIconWrap, { backgroundColor: `${colors.primary}14` }]}>
          <Ionicons name="diamond-outline" size={22} color={colors.primary} />
        </View>

        <View style={styles.premiumHeaderTextWrap}>
          <Text style={[styles.premiumTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.premiumSubtitle, { color: colors.text }]}>{subtitle}</Text>
        </View>

        <View style={[styles.premiumStatusBadge, { backgroundColor: `${colors.primary}12` }]}>
          <Text style={[styles.premiumStatusText, { color: colors.primary }]}>
            {statusLabel}
          </Text>
        </View>
      </View>

      <View style={styles.premiumFeatureRow}>
        <View style={styles.premiumFeatureItem}>
          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
          <Text style={[styles.premiumFeatureText, { color: colors.text }]}>
            Reklamsız kullanım
          </Text>
        </View>

        <View style={styles.premiumFeatureItem}>
          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
          <Text style={[styles.premiumFeatureText, { color: colors.text }]}>
            Limitsiz tarama
          </Text>
        </View>
      </View>

      <View style={styles.premiumFooter}>
        <Text style={[styles.premiumMetaText, { color: colors.text }]}>{metaLabel}</Text>

        <View style={[styles.premiumCtaButton, { backgroundColor: colors.primary }]}>
          <Text style={styles.premiumCtaText}>{ctaLabel}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

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

function formatTryPrice(value: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export const SettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { user, profile, loading: authLoading, profileError, refreshProfile } = useAuth();
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

  const monetization = useMonetizationStatus();

  const {
    draft,
    isEditing,
    isSaving,
    hasChanges,
    saveError,
    startEditing,
    cancelEditing,
    setField,
    save,
  } = useSettingsProfileEditor();

  const tt = useCallback(
    (key: string, fallback: string) => {
      const value = t(key, { defaultValue: fallback });
      return value === key ? fallback : value;
    },
    [t]
  );

  const [refreshing, setRefreshing] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

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
  }, [monetization.entitlement?.isPremium, monetization.entitlement?.plan, monetization.policy?.annualProductId, navigation]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refreshProfile(),
      refreshOperabilityDiagnostics(),
      monetization.refresh(),
    ]);
    setRefreshing(false);
  }, [monetization, refreshOperabilityDiagnostics, refreshProfile]);

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

  const handleProfileSave = useCallback(async () => {
    const success = await save();

    if (!success) {
      Alert.alert(
        tt('error_title', 'Hata'),
        tt('profile_save_error', 'Profil bilgileri kaydedilemedi.')
      );
      return;
    }

    Alert.alert(
      tt('success_title', 'Başarılı'),
      tt('profile_saved', 'Profil bilgileriniz güncellendi.')
    );
  }, [save, tt]);

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

  const readonlyLocation = useMemo(() => {
    const city = profile?.city?.trim();
    const district = profile?.district?.trim();

    if (city && district) {
      return `${city} / ${district}`;
    }

    return city || district || tt('location_not_set', 'Konum bilgisi eklenmemiş');
  }, [profile?.city, profile?.district, tt]);

  const premiumTitle = monetization.entitlement?.isPremium
    ? tt('premium_active', 'Premium aktif')
    : tt('premium_title', 'Premium yıllık plan');

  const premiumSubtitle = monetization.entitlement?.isPremium
    ? tt(
        'premium_active_text',
        'Bu hesapta premium entitlement aktif. Reklamlar bastırılır ve tarama limiti uygulanmaz.'
      )
    : tt(
        'premium_settings_subtitle',
        'Yıllık premium ile reklamsız kullanım ve limitsiz barkod tarama açılır.'
      );

  const premiumStatusLabel = monetization.entitlement?.isPremium
    ? tt('premium_badge_active', 'Aktif')
    : tt('premium_badge_yearly', 'Yıllık');

  const premiumCtaLabel = monetization.entitlement?.isPremium
    ? tt('manage_premium', 'Premium Durumunu Gör')
    : tt('open_premium_offer', 'Premium Teklifini Aç');

  const premiumMetaLabel =
    monetization.policy?.annualPriceTry != null
      ? `${formatTryPrice(monetization.policy.annualPriceTry)} / yıl`
      : '39,99 TL / yıl';

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
          {authLoading ? (
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
        {tt('premium', 'Premium')}
      </Text>

      <View style={{ marginHorizontal: layout.horizontalPadding, marginBottom: 22 }}>
        {monetization.loading ? (
          <View
            style={[
              styles.premiumLoadingCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          <PremiumCard
            title={premiumTitle}
            subtitle={premiumSubtitle}
            statusLabel={premiumStatusLabel}
            ctaLabel={premiumCtaLabel}
            metaLabel={premiumMetaLabel}
            onPress={handleOpenPaywall}
            colors={colors}
          />
        )}

        {monetization.error ? (
          <Text style={styles.monetizationErrorText}>{monetization.error}</Text>
        ) : null}
      </View>

      <Text
        style={[
          styles.sectionTitle,
          { color: colors.text, marginHorizontal: layout.horizontalPadding },
        ]}
      >
        {tt('profile', 'Profil')}
      </Text>

      <View
        style={[
          styles.profileEditorCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            marginHorizontal: layout.horizontalPadding,
          },
        ]}
      >
        <View style={styles.profileEditorHeader}>
          <View style={styles.profileEditorHeaderTextWrap}>
            <Text style={[styles.profileEditorTitle, { color: colors.text }]}>
              {tt('profile_information', 'Profil Bilgileri')}
            </Text>
            <Text style={[styles.profileEditorSubtitle, { color: colors.text }]}>
              {tt(
                'profile_information_subtitle',
                'Ad, soyad, telefon ve adres bilgilerinizi buradan güncelleyebilirsiniz.'
              )}
            </Text>
          </View>

          {!isEditing ? (
            <TouchableOpacity
              style={[
                styles.profileEditIconButton,
                {
                  backgroundColor: `${colors.primary}12`,
                  borderColor: colors.border,
                },
              ]}
              onPress={startEditing}
              activeOpacity={0.85}
            >
              <Ionicons name="create-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {isEditing ? (
          <>
            <View style={styles.profileFieldRow}>
              <View style={styles.profileFieldHalf}>
                <ProfileField
                  label={tt('first_name', 'Ad')}
                  value={draft.firstName}
                  placeholder={tt('first_name', 'Ad')}
                  onChangeText={(value) => setField('firstName', value)}
                  colors={colors}
                  isDark={isDark}
                />
              </View>

              <View style={styles.profileFieldHalf}>
                <ProfileField
                  label={tt('last_name', 'Soyad')}
                  value={draft.lastName}
                  placeholder={tt('last_name', 'Soyad')}
                  onChangeText={(value) => setField('lastName', value)}
                  colors={colors}
                  isDark={isDark}
                />
              </View>
            </View>

            <ProfileField
              label={tt('phone', 'Telefon')}
              value={draft.phone}
              placeholder={tt('phone', 'Telefon')}
              onChangeText={(value) => setField('phone', value)}
              colors={colors}
              isDark={isDark}
            />

            <View style={styles.profileFieldRow}>
              <View style={styles.profileFieldHalf}>
                <ProfileField
                  label={tt('city', 'Şehir')}
                  value={draft.city}
                  placeholder={tt('city', 'Şehir')}
                  onChangeText={(value) => setField('city', value)}
                  colors={colors}
                  isDark={isDark}
                />
              </View>

              <View style={styles.profileFieldHalf}>
                <ProfileField
                  label={tt('district', 'İlçe')}
                  value={draft.district}
                  placeholder={tt('district', 'İlçe')}
                  onChangeText={(value) => setField('district', value)}
                  colors={colors}
                  isDark={isDark}
                />
              </View>
            </View>

            <ProfileField
              label={tt('address', 'Adres')}
              value={draft.address}
              placeholder={tt('address', 'Adres')}
              onChangeText={(value) => setField('address', value)}
              colors={colors}
              isDark={isDark}
              multiline
            />

            {saveError ? (
              <Text style={styles.profileSaveErrorText}>
                {tt('profile_save_error', 'Profil bilgileri kaydedilemedi.')}
              </Text>
            ) : null}

            <View style={styles.profileActionsRow}>
              <TouchableOpacity
                style={[
                  styles.secondaryProfileButton,
                  {
                    borderColor: colors.border,
                  },
                ]}
                onPress={cancelEditing}
                disabled={isSaving}
                activeOpacity={0.85}
              >
                <Text style={[styles.secondaryProfileButtonText, { color: colors.text }]}>
                  {tt('cancel', 'İptal')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.primaryProfileButton,
                  {
                    backgroundColor: hasChanges ? colors.primary : colors.border,
                    opacity: isSaving ? 0.7 : 1,
                  },
                ]}
                onPress={handleProfileSave}
                disabled={!hasChanges || isSaving}
                activeOpacity={0.9}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.primaryProfileButtonText}>
                    {tt('save', 'Kaydet')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.readonlyProfileList}>
            <View style={styles.readonlyProfileRow}>
              <Text style={[styles.readonlyProfileLabel, { color: colors.text }]}>
                {tt('email', 'E-posta')}
              </Text>
              <Text style={[styles.readonlyProfileValue, { color: colors.text }]}>
                {formatOptionalText(profile?.email || user?.email)}
              </Text>
            </View>

            <View style={styles.readonlyProfileRow}>
              <Text style={[styles.readonlyProfileLabel, { color: colors.text }]}>
                {tt('phone', 'Telefon')}
              </Text>
              <Text style={[styles.readonlyProfileValue, { color: colors.text }]}>
                {formatOptionalText(profile?.phone)}
              </Text>
            </View>

            <View style={styles.readonlyProfileRow}>
              <Text style={[styles.readonlyProfileLabel, { color: colors.text }]}>
                {tt('location', 'Konum')}
              </Text>
              <Text style={[styles.readonlyProfileValue, { color: colors.text }]}>
                {readonlyLocation}
              </Text>
            </View>

            <View style={styles.readonlyProfileRow}>
              <Text style={[styles.readonlyProfileLabel, { color: colors.text }]}>
                {tt('address', 'Adres')}
              </Text>
              <Text style={[styles.readonlyProfileValue, { color: colors.text }]}>
                {formatOptionalText(profile?.address)}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryProfileButton, { backgroundColor: colors.primary, marginTop: 16 }]}
              onPress={startEditing}
              activeOpacity={0.9}
            >
              <Text style={styles.primaryProfileButtonText}>
                {tt('edit_profile', 'Profili Düzenle')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
    marginBottom: 22,
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
  premiumLoadingCard: {
    minHeight: 116,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
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
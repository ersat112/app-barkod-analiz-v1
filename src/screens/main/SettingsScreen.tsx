import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { auth, db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { AdBanner } from '../../components/AdBanner';

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

export const SettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { colors, isDark, setIsDark, toggleTheme } = useTheme();
  const { locale, changeLanguage, supportedLanguages, ready: languageReady } = useLanguage();

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
          if (!isActive) return;
          await loadUserProfile();
        } catch {
          if (!isActive) return;
        }
      };

      fetchProfile();

      return () => {
        isActive = false;
      };
    }, [loadUserProfile])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUserProfile();
    setRefreshing(false);
  }, [loadUserProfile]);

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

    if (city && district) return `${city} / ${district}`;
    if (city) return city;
    if (district) return district;

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

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.header}>
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
          { backgroundColor: colors.card, borderColor: colors.border },
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

      <Text style={[styles.sectionTitle, { color: colors.text }]}>
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
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.itemLeft}>
          <View style={[styles.iconBox, { backgroundColor: `${colors.primary}15` }]}>
            <Ionicons name="language-outline" size={20} color={colors.primary} />
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

      <Text style={[styles.sectionTitle, { color: colors.text }]}>
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
        <AdBanner />
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.text }]}>
          ErEnesAl® {APP_VERSION}
        </Text>
        <Text style={[styles.footerSub, { color: colors.text }]}>
          {tt('footer_slogan', 'Sağlık için akıllı seçimler')}
        </Text>
      </View>

      <View style={{ height: 50 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 60,
    paddingHorizontal: 25,
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
    marginHorizontal: 25,
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
    marginHorizontal: 25,
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
    marginHorizontal: 25,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
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
    paddingHorizontal: 25,
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
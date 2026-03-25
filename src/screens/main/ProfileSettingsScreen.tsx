import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../context/AuthContext';
import { useTheme, type ThemeColors } from '../../context/ThemeContext';
import { useAppScreenLayout } from '../../components/layout/useAppScreenLayout';
import { AmbientBackdrop } from '../../components/ui/AmbientBackdrop';
import {
  SearchableSelectSheet,
  SelectionField,
} from '../../components/ui/SearchableSelectSheet';
import { useSettingsProfileEditor } from '../../hooks/useSettingsProfileEditor';
import { getDistrictsByCity, searchCities } from '../../services/locationData';
import { locationService } from '../../services/locationService';
import {
  buildAvatarLetter,
  buildUserDisplayName,
  buildUserMetaText,
} from '../../services/userPresentation.service';
import { withAlpha } from '../../utils/color';

type ProfileFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  colors: ThemeColors;
  isDark: boolean;
  multiline?: boolean;
  helperText?: string;
};

const ProfileField: React.FC<ProfileFieldProps> = ({
  label,
  value,
  placeholder,
  onChangeText,
  colors,
  isDark,
  multiline = false,
  helperText,
}) => {
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={`${colors.text}55`}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          {
            color: colors.text,
            borderColor: withAlpha(colors.border, 'C8'),
            backgroundColor: withAlpha(colors.backgroundMuted, isDark ? 'D4' : 'F5'),
          },
        ]}
      />
      {helperText ? (
        <Text style={[styles.helperText, { color: colors.mutedText }]}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const mergeLocationOptions = (primary: string[], secondary: string[]): string[] => {
  return Array.from(
    new Set(
      [...primary, ...secondary]
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right, 'tr'));
};

const formatOptionalText = (value?: string | null): string => {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  return '-';
};

export const ProfileSettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { user, profile, loading: authLoading, profileError, refreshProfile } = useAuth();
  const layout = useAppScreenLayout({
    topInsetExtra: 16,
    topInsetMin: 32,
    contentBottomExtra: 28,
    contentBottomMin: 40,
    horizontalPadding: 25,
  });

  const {
    draft,
    isSaving,
    hasChanges,
    resolvedCity,
    saveError,
    setField,
    selectCity,
    selectDistrict,
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
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [districtPickerVisible, setDistrictPickerVisible] = useState(false);
  const [cityPickerSearch, setCityPickerSearch] = useState('');
  const [districtPickerSearch, setDistrictPickerSearch] = useState('');
  const [districtOptions, setDistrictOptions] = useState<string[]>([]);
  const [districtOptionsLoading, setDistrictOptionsLoading] = useState(false);

  useEffect(() => {
    let isActive = true;

    if (!resolvedCity) {
      setDistrictOptions([]);
      setDistrictOptionsLoading(false);
      return () => {
        isActive = false;
      };
    }

    const localDistrictOptions = getDistrictsByCity(resolvedCity);
    setDistrictOptions(localDistrictOptions);
    setDistrictOptionsLoading(true);

    void locationService
      .getDistrictsByCityName(resolvedCity)
      .then((remoteDistrictOptions) => {
        if (!isActive) {
          return;
        }

        setDistrictOptions(
          mergeLocationOptions(localDistrictOptions, remoteDistrictOptions)
        );
      })
      .catch((error) => {
        console.warn('[ProfileSettingsScreen] district options load failed:', error);
      })
      .finally(() => {
        if (isActive) {
          setDistrictOptionsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [resolvedCity]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshProfile();
    } finally {
      setRefreshing(false);
    }
  }, [refreshProfile]);

  const handleSave = useCallback(async () => {
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

  const openCityPicker = useCallback(() => {
    setCityPickerSearch(draft.city);
    setCityPickerVisible(true);
  }, [draft.city]);

  const openDistrictPicker = useCallback(() => {
    if (!resolvedCity) {
      return;
    }

    setDistrictPickerSearch(draft.district);
    setDistrictPickerVisible(true);
  }, [draft.district, resolvedCity]);

  const handleCitySelect = useCallback(
    (value: string) => {
      selectCity(value);
      setCityPickerSearch(value);
      setDistrictPickerSearch('');
      setCityPickerVisible(false);
    },
    [selectCity]
  );

  const handleDistrictSelect = useCallback(
    (value: string) => {
      selectDistrict(value);
      setDistrictPickerSearch(value);
      setDistrictPickerVisible(false);
    },
    [selectDistrict]
  );

  const cityPickerItems = useMemo(() => {
    return searchCities(cityPickerSearch).slice(0, 81);
  }, [cityPickerSearch]);

  const districtPickerItems = useMemo(() => {
    const query = districtPickerSearch.trim().toLocaleLowerCase('tr');

    if (!query) {
      return districtOptions;
    }

    return districtOptions.filter((item) =>
      item.toLocaleLowerCase('tr').includes(query)
    );
  }, [districtOptions, districtPickerSearch]);

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

  const readonlyLocation = useMemo(() => {
    const city = profile?.city?.trim();
    const district = profile?.district?.trim();

    if (city && district) {
      return `${city} / ${district}`;
    }

    return city || district || tt('location_not_set', 'Konum bilgisi eklenmemiş');
  }, [profile?.city, profile?.district, tt]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AmbientBackdrop colors={colors} variant="settings" />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView
        style={styles.screen}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: layout.headerTopPadding,
          paddingBottom: layout.contentBottomPadding,
          paddingHorizontal: layout.horizontalPadding,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[
              styles.topIconButton,
              {
                backgroundColor: withAlpha(colors.cardElevated, 'F0'),
                borderColor: withAlpha(colors.border, 'BC'),
              },
            ]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.headerTextWrap}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>
              {tt('profile', 'Profil')}
            </Text>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {tt('profile_information', 'Profil Bilgileri')}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.profileSummaryCard,
            {
              backgroundColor: withAlpha(colors.card, 'F2'),
              borderColor: withAlpha(colors.border, 'B8'),
              shadowColor: colors.shadow,
            },
          ]}
        >
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>

          <View style={styles.profileSummaryTextWrap}>
            {authLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={[styles.userMeta, { color: colors.mutedText }]} numberOfLines={2}>
                  {displayMeta}
                </Text>
                <Text style={[styles.userMeta, { color: colors.mutedText }]} numberOfLines={1}>
                  {verifiedText}
                </Text>
                {profileError ? (
                  <Text style={styles.errorText}>{profileError}</Text>
                ) : null}
              </>
            )}
          </View>
        </View>

        <View
          style={[
            styles.editorCard,
            {
              backgroundColor: withAlpha(colors.cardElevated, 'F1'),
              borderColor: withAlpha(colors.border, 'B8'),
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderTextWrap}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {tt('profile_information', 'Profil Bilgileri')}
              </Text>
              <Text style={[styles.cardSubtitle, { color: colors.mutedText }]}>
                {tt(
                  'profile_information_subtitle',
                  'Ad, soyad, telefon ve adres bilgilerinizi buradan güncelleyebilirsiniz.'
                )}
              </Text>
            </View>
          </View>

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
              <SelectionField
                label={tt('city', 'Şehir')}
                value={draft.city}
                placeholder={tt('select_city', 'Şehir seçin')}
                onPress={openCityPicker}
                colors={colors}
                isDark={isDark}
                helperText={tt('city_picker_helper', 'Şehrinizi seçmek için dokunun.')}
              />
            </View>

            <View style={styles.profileFieldHalf}>
              <SelectionField
                label={tt('district', 'İlçe')}
                value={draft.district}
                placeholder={
                  resolvedCity
                    ? tt('select_district', 'İlçe seçin')
                    : tt('select_city_first', 'Önce şehir seçin')
                }
                onPress={openDistrictPicker}
                colors={colors}
                isDark={isDark}
                disabled={!resolvedCity}
                helperText={
                  resolvedCity
                    ? tt('district_picker_helper', 'İlçenizi seçmek için dokunun.')
                    : tt(
                        'district_helper_select_city',
                        'İlçe önerilerini görmek için önce şehir seçin.'
                      )
                }
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

          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.mutedText }]}>
                {tt('email', 'E-posta')}
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {formatOptionalText(profile?.email || user?.email)}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.mutedText }]}>
                {tt('location', 'Konum')}
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {readonlyLocation}
              </Text>
            </View>
          </View>

          {saveError ? (
            <Text style={styles.errorText}>
              {tt('profile_save_error', 'Profil bilgileri kaydedilemedi.')}
            </Text>
          ) : null}

          <TouchableOpacity
            style={[
              styles.saveButton,
              {
                backgroundColor: hasChanges ? colors.primary : withAlpha(colors.border, 'CC'),
                opacity: isSaving ? 0.72 : 1,
              },
            ]}
            onPress={handleSave}
            disabled={!hasChanges || isSaving}
            activeOpacity={0.88}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.primaryContrast} />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color={colors.primaryContrast} />
                <Text
                  style={[
                    styles.saveButtonText,
                    { color: colors.primaryContrast },
                  ]}
                >
                  {tt('save', 'Kaydet')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <SearchableSelectSheet
        visible={cityPickerVisible}
        title={tt('city_picker_title', 'Şehir seçin')}
        searchPlaceholder={tt('city_picker_search', 'Şehir ara')}
        searchValue={cityPickerSearch}
        onSearchChange={setCityPickerSearch}
        items={cityPickerItems}
        selectedValue={resolvedCity ?? draft.city}
        emptyText={tt('city_picker_empty', 'Aramanıza uygun şehir bulunamadı.')}
        onSelect={handleCitySelect}
        onClose={() => setCityPickerVisible(false)}
        colors={colors}
        isDark={isDark}
      />

      <SearchableSelectSheet
        visible={districtPickerVisible}
        title={tt('district_picker_title', 'İlçe seçin')}
        searchPlaceholder={tt('district_picker_search', 'İlçe ara')}
        searchValue={districtPickerSearch}
        onSearchChange={setDistrictPickerSearch}
        items={districtPickerItems}
        selectedValue={draft.district}
        emptyText={tt(
          'district_picker_empty',
          'Seçili şehir için aramanıza uygun ilçe bulunamadı.'
        )}
        onSelect={handleDistrictSelect}
        onClose={() => setDistrictPickerVisible(false)}
        colors={colors}
        isDark={isDark}
        loading={districtOptionsLoading}
        loadingText={tt('district_picker_loading', 'İlçeler yükleniyor...')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  topIconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerTitle: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: '900',
  },
  profileSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderRadius: 26,
    padding: 20,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: 12,
    },
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },
  profileSummaryTextWrap: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '900',
  },
  userMeta: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
  },
  editorCard: {
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 26,
    padding: 20,
  },
  cardHeader: {
    marginBottom: 14,
  },
  cardHeaderTextWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  cardSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
  },
  profileFieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  profileFieldHalf: {
    flex: 1,
  },
  fieldGroup: {
    marginTop: 14,
  },
  fieldLabel: {
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '800',
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
  },
  inputMultiline: {
    minHeight: 108,
  },
  helperText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
  },
  infoGrid: {
    marginTop: 18,
    borderRadius: 18,
    gap: 10,
  },
  infoRow: {
    gap: 4,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  saveButton: {
    marginTop: 22,
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '900',
  },
  errorText: {
    marginTop: 10,
    color: '#FF5B5B',
    fontSize: 13,
    fontWeight: '700',
  },
});

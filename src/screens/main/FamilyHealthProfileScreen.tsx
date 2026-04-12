import React, { useCallback, useMemo } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { AmbientBackdrop } from '../../components/ui/AmbientBackdrop';
import { useAppScreenLayout } from '../../components/layout/useAppScreenLayout';
import { useTheme, type ThemeColors } from '../../context/ThemeContext';
import {
  getFamilyAllergenDefinitions,
  getFamilyHealthGoalDefinitions,
  getHomeAdditiveSpotlights,
} from '../../services/familyHealthProfile.service';
import { usePreferenceStore } from '../../store/usePreferenceStore';
import { withAlpha } from '../../utils/color';

type SelectableChipCardProps = {
  title: string;
  description: string;
  active: boolean;
  onPress: () => void;
  colors: ThemeColors;
};

const SelectableChipCard: React.FC<SelectableChipCardProps> = ({
  title,
  description,
  active,
  onPress,
  colors,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.optionCard,
        {
          backgroundColor: active
            ? withAlpha(colors.primary, '14')
            : withAlpha(colors.cardElevated, 'F2'),
          borderColor: active ? withAlpha(colors.primary, '5C') : withAlpha(colors.border, 'B8'),
        },
      ]}
      activeOpacity={0.88}
      onPress={onPress}
    >
      <View style={styles.optionCardTopRow}>
        <Text style={[styles.optionTitle, { color: colors.text }]}>{title}</Text>
        <View
          style={[
            styles.optionCheck,
            {
              backgroundColor: active ? colors.primary : withAlpha(colors.border, 'B0'),
            },
          ]}
        >
          <Ionicons
            name={active ? 'checkmark' : 'add'}
            size={14}
            color={active ? colors.primaryContrast : colors.text}
          />
        </View>
      </View>
      <Text style={[styles.optionDescription, { color: colors.mutedText }]}>
        {description}
      </Text>
    </TouchableOpacity>
  );
};

export const FamilyHealthProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t, i18n } = useTranslation();
  const { colors, isDark } = useTheme();
  const layout = useAppScreenLayout({
    topInsetExtra: 16,
    topInsetMin: 32,
    contentBottomExtra: 28,
    contentBottomMin: 40,
    horizontalPadding: 24,
  });

  const tt = useCallback(
    (key: string, fallback: string) => {
      const value = t(key, { defaultValue: fallback });
      return value === key ? fallback : value;
    },
    [t]
  );

  const familyHealthProfile = usePreferenceStore((state) => state.familyHealthProfile);
  const toggleFamilyAllergen = usePreferenceStore((state) => state.toggleFamilyAllergen);
  const toggleWatchedAdditive = usePreferenceStore((state) => state.toggleWatchedAdditive);
  const toggleFamilyHealthGoal = usePreferenceStore((state) => state.toggleFamilyHealthGoal);
  const familyAllergenDefinitions = useMemo(
    () => getFamilyAllergenDefinitions(i18n.language),
    [i18n.language]
  );
  const familyHealthGoalDefinitions = useMemo(
    () => getFamilyHealthGoalDefinitions(i18n.language),
    [i18n.language]
  );

  const summaryText = useMemo(() => {
    const allergenCount = familyHealthProfile.allergens.length;
    const additiveCount = familyHealthProfile.watchedAdditives.length;
    const goalCount = familyHealthProfile.healthGoals.length;

    return tt(
      'family_profile_summary',
      '{{allergens}} alerjen, {{additives}} katkı takibi ve {{goals}} sağlık odağı aktif.'
    )
      .replace('{{allergens}}', String(allergenCount))
      .replace('{{additives}}', String(additiveCount))
      .replace('{{goals}}', String(goalCount));
  }, [familyHealthProfile, tt]);

  const spotlightAdditives = useMemo(() => getHomeAdditiveSpotlights(), []);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AmbientBackdrop colors={colors} variant="settings" />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: layout.headerTopPadding,
          paddingBottom: layout.contentBottomPadding,
          paddingHorizontal: layout.horizontalPadding,
        }}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[
              styles.backButton,
              {
                backgroundColor: withAlpha(colors.cardElevated, 'F0'),
                borderColor: withAlpha(colors.border, 'BC'),
              },
            ]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.86}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.headerTextWrap}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>
              {tt('family_health_profile', 'Aile ve Sağlık Profili')}
            </Text>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {tt('family_health_profile_title', 'Hangi uyarıları önceleyelim?')}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: withAlpha(colors.card, isDark ? 'F2' : 'FC'),
              borderColor: withAlpha(colors.border, 'BC'),
              shadowColor: colors.shadow,
            },
          ]}
        >
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            {tt('family_health_profile_hero', 'Skordan once aileye uygunluk')}
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.mutedText }]}>
            {tt(
              'family_health_profile_hero_subtitle',
              'Buradaki secimler, urun detayinda aile hassasiyetlerine ozel uyari kartlarini one cikarmak icin kullanilir.'
            )}
          </Text>
          <View
            style={[
              styles.summaryPill,
              { backgroundColor: withAlpha(colors.primary, '14') },
            ]}
          >
            <Text style={[styles.summaryPillText, { color: colors.primary }]}>
              {summaryText}
            </Text>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {tt('family_health_allergens_title', 'Alerjen Takibi')}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.mutedText }]}>
            {tt(
              'family_health_allergens_subtitle',
              'Ailede dikkat etmek istedigin alerjenleri sec. Uygulama bu sinyalleri detay ekraninda ayri uyarir.'
            )}
          </Text>
          <View style={styles.optionList}>
            {familyAllergenDefinitions.map((item) => (
              <SelectableChipCard
                key={item.key}
                title={item.label}
                description={item.shortDescription}
                active={familyHealthProfile.allergens.includes(item.key)}
                onPress={() => toggleFamilyAllergen(item.key)}
                colors={colors}
              />
            ))}
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {tt('family_health_goals_title', 'Saglik Odaklari')}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.mutedText }]}>
            {tt(
              'family_health_goals_subtitle',
              'Alisveriste daha hizli karar vermek icin hangi sinyalleri daha belirgin gostermemizi istedigini sec.'
            )}
          </Text>
          <View style={styles.optionList}>
            {familyHealthGoalDefinitions.map((item) => (
              <SelectableChipCard
                key={item.key}
                title={item.label}
                description={item.shortDescription}
                active={familyHealthProfile.healthGoals.includes(item.key)}
                onPress={() => toggleFamilyHealthGoal(item.key)}
                colors={colors}
              />
            ))}
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {tt('family_health_additives_title', 'Izlenen Katki Kodlari')}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.mutedText }]}>
            {tt(
              'family_health_additives_subtitle',
              'Ana sayfada ve urun detayinda daha belirgin gostermek istedigin katkı kodlarini sec.'
            )}
          </Text>
          <View style={styles.optionList}>
            {spotlightAdditives.map((item) => (
              <SelectableChipCard
                key={item.code}
                title={`${item.code} ${item.name}`}
                description={item.impact}
                active={familyHealthProfile.watchedAdditives.includes(item.code)}
                onPress={() => toggleWatchedAdditive(item.code)}
                colors={colors}
              />
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.secondaryAction,
            {
              backgroundColor: withAlpha(colors.cardElevated, 'F2'),
              borderColor: withAlpha(colors.border, 'BC'),
            },
          ]}
          activeOpacity={0.88}
          onPress={() => navigation.navigate('NutritionPreferences')}
        >
          <View style={[styles.secondaryActionIcon, { backgroundColor: withAlpha(colors.primary, '14') }]}>
            <Ionicons name="leaf-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.secondaryActionTextWrap}>
            <Text style={[styles.secondaryActionTitle, { color: colors.text }]}>
              {tt('nutrition_preferences', 'Beslenme Tercihleri')}
            </Text>
            <Text style={[styles.secondaryActionSubtitle, { color: colors.mutedText }]}>
              {tt(
                'family_health_nutrition_link',
                'Vegan, glutensiz ve laktozsuz gibi tercihleri ayrica yonet.'
              )}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </TouchableOpacity>
      </ScrollView>
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
  backButton: {
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
    lineHeight: 34,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 22,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
  },
  heroSubtitle: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
  },
  summaryPill: {
    marginTop: 16,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  summaryPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  sectionBlock: {
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  sectionSubtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
  },
  optionList: {
    marginTop: 14,
    gap: 12,
  },
  optionCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
  },
  optionCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  optionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  optionDescription: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
  },
  optionCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryAction: {
    marginTop: 28,
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  secondaryActionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionTextWrap: {
    flex: 1,
  },
  secondaryActionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryActionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
  },
});

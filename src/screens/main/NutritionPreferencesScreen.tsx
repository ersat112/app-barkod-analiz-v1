import React, { useCallback, useMemo } from 'react';
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useTheme, type ThemeColors } from '../../context/ThemeContext';
import { useAppScreenLayout } from '../../components/layout/useAppScreenLayout';
import { AmbientBackdrop } from '../../components/ui/AmbientBackdrop';
import { usePreferenceStore } from '../../store/usePreferenceStore';
import {
  NUTRITION_PREFERENCE_KEYS,
} from '../../services/nutritionPreferences.service';
import { withAlpha } from '../../utils/color';

type PreferenceCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  colors: ThemeColors;
};

const PreferenceCard: React.FC<PreferenceCardProps> = ({
  icon,
  title,
  description,
  value,
  onValueChange,
  colors,
}) => {
  return (
    <View
      style={[
        styles.preferenceCard,
        {
          backgroundColor: withAlpha(colors.cardElevated, 'F1'),
          borderColor: withAlpha(colors.border, 'BC'),
          shadowColor: colors.shadow,
        },
      ]}
    >
      <View style={styles.preferenceCardHeader}>
        <View style={[styles.preferenceIconBox, { backgroundColor: withAlpha(colors.primary, '14') }]}>
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>

        <View style={styles.preferenceCardTextWrap}>
          <Text style={[styles.preferenceTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.preferenceDescription, { color: colors.mutedText }]}>
            {description}
          </Text>
        </View>

        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: '#767577', true: colors.primary }}
          thumbColor="#FFF"
        />
      </View>
    </View>
  );
};

export const NutritionPreferencesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const layout = useAppScreenLayout({
    topInsetExtra: 18,
    topInsetMin: 72,
    contentBottomExtra: 42,
    contentBottomMin: 96,
  });
  const { t } = useTranslation();
  const nutritionPreferences = usePreferenceStore((state) => state.nutritionPreferences);
  const setNutritionPreference = usePreferenceStore((state) => state.setNutritionPreference);
  const resetNutritionPreferences = usePreferenceStore((state) => state.resetNutritionPreferences);

  const tt = useCallback(
    (key: string, fallback: string) => {
      const value = t(key, { defaultValue: fallback });
      return value === key ? fallback : value;
    },
    [t]
  );

  const activeCount = useMemo(
    () =>
      NUTRITION_PREFERENCE_KEYS.filter((key) => nutritionPreferences[key]).length,
    [nutritionPreferences]
  );

  const preferenceCards = useMemo(
    () => [
      {
        key: 'glutenFree' as const,
        icon: 'ban-outline' as const,
        title: tt('preference_gluten_free', 'Glutensiz'),
        description: tt(
          'preference_gluten_free_desc',
          'Gluten sinyali olan ürünlerde uyarı gösterilir ve alternatifler buna göre filtrelenir.'
        ),
      },
      {
        key: 'lactoseFree' as const,
        icon: 'water-outline' as const,
        title: tt('preference_lactose_free', 'Laktozsuz'),
        description: tt(
          'preference_lactose_free_desc',
          'Laktoz veya süt sinyali taşıyan ürünlerde uyarı gösterilir.'
        ),
      },
      {
        key: 'palmOilFree' as const,
        icon: 'leaf-outline' as const,
        title: tt('preference_palm_oil_free', 'Palmiye Yağı Uyarısı'),
        description: tt(
          'preference_palm_oil_free_desc',
          'Palmiye yağı içeren ürünlerde uyarı gösterilir ve alternatiflerde daha sade seçenekler öne çıkar.'
        ),
      },
      {
        key: 'vegetarian' as const,
        icon: 'nutrition-outline' as const,
        title: tt('preference_vegetarian', 'Vejetaryen'),
        description: tt(
          'preference_vegetarian_desc',
          'Vejetaryen uygunluk sinyali olmayan ürünler için dikkat notu gösterilir.'
        ),
      },
      {
        key: 'vegan' as const,
        icon: 'flower-outline' as const,
        title: tt('preference_vegan', 'Vegan'),
        description: tt(
          'preference_vegan_desc',
          'Vegan uyumluluk sinyali olmayan ürünler için uyarı ve filtreleme uygulanır.'
        ),
      },
    ],
    [tt]
  );

  const handleReset = useCallback(() => {
    Alert.alert(
      tt('nutrition_preferences_reset_title', 'Tercihleri sıfırla'),
      tt(
        'nutrition_preferences_reset_message',
        'Tüm beslenme tercihleri kapatılacak. Devam etmek istiyor musunuz?'
      ),
      [
        { text: tt('cancel', 'İptal'), style: 'cancel' },
        {
          text: tt('reset', 'Sıfırla'),
          style: 'destructive',
          onPress: () => {
            resetNutritionPreferences();
          },
        },
      ]
    );
  }, [resetNutritionPreferences, tt]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: withAlpha(colors.card, isDark ? 'F1' : 'FC'),
              borderColor: withAlpha(colors.border, 'BC'),
              shadowColor: colors.shadow,
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: withAlpha(colors.primary, '10') }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Ionicons name="chevron-back" size={18} color={colors.primary} />
            <Text style={[styles.backButtonText, { color: colors.primary }]}>
              {tt('back', 'Geri')}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.heroEyebrow, { color: colors.primary }]}>
            {tt('nutrition_preferences', 'Beslenme Tercihleri')}
          </Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            {tt(
              'nutrition_preferences_screen_title',
              'Ürünleri size göre yorumlayın'
            )}
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.mutedText }]}>
            {tt(
              'nutrition_preferences_screen_subtitle',
              'Seçtiğiniz tercihler taranan ürünlerde kişisel uygunluk kartını ve alternatif ürün filtrelerini etkiler.'
            )}
          </Text>

          <View
            style={[
              styles.summaryBadge,
              { backgroundColor: withAlpha(colors.primary, '12') },
            ]}
          >
            <Text style={[styles.summaryBadgeText, { color: colors.primary }]}>
              {activeCount > 0
                ? tt('nutrition_preferences_summary_count', `${activeCount} aktif`).replace(
                    '{{count}}',
                    String(activeCount)
                  )
                : tt('nutrition_preferences_summary_none', 'Tercih seçilmedi')}
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {tt('nutrition_preferences_section_title', 'Uyarılar ve filtreler')}
        </Text>

        <View style={styles.preferenceList}>
          {preferenceCards.map((item) => (
            <PreferenceCard
              key={item.key}
              icon={item.icon}
              title={item.title}
              description={item.description}
              value={nutritionPreferences[item.key]}
              onValueChange={(value) => setNutritionPreference(item.key, value)}
              colors={colors}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.resetButton,
            {
              borderColor: withAlpha(colors.border, 'BC'),
              backgroundColor: withAlpha(colors.backgroundMuted, isDark ? 'C8' : 'F6'),
            },
          ]}
          onPress={handleReset}
          activeOpacity={0.88}
        >
          <Ionicons name="refresh-outline" size={18} color={colors.text} />
          <Text style={[styles.resetButtonText, { color: colors.text }]}>
            {tt('nutrition_preferences_reset', 'Tercihleri Sıfırla')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroCard: {
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    marginBottom: 22,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
    gap: 10,
  },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  summaryBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  summaryBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 12,
  },
  preferenceList: {
    gap: 12,
  },
  preferenceCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  preferenceCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  preferenceIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preferenceCardTextWrap: {
    flex: 1,
    gap: 4,
    paddingTop: 2,
  },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  preferenceDescription: {
    fontSize: 13,
    lineHeight: 19,
  },
  resetButton: {
    marginTop: 20,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});

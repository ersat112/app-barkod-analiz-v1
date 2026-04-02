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
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import type { RootStackParamList } from '../../navigation/AppNavigator';
import { AmbientBackdrop } from '../../components/ui/AmbientBackdrop';
import { useAppScreenLayout } from '../../components/layout/useAppScreenLayout';
import { useTheme } from '../../context/ThemeContext';
import {
  getFamilyAllergenDefinition,
  normalizeWatchedAdditiveCode,
} from '../../services/familyHealthProfile.service';
import { getECodeByCode } from '../../services/eCodesData';
import { usePreferenceStore } from '../../store/usePreferenceStore';
import { withAlpha } from '../../utils/color';

type RiskInsightRoute = RouteProp<RootStackParamList, 'RiskInsightDetail'>;

export const RiskInsightDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RiskInsightRoute>();
  const { t } = useTranslation();
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

  const toggleFamilyAllergen = usePreferenceStore((state) => state.toggleFamilyAllergen);
  const toggleWatchedAdditive = usePreferenceStore((state) => state.toggleWatchedAdditive);
  const familyHealthProfile = usePreferenceStore((state) => state.familyHealthProfile);

  const allergen = route.params.kind === 'allergen'
    ? getFamilyAllergenDefinition(route.params.id)
    : undefined;
  const additive =
    route.params.kind === 'additive'
      ? getECodeByCode(normalizeWatchedAdditiveCode(route.params.id))
      : undefined;

  const isSelected = useMemo(() => {
    if (route.params.kind === 'allergen' && allergen) {
      return familyHealthProfile.allergens.includes(allergen.key);
    }

    if (route.params.kind === 'additive' && additive) {
      return familyHealthProfile.watchedAdditives.includes(additive.code);
    }

    return false;
  }, [additive, allergen, familyHealthProfile, route.params.kind]);

  const title = allergen?.label || additive?.name || tt('risk_detail_title', 'Detay');
  const subtitle =
    route.params.kind === 'allergen'
      ? tt(
          'risk_detail_allergen_subtitle',
          'Bu sinyali aile profiline ekleyerek urun detaylarinda daha guclu uyari alabilirsin.'
        )
      : tt(
          'risk_detail_additive_subtitle',
          'Bu katkı kodunu izlemeye alarak detay ekraninda daha belirgin gorunmesini saglayabilirsin.'
        );

  const actionLabel =
    route.params.kind === 'allergen'
      ? isSelected
        ? tt('remove_from_family_alerts', 'Alerjen listesinden cikar')
        : tt('add_as_allergen', 'Alerjen olarak ekle')
      : isSelected
        ? tt('remove_from_watchlist', 'Izleme listesinden cikar')
        : tt('add_to_watchlist', 'Izleme listesine ekle');

  const handlePrimaryAction = useCallback(() => {
    if (route.params.kind === 'allergen' && allergen) {
      toggleFamilyAllergen(allergen.key);
      return;
    }

    if (route.params.kind === 'additive' && additive) {
      toggleWatchedAdditive(additive.code);
    }
  }, [additive, allergen, route.params.kind, toggleFamilyAllergen, toggleWatchedAdditive]);

  if (!allergen && !additive) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <AmbientBackdrop colors={colors} variant="settings" />
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={[styles.emptyWrap, { paddingTop: layout.headerTopPadding }]}>
          <TouchableOpacity
            style={[
              styles.backButton,
              {
                backgroundColor: withAlpha(colors.cardElevated, 'F0'),
                borderColor: withAlpha(colors.border, 'BC'),
              },
            ]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {tt('risk_detail_missing', 'Detay kaydi bulunamadi')}
          </Text>
        </View>
      </View>
    );
  }

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
              {route.params.kind === 'allergen'
                ? tt('allergen_label', 'Alerjen')
                : tt('additive_label', 'Katki Maddesi')}
            </Text>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
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
          {additive ? (
            <View style={[styles.riskBadge, { backgroundColor: withAlpha(colors.danger, '14') }]}>
              <Text style={[styles.riskBadgeText, { color: colors.danger }]}>
                {additive.code} • {additive.risk}
              </Text>
            </View>
          ) : null}
          <Text style={[styles.heroTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.heroSubtitle, { color: colors.mutedText }]}>{subtitle}</Text>

          <TouchableOpacity
            style={[
              styles.primaryAction,
              {
                backgroundColor: isSelected ? withAlpha(colors.border, 'D0') : colors.primary,
              },
            ]}
            activeOpacity={0.88}
            onPress={handlePrimaryAction}
          >
            <Ionicons
              name={isSelected ? 'checkmark-circle' : 'add-circle-outline'}
              size={18}
              color={isSelected ? colors.text : colors.primaryContrast}
            />
            <Text
              style={[
                styles.primaryActionText,
                { color: isSelected ? colors.text : colors.primaryContrast },
              ]}
            >
              {actionLabel}
            </Text>
          </TouchableOpacity>
        </View>

        {allergen ? (
          <View
            style={[
              styles.detailCard,
              {
                backgroundColor: withAlpha(colors.cardElevated, 'F2'),
                borderColor: withAlpha(colors.border, 'BC'),
              },
            ]}
          >
            <Text style={[styles.detailSectionTitle, { color: colors.text }]}>
              {tt('why_it_matters', 'Neden onemli?')}
            </Text>
            <Text style={[styles.detailBody, { color: colors.mutedText }]}>
              {allergen.detail}
            </Text>
            <Text style={[styles.detailSectionTitle, { color: colors.text }]}>
              {tt('watch_terms', 'Takip edilen kelimeler')}
            </Text>
            <Text style={[styles.detailBody, { color: colors.mutedText }]}>
              {allergen.watchTerms.join(', ')}
            </Text>
          </View>
        ) : null}

        {additive ? (
          <View
            style={[
              styles.detailCard,
              {
                backgroundColor: withAlpha(colors.cardElevated, 'F2'),
                borderColor: withAlpha(colors.border, 'BC'),
              },
            ]}
          >
            <Text style={[styles.detailSectionTitle, { color: colors.text }]}>
              {tt('category', 'Kategori')}
            </Text>
            <Text style={[styles.detailBody, { color: colors.mutedText }]}>
              {additive.category}
            </Text>
            <Text style={[styles.detailSectionTitle, { color: colors.text }]}>
              {tt('description', 'Aciklama')}
            </Text>
            <Text style={[styles.detailBody, { color: colors.mutedText }]}>
              {additive.description}
            </Text>
            <Text style={[styles.detailSectionTitle, { color: colors.text }]}>
              {tt('impact_label', 'Etkisi')}
            </Text>
            <Text style={[styles.detailBody, { color: colors.mutedText }]}>
              {additive.impact}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  emptyWrap: {
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 18,
    fontSize: 22,
    fontWeight: '900',
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
  riskBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  riskBadgeText: {
    fontSize: 12,
    fontWeight: '900',
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
  primaryAction: {
    marginTop: 18,
    minHeight: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '900',
  },
  detailCard: {
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
    marginBottom: 8,
  },
  detailBody: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 10,
  },
});

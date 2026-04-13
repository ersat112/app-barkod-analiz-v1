import React, { useCallback, useMemo, useState } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../context/ThemeContext';
import { useAppScreenLayout } from '../../components/layout/useAppScreenLayout';
import { AmbientBackdrop } from '../../components/ui/AmbientBackdrop';
import {
  ALL_E_CODES,
  type ECodeInfo,
  type ECodeRisk,
} from '../../services/eCodesData';
import { withAlpha } from '../../utils/color';

type RiskFilter = 'all' | ECodeRisk;

const getRiskPalette = (risk: ECodeRisk, colors: ReturnType<typeof useTheme>['colors']) => {
  if (risk === 'Düşük') {
    return {
      text: colors.success,
      background: withAlpha(colors.success, '14'),
    };
  }

  if (risk === 'Orta') {
    return {
      text: colors.warning,
      background: withAlpha(colors.warning, '14'),
    };
  }

  return {
    text: colors.danger,
    background: withAlpha(colors.danger, '14'),
  };
};

export const ECodeCatalogScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const layout = useAppScreenLayout({
    topInsetExtra: 18,
    topInsetMin: 72,
    contentBottomExtra: 42,
    contentBottomMin: 96,
  });
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');

  const tt = useCallback(
    (key: string, fallback: string) => {
      const value = t(key, { defaultValue: fallback });
      return value === key ? fallback : value;
    },
    [t]
  );

  const riskOptions = useMemo(
    () => [
      { value: 'all' as const, label: tt('ecode_filter_all', 'Tümü') },
      { value: 'Düşük' as const, label: tt('risk_low', 'Düşük') },
      { value: 'Orta' as const, label: tt('risk_medium', 'Orta') },
      { value: 'Yüksek' as const, label: tt('risk_high', 'Yüksek') },
    ],
    [tt]
  );

  const riskSummary = useMemo(() => {
    return {
      low: ALL_E_CODES.filter((item) => item.risk === 'Düşük').length,
      medium: ALL_E_CODES.filter((item) => item.risk === 'Orta').length,
      high: ALL_E_CODES.filter((item) => item.risk === 'Yüksek').length,
    };
  }, []);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('tr');

    return ALL_E_CODES.filter((item) => {
      if (riskFilter !== 'all' && item.risk !== riskFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [
        item.code,
        item.name,
        item.category,
        item.description,
        item.impact,
        ...(item.aliases ?? []),
      ].some((value) => value.toLocaleLowerCase('tr').includes(normalizedQuery));
    }).sort((left, right) => left.code.localeCompare(right.code));
  }, [query, riskFilter]);

  const renderSummaryCard = (
    tone: 'success' | 'warning' | 'danger',
    label: string,
    value: number
  ) => {
    const accent =
      tone === 'success'
        ? colors.success
        : tone === 'warning'
          ? colors.warning
          : colors.danger;

    return (
      <View
        style={[
          styles.summaryCard,
          {
            backgroundColor: withAlpha(accent, '12'),
            borderColor: withAlpha(accent, '26'),
          },
        ]}
      >
        <Text style={[styles.summaryValue, { color: accent }]}>{value}</Text>
        <Text style={[styles.summaryLabel, { color: colors.text }]}>{label}</Text>
      </View>
    );
  };

  const renderEntry = (item: ECodeInfo) => {
    const palette = getRiskPalette(item.risk, colors);

    return (
      <View
        key={item.code}
        style={[
          styles.entryCard,
          {
            backgroundColor: withAlpha(colors.cardElevated, isDark ? 'F2' : 'FC'),
            borderColor: withAlpha(colors.border, 'BA'),
            shadowColor: colors.shadow,
          },
        ]}
      >
        <View style={styles.entryHeader}>
          <View>
            <Text style={[styles.entryCode, { color: colors.primary }]}>{item.code}</Text>
            <Text style={[styles.entryName, { color: colors.text }]}>{item.name}</Text>
          </View>

          <View style={[styles.riskPill, { backgroundColor: palette.background }]}>
            <Text style={[styles.riskPillText, { color: palette.text }]}>
              {item.risk === 'Düşük'
                ? tt('risk_low', 'Düşük')
                : item.risk === 'Orta'
                  ? tt('risk_medium', 'Orta')
                  : tt('risk_high', 'Yüksek')}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View
            style={[
              styles.metaChip,
              { backgroundColor: withAlpha(colors.primary, '12') },
            ]}
          >
            <Ionicons name="layers-outline" size={14} color={colors.primary} />
            <Text style={[styles.metaChipText, { color: colors.primary }]}>
              {item.category}
            </Text>
          </View>
        </View>

        <Text style={[styles.entryDescription, { color: colors.text }]}>
          {item.description}
        </Text>

        <View
          style={[
            styles.impactBox,
            {
              backgroundColor: withAlpha(colors.backgroundMuted, isDark ? 'CC' : 'F4'),
              borderColor: withAlpha(colors.border, 'A8'),
            },
          ]}
        >
          <Text style={[styles.impactLabel, { color: colors.mutedText }]}>
            {tt('impact_label', 'Etkisi')}
          </Text>
          <Text style={[styles.impactValue, { color: colors.text }]}>{item.impact}</Text>
        </View>

        {item.aliases?.length ? (
          <Text style={[styles.aliasText, { color: colors.mutedText }]}>
            {tt('ecode_aliases', 'Diğer isimler')}: {item.aliases.join(', ')}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AmbientBackdrop colors={colors} variant="settings" />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView
        style={styles.container}
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
            <Text style={[styles.heroEyebrow, { color: colors.primary }]}>
              {tt('ecode_catalog', 'Katkı Kataloğu')}
            </Text>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {tt('ecode_screen_title', 'Katkı maddelerini hızlıca karşılaştır')}
            </Text>
          </View>
        </View>

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
          <Text style={[styles.heroEyebrow, { color: colors.primary }]}>
            {tt('ecode_catalog', 'Katkı Kataloğu')}
          </Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            {tt('ecode_screen_title', 'Katkı maddelerini hızlıca karşılaştır')}
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.mutedText }]}>
            {tt(
              'ecode_screen_subtitle',
              'E-kod, katkı tipi ve risk sinyallerini tek ekranda görerek ürün içeriklerini daha bilinçli yorumlayın.'
            )}
          </Text>

          <View style={styles.summaryRow}>
            {renderSummaryCard('success', tt('risk_low', 'Düşük'), riskSummary.low)}
            {renderSummaryCard('warning', tt('risk_medium', 'Orta'), riskSummary.medium)}
            {renderSummaryCard('danger', tt('risk_high', 'Yüksek'), riskSummary.high)}
          </View>
        </View>

        <View
          style={[
            styles.searchCard,
            {
              backgroundColor: withAlpha(colors.cardElevated, 'EE'),
              borderColor: withAlpha(colors.border, 'B8'),
            },
          ]}
        >
          <View
            style={[
              styles.searchInputWrap,
              {
                backgroundColor: withAlpha(colors.backgroundMuted, isDark ? 'CC' : 'F7'),
                borderColor: withAlpha(colors.border, 'A8'),
              },
            ]}
          >
            <Ionicons name="search-outline" size={18} color={colors.mutedText} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={tt('ecode_search_placeholder', 'E-kod veya isim ara')}
              placeholderTextColor={colors.mutedText}
              style={[styles.searchInput, { color: colors.text }]}
              autoCapitalize="characters"
              autoCorrect={false}
              selectionColor={colors.primary}
            />
            {query ? (
              <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.8}>
                <Ionicons name="close-circle" size={18} color={colors.mutedText} />
              </TouchableOpacity>
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {riskOptions.map((option) => {
              const active = riskFilter === option.value;

              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active
                        ? withAlpha(colors.primary, '18')
                        : withAlpha(colors.backgroundMuted, isDark ? 'CC' : 'F6'),
                      borderColor: active
                        ? withAlpha(colors.primary, '36')
                        : withAlpha(colors.border, 'A6'),
                    },
                  ]}
                  onPress={() => setRiskFilter(option.value)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: active ? colors.primary : colors.text },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <Text style={[styles.resultLabel, { color: colors.mutedText }]}>
          {tt('ecode_results_count', '{{count}} katkı kaydı gösteriliyor.').replace(
            '{{count}}',
            String(filteredItems.length)
          )}
        </Text>

        {filteredItems.length ? (
          filteredItems.map(renderEntry)
        ) : (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: withAlpha(colors.cardElevated, 'EC'),
                borderColor: withAlpha(colors.border, 'B4'),
              },
            ]}
          >
            <Ionicons
              name="search-circle-outline"
              size={28}
              color={colors.mutedText}
            />
            <Text style={[styles.emptyText, { color: colors.text }]}>
              {tt(
                'ecode_catalog_empty',
                'Aramanıza uygun katkı maddesi bulunamadı.'
              )}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
    marginLeft: 14,
  },
  headerTitle: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 22,
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: {
      width: 0,
      height: 14,
    },
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: '900',
  },
  heroSubtitle: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  summaryLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
  },
  searchCard: {
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  filterRow: {
    gap: 10,
    paddingTop: 14,
    paddingRight: 4,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '800',
  },
  resultLabel: {
    marginTop: 18,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '700',
  },
  entryCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 12,
    },
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  entryCode: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  entryName: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  riskPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  riskPillText: {
    fontSize: 12,
    fontWeight: '900',
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: 14,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  entryDescription: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 22,
  },
  impactBox: {
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  impactLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  impactValue: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  aliasText: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
  },
});

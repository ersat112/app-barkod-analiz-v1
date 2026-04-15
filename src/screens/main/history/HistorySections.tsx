import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';

import type { HistoryEntry } from '../../../services/db';
import type { HistoryFilterType, HistorySection } from '../../../types/history';
import { withAlpha } from '../../../utils/color';

type ThemeColors = {
  background: string;
  card: string;
  text: string;
  primary: string;
  border: string;
};

type HistoryListItemProps = {
  item: HistoryEntry;
  timeLabel: string;
  beautyLabel: string;
  foodLabel: string;
  medicineLabel: string;
  officialLabel: string;
  excellentLabel: string;
  goodLabel: string;
  poorLabel: string;
  badLabel: string;
  favoriteLabel: string;
  unfavoriteLabel: string;
  fallbackBrand: string;
  fallbackName: string;
  isFavorite: boolean;
  onPress: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  colors: ThemeColors;
};

type HistoryStateProps = {
  title: string;
  text: string;
  actionLabel: string;
  onActionPress: () => void;
  colors: ThemeColors;
};

type HistoryHeaderProps = {
  title: string;
  subtitle: string;
  colors: ThemeColors;
  topPadding?: number;
  totalCount?: number;
  hasActiveFilters?: boolean;
  searchValue?: string;
  eyebrowLabel?: string;
  countLabel?: string;
  archiveLabel?: string;
  statusLabel?: string;
  readyLabel?: string;
  filteredLabel?: string;
};

type HistoryFooterProps = {
  loadingMore: boolean;
  hasMore: boolean;
  colors: ThemeColors;
};

type HistoryFilterBarProps = {
  searchValue: string;
  selectedType: HistoryFilterType;
  hasActiveFilters: boolean;
  onSearchChange: (value: string) => void;
  onSelectType: (value: HistoryFilterType) => void;
  onClear: () => void;
  searchPlaceholder: string;
  allLabel: string;
  foodLabel: string;
  beautyLabel: string;
  medicineLabel: string;
  clearLabel: string;
  colors: ThemeColors;
};

const FALLBACK_IMAGE = 'https://via.placeholder.com/100?text=No+Image';

const getScoreBubblePalette = (item: HistoryEntry, colors: ThemeColors) => {
  if (item.type === 'medicine') {
    return {
      backgroundColor: `${colors.primary}14`,
      borderColor: `${colors.primary}38`,
      textColor: colors.primary,
      value: 'MED',
      label: 'TITCK',
    };
  }

  const score = typeof item.score === 'number' ? item.score : 0;

  if (score >= 85) {
    return {
      backgroundColor: '#1ED76018',
      borderColor: '#1ED76045',
      textColor: '#148A48',
      value: String(score),
      label: '/100',
    };
  }

  if (score >= 70) {
    return {
      backgroundColor: '#7ED95718',
      borderColor: '#7ED95745',
      textColor: '#4F9E2D',
      value: String(score),
      label: '/100',
    };
  }

  if (score >= 55) {
    return {
      backgroundColor: '#F5B70018',
      borderColor: '#F5B70045',
      textColor: '#A06B00',
      value: String(score),
      label: '/100',
    };
  }

  if (score >= 35) {
    return {
      backgroundColor: '#FF8A0018',
      borderColor: '#FF8A0045',
      textColor: '#B85B00',
      value: String(score),
      label: '/100',
    };
  }

  return {
    backgroundColor: '#FF4D4F18',
    borderColor: '#FF4D4F45',
    textColor: '#C73436',
    value: String(score),
    label: '/100',
  };
};

const getHistoryStatusMeta = (
  item: HistoryEntry,
  labels: {
    officialLabel: string;
    excellentLabel: string;
    goodLabel: string;
    poorLabel: string;
    badLabel: string;
  }
): {
  label: string;
  color: string;
  scoreText: string;
} => {
  if (item.type === 'medicine') {
    return {
      label: labels.officialLabel,
      color: '#3B82F6',
      scoreText: 'TITCK',
    };
  }

  const score = typeof item.score === 'number' ? item.score : 0;
  if (score >= 85) {
    return { label: labels.excellentLabel, color: '#18B56A', scoreText: `${score}/100` };
  }
  if (score >= 70) {
    return { label: labels.goodLabel, color: '#74C947', scoreText: `${score}/100` };
  }
  if (score >= 35) {
    return { label: labels.poorLabel, color: '#E38B2D', scoreText: `${score}/100` };
  }

  return { label: labels.badLabel, color: '#D94B45', scoreText: `${score}/100` };
};

export const HistoryListHeader: React.FC<HistoryHeaderProps> = ({
  title,
  subtitle,
  colors,
  topPadding = 60,
  totalCount = 0,
  hasActiveFilters = false,
  searchValue = '',
  eyebrowLabel = 'Tarama Arşivi',
  countLabel = 'KAYIT',
  archiveLabel = 'ARŞİV',
  statusLabel = 'DURUM',
  readyLabel = 'Hazır',
  filteredLabel = 'Filtreli',
}) => {
  return (
    <View style={[styles.header, { paddingTop: topPadding }]}>
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroEyebrow}>{eyebrowLabel}</Text>
            <Text style={styles.heroTitle}>{title}</Text>
            <Text style={styles.heroSubtitle}>{subtitle}</Text>
          </View>
          <View style={styles.heroBadgeWrap}>
            <Text style={styles.heroBadgeLabel}>{countLabel}</Text>
            <Text style={styles.heroBadgeValue}>{totalCount}</Text>
          </View>
        </View>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>{archiveLabel}</Text>
            <Text style={styles.heroStatValue}>{totalCount}</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>{statusLabel}</Text>
              <Text style={styles.heroStatValue}>
              {hasActiveFilters ? filteredLabel : readyLabel}
              </Text>
            </View>
        </View>

        {searchValue.trim().length ? (
          <View style={styles.heroSearchPill}>
            <Ionicons name="search-outline" size={14} color="#FFFFFF" />
            <Text style={styles.heroSearchPillText} numberOfLines={1}>
              {searchValue.trim()}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

export const HistoryFilterBar: React.FC<HistoryFilterBarProps> = ({
  searchValue,
  selectedType,
  hasActiveFilters,
  onSearchChange,
  onSelectType,
  onClear,
  searchPlaceholder,
  allLabel,
  foodLabel,
  beautyLabel,
  medicineLabel,
  clearLabel,
  colors,
}) => {
  const filterOptions: { key: HistoryFilterType; label: string }[] = [
    { key: 'all', label: allLabel },
    { key: 'food', label: foodLabel },
    { key: 'beauty', label: beautyLabel },
    { key: 'medicine', label: medicineLabel },
  ];

  return (
    <View style={styles.filterWrap}>
      <View
        style={[
          styles.searchBox,
          {
            backgroundColor: colors.card,
            borderColor: withAlpha(colors.border, '64'),
          },
        ]}
      >
        <Ionicons name="search-outline" size={18} color={colors.primary} />
        <TextInput
          value={searchValue}
          onChangeText={onSearchChange}
          placeholder={searchPlaceholder}
          placeholderTextColor={`${colors.text}55`}
          style={[styles.searchInput, { color: colors.text }]}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchValue.trim().length > 0 ? (
          <TouchableOpacity onPress={() => onSearchChange('')}>
            <Ionicons name="close-circle" size={18} color={colors.border} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.filterRow}>
        {filterOptions.map((option) => {
          const selected = selectedType === option.key;

          return (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.filterChip,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? `${colors.primary}12` : colors.card,
                },
              ]}
              onPress={() => onSelectType(option.key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: selected ? colors.primary : colors.text },
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {hasActiveFilters ? (
          <TouchableOpacity
            style={[styles.clearChip, { borderColor: colors.border }]}
            onPress={onClear}
          >
            <Text style={[styles.clearChipText, { color: colors.text }]}>
              {clearLabel}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

export const HistorySectionHeader: React.FC<{
  section: HistorySection;
  colors: ThemeColors;
}> = ({ section, colors }) => {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
    </View>
  );
};

const HistoryItemImage: React.FC<{ uri?: string | null }> = ({ uri }) => {
  const [failed, setFailed] = useState(false);

  return (
    <Image
      source={{ uri: !uri || failed ? FALLBACK_IMAGE : uri }}
      style={styles.itemImage}
      onError={() => setFailed(true)}
    />
  );
};

export const HistoryListItem: React.FC<HistoryListItemProps> = ({
  item,
  timeLabel,
  beautyLabel,
  foodLabel,
  medicineLabel,
  officialLabel,
  excellentLabel,
  goodLabel,
  poorLabel,
  badLabel,
  favoriteLabel,
  unfavoriteLabel,
  fallbackBrand,
  fallbackName,
  isFavorite,
  onPress,
  onDelete,
  onToggleFavorite,
  colors,
}) => {
  const scoreBubble = getScoreBubblePalette(item, colors);
  const statusMeta = getHistoryStatusMeta(item, {
    officialLabel,
    excellentLabel,
    goodLabel,
    poorLabel,
    badLabel,
  });

  return (
    <Swipeable
      overshootRight={false}
      renderRightActions={() => (
        <TouchableOpacity
          style={styles.deleteAction}
          onPress={onDelete}
          activeOpacity={0.82}
        >
          <Ionicons name="trash-outline" size={26} color="#FFF" />
        </TouchableOpacity>
      )}
    >
      <TouchableOpacity
        style={[
          styles.itemCard,
          {
            backgroundColor: colors.card,
            borderColor: withAlpha(colors.border, '64'),
          },
        ]}
        onPress={onPress}
        activeOpacity={0.82}
      >
        <HistoryItemImage uri={item.image_url} />

        <View style={styles.itemDetails}>
          <View style={styles.itemHeaderRow}>
            <View style={styles.itemHeaderTextWrap}>
              <Text style={[styles.itemBrand, { color: colors.text }]} numberOfLines={1}>
                {item.brand || fallbackBrand}
              </Text>

              <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={2}>
                {item.name || fallbackName}
              </Text>
              <View style={styles.itemStatusRow}>
                <View style={[styles.statusDot, { backgroundColor: statusMeta.color }]} />
                <Text style={[styles.itemStatusLabel, { color: statusMeta.color }]}>
                  {statusMeta.label}
                </Text>
                <Text style={[styles.itemScoreInline, { color: colors.text }]}>
                  {statusMeta.scoreText}
                </Text>
              </View>
              <Text style={[styles.itemMetaLine, { color: colors.text }]}>
                {item.type === 'beauty'
                  ? beautyLabel
                  : item.type === 'medicine'
                    ? medicineLabel
                    : foodLabel}{' '}
                • {timeLabel}
              </Text>
            </View>
            <View style={styles.itemRightArea}>
              <TouchableOpacity
                style={[
                  styles.favoriteIconButton,
                  {
                    backgroundColor: isFavorite ? `${colors.primary}12` : 'transparent',
                    borderColor: colors.border,
                  },
                ]}
                onPress={onToggleFavorite}
                activeOpacity={0.88}
                accessibilityLabel={isFavorite ? unfavoriteLabel : favoriteLabel}
              >
                <Ionicons
                  name={isFavorite ? 'star' : 'star-outline'}
                  size={16}
                  color={colors.primary}
                />
              </TouchableOpacity>
              <View
                style={[
                  styles.scoreBubble,
                  {
                    backgroundColor: scoreBubble.backgroundColor,
                    borderColor: scoreBubble.borderColor,
                  },
                ]}
              >
                <Text style={[styles.scoreBubbleValue, { color: scoreBubble.textColor }]}>
                  {scoreBubble.value}
                </Text>
                <Text style={[styles.scoreBubbleLabel, { color: scoreBubble.textColor }]}>
                  {scoreBubble.label}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.border} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
};

export const HistoryLoadingState: React.FC<{
  label: string;
  colors: ThemeColors;
}> = ({ label, colors }) => {
  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.loadingText, { color: colors.primary }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
};

export const HistoryEmptyState: React.FC<HistoryStateProps> = ({
  title,
  text,
  actionLabel,
  onActionPress,
  colors,
}) => {
  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <Ionicons name="time-outline" size={72} color={colors.border} />
      <Text style={[styles.stateTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.stateText, { color: colors.text }]}>{text}</Text>

      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
        onPress={onActionPress}
      >
        <Text style={styles.primaryBtnText}>{actionLabel}</Text>
      </TouchableOpacity>
    </View>
  );
};

export const HistoryErrorState: React.FC<HistoryStateProps> = ({
  title,
  text,
  actionLabel,
  onActionPress,
  colors,
}) => {
  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <Ionicons name="cloud-offline-outline" size={72} color={colors.border} />
      <Text style={[styles.stateTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.stateText, { color: colors.text }]}>{text}</Text>

      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
        onPress={onActionPress}
      >
        <Text style={styles.primaryBtnText}>{actionLabel}</Text>
      </TouchableOpacity>
    </View>
  );
};

export const HistoryListFooter: React.FC<HistoryFooterProps> = ({
  loadingMore,
  hasMore,
  colors,
}) => {
  if (loadingMore) {
    return (
      <View style={styles.footerLoading}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return <View style={{ height: hasMore ? 12 : 24 }} />;
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  heroCard: {
    backgroundColor: '#63AE2E',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 8,
    },
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroTextWrap: {
    flex: 1,
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: {
    marginTop: 6,
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
  },
  heroSubtitle: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  heroBadgeWrap: {
    minWidth: 72,
    alignItems: 'flex-end',
  },
  heroBadgeLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroBadgeValue: {
    marginTop: 6,
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  heroStat: {
    flex: 1,
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroStatValue: {
    marginTop: 5,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  heroDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 14,
  },
  heroSearchPill: {
    marginTop: 14,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    maxWidth: '100%',
  },
  heroSearchPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  filterWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchBox: {
    borderWidth: 1,
    borderRadius: 20,
    minHeight: 46,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 9,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  clearChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  clearChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeader: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 7,
  },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  itemCard: {
    marginHorizontal: 16,
    marginBottom: 6,
    borderRadius: 20,
    borderWidth: 1,
    padding: 9,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemImage: {
    width: 44,
    height: 44,
    borderRadius: 11,
    resizeMode: 'cover',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 10,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemHeaderTextWrap: {
    flex: 1,
  },
  itemBrand: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    opacity: 0.66,
  },
  itemName: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 17,
  },
  itemStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
    flexWrap: 'wrap',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  itemStatusLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  itemScoreInline: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    opacity: 0.72,
  },
  itemMetaLine: {
    marginTop: 5,
    fontSize: 11,
    lineHeight: 14,
    opacity: 0.62,
  },
  itemRightArea: {
    alignItems: 'flex-end',
    gap: 6,
    paddingTop: 0,
  },
  favoriteIconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreBubble: {
    minWidth: 46,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 8,
  },
  scoreBubbleValue: {
    fontSize: 11,
    fontWeight: '900',
  },
  scoreBubbleLabel: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  deleteAction: {
    marginRight: 16,
    marginBottom: 8,
    width: 78,
    borderRadius: 16,
    backgroundColor: '#FF4D4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 3,
  },
  stateTitle: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: '900',
  },
  stateText: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.72,
  },
  primaryBtn: {
    marginTop: 22,
    paddingHorizontal: 26,
    paddingVertical: 15,
    borderRadius: 16,
  },
  primaryBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  footerLoading: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

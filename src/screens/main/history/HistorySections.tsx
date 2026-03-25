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
  favoriteLabel: string;
  unfavoriteLabel: string;
  rescanLabel: string;
  fallbackBrand: string;
  fallbackName: string;
  isFavorite: boolean;
  onPress: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onRescan: () => void;
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

const getScoreBubblePalette = (
  item: HistoryEntry,
  colors: ThemeColors
): {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  value: string;
  label: string;
} => {
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

export const HistoryListHeader: React.FC<HistoryHeaderProps> = ({
  title,
  subtitle,
  colors,
  topPadding = 60,
}) => {
  return (
    <View style={[styles.header, { paddingTop: topPadding }]}>
      <Text style={[styles.headerTitle, { color: colors.primary }]}>{title}</Text>
      <Text style={[styles.headerSubtitle, { color: colors.text }]}>{subtitle}</Text>
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
          { backgroundColor: colors.card, borderColor: colors.border },
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
  favoriteLabel,
  unfavoriteLabel,
  rescanLabel,
  fallbackBrand,
  fallbackName,
  isFavorite,
  onPress,
  onDelete,
  onToggleFavorite,
  onRescan,
  colors,
}) => {
  const scoreBubble = getScoreBubblePalette(item, colors);

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
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        onPress={onPress}
        activeOpacity={0.82}
      >
        <HistoryItemImage uri={item.image_url} />

        <View style={styles.itemDetails}>
          <View style={styles.itemHeaderRow}>
            <View style={styles.itemHeaderTextWrap}>
              <Text style={[styles.itemBrand, { color: colors.primary }]} numberOfLines={1}>
                {item.brand || fallbackBrand}
              </Text>

              <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={2}>
                {item.name || fallbackName}
              </Text>
            </View>

            <View style={styles.itemRightArea}>
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
              <View style={styles.itemTimeRow}>
                <Text style={[styles.itemTime, { color: colors.text }]}>{timeLabel}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.border} />
              </View>
            </View>
          </View>

          <View style={styles.itemMetaRow}>
            <View style={[styles.inlineBadge, { backgroundColor: `${colors.primary}12` }]}>
              <Text
                style={[styles.inlineBadgeText, { color: colors.primary }]}
                numberOfLines={1}
              >
                {item.type === 'beauty'
                  ? beautyLabel
                  : item.type === 'medicine'
                    ? medicineLabel
                    : foodLabel}
              </Text>
            </View>
          </View>

          <View style={styles.itemActionsRow}>
            <TouchableOpacity
              style={[
                styles.secondaryActionButton,
                {
                  borderColor: colors.border,
                  backgroundColor: isFavorite ? `${colors.primary}12` : 'transparent',
                },
              ]}
              onPress={onToggleFavorite}
              activeOpacity={0.88}
            >
              <Ionicons
                name={isFavorite ? 'star' : 'star-outline'}
                size={16}
                color={colors.primary}
              />
              <Text
                style={[
                  styles.secondaryActionText,
                  { color: isFavorite ? colors.primary : colors.text },
                ]}
                numberOfLines={1}
              >
                {isFavorite ? unfavoriteLabel : favoriteLabel}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryActionButton, { backgroundColor: colors.primary }]}
              onPress={onRescan}
              activeOpacity={0.9}
            >
              <Ionicons name="refresh-outline" size={16} color="#000" />
              <Text style={styles.primaryActionText} numberOfLines={1}>
                {rescanLabel}
              </Text>
            </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.68,
  },
  filterWrap: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  searchBox: {
    borderWidth: 1,
    borderRadius: 18,
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  clearChip: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  clearChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    opacity: 0.55,
    letterSpacing: 1,
  },
  itemCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemImage: {
    width: 58,
    height: 58,
    borderRadius: 14,
    resizeMode: 'cover',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  itemHeaderTextWrap: {
    flex: 1,
    minHeight: 40,
  },
  itemBrand: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  itemName: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  itemMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  inlineBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 9,
    maxWidth: '100%',
  },
  inlineBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  itemRightArea: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 58,
  },
  itemTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemTime: {
    fontSize: 11,
    fontWeight: '700',
    opacity: 0.7,
  },
  scoreBubble: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreBubbleValue: {
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 18,
  },
  scoreBubbleLabel: {
    marginTop: 1,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  itemActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  secondaryActionButton: {
    flex: 1,
    minHeight: 34,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryActionText: {
    fontSize: 11,
    fontWeight: '800',
  },
  primaryActionButton: {
    flex: 1.1,
    minHeight: 34,
    borderRadius: 12,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryActionText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '900',
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

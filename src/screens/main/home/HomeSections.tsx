import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import type { ThemeColors } from '../../../context/ThemeContext';
import type { HistoryEntry } from '../../../services/db';
import { withAlpha } from '../../../utils/color';

type QuickActionCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
  colors: ThemeColors;
};

type StatCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  value: string | number;
  label: string;
  colors: ThemeColors;
};

type MissionCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  progressLabel: string;
  progressMeta: string;
  progressValue: number;
  motivationText: string;
  actionLabel: string;
  onActionPress: () => void;
  colors: ThemeColors;
};

type SummaryCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  colors: ThemeColors;
};

type ChallengeCardProps = {
  title: string;
  subtitle: string;
  progressLabel: string;
  progressMeta: string;
  progressValue: number;
  footerText: string;
  colors: ThemeColors;
};

type LastProductCardProps = {
  item: HistoryEntry;
  title: string;
  subtitle: string;
  barcodeLabel: string;
  scoreLabel: string;
  medicineLabel: string;
  fallbackBrand: string;
  fallbackName: string;
  onPress: () => void;
  colors: ThemeColors;
};

type InsightCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  colors: ThemeColors;
};

type LoadingStateProps = {
  label: string;
  colors: ThemeColors;
};

type RecentProductsCarouselProps = {
  title: string;
  subtitle: string;
  items: HistoryEntry[];
  scoreLabel: string;
  medicineLabel: string;
  fallbackBrand: string;
  fallbackName: string;
  onItemPress: (item: HistoryEntry) => void;
  colors: ThemeColors;
};

type QuickInsightsStripProps = {
  items: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
  }[];
  colors: ThemeColors;
};

type LiveInsightCardProps = {
  items: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    text: string;
    meta?: string;
    onPress?: () => void;
  }[];
  badgeLabel: string;
  helperText?: string;
  colors: ThemeColors;
};

const FALLBACK_IMAGE = 'https://via.placeholder.com/100?text=No+Image';

export const QuickActionCard: React.FC<QuickActionCardProps> = ({
  icon,
  title,
  description,
  onPress,
  colors,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.quickActionCard,
        {
          backgroundColor: colors.card,
          borderColor: withAlpha(colors.border, 'BB'),
        },
      ]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View style={styles.quickActionTopRow}>
        <View
          style={[
            styles.quickActionIconShell,
            { backgroundColor: withAlpha(colors.primary, '14') },
          ]}
        >
          <Ionicons name={icon} size={22} color={colors.primary} />
        </View>
        <View
          style={[
            styles.quickActionArrowShell,
            { backgroundColor: withAlpha(colors.teal, '14') },
          ]}
        >
          <Ionicons name="arrow-forward" size={16} color={colors.teal} />
        </View>
      </View>

      <View style={styles.quickActionBody}>
        <Text
          style={[styles.quickActionTitle, { color: colors.text }]}
          numberOfLines={2}
        >
          {title}
        </Text>
        <Text
          style={[styles.quickActionText, { color: colors.mutedText }]}
          numberOfLines={3}
        >
          {description}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export const StatCard: React.FC<StatCardProps> = ({
  icon,
  value,
  label,
  colors,
}) => {
  const { t } = useTranslation();
  const trendText = t('live_dashboard_data', {
    defaultValue: 'Canli dashboard verisi',
  });

  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: colors.card,
          borderColor: withAlpha(colors.border, 'B5'),
        },
      ]}
    >
      <View style={styles.statHeader}>
        <Text style={[styles.statLabel, { color: colors.mutedText }]}>{label}</Text>
        <View
          style={[
            styles.statIconShell,
            { backgroundColor: withAlpha(colors.primary, '14') },
          ]}
        >
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>
      </View>
      <Text style={[styles.statValue, { color: colors.primary }]}>{value}</Text>
      <View style={styles.statTrendRow}>
        <View
          style={[
            styles.statTrendDot,
            { backgroundColor: withAlpha(colors.teal, 'B0') },
          ]}
        />
        <Text style={[styles.statTrendText, { color: colors.mutedText }]}>
          {trendText}
        </Text>
      </View>
    </View>
  );
};

export const MissionCard: React.FC<MissionCardProps> = ({
  icon,
  title,
  description,
  progressLabel,
  progressMeta,
  progressValue,
  motivationText,
  actionLabel,
  onActionPress,
  colors,
}) => {
  const { t } = useTranslation();
  const badgeLabel = t('today_focus_label', {
    defaultValue: 'Bugunun odagi',
  });
  const progressMetaLabel = t('mission_progress_status', {
    defaultValue: 'Hazirlik tamamlaniyor',
  });

  return (
    <View
      style={[
        styles.heroCard,
        {
          backgroundColor: colors.card,
          borderColor: withAlpha(colors.border, 'BB'),
        },
      ]}
    >
      <View style={styles.heroBadgeRow}>
        <View
          style={[
            styles.heroBadge,
            { backgroundColor: withAlpha(colors.primary, '14') },
          ]}
        >
          <Text style={[styles.heroBadgeText, { color: colors.primary }]}>
            {badgeLabel}
          </Text>
        </View>
        <Text style={[styles.heroMetaText, { color: colors.mutedText }]}>
          {progressMeta}
        </Text>
      </View>

      <View style={styles.heroTopRow}>
        <View
          style={[
            styles.heroIconBox,
            { backgroundColor: withAlpha(colors.primary, '14') },
          ]}
        >
          <Ionicons name={icon} size={26} color={colors.primary} />
        </View>
        <View style={styles.heroTextArea}>
          <Text style={[styles.heroTitle, { color: colors.text }]} numberOfLines={2}>
            {title}
          </Text>
          <Text
            style={[styles.heroSubtitle, { color: colors.mutedText }]}
            numberOfLines={3}
          >
            {description}
          </Text>
        </View>
      </View>

      <View style={styles.progressHeader}>
        <Text style={[styles.progressLabel, { color: colors.text }]}>
          {progressLabel}
        </Text>
        <Text style={[styles.progressMeta, { color: colors.mutedText }]}>
          {progressMetaLabel}
        </Text>
      </View>

      <View
        style={[
          styles.progressTrack,
          { backgroundColor: withAlpha(colors.border, '6B') },
        ]}
      >
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.max(0, Math.min(progressValue, 1)) * 100}%`,
              backgroundColor: colors.primary,
            },
          ]}
        />
      </View>

      <Text style={[styles.motivationText, { color: colors.mutedText }]}>
        {motivationText}
      </Text>

      <TouchableOpacity
        style={[
          styles.mainActionBtn,
          {
            backgroundColor: colors.primary,
            shadowColor: colors.shadow,
          },
        ]}
        onPress={onActionPress}
        activeOpacity={0.9}
      >
        <View style={styles.btnContent}>
          <Ionicons name="barcode-outline" size={30} color="#000" />
          <Text style={[styles.mainActionText, { color: colors.primaryContrast }]}>
            {actionLabel.toUpperCase()}
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={22} color={colors.primaryContrast} />
      </TouchableOpacity>
    </View>
  );
};

export const SummaryCard: React.FC<SummaryCardProps> = ({
  icon,
  title,
  description,
  colors,
}) => {
  return (
    <View
      style={[
        styles.largeCard,
        {
          backgroundColor: colors.cardElevated,
          borderColor: withAlpha(colors.border, 'BA'),
        },
      ]}
    >
      <View style={styles.largeCardHeader}>
        <View
          style={[styles.iconBox, { backgroundColor: withAlpha(colors.primary, '14') }]}
        >
          <Ionicons name={icon} size={26} color={colors.primary} />
        </View>
        <View style={styles.largeCardInfo}>
          <Text style={[styles.largeCardTitle, { color: colors.text }]}>
            {title}
          </Text>
          <Text style={[styles.largeCardHint, { color: colors.mutedText }]}>
            {description}
          </Text>
        </View>
      </View>
    </View>
  );
};

export const ChallengeCard: React.FC<ChallengeCardProps> = ({
  title,
  subtitle,
  progressLabel,
  progressMeta,
  progressValue,
  footerText,
  colors,
}) => {
  return (
    <View
      style={[
        styles.challengeCard,
        {
          backgroundColor: colors.card,
          borderColor: withAlpha(colors.border, 'B5'),
        },
      ]}
    >
      <View style={styles.challengeHeader}>
        <View
          style={[
            styles.challengeIconBox,
            { backgroundColor: withAlpha(colors.primary, '14') },
          ]}
        >
          <Ionicons name="medal-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.challengeTextBox}>
          <Text style={[styles.challengeTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.challengeSubtitle, { color: colors.mutedText }]}>
            {subtitle}
          </Text>
        </View>
      </View>

      <View style={styles.progressHeader}>
        <Text style={[styles.progressLabel, { color: colors.text }]}>
          {progressLabel}
        </Text>
        <Text style={[styles.progressMeta, { color: colors.text }]}>
          {progressMeta}
        </Text>
      </View>

      <View
        style={[
          styles.progressTrack,
          { backgroundColor: withAlpha(colors.border, '6B') },
        ]}
      >
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.max(0, Math.min(progressValue, 1)) * 100}%`,
              backgroundColor: colors.primary,
            },
          ]}
        />
      </View>

      <Text style={[styles.challengeFooterText, { color: colors.mutedText }]}>
        {footerText}
      </Text>
    </View>
  );
};

const LastProductImage: React.FC<{ uri?: string | null }> = ({ uri }) => {
  const [failed, setFailed] = useState(false);

  return (
    <Image
      source={{ uri: !uri || failed ? FALLBACK_IMAGE : uri }}
      style={styles.lastProductImage}
      onError={() => setFailed(true)}
    />
  );
};

export const LastProductCard: React.FC<LastProductCardProps> = ({
  item,
  title,
  subtitle,
  barcodeLabel,
  scoreLabel,
  medicineLabel,
  fallbackBrand,
  fallbackName,
  onPress,
  colors,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.lastProductCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      activeOpacity={0.88}
      onPress={onPress}
    >
      <View style={styles.lastProductHeader}>
        <View
          style={[
            styles.lastProductHeaderIcon,
            { backgroundColor: `${colors.primary}15` },
          ]}
        >
          <Ionicons name="time-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.lastProductHeaderTextWrap}>
          <Text style={[styles.lastProductEyebrow, { color: colors.primary }]}>{title}</Text>
          <Text style={[styles.lastProductSubtitle, { color: colors.mutedText }]}>
            {subtitle}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.border} />
      </View>

      <View style={styles.lastProductContent}>
        <LastProductImage uri={item.image_url} />
        <View style={styles.lastProductBody}>
          <Text style={[styles.lastProductBrand, { color: colors.primary }]} numberOfLines={1}>
            {item.brand || fallbackBrand}
          </Text>
          <Text style={[styles.lastProductName, { color: colors.text }]} numberOfLines={2}>
            {item.name || fallbackName}
          </Text>

          <View style={styles.lastProductMetaRow}>
            <View style={[styles.inlineBadge, { backgroundColor: `${colors.primary}12` }]}>
              <Text style={[styles.inlineBadgeText, { color: colors.primary }]} numberOfLines={1}>
                {barcodeLabel}: {item.barcode}
              </Text>
            </View>

            <View style={[styles.inlineBadge, { backgroundColor: `${colors.primary}12` }]}>
              <Text style={[styles.inlineBadgeText, { color: colors.primary }]} numberOfLines={1}>
                {item.type === 'medicine'
                  ? medicineLabel
                  : `${scoreLabel}: ${item.score ?? '-'}`}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export const RecentProductsCarousel: React.FC<RecentProductsCarouselProps> = ({
  title,
  subtitle,
  items,
  scoreLabel,
  medicineLabel,
  fallbackBrand,
  fallbackName,
  onItemPress,
  colors,
}) => {
  if (!items.length) {
    return null;
  }

  return (
    <View
      style={[
        styles.carouselSection,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.carouselHeader}>
        <View
          style={[
            styles.lastProductHeaderIcon,
            { backgroundColor: `${colors.primary}15` },
          ]}
        >
          <Ionicons name="albums-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.lastProductHeaderTextWrap}>
          <Text style={[styles.lastProductEyebrow, { color: colors.primary }]}>{title}</Text>
          <Text style={[styles.lastProductSubtitle, { color: colors.mutedText }]}>
            {subtitle}
          </Text>
        </View>
      </View>

      <View style={styles.recentList}>
        {items.slice(0, 4).map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.recentListItem,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
            activeOpacity={0.88}
            onPress={() => onItemPress(item)}
          >
            <LastProductImage uri={item.image_url} />
            <View style={styles.recentListTextWrap}>
              <Text
                style={[styles.carouselBrand, { color: colors.primary }]}
                numberOfLines={1}
              >
                {item.brand || fallbackBrand}
              </Text>
              <Text
                style={[styles.carouselName, { color: colors.text }]}
                numberOfLines={2}
              >
                {item.name || fallbackName}
              </Text>
            </View>
            <View style={[styles.inlineBadge, { backgroundColor: `${colors.primary}12` }]}>
              <Text style={[styles.inlineBadgeText, { color: colors.primary }]}>
                {item.type === 'medicine'
                  ? medicineLabel
                  : `${scoreLabel}: ${item.score ?? '-'}`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.border} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

export const QuickInsightsStrip: React.FC<QuickInsightsStripProps> = ({
  items,
  colors,
}) => {
  return (
    <View style={styles.quickInsightsRow}>
        {items.map((item) => (
        <View
          key={`${item.icon}-${item.label}`}
          style={[
            styles.quickInsightCard,
            {
              backgroundColor: colors.card,
              borderColor: withAlpha(colors.border, 'B5'),
            },
          ]}
        >
          <View
            style={[
              styles.quickInsightIconShell,
              { backgroundColor: withAlpha(colors.teal, '14') },
            ]}
          >
            <Ionicons name={item.icon} size={16} color={colors.teal} />
          </View>
          <Text style={[styles.quickInsightValue, { color: colors.text }]} numberOfLines={1}>
            {item.value}
          </Text>
          <Text
            style={[styles.quickInsightLabel, { color: colors.mutedText }]}
            numberOfLines={2}
          >
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
};

export const LiveInsightCard: React.FC<LiveInsightCardProps> = ({
  items,
  badgeLabel,
  helperText,
  colors,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) {
      return undefined;
    }

    const timer = setInterval(() => {
      setActiveIndex((current) => (current + 1) % items.length);
    }, 5500);

    return () => clearInterval(timer);
  }, [items.length]);

  if (!items.length) {
    return null;
  }

  const activeItem = items[activeIndex % items.length];
  const goToNextItem = () => {
    setActiveIndex((current) => (current + 1) % items.length);
  };

  return (
    <TouchableOpacity
      style={[
        styles.liveInsightCard,
        {
          backgroundColor: colors.cardElevated,
          borderColor: withAlpha(colors.primary, '30'),
        },
      ]}
      activeOpacity={0.92}
      onPress={() => {
        if (activeItem.onPress) {
          activeItem.onPress();
          return;
        }

        goToNextItem();
      }}
    >
      <View style={styles.liveInsightHeader}>
        <View style={[styles.heroBadge, { backgroundColor: withAlpha(colors.primary, '14') }]}>
          <Text style={[styles.heroBadgeText, { color: colors.primary }]}>{badgeLabel}</Text>
        </View>

        <View style={styles.liveInsightMeta}>
          <Text style={[styles.liveInsightCounter, { color: colors.primary }]}>
            {activeIndex + 1}/{items.length}
          </Text>
          <TouchableOpacity
            style={[
              styles.liveInsightNextButton,
              { backgroundColor: withAlpha(colors.primary, '12') },
            ]}
            onPress={goToNextItem}
            activeOpacity={0.86}
          >
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.liveInsightBody}>
        <View
          style={[
            styles.liveInsightIconBox,
            { backgroundColor: withAlpha(colors.teal, '14') },
          ]}
        >
          <Ionicons name={activeItem.icon} size={22} color={colors.teal} />
        </View>

        <View style={styles.liveInsightTextWrap}>
          <Text style={[styles.liveInsightTitle, { color: colors.text }]}>
            {activeItem.title}
          </Text>
          {activeItem.meta ? (
            <Text style={[styles.liveInsightMetaText, { color: colors.primary }]}>
              {activeItem.meta}
            </Text>
          ) : null}
          <Text style={[styles.liveInsightText, { color: colors.mutedText }]}>
            {activeItem.text}
          </Text>
        </View>
      </View>

      <View style={styles.liveInsightFooter}>
        {helperText ? (
          <Text style={[styles.liveInsightHelper, { color: colors.mutedText }]}>
            {helperText}
          </Text>
        ) : <View />}

        <View style={styles.liveInsightDots}>
          {items.map((item, index) => (
            <View
              key={`${item.icon}-${index}`}
              style={[
                styles.liveInsightDot,
                {
                  backgroundColor:
                    index === activeIndex
                      ? colors.primary
                      : withAlpha(colors.border, '96'),
                },
              ]}
            />
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );
};

export const InsightCard: React.FC<InsightCardProps> = ({
  icon,
  title,
  text,
  colors,
}) => {
  return (
    <View
      style={[
        styles.activityCard,
        {
          backgroundColor: colors.card,
          borderColor: withAlpha(colors.border, 'B0'),
        },
      ]}
    >
      <View style={styles.activityHeader}>
        <Ionicons name={icon} size={20} color={colors.primary} />
        <Text style={[styles.activityTitle, { color: colors.primary }]}>{title}</Text>
      </View>

      <Text style={[styles.activityText, { color: colors.mutedText }]}>{text}</Text>
    </View>
  );
};

export const DidYouKnowCard: React.FC<{
  title: string;
  text: string;
  colors: ThemeColors;
}> = ({ title, text, colors }) => {
  return (
    <View
      style={[
        styles.insightBox,
        {
          backgroundColor: colors.cardElevated,
          borderColor: withAlpha(colors.primary, '2E'),
        },
      ]}
    >
      <View style={styles.insightHeader}>
        <Ionicons name="bulb-outline" size={20} color={colors.primary} />
        <Text style={[styles.insightTitle, { color: colors.primary }]}>{title}</Text>
      </View>

      <Text style={[styles.insightText, { color: colors.mutedText }]}>{text}</Text>
    </View>
  );
};

export const HomeLoadingState: React.FC<LoadingStateProps> = ({ label, colors }) => {
  return (
    <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.loadingText, { color: colors.primary }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  heroCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 20,
    marginBottom: 18,
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: {
      width: 0,
      height: 14,
    },
    elevation: 8,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 16,
  },
  heroBadge: {
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  heroMetaText: {
    fontSize: 12,
    fontWeight: '700',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  heroIconBox: {
    width: 54,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTextArea: {
    flex: 1,
    marginLeft: 14,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.75,
  },
  progressHeader: {
    marginTop: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.8,
  },
  progressMeta: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressTrack: {
    width: '100%',
    height: 11,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  motivationText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.76,
  },
  mainActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderRadius: 20,
    marginTop: 16,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  mainActionText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '900',
    marginLeft: 14,
    letterSpacing: 0.8,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    minHeight: 132,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  statIconShell: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
    marginTop: 14,
  },
  statLabel: {
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
    fontWeight: '700',
  },
  statTrendRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  statTrendDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  statTrendText: {
    fontSize: 11,
    fontWeight: '700',
  },
  largeCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
  },
  largeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeCardInfo: {
    flex: 1,
    marginLeft: 14,
  },
  largeCardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  largeCardHint: {
    marginTop: 5,
    fontSize: 12,
    opacity: 0.65,
    lineHeight: 18,
  },
  challengeCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  challengeIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  challengeTextBox: {
    flex: 1,
    marginLeft: 12,
  },
  challengeTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  challengeSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
  },
  challengeFooterText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 20,
  },
  lastProductCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
  },
  lastProductHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lastProductHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lastProductHeaderTextWrap: {
    flex: 1,
  },
  lastProductEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  lastProductSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
  },
  lastProductContent: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lastProductImage: {
    width: 60,
    height: 60,
    borderRadius: 16,
    resizeMode: 'cover',
  },
  lastProductBody: {
    flex: 1,
  },
  lastProductBrand: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  lastProductName: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
  },
  lastProductMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  inlineBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '100%',
    alignSelf: 'flex-start',
  },
  inlineBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    flexShrink: 1,
  },
  carouselSection: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 16,
    marginBottom: 18,
  },
  carouselHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  recentList: {
    paddingHorizontal: 18,
    gap: 10,
  },
  recentListItem: {
    minHeight: 78,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recentListTextWrap: {
    flex: 1,
  },
  carouselBrand: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  carouselName: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  quickInsightsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  liveInsightCard: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 20,
    marginBottom: 20,
  },
  liveInsightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  liveInsightMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveInsightNextButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveInsightCounter: {
    fontSize: 12,
    fontWeight: '900',
  },
  liveInsightBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginTop: 18,
  },
  liveInsightIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveInsightTextWrap: {
    flex: 1,
  },
  liveInsightTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  liveInsightText: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 22,
  },
  liveInsightMetaText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  liveInsightFooter: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  liveInsightHelper: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  liveInsightDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveInsightDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  quickInsightCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    padding: 15,
    minHeight: 104,
  },
  quickInsightIconShell: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickInsightValue: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '900',
  },
  quickInsightLabel: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
  },
  quickActionCard: {
    flex: 1,
    minHeight: 168,
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
  },
  quickActionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickActionIconShell: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionArrowShell: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionBody: {
    marginTop: 20,
  },
  quickActionTitle: {
    fontSize: 15,
    fontWeight: '800',
    minHeight: 42,
    lineHeight: 20,
  },
  quickActionText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    minHeight: 58,
  },
  activityCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  activityText: {
    fontSize: 14,
    lineHeight: 22,
  },
  insightBox: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  insightTitle: {
    fontWeight: 'bold',
    fontSize: 15,
    textTransform: 'uppercase',
  },
  insightText: {
    fontSize: 14,
    lineHeight: 22,
  },
  loadingContainer: {
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
});

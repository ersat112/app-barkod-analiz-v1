import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { HistoryEntry } from '../../../services/db';

type ThemeColors = {
  background: string;
  card: string;
  text: string;
  primary: string;
  border: string;
};

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
  fallbackBrand: string;
  fallbackName: string;
  onItemPress: (barcode: string) => void;
  colors: ThemeColors;
};

type QuickInsightsStripProps = {
  items: Array<{
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
  }>;
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
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <Ionicons name={icon} size={24} color={colors.primary} />
      <Text
        style={[styles.quickActionTitle, { color: colors.text }]}
        numberOfLines={2}
      >
        {title}
      </Text>
      <Text
        style={[styles.quickActionText, { color: colors.text }]}
        numberOfLines={3}
      >
        {description}
      </Text>
    </TouchableOpacity>
  );
};

export const StatCard: React.FC<StatCardProps> = ({
  icon,
  value,
  label,
  colors,
}) => {
  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Ionicons name={icon} size={24} color={colors.primary} />
      <Text style={[styles.statValue, { color: colors.primary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.text }]}>{label}</Text>
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
  return (
    <View
      style={[
        styles.heroCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.heroTopRow}>
        <View style={[styles.heroIconBox, { backgroundColor: `${colors.primary}15` }]}>
          <Ionicons name={icon} size={26} color={colors.primary} />
        </View>
        <View style={styles.heroTextArea}>
          <Text style={[styles.heroTitle, { color: colors.text }]} numberOfLines={2}>
            {title}
          </Text>
          <Text
            style={[styles.heroSubtitle, { color: colors.text }]}
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
        <Text style={[styles.progressMeta, { color: colors.text }]}>
          {progressMeta}
        </Text>
      </View>

      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
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

      <Text style={[styles.motivationText, { color: colors.text }]}>
        {motivationText}
      </Text>

      <TouchableOpacity
        style={[styles.mainActionBtn, { backgroundColor: colors.primary }]}
        onPress={onActionPress}
        activeOpacity={0.9}
      >
        <View style={styles.btnContent}>
          <Ionicons name="barcode-outline" size={30} color="#000" />
          <Text style={styles.mainActionText}>{actionLabel.toUpperCase()}</Text>
        </View>
        <Ionicons name="arrow-forward" size={22} color="#000" />
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
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.largeCardHeader}>
        <View style={[styles.iconBox, { backgroundColor: `${colors.primary}15` }]}>
          <Ionicons name={icon} size={26} color={colors.primary} />
        </View>
        <View style={styles.largeCardInfo}>
          <Text style={[styles.largeCardTitle, { color: colors.text }]}>
            {title}
          </Text>
          <Text style={[styles.largeCardHint, { color: colors.text }]}>
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
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.challengeHeader}>
        <View style={[styles.challengeIconBox, { backgroundColor: `${colors.primary}15` }]}>
          <Ionicons name="medal-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.challengeTextBox}>
          <Text style={[styles.challengeTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.challengeSubtitle, { color: colors.text }]}>{subtitle}</Text>
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

      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
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

      <Text style={[styles.challengeFooterText, { color: colors.text }]}>
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
        <View style={[styles.challengeIconBox, { backgroundColor: `${colors.primary}15` }]}>
          <Ionicons name="time-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.challengeTextBox}>
          <Text style={[styles.challengeTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.challengeSubtitle, { color: colors.text }]}>{subtitle}</Text>
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
                {scoreLabel}: {item.score ?? '-'}
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
        <View style={[styles.challengeIconBox, { backgroundColor: `${colors.primary}15` }]}>
          <Ionicons name="albums-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.challengeTextBox}>
          <Text style={[styles.challengeTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.challengeSubtitle, { color: colors.text }]}>{subtitle}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carouselContent}
      >
        {items.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.carouselItem,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
            activeOpacity={0.88}
            onPress={() => onItemPress(item.barcode)}
          >
            <LastProductImage uri={item.image_url} />
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
            <View style={[styles.inlineBadge, { backgroundColor: `${colors.primary}12` }]}>
              <Text style={[styles.inlineBadgeText, { color: colors.primary }]}>
                {item.score ?? '-'} / 100
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Ionicons name={item.icon} size={18} color={colors.primary} />
          <Text style={[styles.quickInsightValue, { color: colors.text }]} numberOfLines={1}>
            {item.value}
          </Text>
          <Text style={[styles.quickInsightLabel, { color: colors.text }]} numberOfLines={2}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
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
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.activityHeader}>
        <Ionicons name={icon} size={20} color={colors.primary} />
        <Text style={[styles.activityTitle, { color: colors.primary }]}>{title}</Text>
      </View>

      <Text style={[styles.activityText, { color: colors.text }]}>{text}</Text>
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
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.insightHeader}>
        <Ionicons name="bulb-outline" size={20} color={colors.primary} />
        <Text style={[styles.insightTitle, { color: colors.primary }]}>{title}</Text>
      </View>

      <Text style={[styles.insightText, { color: colors.text }]}>{text}</Text>
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
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
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
    opacity: 0.55,
  },
  progressTrack: {
    width: '100%',
    height: 10,
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
    shadowColor: '#000',
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
    alignItems: 'flex-start',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
    marginTop: 8,
  },
  statLabel: {
    marginTop: 6,
    fontSize: 12,
    opacity: 0.7,
    lineHeight: 18,
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
    opacity: 0.68,
  },
  challengeFooterText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.75,
  },
  lastProductCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
  },
  lastProductHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastProductContent: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastProductImage: {
    width: 76,
    height: 76,
    borderRadius: 18,
    resizeMode: 'cover',
  },
  lastProductBody: {
    flex: 1,
    marginLeft: 14,
  },
  lastProductBrand: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  lastProductName: {
    marginTop: 4,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 24,
  },
  lastProductMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
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
    borderRadius: 22,
    paddingVertical: 18,
    marginBottom: 18,
  },
  carouselHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  carouselContent: {
    paddingHorizontal: 18,
    gap: 12,
  },
  carouselItem: {
    width: 156,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
  },
  carouselBrand: {
    marginTop: 10,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  carouselName: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    minHeight: 38,
  },
  quickInsightsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  quickInsightCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    minHeight: 92,
  },
  quickInsightValue: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '900',
  },
  quickInsightLabel: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    opacity: 0.7,
  },
  quickActionCard: {
    flex: 1,
    minHeight: 150,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    justifyContent: 'space-between',
  },
  quickActionTitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '800',
    minHeight: 40,
    lineHeight: 20,
  },
  quickActionText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.7,
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
    opacity: 0.8,
  },
  insightBox: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderLeftWidth: 6,
    borderLeftColor: '#FFD700',
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
    opacity: 0.8,
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

import React from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { AnalysisResult, ECodeMatch, Product } from '../../../utils/analysis';

const { width } = Dimensions.get('window');
const FALLBACK_IMAGE = 'https://via.placeholder.com/400?text=No+Image';

type ThemeColors = {
  background: string;
  card: string;
  text: string;
  primary: string;
  border: string;
};

type DisplayProduct = Product & {
  sourceName?: string;
  country?: string;
  origin?: string;
};

type MetaChipItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
};

export const DetailLoadingState: React.FC<{
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

export const DetailErrorState: React.FC<{
  text: string;
  secondaryLabel: string;
  primaryLabel: string;
  onSecondaryPress: () => void;
  onPrimaryPress: () => void;
  retryLabel?: string;
  onRetry?: () => void;
  colors: ThemeColors;
}> = ({
  text,
  secondaryLabel,
  primaryLabel,
  onSecondaryPress,
  onPrimaryPress,
  retryLabel,
  onRetry,
  colors,
}) => {
  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <Ionicons name="alert-circle-outline" size={80} color={colors.border} />
      <Text style={[styles.errorText, { color: colors.text }]}>{text}</Text>

      <View style={styles.errorActions}>
        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: colors.border }]}
          onPress={onSecondaryPress}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
            {secondaryLabel}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={onPrimaryPress}
        >
          <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
        </TouchableOpacity>
      </View>

      {retryLabel && onRetry ? (
        <TouchableOpacity style={styles.retryLink} onPress={onRetry}>
          <Text style={[styles.retryText, { color: colors.primary }]}>{retryLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

export const DetailHeroSection: React.FC<{
  imageUri?: string | null;
  isDark: boolean;
  badgeLabel: string;
  hasActualOrigin: boolean;
  onBack: () => void;
  onShare: () => void;
  onImageError: () => void;
  colors: ThemeColors;
}> = ({
  imageUri,
  isDark,
  badgeLabel,
  hasActualOrigin,
  onBack,
  onShare,
  onImageError,
  colors,
}) => {
  return (
    <View
      style={[
        styles.imageSection,
        { backgroundColor: isDark ? '#111' : '#F8F8F8' },
      ]}
    >
      <Image
        source={{ uri: imageUri || FALLBACK_IMAGE }}
        style={styles.productImage}
        onError={onImageError}
      />

      <View style={styles.headerActions}>
        <TouchableOpacity style={styles.iconBtn} onPress={onBack}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconBtn} onPress={onShare}>
          <Ionicons name="share-social-outline" size={26} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.originBadge}>
        <Ionicons
          name={hasActualOrigin ? 'flag-outline' : 'barcode-outline'}
          size={14}
          color="#FFF"
        />
        <Text style={styles.originText} numberOfLines={1}>
          {badgeLabel}
        </Text>
      </View>
    </View>
  );
};

export const ProductHeadingSection: React.FC<{
  brand: string;
  name: string;
  colors: ThemeColors;
}> = ({ brand, name, colors }) => {
  return (
    <>
      <Text style={[styles.brandName, { color: colors.primary }]} numberOfLines={1}>
        {brand}
      </Text>

      <Text style={[styles.productName, { color: colors.text }]} numberOfLines={3}>
        {name}
      </Text>
    </>
  );
};

export const MetaChipsSection: React.FC<{
  items: MetaChipItem[];
  colors: ThemeColors;
}> = ({ items, colors }) => {
  return (
    <View style={styles.metaRow}>
      {items.map((item) => (
        <View
          key={`${item.icon}-${item.label}`}
          style={[
            styles.metaChip,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Ionicons name={item.icon} size={14} color={colors.primary} />
          <Text
            style={[styles.metaChipText, { color: colors.text }]}
            numberOfLines={1}
          >
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
};

export const NoticeCard: React.FC<{
  text: string;
  colors: ThemeColors;
}> = ({ text, colors }) => {
  return (
    <View
      style={[
        styles.noticeCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
      <Text style={[styles.noticeText, { color: colors.text }]}>{text}</Text>
    </View>
  );
};

export const ScoreOverviewCard: React.FC<{
  score: number;
  grade: string;
  analysis: AnalysisResult;
  colors: ThemeColors;
}> = ({ score, grade, analysis, colors }) => {
  return (
    <View
      style={[
        styles.scoreCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.scoreCircle,
          {
            borderColor: analysis.color,
            backgroundColor: `${analysis.color}15`,
          },
        ]}
      >
        <Text style={[styles.scoreNumber, { color: analysis.color }]}>{score}</Text>
        <Text style={[styles.scoreOverHundred, { color: colors.text }]}>/100</Text>
      </View>

      <View style={styles.scoreInfo}>
        <View
          style={[
            styles.gradeBadge,
            {
              backgroundColor: analysis.color,
            },
          ]}
        >
          <Text style={styles.gradeBadgeText}>{grade}</Text>
        </View>

        <Text style={[styles.scoreRiskTitle, { color: analysis.color }]}>
          {`${analysis.riskLevel.toUpperCase()} RİSK`}
        </Text>

        <Text style={[styles.scoreRecommendation, { color: colors.text }]}>
          {analysis.recommendation}
        </Text>
      </View>
    </View>
  );
};

export const SummarySection: React.FC<{
  title: string;
  text: string;
  colors: ThemeColors;
}> = ({ title, text, colors }) => {
  return (
    <View style={styles.summaryBox}>
      <Text style={[styles.summaryTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.summaryText, { color: colors.text }]}>{text}</Text>
    </View>
  );
};

export const AdditivesSection: React.FC<{
  title: string;
  emptyLabel: string;
  items: ECodeMatch[];
  analysisColor: string;
  unknownLabel: string;
  colors: ThemeColors;
}> = ({ title, emptyLabel, items, analysisColor, unknownLabel, colors }) => {
  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>

        <View style={[styles.countBadge, { backgroundColor: analysisColor }]}>
          <Text style={styles.countText}>{items.length}</Text>
        </View>
      </View>

      {items.length ? (
        items.map((item, index) => {
          const isHighRisk = String(item.risk || '').toLowerCase() === 'yüksek';
          const riskColor = isHighRisk ? '#FF4444' : '#FFD700';

          return (
            <View
              key={`${item.code}-${index}`}
              style={[
                styles.additiveItem,
                {
                  backgroundColor: colors.card,
                  borderLeftColor: riskColor,
                },
              ]}
            >
              <View style={styles.additiveMain}>
                <Text
                  style={[styles.additiveName, { color: colors.text }]}
                  numberOfLines={2}
                >
                  {item.code} - {item.name}
                </Text>

                <Text style={[styles.additiveRisk, { color: riskColor }]}>
                  {item.risk || unknownLabel}
                </Text>
              </View>

              <Text style={[styles.additiveImpact, { color: colors.text }]}>
                {String(item.impact || '')}
              </Text>
            </View>
          );
        })
      ) : (
        <View style={styles.cleanContentBox}>
          <Ionicons name="shield-checkmark-outline" size={50} color="#1ED760" />
          <Text style={[styles.cleanText, { color: colors.text }]}>{emptyLabel}</Text>
        </View>
      )}
    </>
  );
};

export const TextSection: React.FC<{
  title: string;
  text: string;
  colors: ThemeColors;
}> = ({ title, text, colors }) => {
  return (
    <>
      <Text style={[styles.sectionTitle, styles.textSectionTitle, { color: colors.text }]}>
        {title}
      </Text>

      <View
        style={[
          styles.textBox,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.textBoxText, { color: colors.text }]}>{text}</Text>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 4,
  },
  imageSection: {
    width,
    height: 380,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImage: {
    width: '80%',
    height: '80%',
    resizeMode: 'contain',
  },
  headerActions: {
    position: 'absolute',
    top: 55,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconBtn: {
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  originBadge: {
    position: 'absolute',
    bottom: 25,
    left: 25,
    right: 25,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  originText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 6,
    flex: 1,
  },
  brandName: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  productName: {
    fontSize: 28,
    fontWeight: '900',
    marginTop: 5,
    marginBottom: 18,
    lineHeight: 34,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
    maxWidth: '100%',
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.8,
  },
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 22,
  },
  scoreCircle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
  },
  scoreOverHundred: {
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.7,
    marginTop: 2,
  },
  scoreInfo: {
    flex: 1,
    marginLeft: 18,
    justifyContent: 'center',
  },
  gradeBadge: {
    alignSelf: 'flex-start',
    minWidth: 48,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  gradeBadgeText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '900',
  },
  scoreRiskTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 6,
  },
  scoreRecommendation: {
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.82,
  },
  summaryBox: {
    marginBottom: 26,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 13,
    lineHeight: 21,
    opacity: 0.75,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '900',
  },
  textSectionTitle: {
    marginTop: 35,
  },
  countBadge: {
    marginLeft: 12,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countText: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  additiveItem: {
    padding: 20,
    borderRadius: 22,
    marginBottom: 15,
    borderLeftWidth: 6,
  },
  additiveMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 12,
  },
  additiveName: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
  },
  additiveRisk: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  additiveImpact: {
    fontSize: 13,
    lineHeight: 22,
    opacity: 0.7,
  },
  cleanContentBox: {
    alignItems: 'center',
    padding: 45,
    gap: 15,
  },
  cleanText: {
    fontWeight: '800',
    fontSize: 16,
    textAlign: 'center',
  },
  textBox: {
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  textBoxText: {
    fontSize: 14,
    lineHeight: 26,
    opacity: 0.72,
  },
  errorText: {
    marginTop: 25,
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  errorActions: {
    flexDirection: 'row',
    marginTop: 35,
    gap: 12,
  },
  primaryBtn: {
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 22,
  },
  primaryBtnText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 1,
  },
  secondaryBtn: {
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 22,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 1,
  },
  retryLink: {
    marginTop: 16,
  },
  retryText: {
    fontWeight: '700',
    fontSize: 14,
  },
});
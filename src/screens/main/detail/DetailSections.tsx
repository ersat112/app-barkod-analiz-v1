import React from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ThemeColors } from '../../../context/ThemeContext';
import type { ECodeMatch } from '../../../utils/analysis';
import { withAlpha } from '../../../utils/color';

const { width } = Dimensions.get('window');
const FALLBACK_IMAGE = 'https://via.placeholder.com/400?text=No+Image';

type MetaChipItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
};

type ShareAction = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  accentColor: string;
  onPress: () => void;
};

type ActionLinkItem = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  helper?: string;
  onPress: () => void;
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
  riskLabel: string;
  recommendationText: string;
  analysisColor: string;
  colors: ThemeColors;
}> = ({ score, grade, riskLabel, recommendationText, analysisColor, colors }) => {
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
            borderColor: analysisColor,
            backgroundColor: `${analysisColor}15`,
          },
        ]}
      >
        <Text style={[styles.scoreNumber, { color: analysisColor }]}>{score}</Text>
        <Text style={[styles.scoreOverHundred, { color: colors.text }]}>/100</Text>
      </View>

      <View style={styles.scoreInfo}>
        <View
          style={[
            styles.gradeBadge,
            {
              backgroundColor: analysisColor,
            },
          ]}
        >
          <Text style={styles.gradeBadgeText}>{grade}</Text>
        </View>

        <Text style={[styles.scoreRiskTitle, { color: analysisColor }]}>
          {riskLabel.toUpperCase()}
        </Text>

        <Text style={[styles.scoreRecommendation, { color: colors.text }]}>
          {recommendationText}
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
  formatRiskLabel?: (risk?: string | null) => string;
  colors: ThemeColors;
}> = ({
  title,
  emptyLabel,
  items,
  analysisColor,
  unknownLabel,
  formatRiskLabel,
  colors,
}) => {
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
          const normalizedRisk = String(item.risk || '')
            .trim()
            .toLowerCase();
          const isHighRisk = normalizedRisk === 'yüksek' || normalizedRisk === 'high';
          const isLowRisk = normalizedRisk === 'düşük' || normalizedRisk === 'low';
          const riskColor = isHighRisk ? '#FF4444' : isLowRisk ? '#1ED760' : '#FFD700';

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
                  {formatRiskLabel?.(typeof item.risk === 'string' ? item.risk : null) ||
                    item.risk ||
                    unknownLabel}
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

export const ShareSheet: React.FC<{
  title: string;
  subtitle: string;
  closeLabel: string;
  previewTitle: string;
  previewSubtitle: string;
  previewBody: string;
  actions: ShareAction[];
  onClose: () => void;
  colors: ThemeColors;
}> = ({
  title,
  subtitle,
  closeLabel,
  previewTitle,
  previewSubtitle,
  previewBody,
  actions,
  onClose,
  colors,
}) => {
  return (
    <View
      style={[
        styles.shareSheetCard,
        {
          backgroundColor: colors.cardElevated,
          borderColor: withAlpha(colors.border, 'C8'),
          shadowColor: colors.shadow,
        },
      ]}
    >
      <View style={styles.shareSheetHeader}>
        <View style={styles.shareSheetHeaderTextWrap}>
          <Text style={[styles.shareSheetTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.shareSheetSubtitle, { color: colors.mutedText }]}>
            {subtitle}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.shareSheetCloseButton,
            {
              backgroundColor: withAlpha(colors.background, 'CC'),
              borderColor: withAlpha(colors.border, 'B8'),
            },
          ]}
          onPress={onClose}
          activeOpacity={0.86}
        >
          <Ionicons name="close" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.sharePreviewCard,
          {
            backgroundColor: withAlpha(colors.backgroundMuted, 'F2'),
            borderColor: withAlpha(colors.border, 'B8'),
          },
        ]}
      >
        <Text style={[styles.sharePreviewTitle, { color: colors.text }]} numberOfLines={2}>
          {previewTitle}
        </Text>
        <Text
          style={[styles.sharePreviewSubtitle, { color: colors.primary }]}
          numberOfLines={1}
        >
          {previewSubtitle}
        </Text>
        <Text
          style={[styles.sharePreviewBody, { color: colors.mutedText }]}
          numberOfLines={4}
        >
          {previewBody}
        </Text>
      </View>

      <View style={styles.shareActionsGrid}>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.key}
            style={[
              styles.shareActionCard,
              {
                backgroundColor: withAlpha(colors.background, 'E8'),
                borderColor: withAlpha(colors.border, 'B8'),
              },
            ]}
            onPress={action.onPress}
            activeOpacity={0.9}
          >
            <View
              style={[
                styles.shareActionIconWrap,
                { backgroundColor: withAlpha(action.accentColor, '18') },
              ]}
            >
              <Ionicons name={action.icon} size={22} color={action.accentColor} />
            </View>

            <Text style={[styles.shareActionTitle, { color: colors.text }]}>
              {action.title}
            </Text>
            <Text style={[styles.shareActionSubtitle, { color: colors.mutedText }]}>
              {action.subtitle}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[
          styles.shareCloseCta,
          {
            backgroundColor: withAlpha(colors.primary, '12'),
            borderColor: withAlpha(colors.primary, '2C'),
          },
        ]}
        onPress={onClose}
        activeOpacity={0.88}
      >
        <Text style={[styles.shareCloseCtaText, { color: colors.primary }]}>
          {closeLabel}
        </Text>
      </TouchableOpacity>
    </View>
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

export const ActionLinksSection: React.FC<{
  title: string;
  items: ActionLinkItem[];
  colors: ThemeColors;
}> = ({ title, items, colors }) => {
  if (!items.length) {
    return null;
  }

  return (
    <>
      <Text style={[styles.sectionTitle, styles.textSectionTitle, { color: colors.text }]}>
        {title}
      </Text>

      <View style={styles.actionLinksWrap}>
        {items.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[
              styles.actionLinkCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={item.onPress}
            activeOpacity={0.88}
          >
            <View
              style={[
                styles.actionLinkIconWrap,
                { backgroundColor: withAlpha(colors.primary, '16') },
              ]}
            >
              <Ionicons name={item.icon} size={18} color={colors.primary} />
            </View>

            <View style={styles.actionLinkTextWrap}>
              <Text style={[styles.actionLinkLabel, { color: colors.text }]}>
                {item.label}
              </Text>

              {item.helper ? (
                <Text style={[styles.actionLinkHelper, { color: colors.mutedText }]}>
                  {item.helper}
                </Text>
              ) : null}
            </View>

            <Ionicons name="open-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
        ))}
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
  actionLinksWrap: {
    gap: 12,
    marginBottom: 24,
  },
  actionLinkCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionLinkIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLinkTextWrap: {
    flex: 1,
  },
  actionLinkLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  actionLinkHelper: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
  },
  shareSheetCard: {
    width: '100%',
    borderRadius: 28,
    borderWidth: 1,
    padding: 20,
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: {
      width: 0,
      height: 18,
    },
    elevation: 14,
  },
  shareSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  shareSheetHeaderTextWrap: {
    flex: 1,
  },
  shareSheetTitle: {
    fontSize: 22,
    fontWeight: '900',
  },
  shareSheetSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
  },
  shareSheetCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharePreviewCard: {
    marginTop: 18,
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
  },
  sharePreviewTitle: {
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 24,
  },
  sharePreviewSubtitle: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  sharePreviewBody: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
  },
  shareActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 18,
  },
  shareActionCard: {
    width: '48%',
    minHeight: 140,
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
  },
  shareActionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareActionTitle: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '900',
  },
  shareActionSubtitle: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
  },
  shareCloseCta: {
    marginTop: 18,
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareCloseCtaText: {
    fontSize: 14,
    fontWeight: '900',
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

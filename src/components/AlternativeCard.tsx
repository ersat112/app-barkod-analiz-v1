import React from 'react';
import {
  Image,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../context/ThemeContext';

type AlternativeCardProps = {
  title: string;
  brand?: string;
  subtitle?: string;
  imageUrl?: string;
  score?: number | null;
  grade?: string;
  badgeText?: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const getScoreColor = (score?: number | null): string => {
  if (typeof score !== 'number') return '#999999';
  if (score >= 75) return '#1ED760';
  if (score >= 45) return '#F5A623';
  return '#FF4D4F';
};

const getResolvedGrade = (grade?: string, score?: number | null): string => {
  const raw = String(grade || '').trim().toUpperCase();

  if (['A', 'B', 'C', 'D', 'E'].includes(raw)) {
    return raw;
  }

  if (typeof score !== 'number') {
    return 'N/A';
  }

  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 35) return 'D';
  return 'E';
};

export const AlternativeCard: React.FC<AlternativeCardProps> = ({
  title,
  brand,
  subtitle,
  imageUrl,
  score,
  grade,
  badgeText,
  onPress,
  disabled = false,
  style,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const tt = (key: string, fallback: string) => {
    const value = t(key, { defaultValue: fallback });
    return value === key ? fallback : value;
  };

  const scoreColor = getScoreColor(score);
  const resolvedGrade = getResolvedGrade(grade, score);
  const isPressable = !!onPress && !disabled;

  return (
    <TouchableOpacity
      activeOpacity={isPressable ? 0.86 : 1}
      disabled={!isPressable}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: disabled ? 0.7 : 1,
        },
        style,
      ]}
    >
      <View style={styles.left}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} />
        ) : (
          <View
            style={[
              styles.imageFallback,
              { backgroundColor: `${colors.primary}12` },
            ]}
          >
            <Ionicons name="leaf-outline" size={24} color={colors.primary} />
          </View>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <View
            style={[
              styles.badge,
              { backgroundColor: `${colors.primary}14` },
            ]}
          >
            <Text style={[styles.badgeText, { color: colors.primary }]}>
              {badgeText || tt('alternative_badge', 'Öneri')}
            </Text>
          </View>

          <View style={styles.rightBadges}>
            {typeof score === 'number' ? (
              <View
                style={[
                  styles.scoreBadge,
                  { backgroundColor: `${scoreColor}18` },
                ]}
              >
                <Text style={[styles.scoreText, { color: scoreColor }]}>
                  {Math.round(score)}/100
                </Text>
              </View>
            ) : null}

            <View
              style={[
                styles.gradeBadge,
                { backgroundColor: `${scoreColor}14` },
              ]}
            >
              <Text style={[styles.gradeBadgeText, { color: scoreColor }]}>
                {resolvedGrade}
              </Text>
            </View>
          </View>
        </View>

        {!!brand && (
          <Text
            style={[styles.brand, { color: colors.primary }]}
            numberOfLines={1}
          >
            {brand}
          </Text>
        )}

        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {title}
        </Text>

        {!!subtitle && (
          <Text
            style={[styles.subtitle, { color: colors.text }]}
            numberOfLines={3}
          >
            {subtitle}
          </Text>
        )}

        <View style={styles.footerRow}>
          <Text style={[styles.footerHint, { color: colors.text }]} numberOfLines={1}>
            {tt('better_option_hint', 'Daha iyi seçenek önerisi')}
          </Text>

          <Ionicons
            name={isPressable ? 'chevron-forward' : 'sparkles-outline'}
            size={18}
            color={colors.border}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
  },
  left: {
    marginRight: 14,
  },
  image: {
    width: 74,
    height: 74,
    borderRadius: 16,
    resizeMode: 'cover',
  },
  imageFallback: {
    width: 74,
    height: 74,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    minHeight: 74,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: 120,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  rightBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  scoreText: {
    fontSize: 11,
    fontWeight: '900',
  },
  gradeBadge: {
    minWidth: 34,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeBadgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  brand: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.74,
  },
  footerRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  footerHint: {
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.7,
    flex: 1,
  },
});
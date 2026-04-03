import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ThemeColors } from '../context/ThemeContext';
import { withAlpha } from '../utils/color';

type ScreenOnboardingOverlayProps = {
  visible: boolean;
  title: string;
  body: string;
  actionLabel: string;
  colors: ThemeColors;
  icon?: keyof typeof Ionicons.glyphMap;
  progressLabel?: string;
  onPress: () => void;
};

export const ScreenOnboardingOverlay: React.FC<ScreenOnboardingOverlayProps> = ({
  visible,
  title,
  body,
  actionLabel,
  colors,
  icon = 'sparkles-outline',
  progressLabel,
  onPress,
}) => {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.overlay}>
      <View style={[styles.scrim, { backgroundColor: 'rgba(8,10,16,0.72)' }]} />

      <View
        style={[
          styles.card,
          {
            backgroundColor: withAlpha(colors.card, 'FC'),
            borderColor: withAlpha(colors.border, 'BC'),
            shadowColor: colors.shadow,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={[styles.iconWrap, { backgroundColor: withAlpha(colors.primary, '14') }]}>
            <Ionicons name={icon} size={18} color={colors.primary} />
          </View>

          <View style={styles.headerTextWrap}>
            {progressLabel ? (
              <Text style={[styles.progressLabel, { color: colors.primary }]}>{progressLabel}</Text>
            ) : null}
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          </View>
        </View>

        <Text style={[styles.body, { color: colors.mutedText }]}>{body}</Text>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          activeOpacity={0.9}
          onPress={onPress}
        >
          <Text style={[styles.actionText, { color: colors.primaryContrast }]}>{actionLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 40,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: '100%',
    borderRadius: 28,
    borderWidth: 1,
    padding: 20,
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 24,
  },
  body: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 22,
  },
  actionButton: {
    marginTop: 18,
    borderRadius: 18,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '900',
  },
});

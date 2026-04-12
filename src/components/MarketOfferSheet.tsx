import React from 'react';
import {
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  buildMarketMonogram,
  resolveMarketAccent,
  resolveMarketLogoUrl,
} from '../config/marketBranding';
import type { ThemeColors } from '../context/ThemeContext';
import { withAlpha } from '../utils/color';

type MarketOfferSheetDetail = {
  key: string;
  label: string;
  value: string;
};

type MarketOfferSheetAction = {
  key: string;
  label: string;
  onPress: () => void;
  iconName?: keyof typeof Ionicons.glyphMap;
  tone?: 'primary' | 'teal';
};

type MarketOfferSheetProps = {
  visible: boolean;
  title: string;
  subtitle: string;
  marketName?: string | null;
  marketKey?: string | null;
  marketLogoUrl?: string | null;
  details: MarketOfferSheetDetail[];
  actions?: MarketOfferSheetAction[];
  onClose: () => void;
  colors: ThemeColors;
  isDark?: boolean;
};

const MarketBadge: React.FC<{
  marketName?: string | null;
  marketKey?: string | null;
  logoUrl?: string | null;
  size?: number;
}> = ({ marketName, marketKey, logoUrl, size = 42 }) => {
  const accent = resolveMarketAccent(marketKey, marketName);
  const monogram = buildMarketMonogram(marketName);
  const stableLogoUrl = resolveMarketLogoUrl(marketKey, marketName, logoUrl);

  if (stableLogoUrl) {
    return (
      <Image
        source={{ uri: stableLogoUrl }}
        style={[
          styles.marketLogoImage,
          {
            width: size,
            height: size,
            borderRadius: Math.round(size * 0.3),
          },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.marketMonogramBadge,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.3),
          backgroundColor: withAlpha(accent, '22'),
          borderColor: withAlpha(accent, '66'),
        },
      ]}
    >
      <Text style={[styles.marketMonogramText, { color: accent }]}>{monogram}</Text>
    </View>
  );
};

export const MarketOfferSheet: React.FC<MarketOfferSheetProps> = ({
  visible,
  title,
  subtitle,
  marketName,
  marketKey,
  marketLogoUrl,
  details,
  actions = [],
  onClose,
  colors,
  isDark = false,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.wrap}>
          <View
            style={[
              styles.card,
              {
                backgroundColor: withAlpha(colors.cardElevated, isDark ? 'F4' : 'FC'),
                borderColor: withAlpha(colors.border, 'BC'),
                shadowColor: colors.shadow,
              },
            ]}
          >
            <View
              style={[
                styles.handle,
                { backgroundColor: withAlpha(colors.border, 'A8') },
              ]}
            />

            <View style={styles.header}>
              <View style={styles.headerMain}>
                <MarketBadge
                  marketKey={marketKey}
                  marketName={marketName || title}
                  logoUrl={marketLogoUrl}
                  size={42}
                />
                <View style={styles.headerTextWrap}>
                  <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                  <Text style={[styles.subtitle, { color: colors.mutedText }]}>{subtitle}</Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={onClose}
                style={[
                  styles.closeButton,
                  {
                    backgroundColor: withAlpha(colors.backgroundMuted, isDark ? '96' : 'F2'),
                    borderColor: withAlpha(colors.border, 'B8'),
                  },
                ]}
              >
                <Ionicons name="close-outline" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.detailsWrap,
                { borderTopColor: withAlpha(colors.border, '80') },
              ]}
            >
              {details.map((detail) => (
                <View
                  key={detail.key}
                  style={[
                    styles.detailRow,
                    { borderBottomColor: withAlpha(colors.border, '80') },
                  ]}
                >
                  <Text style={[styles.detailLabel, { color: colors.mutedText }]}>
                    {detail.label}
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {detail.value}
                  </Text>
                </View>
              ))}
            </View>

            {actions.length ? (
              <View style={styles.actions}>
                {actions.map((action) => {
                  const toneColor = action.tone === 'teal' ? colors.teal : colors.primary;

                  return (
                    <TouchableOpacity
                      key={action.key}
                      activeOpacity={0.88}
                      onPress={action.onPress}
                      style={[
                        styles.actionButton,
                        {
                          backgroundColor: withAlpha(toneColor, '12'),
                          borderColor: withAlpha(toneColor, '38'),
                        },
                      ]}
                    >
                      {action.iconName ? (
                        <Ionicons name={action.iconName} size={16} color={toneColor} />
                      ) : null}
                      <Text style={[styles.actionLabel, { color: toneColor }]}>
                        {action.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.36)',
  },
  wrap: {
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  card: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 18,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 999,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  headerMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerTextWrap: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 18,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  detailValue: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  actionButton: {
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  marketLogoImage: {
    backgroundColor: '#E5E7EB',
  },
  marketMonogramBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  marketMonogramText: {
    fontSize: 12,
    fontWeight: '900',
  },
});

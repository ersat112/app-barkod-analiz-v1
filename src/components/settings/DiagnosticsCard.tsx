import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type {
  DiagnosticsPill,
  DiagnosticsPillTone,
  DiagnosticsRow,
} from '../../types/diagnostics';

export type DiagnosticsCardColors = {
  card: string;
  text: string;
  border: string;
  primary: string;
};

type DiagnosticsCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  colors: DiagnosticsCardColors;
  loading?: boolean;
  refreshing?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  pills?: DiagnosticsPill[];
  rows?: DiagnosticsRow[];
};

function getPillPalette(
  tone: DiagnosticsPillTone,
  colors: DiagnosticsCardColors
): { backgroundColor: string; textColor: string } {
  switch (tone) {
    case 'success':
      return {
        backgroundColor: `${colors.primary}14`,
        textColor: colors.primary,
      };

    case 'danger':
      return {
        backgroundColor: '#FF444414',
        textColor: '#FF4444',
      };

    case 'neutral':
    default:
      return {
        backgroundColor: `${colors.border}55`,
        textColor: colors.text,
      };
  }
}

export const DiagnosticsCard: React.FC<DiagnosticsCardProps> = ({
  icon,
  title,
  subtitle,
  colors,
  loading = false,
  refreshing = false,
  error = null,
  onRefresh,
  pills = [],
  rows = [],
}) => {
  const hasContent = pills.length > 0 || rows.length > 0;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor: `${colors.primary}15`,
              },
            ]}
          >
            <Ionicons name={icon} size={20} color={colors.primary} />
          </View>

          <View style={styles.headerTextWrap}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: colors.text }]}>{subtitle}</Text>
          </View>
        </View>

        {onRefresh ? (
          <TouchableOpacity
            style={[
              styles.refreshButton,
              refreshing && styles.refreshButtonDisabled,
              {
                borderColor: colors.border,
                backgroundColor: `${colors.primary}10`,
              },
            ]}
            onPress={onRefresh}
            disabled={refreshing}
            activeOpacity={0.85}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="refresh" size={18} color={colors.primary} />
            )}
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}

      {!loading && hasContent ? (
        <>
          {pills.length > 0 ? (
            <View style={styles.pillsRow}>
              {pills.map((pill) => {
                const palette = getPillPalette(pill.tone ?? 'neutral', colors);

                return (
                  <View
                    key={pill.label}
                    style={[
                      styles.pill,
                      {
                        backgroundColor: palette.backgroundColor,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        {
                          color: palette.textColor,
                        },
                      ]}
                    >
                      {pill.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          {rows.length > 0 ? (
            <View style={styles.grid}>
              {rows.map((row) => (
                <View key={row.label} style={styles.row}>
                  <Text style={[styles.label, { color: colors.text }]}>{row.label}</Text>
                  <Text style={[styles.value, { color: colors.text }]}>{row.value}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTextWrap: {
    flex: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.62,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButtonDisabled: {
    opacity: 0.7,
  },
  loadingWrap: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
    marginBottom: 14,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  grid: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  label: {
    flex: 1,
    fontSize: 13,
    opacity: 0.72,
  },
  value: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  errorText: {
    marginTop: 14,
    color: '#FF4444',
    fontSize: 12,
    fontWeight: '700',
  },
});
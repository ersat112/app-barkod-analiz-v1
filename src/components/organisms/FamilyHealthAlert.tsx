import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../context/ThemeContext';

export type FamilyHealthAlertItem = {
  id: string;
  title: string;
  description: string;
  severity?: 'info' | 'warning' | 'danger' | 'success';
};

type FamilyHealthAlertProps = {
  items?: FamilyHealthAlertItem[];
  style?: StyleProp<ViewStyle>;
};

const getAlertMeta = (
  severity: FamilyHealthAlertItem['severity'],
  primary: string
): {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
} => {
  switch (severity) {
    case 'danger':
      return {
        icon: 'alert-circle',
        color: '#FF4D4F',
        bg: 'rgba(255,77,79,0.12)',
      };
    case 'warning':
      return {
        icon: 'warning',
        color: '#F5A623',
        bg: 'rgba(245,166,35,0.14)',
      };
    case 'success':
      return {
        icon: 'checkmark-circle',
        color: '#1ED760',
        bg: 'rgba(30,215,96,0.14)',
      };
    case 'info':
    default:
      return {
        icon: 'information-circle',
        color: primary,
        bg: `${primary}14`,
      };
  }
};

export const FamilyHealthAlert: React.FC<FamilyHealthAlertProps> = ({
  items = [],
  style,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const tt = (key: string, fallback: string) => {
    const value = t(key, { defaultValue: fallback });
    return value === key ? fallback : value;
  };

  if (!items.length) {
    return null;
  }

  return (
    <View style={[styles.wrapper, style]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        {tt('family_health_alerts', 'Aile ve Hassas Kullanım Uyarıları')}
      </Text>

      {items.map((item) => {
        const meta = getAlertMeta(item.severity, colors.primary);

        return (
          <View
            key={item.id}
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
              <Ionicons name={meta.icon} size={22} color={meta.color} />
            </View>

            <View style={styles.content}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
                {item.title}
              </Text>

              <Text style={[styles.description, { color: colors.text }]}>
                {item.description}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 2,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 20,
  },
  description: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.78,
  },
});
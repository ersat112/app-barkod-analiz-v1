import React, { useCallback, useMemo } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { AmbientBackdrop } from '../../components/ui/AmbientBackdrop';
import { useAppScreenLayout } from '../../components/layout/useAppScreenLayout';
import { useTheme } from '../../context/ThemeContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { buildHelpArticle } from '../../services/helpCenterContent.service';
import { withAlpha } from '../../utils/color';

type HelpArticleRoute = RouteProp<RootStackParamList, 'HelpArticle'>;

export const HelpArticleScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<HelpArticleRoute>();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const layout = useAppScreenLayout({
    topInsetExtra: 16,
    topInsetMin: 32,
    contentBottomExtra: 28,
    contentBottomMin: 40,
    horizontalPadding: 24,
  });

  const tt = useCallback(
    (key: string, fallback: string) => {
      const value = t(key, { defaultValue: fallback });
      return value === key ? fallback : value;
    },
    [t]
  );

  const article = useMemo(
    () => buildHelpArticle(route.params.articleKey, tt),
    [route.params.articleKey, tt]
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AmbientBackdrop colors={colors} variant="settings" />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: layout.headerTopPadding,
          paddingBottom: layout.contentBottomPadding,
          paddingHorizontal: layout.horizontalPadding,
        }}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[
              styles.backButton,
              {
                backgroundColor: withAlpha(colors.cardElevated, 'F0'),
                borderColor: withAlpha(colors.border, 'BC'),
              },
            ]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.86}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.headerTextWrap}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>
              {tt('help_center_eyebrow', 'Yardım Merkezi')}
            </Text>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{article.title}</Text>
          </View>
        </View>

        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: withAlpha(colors.card, isDark ? 'F2' : 'FC'),
              borderColor: withAlpha(colors.border, 'BC'),
              shadowColor: colors.shadow,
            },
          ]}
        >
          <Text style={[styles.heroSubtitle, { color: colors.mutedText }]}>
            {article.subtitle}
          </Text>
        </View>

        <View style={styles.sectionList}>
          {article.sections.map((section) => (
            <View
              key={section.key}
              style={[
                styles.sectionCard,
                {
                  backgroundColor: withAlpha(colors.cardElevated, 'F0'),
                  borderColor: withAlpha(colors.border, 'BC'),
                },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
              <Text style={[styles.sectionBody, { color: colors.mutedText }]}>{section.body}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerTitle: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 22,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 24,
  },
  sectionList: {
    marginTop: 24,
    gap: 12,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  sectionBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
  },
});

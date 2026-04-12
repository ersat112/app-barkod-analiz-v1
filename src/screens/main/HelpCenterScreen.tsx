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
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { AmbientBackdrop } from '../../components/ui/AmbientBackdrop';
import { useAppScreenLayout } from '../../components/layout/useAppScreenLayout';
import { useTheme, type ThemeColors } from '../../context/ThemeContext';
import { withAlpha } from '../../utils/color';

type HelpMenuItem = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
};

const HelpMenuCard: React.FC<HelpMenuItem & { colors: ThemeColors }> = ({
  icon,
  title,
  subtitle,
  onPress,
  colors,
}) => (
  <TouchableOpacity
    style={[
      styles.card,
      {
        backgroundColor: withAlpha(colors.cardElevated, 'F0'),
        borderColor: withAlpha(colors.border, 'BC'),
        shadowColor: colors.shadow,
      },
    ]}
    onPress={onPress}
    activeOpacity={0.88}
  >
    <View style={[styles.iconWrap, { backgroundColor: withAlpha(colors.primary, '14') }]}>
      <Ionicons name={icon} size={18} color={colors.primary} />
    </View>
    <View style={styles.cardTextWrap}>
      <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.cardSubtitle, { color: colors.mutedText }]}>{subtitle}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={colors.primary} />
  </TouchableOpacity>
);

export const HelpCenterScreen: React.FC = () => {
  const navigation = useNavigation<any>();
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

  const menuItems = useMemo<HelpMenuItem[]>(
    () => [
      {
        key: 'basics',
        icon: 'apps-outline',
        title: tt('help_center_basics_title', 'BarkodAnaliz Nasıl Çalışır?'),
        subtitle: tt(
          'help_center_basics_subtitle',
          'Tarama, skor, fiyat ve geçmiş akışının temel mantığını görün.'
        ),
        onPress: () => navigation.navigate('HelpArticle', { articleKey: 'appBasics' }),
      },
      {
        key: 'methodology',
        icon: 'flask-outline',
        title: tt('help_center_methodology_title', 'Skor Nasıl Üretilir?'),
        subtitle: tt(
          'help_center_methodology_subtitle',
          'Gıda, kozmetik ve ilaç metodolojisini kaynaklarıyla birlikte açın.'
        ),
        onPress: () => navigation.navigate('MethodologySources'),
      },
      {
        key: 'nutri-score',
        icon: 'nutrition-outline',
        title: tt('help_center_nutri_score_title', 'Nutri-Score ve Besin Dengesi'),
        subtitle: tt(
          'help_center_nutri_score_subtitle',
          'A-E etiketi, besin dengesi ve OCR sınırlarını uygulama içinden okuyun.'
        ),
        onPress: () => navigation.navigate('HelpArticle', { articleKey: 'nutriScore' }),
      },
      {
        key: 'sensitivities',
        icon: 'warning-outline',
        title: tt('help_center_sensitivities_title', 'Hassas Maddeler ve Aile Profili'),
        subtitle: tt(
          'help_center_sensitivities_subtitle',
          'Alerjenler, katkı takibi ve kişisel uygunluk katmanı nasıl çalışıyor?'
        ),
        onPress: () => navigation.navigate('HelpArticle', { articleKey: 'sensitivities' }),
      },
      {
        key: 'database',
        icon: 'server-outline',
        title: tt('help_center_database_title', 'Veritabanı ve Kaynaklar'),
        subtitle: tt(
          'help_center_database_subtitle',
          'Open Food Facts, Open Beauty Facts, TITCK ve market_gelsin zincirini inceleyin.'
        ),
        onPress: () => navigation.navigate('HelpArticle', { articleKey: 'database' }),
      },
      {
        key: 'google-signin',
        icon: 'logo-google',
        title: tt('help_center_google_title', 'Google ile Giriş'),
        subtitle: tt(
          'help_center_google_subtitle',
          'Google oturumu, Firebase kimlik doğrulaması ve hata durumlarını görün.'
        ),
        onPress: () => navigation.navigate('HelpArticle', { articleKey: 'googleSignIn' }),
      },
      {
        key: 'ads',
        icon: 'megaphone-outline',
        title: tt('help_center_ads_title', 'Reklamlar ve Premium'),
        subtitle: tt(
          'help_center_ads_subtitle',
          'Banner, geçiş, ödüllü reklam ve premium modelini birlikte okuyun.'
        ),
        onPress: () => navigation.navigate('HelpArticle', { articleKey: 'adsAndPremium' }),
      },
      {
        key: 'medical',
        icon: 'medkit-outline',
        title: tt('help_center_medical_title', 'Güvenlik ve Tıbbi Sınırlar'),
        subtitle: tt(
          'help_center_medical_subtitle',
          'Hangi yüzeyler yönlendiricidir, hangi alanlarda resmi belge gerekir?'
        ),
        onPress: () => navigation.navigate('LegalDocument', { documentKey: 'medical' }),
      },
      {
        key: 'independence',
        icon: 'shield-checkmark-outline',
        title: tt('help_center_independence_title', 'Bağımsızlık'),
        subtitle: tt(
          'help_center_independence_subtitle',
          'Skor, öneri ve sıralama mantığının nasıl bağımsız kaldığını görün.'
        ),
        onPress: () => navigation.navigate('LegalDocument', { documentKey: 'independence' }),
      },
      {
        key: 'premium',
        icon: 'diamond-outline',
        title: tt('help_center_premium_title', 'Premium Nasıl Çalışır?'),
        subtitle: tt(
          'help_center_premium_subtitle',
          'Reklamsız kullanım, market optimizasyonu ve premium sınırlarını öğrenin.'
        ),
        onPress: () => navigation.navigate('LegalDocument', { documentKey: 'premium' }),
      },
    ],
    [navigation, tt]
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
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {tt('help_center_title', 'Uygulama nasıl çalışıyor?')}
            </Text>
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
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            {tt('help_center_hero_title', 'Skor, fiyat ve güven aynı menüde')}
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.mutedText }]}>
            {tt(
              'help_center_hero_subtitle',
              'Bu menü, Yuka benzeri yardım merkezi mantığıyla BarkodAnaliz yüzeylerini; metodoloji, hassas maddeler, güvenlik ve bağımsızlık başlıklarında toplar.'
            )}
          </Text>
        </View>

        <View style={styles.listWrap}>
          {menuItems.map((item) => (
            <HelpMenuCard
              key={item.key}
              icon={item.icon}
              title={item.title}
              subtitle={item.subtitle}
              onPress={item.onPress}
              colors={colors}
            />
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
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
  },
  heroSubtitle: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
  },
  listWrap: {
    marginTop: 26,
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  cardSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
  },
});

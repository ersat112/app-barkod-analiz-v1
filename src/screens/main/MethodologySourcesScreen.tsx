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
import * as WebBrowser from 'expo-web-browser';

import { useTheme } from '../../context/ThemeContext';
import { useAppScreenLayout } from '../../components/layout/useAppScreenLayout';
import { AmbientBackdrop } from '../../components/ui/AmbientBackdrop';
import { BEAUTY_INGREDIENT_RISK_UPDATES } from '../../services/beautyIngredientsData';
import { ADDITIVE_RISK_UPDATES } from '../../services/eCodesData';
import { SCIENTIFIC_SOURCE_RECORDS } from '../../services/scientificSourcesData';
import { withAlpha } from '../../utils/color';

const WHO_FOPNL_GUIDANCE_URL =
  'https://apps.who.int/iris/bitstream/handle/10665/336988/WHO-EURO-2020-1569-41320-56234-eng.pdf?sequence=1&isAllowed=y';
const OPEN_FOOD_FACTS_URL = 'https://world.openfoodfacts.org';
const OPEN_BEAUTY_FACTS_URL = 'https://world.openbeautyfacts.org';
const TITCK_PORTAL_URL = 'https://www.titck.gov.tr/kubkt';

type PrincipleCard = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
};

type SourceLinkCard = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
};

export const MethodologySourcesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const layout = useAppScreenLayout({
    topInsetExtra: 18,
    topInsetMin: 72,
    contentBottomExtra: 42,
    contentBottomMin: 96,
  });
  const { t } = useTranslation();

  const tt = useCallback(
    (key: string, fallback: string) => {
      const value = t(key, { defaultValue: fallback });
      return value === key ? fallback : value;
    },
    [t]
  );

  const openUrl = useCallback(async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      });
    } catch (error) {
      console.warn('[MethodologySourcesScreen] failed to open source URL:', error);
    }
  }, []);

  const principleCards = useMemo<PrincipleCard[]>(
    () => [
      {
        key: 'explainable',
        icon: 'sparkles-outline',
        title: tt('methodology_principle_explainable_title', 'Açıklanabilir skor'),
        body: tt(
          'methodology_principle_explainable_body',
          'Toplam puan tek başına bırakılmaz; besinsel kalite, işlenme seviyesi, katkı veya içerik sinyalleri ayrı ayrı gösterilir.'
        ),
      },
      {
        key: 'transparency',
        icon: 'eye-outline',
        title: tt('methodology_principle_transparency_title', 'Veri şeffaflığı'),
        body: tt(
          'methodology_principle_transparency_body',
          'Eksik veri varsa sistem bunu gizlemez; sınırlı veri, eksik sinyal ve yönlendirici yorum notları açıkça gösterilir.'
        ),
      },
      {
        key: 'independence',
        icon: 'shield-outline',
        title: tt('methodology_principle_independence_title', 'Bağımsızlık'),
        body: tt(
          'methodology_principle_independence_body',
          'Skor mantığı reklam veya marka sponsorluklarına göre şekillenmez; amaç kullanıcıyı veriye dayalı olarak yönlendirmektir.'
        ),
      },
      {
        key: 'official',
        icon: 'document-text-outline',
        title: tt('methodology_principle_official_title', 'Resmi kayıt önceliği'),
        body: tt(
          'methodology_principle_official_body',
          'İlaç gibi yüksek güven gerektiren yüzeylerde topluluk verisi yerine resmi kayıt, prospektüs ve düzenleyici belge zinciri esas alınır.'
        ),
      },
      {
        key: 'scientific-governance',
        icon: 'flask-outline',
        title: tt(
          'methodology_principle_scientific_title',
          'Bilimsel yönetişim'
        ),
        body: tt(
          'methodology_principle_scientific_body',
          'Nutri-Score gibi modeller yalnız skor üretmez; kamu sağlığı çerçevesi, bilimsel komite değerlendirmesi ve kanıta dayalı algoritma güncellemeleriyle birlikte okunur.'
        ),
      },
    ],
    [tt]
  );

  const sourceLinks = useMemo<SourceLinkCard[]>(
    () => [
      {
        key: 'off',
        icon: 'restaurant-outline',
        title: tt('methodology_link_off_title', 'Open Food Facts'),
        subtitle: tt(
          'methodology_link_off_subtitle',
          'Gıda ürün kaydı, Nutri-Score alanları ve içerik verisi.'
        ),
        onPress: () => {
          void openUrl(OPEN_FOOD_FACTS_URL);
        },
      },
      {
        key: 'obf',
        icon: 'flower-outline',
        title: tt('methodology_link_obf_title', 'Open Beauty Facts'),
        subtitle: tt(
          'methodology_link_obf_subtitle',
          'Kozmetik ürün kaydı ve içerik verisi.'
        ),
        onPress: () => {
          void openUrl(OPEN_BEAUTY_FACTS_URL);
        },
      },
      {
        key: 'nutri-score',
        icon: 'reader-outline',
        title: tt('methodology_link_nutri_title', 'Nutri-Score Özeti'),
        subtitle: tt(
          'methodology_link_nutri_subtitle',
          'A-E etiketi, besin dengesi ve OCR sınırlarını uygulama içinden açıklar.'
        ),
        onPress: () => navigation.navigate('HelpArticle', { articleKey: 'nutriScore' }),
      },
      {
        key: 'who',
        icon: 'globe-outline',
        title: tt('methodology_link_who_title', 'WHO Rehberi'),
        subtitle: tt(
          'methodology_link_who_subtitle',
          'Ambalaj önü beslenme etiketlemesine ilişkin WHO kılavuzu.'
        ),
        onPress: () => {
          void openUrl(WHO_FOPNL_GUIDANCE_URL);
        },
      },
      {
        key: 'titck',
        icon: 'medkit-outline',
        title: tt('methodology_link_titck_title', 'TITCK Portalı'),
        subtitle: tt(
          'methodology_link_titck_subtitle',
          'İlaç kayıtları, prospektüs ve KÜB belgeleri.'
        ),
        onPress: () => {
          void openUrl(TITCK_PORTAL_URL);
        },
      },
    ],
    [navigation, openUrl, tt]
  );

  const scientificInstitutionCards = useMemo(
    () =>
      SCIENTIFIC_SOURCE_RECORDS.map((item) => ({
        key: item.key,
        title: item.title,
        body: item.scope,
        url: item.url,
      })),
    []
  );

  const categoryCards = useMemo(
    () => [
      {
        key: 'food',
        title: tt('methodology_food_title', 'Gıda'),
        body: tt(
          'methodology_food_body',
          'Gıda ürünlerinde toplam skor resmi besin puanı veya ürün derecesi taban alınarak oluşturulur; bunlar yoksa çözümlenen besin tablosu alanlarından yerel besinsel taban üretilir. Katkı sinyalleri skoru aşağı çekebilir; NOVA işlenme seviyesi ise daha düşük ağırlıklı ikinci bir sinyal olarak toplam skora kontrollü biçimde yansır.'
        ),
        chips: [
          tt('food_signal_nutrition_title', 'Besinsel kalite'),
          tt('food_signal_processing_title', 'İşlenme seviyesi'),
          tt('food_signal_additives_title', 'Katkı riski'),
          tt('methodology_chip_front_label', 'A-E ön yüz etiketi'),
        ],
      },
      {
        key: 'beauty',
        title: tt('methodology_beauty_title', 'Kozmetik'),
        body: tt(
          'methodology_beauty_body',
          'Kozmetik yorumunda ürün kaydı, içerik metni ve yerel içerik risk kayıt defteri birlikte değerlendirilir; sistem ihtiyatlı bir kullanıcı özeti ve Yuka benzeri risk tavanları üretir.'
        ),
        chips: [
          tt('source_tag_ingredient_scan', 'İçerik taraması'),
          tt('source_tag_precautionary', 'İhtiyat ilkesi'),
          tt('methodology_signal_usage', 'kullanım bilgisi'),
        ],
      },
      {
        key: 'medicine',
        title: tt('methodology_medicine_title', 'İlaç'),
        body: tt(
          'methodology_medicine_body',
          'İlaç ekranı genel bilgi amaçlıdır; veri resmi TITCK kayıtlarından ve varsa prospektüs/KÜB belgelerinden çözümlenir.'
        ),
        chips: [
          tt('scientific_tag_official_record', 'Resmi kayıt'),
          tt('scientific_tag_regulatory_document', 'Düzenleyici belge'),
        ],
      },
    ],
    [tt]
  );

  const riskUpdateCards = useMemo(
    () => [
      ...ADDITIVE_RISK_UPDATES.slice(0, 3).map((item) => ({
        key: `additive-${item.code}-${item.date}`,
        title: `${item.code} • ${item.name}`,
        body: `${item.date} • ${
          item.previousRisk ? `${item.previousRisk} → ${item.nextRisk}` : item.nextRisk
        } • ${item.note}`,
      })),
      ...BEAUTY_INGREDIENT_RISK_UPDATES.slice(0, 3).map((item) => ({
        key: `beauty-${item.ingredient}-${item.date}`,
        title: item.ingredient,
        body: `${item.date} • ${
          item.previousRisk ? `${item.previousRisk} → ${item.nextRisk}` : item.nextRisk
        } • ${item.note}`,
      })),
    ],
    []
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AmbientBackdrop colors={colors} variant="settings" />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView
        style={styles.container}
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
            <Text style={[styles.heroEyebrow, { color: colors.primary }]}>
              {tt('methodology_sources', 'Metodoloji ve Kaynaklar')}
            </Text>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {tt('methodology_sources_screen_title', 'Skor sistemi nasıl çalışıyor?')}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: withAlpha(colors.card, isDark ? 'F1' : 'FC'),
              borderColor: withAlpha(colors.border, 'BC'),
              shadowColor: colors.shadow,
            },
          ]}
        >
          <Text style={[styles.heroEyebrow, { color: colors.primary }]}>
            {tt('methodology_sources', 'Metodoloji ve Kaynaklar')}
          </Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            {tt(
              'methodology_sources_screen_title',
              'Skor sistemi nasıl çalışıyor?'
            )}
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.mutedText }]}>
            {tt(
              'methodology_sources_screen_subtitle',
              'Bu ekran; BarkodAnaliz skorlarının hangi veri sınıflarıyla üretildiğini, hangi kaynaklara dayandığını ve yorum sınırlarını özetler.'
            )}
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {tt('methodology_principles', 'Temel İlkeler')}
        </Text>

        <View style={styles.cardList}>
          {principleCards.map((item) => (
            <View
              key={item.key}
              style={[
                styles.infoCard,
                {
                  backgroundColor: withAlpha(colors.cardElevated, 'EE'),
                  borderColor: withAlpha(colors.border, 'B8'),
                  shadowColor: colors.shadow,
                },
              ]}
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: withAlpha(colors.primary, '12') },
                ]}
              >
                <Ionicons name={item.icon} size={18} color={colors.primary} />
              </View>
              <Text style={[styles.infoCardTitle, { color: colors.text }]}>
                {item.title}
              </Text>
              <Text style={[styles.infoCardBody, { color: colors.mutedText }]}>
                {item.body}
              </Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {tt('methodology_categories', 'Kategori Bazlı Model')}
        </Text>

        <View style={styles.cardList}>
          {categoryCards.map((item) => (
            <View
              key={item.key}
              style={[
                styles.infoCard,
                {
                  backgroundColor: withAlpha(colors.cardElevated, 'EE'),
                  borderColor: withAlpha(colors.border, 'B8'),
                  shadowColor: colors.shadow,
                },
              ]}
            >
              <Text style={[styles.infoCardTitle, { color: colors.text }]}>
                {item.title}
              </Text>
              <Text style={[styles.infoCardBody, { color: colors.mutedText }]}>
                {item.body}
              </Text>

              <View style={styles.chipRow}>
                {item.chips.map((chip) => (
                  <View
                    key={chip}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: withAlpha(colors.primary, '10'),
                        borderColor: withAlpha(colors.primary, '24'),
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: colors.primary }]}>
                      {chip}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {tt('scientific_sources_title', 'Kaynaklar')}
        </Text>

        <View style={styles.cardList}>
          {sourceLinks.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.sourceCard,
                {
                  backgroundColor: withAlpha(colors.cardElevated, 'EE'),
                  borderColor: withAlpha(colors.border, 'B8'),
                  shadowColor: colors.shadow,
                },
              ]}
              onPress={item.onPress}
              activeOpacity={0.88}
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: withAlpha(colors.primary, '12') },
                ]}
              >
                <Ionicons name={item.icon} size={18} color={colors.primary} />
              </View>

              <View style={styles.sourceTextWrap}>
                <Text style={[styles.infoCardTitle, { color: colors.text }]}>
                  {item.title}
                </Text>
                <Text style={[styles.infoCardBody, { color: colors.mutedText }]}>
                  {item.subtitle}
                </Text>
              </View>

              <Ionicons name="open-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {tt('scientific_institutions_title', 'Bilimsel Kurumlar')}
        </Text>

        <View style={styles.cardList}>
          {scientificInstitutionCards.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.sourceCard,
                {
                  backgroundColor: withAlpha(colors.cardElevated, 'EE'),
                  borderColor: withAlpha(colors.border, 'B8'),
                  shadowColor: colors.shadow,
                },
              ]}
              onPress={() => {
                if (item.url) {
                  void openUrl(item.url);
                }
              }}
              activeOpacity={0.88}
            >
              <View style={styles.sourceTextWrap}>
                <Text style={[styles.infoCardTitle, { color: colors.text }]}>
                  {item.title}
                </Text>
                <Text style={[styles.infoCardBody, { color: colors.mutedText }]}>
                  {item.body}
                </Text>
                {item.url ? (
                  <Text style={[styles.sourceUrlText, { color: colors.primary }]}>
                    {item.url}
                  </Text>
                ) : null}
              </View>
              {item.url ? (
                <Ionicons name="open-outline" size={18} color={colors.primary} />
              ) : null}
            </TouchableOpacity>
          ))}
        </View>

        {riskUpdateCards.length ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {tt('risk_update_summary_title', 'Risk Değişiklik Özeti')}
            </Text>

            <View style={styles.cardList}>
              {riskUpdateCards.map((item) => (
                <View
                  key={item.key}
                  style={[
                    styles.infoCard,
                    {
                      backgroundColor: withAlpha(colors.cardElevated, 'EE'),
                      borderColor: withAlpha(colors.border, 'B8'),
                      shadowColor: colors.shadow,
                    },
                  ]}
                >
                  <Text style={[styles.infoCardTitle, { color: colors.text }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.infoCardBody, { color: colors.mutedText }]}>
                    {item.body}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <View
          style={[
            styles.footerCard,
            {
              backgroundColor: withAlpha(colors.card, isDark ? 'F1' : 'FC'),
              borderColor: withAlpha(colors.border, 'BC'),
            },
          ]}
        >
          <Text style={[styles.footerTitle, { color: colors.text }]}>
            {tt('methodology_limits_title', 'Yorum Sınırları')}
          </Text>
          <Text style={[styles.footerText, { color: colors.mutedText }]}>
            {tt(
              'methodology_limits_body',
              'BarkodAnaliz; kullanıcıyı yönlendiren veri-temelli bir analiz yüzeyi sunar. Tıbbi tanı, tedavi veya düzenleyici karar yerine geçmez; özellikle ilaç ve hassas sağlık kararlarında resmi belge ve sağlık profesyoneli görüşü esas alınmalıdır.'
            )}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
    marginLeft: 14,
  },
  headerTitle: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 22,
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: {
      width: 0,
      height: 14,
    },
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: '900',
  },
  heroSubtitle: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 12,
    fontSize: 19,
    fontWeight: '900',
  },
  cardList: {
    gap: 12,
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 12,
    },
  },
  sourceCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 12,
    },
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  infoCardBody: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  sourceTextWrap: {
    flex: 1,
  },
  sourceUrlText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
  },
  footerCard: {
    marginTop: 24,
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
  },
  footerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  footerText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
  },
});

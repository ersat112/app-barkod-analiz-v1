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
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import type { RootStackParamList } from '../../navigation/AppNavigator';
import { AmbientBackdrop } from '../../components/ui/AmbientBackdrop';
import { useAppScreenLayout } from '../../components/layout/useAppScreenLayout';
import { useTheme } from '../../context/ThemeContext';
import { withAlpha } from '../../utils/color';

type LegalDocumentKey =
  | 'terms'
  | 'privacy'
  | 'medical'
  | 'premium'
  | 'independence';

type LegalSection = {
  key: string;
  title: string;
  body: string;
};

type LegalDocumentContent = {
  icon: keyof typeof Ionicons.glyphMap;
  eyebrow: string;
  title: string;
  subtitle: string;
  sections: LegalSection[];
};

const DOCUMENT_ICON_MAP: Record<LegalDocumentKey, keyof typeof Ionicons.glyphMap> = {
  terms: 'document-text-outline',
  privacy: 'shield-checkmark-outline',
  medical: 'medkit-outline',
  premium: 'diamond-outline',
  independence: 'compass-outline',
};

export const LegalDocumentScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'LegalDocument'>>();
  const { documentKey } = route.params;
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const layout = useAppScreenLayout({
    topInsetExtra: 18,
    topInsetMin: 72,
    contentBottomExtra: 42,
    contentBottomMin: 96,
  });

  const tt = useCallback(
    (key: string, fallback: string) => {
      const value = t(key, { defaultValue: fallback });
      return value === key ? fallback : value;
    },
    [t]
  );

  const documentContent = useMemo<LegalDocumentContent>(() => {
    const commonEyebrow = tt('legal_documents', 'Yasal Belgeler');

    const getContent = (key: LegalDocumentKey): LegalDocumentContent => {
      switch (key) {
        case 'terms':
          return {
            icon: DOCUMENT_ICON_MAP[key],
            eyebrow: commonEyebrow,
            title: tt('terms_and_conditions', 'Şartlar ve Koşullar'),
            subtitle: tt(
              'legal_terms_subtitle',
              'BarkodAnaliz kullanımı; Türkiye Cumhuriyeti hukuku, tüketici mevzuatı ve ürün verisinin sınırları çerçevesinde bilgi amaçlı bir hizmet olarak yürür.'
            ),
            sections: [
              {
                key: 'acceptance',
                title: tt('legal_terms_acceptance_title', 'Kullanım ve kabul'),
                body: tt(
                  'legal_terms_acceptance_body',
                  'Uygulamayı kullanmak; BarkodAnaliz hizmetinin bilgi amaçlı analiz sunduğunu, mutlak doğruluk veya sağlık sonucu garantisi vermediğini ve ürün içeriğini doğrudan ambalaj veya resmi belge üzerinden kontrol etme sorumluluğunu ortadan kaldırmadığını kabul etmek anlamına gelir.'
                ),
              },
              {
                key: 'data',
                title: tt('legal_terms_data_title', 'Veri ve içerik sınırları'),
                body: tt(
                  'legal_terms_data_body',
                  'BarkodAnaliz verileri açık veri tabanları, kullanıcı katkıları, marka tarafından sağlanan etiket bilgileri ve BarkodAnaliz kürasyonu üzerinden oluşabilir. Etiket değişiklikleri, eksik alanlar veya tespit hataları oluşabilir; bu nedenle hizmet Türk tüketici mevzuatındaki ön bilgilendirme mantığına uygun olarak yönlendirici nitelikte değerlendirilmelidir.'
                ),
              },
              {
                key: 'user',
                title: tt('legal_terms_user_title', 'Kullanıcı hesabı ve katkılar'),
                body: tt(
                  'legal_terms_user_body',
                  'Kullanıcılar yalnızca hak sahibi oldukları bilgi ve görselleri eklemeli, kasıtlı yanlış veri girmemeli ve topluluk katkılarının moderasyona tabi olduğunu kabul etmelidir.'
                ),
              },
              {
                key: 'limits',
                title: tt('legal_terms_limits_title', 'Skor ve öneri sınırları'),
                body: tt(
                  'legal_terms_limits_body',
                  'Skorlar ve alternatif öneriler; BarkodAnaliz metodolojisine göre oluşturulan yönlendirici değerlendirmelerdir. Bir ürünün yasak, tehlikeli ya da herkese otomatik olarak uygun olduğu anlamına gelmez.'
                ),
              },
              {
                key: 'dispute',
                title: tt('legal_terms_dispute_title', 'Uyuşmazlık ve başvuru yolları'),
                body: tt(
                  'legal_terms_dispute_body',
                  'Nihai metinlerde uygulanacak hukuk ve yetkili merciler Türkiye Cumhuriyeti hukuku çerçevesinde belirlenmelidir. Tüketici işlemlerine ilişkin uyuşmazlıklarda 6502 sayılı Kanun kapsamındaki başvuru yolları, koşullara göre tüketici hakem heyetleri ve tüketici mahkemeleri dahil değerlendirilmelidir.'
                ),
              },
            ],
          };
        case 'privacy':
          return {
            icon: DOCUMENT_ICON_MAP[key],
            eyebrow: commonEyebrow,
            title: tt('privacy_policy', 'Gizlilik Politikası'),
            subtitle: tt(
              'legal_privacy_subtitle',
              'BarkodAnaliz, hesabınız ve uygulama içi tercihlerinizi 6698 sayılı Kişisel Verilerin Korunması Kanunu çerçevesinde hizmeti çalıştırmak için gerekli en düşük kapsamda işlemeyi hedefler.'
            ),
            sections: [
              {
                key: 'collect',
                title: tt('legal_privacy_collect_title', 'Toplanan veriler'),
                body: tt(
                  'legal_privacy_collect_body',
                  'Hesap oluşturduğunuzda kimlik ve iletişim bilgileri, uygulama tercihleri, tarama geçmişi ve ürün katkıları gibi hizmeti çalıştıran veriler saklanabilir. Nihai Aydınlatma Metni, KVKK kapsamındaki veri kategorileri, amaçlar, hukuki sebepler ve aktarım başlıklarını açıkça göstermelidir.'
                ),
              },
              {
                key: 'use',
                title: tt('legal_privacy_use_title', 'Verilerin kullanım amacı'),
                body: tt(
                  'legal_privacy_use_body',
                  'Bu veriler; hesabı sürdürmek, tarama sonuçlarını hızlandırmak, tercihlerinizi cihazlar arasında eşitlemek, önerileri iyileştirmek ve destek taleplerini yanıtlamak için kullanılır.'
                ),
              },
              {
                key: 'sale',
                title: tt('legal_privacy_sale_title', 'Ne yapmıyoruz'),
                body: tt(
                  'legal_privacy_sale_body',
                  'BarkodAnaliz kullanıcı verilerini satmayı, ürün sıralamasını sponsorlu ödeme ile değiştirmeyi veya özel tercihleri reklamveren etkisine göre yönlendirmeyi hedeflemez.'
                ),
              },
              {
                key: 'control',
                title: tt('legal_privacy_control_title', 'Kontrol ve silme'),
                body: tt(
                  'legal_privacy_control_body',
                  'Kullanıcı kendi hesabını, tercihlerinin önemli bir kısmını ve izin verdiği bildirim ayarlarını uygulama üzerinden yönetebilir. Nihai hukuk paketinde, KVKK madde 11 kapsamındaki başvuru ve veri sahibi hakları için açık destek ve başvuru akışı tanımlanmalıdır.'
                ),
              },
            ],
          };
        case 'medical':
          return {
            icon: DOCUMENT_ICON_MAP[key],
            eyebrow: commonEyebrow,
            title: tt('medical_disclaimer', 'Tıbbi ve Bilgilendirme Uyarısı'),
            subtitle: tt(
              'legal_medical_subtitle',
              'BarkodAnaliz sağlık profesyoneli yerine geçmez; ürün ve ilaç ekranları yalnızca genel bilgilendirme amaçlıdır ve tıbbi danışmanlık sayılmaz.'
            ),
            sections: [
              {
                key: 'advice',
                title: tt('legal_medical_advice_title', 'Tıbbi tavsiye değildir'),
                body: tt(
                  'legal_medical_advice_body',
                  'Uygulama; tanı, tedavi, reçete, doz ayarı veya klinik karar desteği sağlamaz. Doktor, eczacı, diyetisyen veya resmi sağlık otoritesi görüşünün yerine geçmez.'
                ),
              },
              {
                key: 'verify',
                title: tt('legal_medical_verify_title', 'Etiket ve prospektüs doğrulaması'),
                body: tt(
                  'legal_medical_verify_body',
                  'Alerji, intolerans, hamilelik, çocuk kullanımı, kronik hastalıklar ve ilaç etkileşimleri gibi hassas durumlarda ürün etiketleri ve resmi prospektüs/KÜB belgeleri doğrudan kontrol edilmelidir.'
                ),
              },
              {
                key: 'preferences',
                title: tt('legal_medical_preferences_title', 'Beslenme tercihleri sınırı'),
                body: tt(
                  'legal_medical_preferences_body',
                  'Glutensiz, laktozsuz, vegan veya benzeri kişisel uygunluk uyarıları veriye dayalı yönlendirici sinyallerdir. Özellikle ciddi alerji veya çölyak gibi durumlarda tek karar aracı olarak kullanılmamalıdır.'
                ),
              },
              {
                key: 'medicine',
                title: tt('legal_medical_medicine_title', 'İlaç bilgisi kapsamı'),
                body: tt(
                  'legal_medical_medicine_body',
                  'İlaç ekranlarında gösterilen kullanım özeti, resmi kayıt ve prospektüslerden türetilmiş genel açıklamadır. Son karar için tam prospektüs ve sağlık profesyoneli görüşü esas alınmalıdır.'
                ),
              },
            ],
          };
        case 'premium':
          return {
            icon: DOCUMENT_ICON_MAP[key],
            eyebrow: commonEyebrow,
            title: tt('premium_terms', 'Premium Koşulları'),
            subtitle: tt(
              'legal_premium_subtitle',
              'Premium özellikler ek araçlar sağlar; Türk tüketici mevzuatı, ilgili mağaza kuralları ve satın alma anındaki ön bilgilendirme metni birlikte değerlendirilmelidir.'
            ),
            sections: [
              {
                key: 'scope',
                title: tt('legal_premium_scope_title', 'Premium kapsamı'),
                body: tt(
                  'legal_premium_scope_body',
                  'Premium; çevrimdışı erişim, arama, beslenme tercihleri ve benzeri ek yüzeyler sağlayabilir. Sunulan özelliklerin kapsamı uygulama içi planda açıkça belirtilmelidir.'
                ),
              },
              {
                key: 'billing',
                title: tt('legal_premium_billing_title', 'Ücretlendirme ve yenileme'),
                body: tt(
                  'legal_premium_billing_body',
                  'Abonelik ücretlendirmesi, yenileme ve iptal akışı Apple App Store, Google Play veya ilgili ödeme sağlayıcısının kuralları ile birlikte Türk tüketici mevzuatındaki ön bilgilendirme ve abonelik sözleşmesi ilkelerine uygun biçimde açıklanmalıdır.'
                ),
              },
              {
                key: 'withdrawal',
                title: tt('legal_premium_withdrawal_title', 'Cayma ve istisnalar'),
                body: tt(
                  'legal_premium_withdrawal_body',
                  'Dijital içerik ve süreli erişim niteliğindeki premium hizmetlerde cayma hakkı ve istisnaları, satın alma anındaki güncel hukuk metninde açıkça gösterilmelidir. Nihai metin, ilgili mağaza ve yürürlükteki mevzuata göre ayrıca doğrulanmalıdır.'
                ),
              },
              {
                key: 'restore',
                title: tt('legal_premium_restore_title', 'Geri yükleme ve hesap eşleşmesi'),
                body: tt(
                  'legal_premium_restore_body',
                  'Satın alma ve geri yükleme işlemleri ilgili mağaza hesabı, cihaz durumu ve BarkodAnaliz kimlik eşleşmesine bağlıdır. Premium erişim; üçüncü taraf mağaza sorunlarını tek başına çözmez.'
                ),
              },
              {
                key: 'guarantee',
                title: tt('legal_premium_guarantee_title', 'Ne garanti edilmez'),
                body: tt(
                  'legal_premium_guarantee_body',
                  'Premium satın alma; tıbbi sonuç, ürün bulunabilirliği, tüm barkodların kapsanması veya her cihazda kesintisiz çalışma garantisi vermez.'
                ),
              },
            ],
          };
        case 'independence':
        default:
          return {
            icon: DOCUMENT_ICON_MAP[key],
            eyebrow: commonEyebrow,
            title: tt('independence_policy', 'Bağımsızlık Politikası'),
            subtitle: tt(
              'legal_independence_subtitle',
              'BarkodAnaliz; ürün skorları ve alternatif öneriler üzerinde marka etkisini azaltan, açıklanabilir ve bağımsız bir model hedefler.'
            ),
            sections: [
              {
                key: 'revenue',
                title: tt('legal_independence_revenue_title', 'Gelir modeli'),
                body: tt(
                  'legal_independence_revenue_body',
                  'BarkodAnaliz için tercih edilen sürdürülebilir model; premium gelir, açıkça beyan edilen hizmet gelirleri ve marka etkisinden bağımsız ürün mantığıdır.'
                ),
              },
              {
                key: 'ranking',
                title: tt('legal_independence_ranking_title', 'Sponsorlu sıralama yok'),
                body: tt(
                  'legal_independence_ranking_body',
                  'Bir markanın ödeme yapması, ürün skorunu, alternatif ürün listesine girişini veya kategori içi görünürlüğünü değiştirmemelidir.'
                ),
              },
              {
                key: 'alternatives',
                title: tt('legal_independence_alternatives_title', 'Alternatif öneri mantığı'),
                body: tt(
                  'legal_independence_alternatives_body',
                  'Alternatifler; kategori yakınlığı, veri kalitesi, kullanıcı tercihi, daha iyi skor ve ürün erişilebilirliği gibi sinyallerle seçilmelidir.'
                ),
              },
              {
                key: 'sources',
                title: tt('legal_independence_sources_title', 'Kaynak ve moderasyon'),
                body: tt(
                  'legal_independence_sources_body',
                  'Açık veri tabanları, paylaşılan önbellek, kullanıcı katkısı ve kürasyon birlikte kullanılabilir; ancak her katkı, şeffaf kaynak zinciri ve moderasyon kurallarıyla desteklenmelidir.'
                ),
              },
            ],
          };
      }
    };

    return getContent(documentKey);
  }, [documentKey, tt]);

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
              {tt('legal_documents', 'Yasal Belgeler')}
            </Text>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {documentContent.title}
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
          <View
            style={[styles.heroIconWrap, { backgroundColor: withAlpha(colors.primary, '16') }]}
          >
            <Ionicons
              name={documentContent.icon}
              size={24}
              color={colors.primary}
            />
          </View>
          <Text style={[styles.heroEyebrow, { color: colors.primary }]}>
            {documentContent.eyebrow}
          </Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            {documentContent.title}
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.mutedText }]}>
            {documentContent.subtitle}
          </Text>
        </View>

        <View style={styles.cardList}>
          {documentContent.sections.map((section) => (
            <View
              key={section.key}
              style={[
                styles.sectionCard,
                {
                  backgroundColor: withAlpha(colors.cardElevated, 'F2'),
                  borderColor: withAlpha(colors.border, 'BC'),
                  shadowColor: colors.shadow,
                },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {section.title}
              </Text>
              <Text style={[styles.sectionBody, { color: colors.mutedText }]}>
                {section.body}
              </Text>
            </View>
          ))}
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
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 24,
    marginBottom: 18,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 3,
  },
  heroIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
  },
  heroSubtitle: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 22,
  },
  cardList: {
    gap: 14,
  },
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 18,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 22,
  },
});

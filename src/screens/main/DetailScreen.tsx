import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { fetchProductByBarcode } from '../../api/productResolver';
import { useTheme } from '../../context/ThemeContext';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { saveProductToHistory } from '../../services/db';
import { useScanStore } from '../../store/useScanStore';
import { analyzeProduct, type AnalysisResult, type Product } from '../../utils/analysis';
import { barcodeDecoder } from '../../utils/barcodeDecoder';

import { AdBanner } from '../../components/AdBanner';
import { AlternativeCard } from '../../components/AlternativeCard';
import { FamilyHealthAlert } from '../../components/organisms/FamilyHealthAlert';

const { width } = Dimensions.get('window');
const FALLBACK_IMAGE = 'https://via.placeholder.com/400?text=No+Image';

type DetailRoute = RouteProp<RootStackParamList, 'Detail'>;

type DisplayProduct = Product & {
  sourceName?: string;
  country?: string;
  origin?: string;
};

const scoreToGrade = (score: number): 'A' | 'B' | 'C' | 'D' | 'E' => {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 35) return 'D';
  return 'E';
};

const normalizeOriginText = (value?: string | null): string => {
  if (!value) return 'Menşei yok';

  return value
    .replace(/en:/gi, '')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const DetailScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<DetailRoute>();

  const tt = useCallback(
    (key: string, fallback: string) => {
      const value = t(key, { defaultValue: fallback });
      return value === key ? fallback : value;
    },
    [t]
  );

  const { barcode } = route.params;
  const { setAnalysis, currentProduct, currentAnalysis } = useScanStore();

  const normalizedRouteBarcode = useMemo(
    () => String(barcode || '').replace(/[^\d]/g, '').trim(),
    [barcode]
  );

  const isCurrentBarcodeInStore = currentProduct?.barcode === normalizedRouteBarcode;

  const [loading, setLoading] = useState(!isCurrentBarcodeInStore);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const [localProduct, setLocalProduct] = useState<Product | null>(
    isCurrentBarcodeInStore ? currentProduct : null
  );
  const [localAnalysis, setLocalAnalysis] = useState<AnalysisResult | null>(
    isCurrentBarcodeInStore ? currentAnalysis : null
  );

  const lastResolvedBarcodeRef = useRef<string | null>(null);
  const lastSavedHistoryKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (isCurrentBarcodeInStore && currentProduct) {
      setLocalProduct(currentProduct);
      setLocalAnalysis(currentAnalysis ?? null);
      setLoading(false);
      setError(null);
      lastResolvedBarcodeRef.current = normalizedRouteBarcode;
    }
  }, [
    currentAnalysis,
    currentProduct,
    isCurrentBarcodeInStore,
    normalizedRouteBarcode,
  ]);

  const originInfo = useMemo(
    () => barcodeDecoder.decode(normalizedRouteBarcode),
    [normalizedRouteBarcode]
  );

  const displayedProduct = localProduct;
  const displayedAnalysis = localAnalysis;
  const extendedProduct = displayedProduct as DisplayProduct | null;
  const analysisColor = displayedAnalysis?.color ?? '#888';

  const productImageUri = imageError
    ? FALLBACK_IMAGE
    : displayedProduct?.image_url || FALLBACK_IMAGE;

  const sourceLabel = useMemo(() => {
    if (!extendedProduct?.sourceName) return tt('source_unknown', 'Bilinmeyen Kaynak');

    return extendedProduct.sourceName === 'openfoodfacts'
      ? 'Open Food Facts'
      : 'Open Beauty Facts';
  }, [extendedProduct?.sourceName, tt]);

  const resolvedOriginLabel = useMemo(() => {
    const raw =
      extendedProduct?.origin ||
      extendedProduct?.country ||
      originInfo.country ||
      tt('international', 'Uluslararası');

    return normalizeOriginText(raw);
  }, [extendedProduct?.country, extendedProduct?.origin, originInfo.country, tt]);

  const displayScore = useMemo(() => {
    return Math.max(
      0,
      Math.min(100, Math.round(displayedAnalysis?.score ?? displayedProduct?.score ?? 0))
    );
  }, [displayedAnalysis?.score, displayedProduct?.score]);

  const displayGrade = useMemo(() => {
    const rawGrade = displayedProduct?.grade?.toUpperCase();

    if (rawGrade && ['A', 'B', 'C', 'D', 'E'].includes(rawGrade)) {
      return rawGrade;
    }

    return scoreToGrade(displayScore);
  }, [displayScore, displayedProduct?.grade]);

  const familyAlerts = useMemo(() => {
    if (!displayedProduct || !displayedAnalysis) return [];

    const alerts = [];

    if (displayedAnalysis.riskLevel === 'Yüksek') {
      alerts.push({
        id: 'high-risk',
        title: tt('family_high_risk_title', 'Çocuklar ve hassas bireyler için dikkat'),
        description: tt(
          'family_high_risk_desc',
          'Bu ürünün genel analiz sonucu yüksek risk seviyesinde görünüyor. Düzenli tüketim veya kullanım öncesi içerik dikkatle incelenmelidir.'
        ),
        severity: 'danger' as const,
      });
    }

    if (
      displayedAnalysis.foundECodes?.some(
        (item) => String(item.risk || '').toLowerCase() === 'yüksek'
      )
    ) {
      alerts.push({
        id: 'ecode-risk',
        title: tt('family_ecode_title', 'Katkı maddesi hassasiyeti olabilir'),
        description: tt(
          'family_ecode_desc',
          'Üründe yüksek riskli katkı maddeleri tespit edildi. Özellikle çocuklar, alerjik bireyler ve özel beslenme takibi yapanlar dikkat etmelidir.'
        ),
        severity: 'warning' as const,
      });
    }

    if (displayedProduct.type === 'beauty' && displayedProduct.usage_instructions) {
      alerts.push({
        id: 'beauty-usage',
        title: tt('family_beauty_usage_title', 'Kozmetik kullanım talimatını okuyun'),
        description: tt(
          'family_beauty_usage_desc',
          'Kozmetik ürünlerde kullanım sıklığı, cilt tipi ve bölgesel hassasiyet önemli olabilir.'
        ),
        severity: 'info' as const,
      });
    }

    return alerts;
  }, [displayedAnalysis, displayedProduct, tt]);

  const showAlternativeCard = useMemo(() => {
    if (!displayedAnalysis) return false;
    return displayedAnalysis.score < 75;
  }, [displayedAnalysis]);

  const loadProduct = useCallback(async () => {
    if (!normalizedRouteBarcode) {
      setError(tt('invalid_barcode', 'Geçersiz barkod formatı'));
      setLoading(false);
      return;
    }

    if (lastResolvedBarcodeRef.current === normalizedRouteBarcode && localProduct && localAnalysis) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setImageError(false);

      const result = await fetchProductByBarcode(normalizedRouteBarcode);

      if (!result.found) {
        useScanStore.getState().markNotFound(result.barcode);

        if (result.reason === 'invalid_barcode') {
          setError(tt('invalid_barcode', 'Geçersiz barkod formatı'));
        } else {
          setError(tt('product_not_found', 'Ürün verisi bulunamadı'));
        }

        setLocalProduct(null);
        setLocalAnalysis(null);
        lastResolvedBarcodeRef.current = normalizedRouteBarcode;
        return;
      }

      const product = result.product;
      const analysis = analyzeProduct(product);

      setLocalProduct(product);
      setLocalAnalysis(analysis);
      setAnalysis(product, analysis);
      lastResolvedBarcodeRef.current = normalizedRouteBarcode;

      const historySaveKey = `${product.barcode}-${analysis.score}`;

      if (lastSavedHistoryKeyRef.current !== historySaveKey) {
        try {
          await Promise.resolve(saveProductToHistory(product, analysis.score));
          lastSavedHistoryKeyRef.current = historySaveKey;
        } catch (historyError) {
          console.warn('History save failed:', historyError);
        }
      }
    } catch (loadError) {
      console.error('Detail load failed:', loadError);
      setError(tt('error_generic', 'Bir hata oluştu'));
      setLocalProduct(null);
      setLocalAnalysis(null);
    } finally {
      setLoading(false);
    }
  }, [
    localAnalysis,
    localProduct,
    normalizedRouteBarcode,
    setAnalysis,
    tt,
  ]);

  useEffect(() => {
    if (isCurrentBarcodeInStore && currentProduct) {
      return;
    }

    if (lastResolvedBarcodeRef.current === normalizedRouteBarcode && localProduct && localAnalysis) {
      return;
    }

    loadProduct();
  }, [
    currentProduct,
    isCurrentBarcodeInStore,
    loadProduct,
    localAnalysis,
    localProduct,
    normalizedRouteBarcode,
  ]);

  const handleRetry = useCallback(() => {
    lastResolvedBarcodeRef.current = null;
    loadProduct();
  }, [loadProduct]);

  const handleShare = useCallback(async () => {
    if (!displayedProduct || !displayedAnalysis) {
      Alert.alert(tt('error_title', 'Hata'), tt('data_not_ready', 'Veri hazır değil'));
      return;
    }

    try {
      await Share.share({
        message:
          `${displayedProduct.brand || tt('unknown_brand', 'Bilinmeyen Marka')} - ${displayedProduct.name || tt('unnamed_product', 'İsimsiz Ürün')}\n` +
          `${tt('source', 'Kaynak')}: ${sourceLabel}\n` +
          `${tt('origin_label', 'Menşei')}: ${resolvedOriginLabel}\n` +
          `${tt('analysis_summary', 'Analiz Özeti')}: ${displayedAnalysis.riskLevel} Risk\n` +
          `${tt('score_label', 'Skor')}: ${displayScore}/100\n` +
          `Not: ${displayGrade}\n` +
          `${tt('barcode_label', 'Barkod')}: ${normalizedRouteBarcode}`,
      });
    } catch (shareError) {
      console.error('Share failed:', shareError);
      Alert.alert(tt('error_title', 'Hata'), tt('share_error', 'Paylaşım başarısız oldu'));
    }
  }, [
    displayGrade,
    displayScore,
    displayedAnalysis,
    displayedProduct,
    normalizedRouteBarcode,
    resolvedOriginLabel,
    sourceLabel,
    tt,
  ]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.primary }]}>
          {tt('analyzing', 'Analiz ediliyor').toUpperCase()}
        </Text>
      </View>
    );
  }

  if (error || !displayedProduct || !displayedAnalysis) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={80} color={colors.border} />
        <Text style={[styles.errorText, { color: colors.text }]}>
          {error || tt('product_not_found', 'Ürün bulunamadı')}
        </Text>

        <View style={styles.errorActions}>
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: colors.border }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
              {tt('go_back', 'Geri Dön')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('MissingProduct', { barcode: normalizedRouteBarcode })}
          >
            <Text style={styles.backBtnText}>{tt('add_product', 'Ürünü Ekle')}</Text>
          </TouchableOpacity>
        </View>

        {!error?.includes('Geçersiz') ? (
          <TouchableOpacity style={styles.retryLink} onPress={handleRetry}>
            <Text style={[styles.retryText, { color: colors.primary }]}>
              {tt('retry', 'Tekrar Dene')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View
          style={[
            styles.imageSection,
            { backgroundColor: isDark ? '#111' : '#F8F8F8' },
          ]}
        >
          <Image
            source={{ uri: productImageUri }}
            style={styles.productImage}
            onError={() => setImageError(true)}
          />

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={26} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconBtn} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={26} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.originBadge}>
            <Ionicons name="globe-outline" size={14} color="#FFF" />
            <Text style={styles.originText} numberOfLines={1}>
              {resolvedOriginLabel}
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={[styles.brandName, { color: colors.primary }]} numberOfLines={1}>
            {displayedProduct.brand || tt('unknown_brand', 'Bilinmeyen Marka')}
          </Text>

          <Text style={[styles.productName, { color: colors.text }]} numberOfLines={3}>
            {displayedProduct.name || tt('unnamed_product', 'İsimsiz Ürün')}
          </Text>

          <View style={styles.metaRow}>
            <View
              style={[
                styles.metaChip,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons name="server-outline" size={14} color={colors.primary} />
              <Text
                style={[styles.metaChipText, { color: colors.text }]}
                numberOfLines={1}
              >
                {sourceLabel}
              </Text>
            </View>

            <View
              style={[
                styles.metaChip,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons name="flag-outline" size={14} color={colors.primary} />
              <Text
                style={[styles.metaChipText, { color: colors.text }]}
                numberOfLines={1}
              >
                {resolvedOriginLabel}
              </Text>
            </View>

            <View
              style={[
                styles.metaChip,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons name="analytics-outline" size={14} color={colors.primary} />
              <Text
                style={[styles.metaChipText, { color: colors.text }]}
                numberOfLines={1}
              >
                {tt('api_score', 'API Skoru')}: {displayedProduct.score ?? '-'}
              </Text>
            </View>
          </View>

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
              <Text style={[styles.scoreNumber, { color: analysisColor }]}>
                {displayScore}
              </Text>
              <Text style={[styles.scoreOverHundred, { color: colors.text }]}>
                /100
              </Text>
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
                <Text style={styles.gradeBadgeText}>{displayGrade}</Text>
              </View>

              <Text style={[styles.scoreRiskTitle, { color: analysisColor }]}>
                {(displayedAnalysis.riskLevel || tt('unknown', 'Bilinmiyor')).toUpperCase()} RİSK
              </Text>

              <Text style={[styles.scoreRecommendation, { color: colors.text }]}>
                {displayedAnalysis.recommendation ||
                  tt('no_recommendation', 'Öneri bulunamadı')}
              </Text>
            </View>
          </View>

          <FamilyHealthAlert items={familyAlerts} style={{ marginBottom: 24 }} />

          {showAlternativeCard ? (
            <AlternativeCard
              title={
                displayedProduct.type === 'food'
                  ? tt('alternative_food_title', 'Daha sade içerikli benzer ürünleri tercih edebilirsiniz')
                  : tt('alternative_beauty_title', 'Daha düşük riskli kozmetik alternatifleri değerlendirilebilir')
              }
              brand={tt('alternative_badge', 'Öneri')}
              subtitle={
                displayedProduct.type === 'food'
                  ? tt(
                      'alternative_food_subtitle',
                      'Katkı maddesi daha az olan veya daha yüksek analiz skoruna sahip ürünlere bakın.'
                    )
                  : tt(
                      'alternative_beauty_subtitle',
                      'İçerik listesi daha sade, kullanım amacı benzer alternatifler daha uygun olabilir.'
                    )
              }
              badgeText={tt('alternative_badge', 'Öneri')}
              score={displayScore}
              grade={displayGrade}
              style={{ marginBottom: 28 }}
            />
          ) : null}

          <View style={styles.summaryBox}>
            <Text style={[styles.summaryTitle, { color: colors.text }]}>
              {tt('analysis_summary', 'Analiz Özeti')}
            </Text>
            <Text style={[styles.summaryText, { color: colors.text }]}>
              {displayedAnalysis.summary}
            </Text>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {tt('additives', 'Katkı Maddeleri')}
            </Text>

            <View style={[styles.countBadge, { backgroundColor: analysisColor }]}>
              <Text style={styles.countText}>
                {displayedAnalysis.foundECodes?.length ?? 0}
              </Text>
            </View>
          </View>

          {displayedAnalysis.foundECodes?.length ? (
            displayedAnalysis.foundECodes.map((item, index) => {
              const isHighRisk = String(item.risk || '').toLowerCase() === 'yüksek';
              const riskColor = isHighRisk ? '#FF4444' : '#FFD700';

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
                      {item.risk || tt('unknown', 'Bilinmiyor')}
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
              <Text style={[styles.cleanText, { color: colors.text }]}>
                {tt('clean_content_detected', 'Belirgin katkı riski tespit edilmedi')}
              </Text>
            </View>
          )}

          <Text style={[styles.sectionTitle, styles.ingredientsTitle, { color: colors.text }]}>
            {tt('ingredients', 'İçerik')}
          </Text>

          <View
            style={[
              styles.ingredientsBox,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.ingredientsText, { color: colors.text }]}>
              {displayedProduct.ingredients_text ||
                tt('no_ingredients_info', 'İçerik bilgisi bulunamadı')}
            </Text>
          </View>

          {displayedProduct.type === 'beauty' && displayedProduct.usage_instructions ? (
            <>
              <Text
                style={[styles.sectionTitle, styles.ingredientsTitle, { color: colors.text }]}
              >
                {tt('usage_information', 'Kullanım Bilgisi')}
              </Text>
              <View
                style={[
                  styles.ingredientsBox,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.ingredientsText, { color: colors.text }]}>
                  {displayedProduct.usage_instructions}
                </Text>
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.adContainer}>
        <AdBanner />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
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
  content: {
    padding: 25,
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
  ingredientsTitle: {
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
  ingredientsBox: {
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  ingredientsText: {
    fontSize: 14,
    lineHeight: 26,
    opacity: 0.72,
  },
  adContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    alignItems: 'center',
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
  backBtn: {
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 22,
  },
  backBtnText: {
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
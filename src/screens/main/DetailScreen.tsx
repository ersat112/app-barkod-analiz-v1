import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { fetchProductByBarcode } from '../../api/productResolver';
import { FEATURES } from '../../config/features';
import { useTheme } from '../../context/ThemeContext';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { saveProductToHistory } from '../../services/db';
import { useScanStore } from '../../store/useScanStore';
import { analyzeProduct, type AnalysisResult, type Product } from '../../utils/analysis';
import { barcodeDecoder } from '../../utils/barcodeDecoder';

import { AdBanner } from '../../components/AdBanner';
import { AlternativeCard } from '../../components/AlternativeCard';
import { FamilyHealthAlert } from '../../components/organisms/FamilyHealthAlert';
import {
  AdditivesSection,
  DetailErrorState,
  DetailHeroSection,
  DetailLoadingState,
  MetaChipsSection,
  NoticeCard,
  ProductHeadingSection,
  ScoreOverviewCard,
  SummarySection,
  TextSection,
} from './detail/DetailSections';

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

const normalizeDisplayText = (value?: string | null): string => {
  if (!value) return '';

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

  const sourceLabel = useMemo(() => {
    if (!extendedProduct?.sourceName) return tt('source_unknown', 'Bilinmeyen Kaynak');

    return extendedProduct.sourceName === 'openfoodfacts'
      ? 'Open Food Facts'
      : 'Open Beauty Facts';
  }, [extendedProduct?.sourceName, tt]);

  const actualOriginRaw = useMemo(() => {
    return normalizeDisplayText(
      extendedProduct?.origin || extendedProduct?.country || ''
    );
  }, [extendedProduct?.country, extendedProduct?.origin]);

  const hasActualOrigin = actualOriginRaw.length > 0;

  const actualOriginLabel = useMemo(() => {
    if (hasActualOrigin) {
      return actualOriginRaw;
    }

    return tt('origin_not_available', 'Menşei bilgisi yok');
  }, [actualOriginRaw, hasActualOrigin, tt]);

  const gs1PrefixLabel = useMemo(() => {
    if (!originInfo.hasGs1PrefixInfo || !originInfo.gs1PrefixCountry || !originInfo.prefix) {
      return tt('gs1_not_available', 'GS1 kayıt bilgisi yok');
    }

    return `${originInfo.gs1PrefixCountry} (${originInfo.prefix})`;
  }, [originInfo.gs1PrefixCountry, originInfo.hasGs1PrefixInfo, originInfo.prefix, tt]);

  const headerBadgeLabel = useMemo(() => {
    if (FEATURES.productPresentation.gs1OriginLabelFixEnabled) {
      if (hasActualOrigin) {
        return actualOriginLabel;
      }

      if (originInfo.hasGs1PrefixInfo && originInfo.gs1PrefixCountry) {
        return `GS1: ${originInfo.gs1PrefixCountry}`;
      }

      return tt('origin_not_available', 'Menşei bilgisi yok');
    }

    return actualOriginRaw || originInfo.country || tt('international', 'Uluslararası');
  }, [
    actualOriginLabel,
    actualOriginRaw,
    hasActualOrigin,
    originInfo.country,
    originInfo.gs1PrefixCountry,
    originInfo.hasGs1PrefixInfo,
    tt,
  ]);

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

  const productImageUri = imageError
    ? 'https://via.placeholder.com/400?text=No+Image'
    : displayedProduct?.image_url || 'https://via.placeholder.com/400?text=No+Image';

  const metaChipItems = useMemo(
    () => [
      {
        icon: 'server-outline' as const,
        label: sourceLabel,
      },
      {
        icon: 'flag-outline' as const,
        label: actualOriginLabel,
      },
      {
        icon: 'barcode-outline' as const,
        label: `GS1: ${gs1PrefixLabel}`,
      },
      {
        icon: 'analytics-outline' as const,
        label: `${tt('api_score', 'API Skoru')}: ${displayedProduct?.score ?? '-'}`,
      },
    ],
    [actualOriginLabel, displayedProduct?.score, gs1PrefixLabel, sourceLabel, tt]
  );

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
          `${tt('origin_label', 'Menşei')}: ${actualOriginLabel}\n` +
          `GS1: ${gs1PrefixLabel}\n` +
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
    actualOriginLabel,
    displayGrade,
    displayScore,
    displayedAnalysis,
    displayedProduct,
    gs1PrefixLabel,
    normalizedRouteBarcode,
    sourceLabel,
    tt,
  ]);

  if (loading) {
    return <DetailLoadingState label={tt('analyzing', 'Analiz ediliyor')} colors={colors} />;
  }

  if (error || !displayedProduct || !displayedAnalysis) {
    return (
      <DetailErrorState
        text={error || tt('product_not_found', 'Ürün bulunamadı')}
        secondaryLabel={tt('go_back', 'Geri Dön')}
        primaryLabel={tt('add_product', 'Ürünü Ekle')}
        onSecondaryPress={() => navigation.goBack()}
        onPrimaryPress={() =>
          navigation.navigate('MissingProduct', { barcode: normalizedRouteBarcode })
        }
        retryLabel={!error?.includes('Geçersiz') ? tt('retry', 'Tekrar Dene') : undefined}
        onRetry={!error?.includes('Geçersiz') ? handleRetry : undefined}
        colors={colors}
      />
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <DetailHeroSection
          imageUri={productImageUri}
          isDark={isDark}
          badgeLabel={headerBadgeLabel}
          hasActualOrigin={hasActualOrigin}
          onBack={() => navigation.goBack()}
          onShare={handleShare}
          onImageError={() => setImageError(true)}
          colors={colors}
        />

        <View style={styles.content}>
          <ProductHeadingSection
            brand={displayedProduct.brand || tt('unknown_brand', 'Bilinmeyen Marka')}
            name={displayedProduct.name || tt('unnamed_product', 'İsimsiz Ürün')}
            colors={colors}
          />

          <MetaChipsSection items={metaChipItems} colors={colors} />

          {FEATURES.productPresentation.gs1OriginLabelFixEnabled ? (
            <NoticeCard
              text={
                hasActualOrigin
                  ? `GS1 prefix bilgisi: ${gs1PrefixLabel}. Ürünün menşei alanı ayrıca gösterilir.`
                  : `Gerçek menşei bilgisi bulunamadı. Gösterilen GS1 alanı barkodun kayıt bölgesidir: ${gs1PrefixLabel}.`
              }
              colors={colors}
            />
          ) : null}

          <ScoreOverviewCard
            score={displayScore}
            grade={displayGrade}
            analysis={displayedAnalysis}
            colors={colors}
          />

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

          <SummarySection
            title={tt('analysis_summary', 'Analiz Özeti')}
            text={displayedAnalysis.summary}
            colors={colors}
          />

          <AdditivesSection
            title={tt('additives', 'Katkı Maddeleri')}
            emptyLabel={tt('clean_content_detected', 'Belirgin katkı riski tespit edilmedi')}
            items={displayedAnalysis.foundECodes ?? []}
            analysisColor={analysisColor}
            unknownLabel={tt('unknown', 'Bilinmiyor')}
            colors={colors}
          />

          <TextSection
            title={tt('ingredients', 'İçerik')}
            text={
              displayedProduct.ingredients_text ||
              tt('no_ingredients_info', 'İçerik bilgisi bulunamadı')
            }
            colors={colors}
          />

          {displayedProduct.type === 'beauty' && displayedProduct.usage_instructions ? (
            <TextSection
              title={tt('usage_information', 'Kullanım Bilgisi')}
              text={displayedProduct.usage_instructions}
              colors={colors}
            />
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
  content: {
    padding: 25,
  },
  adContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    alignItems: 'center',
  },
});

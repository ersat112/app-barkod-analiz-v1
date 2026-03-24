import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import {
  lookupProductByBarcode,
  type ProductLookupResult,
} from '../../services/productLookup.service';
import { FEATURES } from '../../config/features';
import { useTheme } from '../../context/ThemeContext';
import { useMissingProductFlow } from '../../hooks/useMissingProductFlow';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { adService } from '../../services/adService';
import { analyticsService } from '../../services/analytics.service';
import { saveProductToHistory } from '../../services/db';
import { entitlementService } from '../../services/entitlement.service';
import { freeScanPolicyService } from '../../services/freeScanPolicy.service';
import { enqueueRemoteHistorySync } from '../../services/historyRemoteSync.service';
import { useScanStore } from '../../store/useScanStore';
import {
  analyzeProduct,
  type AnalysisResult,
  type Product,
} from '../../utils/analysis';
import { barcodeDecoder } from '../../utils/barcodeDecoder';

import { AdBanner } from '../../components/AdBanner';
import { AlternativeCard } from '../../components/AlternativeCard';
import { FamilyHealthAlert } from '../../components/organisms/FamilyHealthAlert';
import { useAppScreenLayout } from '../../components/layout/useAppScreenLayout';
import {
  AdditivesSection,
  DetailErrorState,
  DetailHeroSection,
  DetailLoadingState,
  MetaChipsSection,
  NoticeCard,
  ProductHeadingSection,
  ScoreOverviewCard,
  ShareSheet,
  SummarySection,
  TextSection,
} from './detail/DetailSections';
import type { ProductRepositoryCacheTier, ProductRepositoryLookupMeta } from '../../types/productRepository';

type DetailRoute = RouteProp<RootStackParamList, 'Detail'>;

type DisplayProduct = Product & {
  sourceName?: string;
  country?: string;
  origin?: string;
};

type DetailLookupContext = {
  source?: 'food' | 'beauty' | 'cache';
  cacheTier?: ProductRepositoryCacheTier;
  lookupMeta?: ProductRepositoryLookupMeta;
};

type RiskLevelKey = 'low' | 'medium' | 'high';
type TranslateFn = (key: string, fallback: string) => string;

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

const mapStoreSourceToLookupSource = (
  sourceName?: string
): 'food' | 'beauty' | 'cache' | undefined => {
  if (sourceName === 'openfoodfacts') {
    return 'food';
  }

  if (sourceName === 'openbeautyfacts') {
    return 'beauty';
  }

  return undefined;
};

const buildProductShareUrl = (
  barcode: string,
  productType?: Product['type'],
  sourceName?: Product['sourceName']
): string => {
  const normalizedBarcode = String(barcode || '').replace(/[^\d]/g, '').trim();
  const source = sourceName === 'openbeautyfacts' || productType === 'beauty'
    ? 'openbeautyfacts'
    : 'openfoodfacts';

  if (!normalizedBarcode) {
    return source === 'openbeautyfacts'
      ? 'https://world.openbeautyfacts.org'
      : 'https://world.openfoodfacts.org';
  }

  return source === 'openbeautyfacts'
    ? `https://world.openbeautyfacts.org/product/${normalizedBarcode}`
    : `https://world.openfoodfacts.org/product/${normalizedBarcode}`;
};

const applyTemplate = (
  template: string,
  replacements: Record<string, string | number>
): string => {
  return Object.entries(replacements).reduce((result, [key, value]) => {
    return result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(value));
  }, template);
};

const normalizeRiskLevelKey = (value?: string | null): RiskLevelKey => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  if (normalized === 'yüksek' || normalized === 'high') {
    return 'high';
  }

  if (normalized === 'orta' || normalized === 'medium') {
    return 'medium';
  }

  return 'low';
};

const translateRiskLevel = (tt: TranslateFn, value?: string | null): string => {
  switch (normalizeRiskLevelKey(value)) {
    case 'high':
      return tt('risk_high', 'Yüksek');
    case 'medium':
      return tt('risk_medium', 'Orta');
    default:
      return tt('risk_low', 'Düşük');
  }
};

const translateRiskCompound = (tt: TranslateFn, value?: string | null): string => {
  switch (normalizeRiskLevelKey(value)) {
    case 'high':
      return tt('risk_high_compound', 'Yüksek risk');
    case 'medium':
      return tt('risk_medium_compound', 'Orta risk');
    default:
      return tt('risk_low_compound', 'Düşük risk');
  }
};

const buildLocalizedAnalysisSummary = (params: {
  tt: TranslateFn;
  foundECodesCount: number;
  hasApiScore: boolean;
}): string => {
  if (params.foundECodesCount > 0) {
    return applyTemplate(
      params.tt(
        'analysis_summary_additive_signal',
        '{{count}} içerik bileşeni incelendi, katkı bazlı risk etkisi hesaba katıldı.'
      ),
      { count: params.foundECodesCount }
    );
  }

  if (params.hasApiScore) {
    return params.tt(
      'analysis_summary_api_complete',
      'API skoru ve ürün derecesi üzerinden analiz tamamlandı.'
    );
  }

  return params.tt(
    'analysis_summary_clean_default',
    'İçerikte belirgin riskli madde tespit edilmedi.'
  );
};

const buildLocalizedRecommendation = (params: {
  tt: TranslateFn;
  type: Product['type'];
  riskLevel: string;
  foundECodesCount: number;
  hasApiScore: boolean;
}): string => {
  const riskLevel = normalizeRiskLevelKey(params.riskLevel);

  if (params.type === 'beauty') {
    if (riskLevel === 'high') {
      return params.foundECodesCount > 0
        ? params.tt(
            'recommendation_beauty_high_additive',
            'İçerikte dikkat gerektiren bileşenler bulundu. Kozmetik ürünü kullanmadan önce içerik detayını kontrol edin.'
          )
        : params.tt(
            'recommendation_beauty_high_basic',
            'Kozmetik ürün için risk seviyesi yüksek görünüyor. İçerik ve kullanım amacı dikkatle incelenmeli.'
          );
    }

    if (riskLevel === 'medium') {
      return params.foundECodesCount > 0
        ? params.tt(
            'recommendation_beauty_medium_additive',
            'Kozmetik içerikte bazı dikkat edilmesi gereken maddeler bulunuyor.'
          )
        : params.tt(
            'recommendation_beauty_medium_basic',
            'Kozmetik ürün orta risk seviyesinde görünüyor.'
          );
    }

    return params.hasApiScore
      ? params.tt(
          'recommendation_beauty_low_api',
          'Kozmetik ürün mevcut verilere göre düşük risk seviyesinde görünüyor.'
        )
      : params.tt(
          'recommendation_beauty_low_clean',
          'Kozmetik içerik genel olarak temiz görünüyor.'
        );
  }

  if (riskLevel === 'high') {
    return params.foundECodesCount > 0
      ? params.tt(
          'recommendation_food_high_additive',
          'Ürün hem API skoru hem de içerik bileşenleri açısından yüksek risk gösterebilir.'
        )
      : params.tt(
          'recommendation_food_high_basic',
          'API skoruna göre ürün risk seviyesi yüksek görünüyor.'
        );
  }

  if (riskLevel === 'medium') {
    return params.foundECodesCount > 0
      ? params.tt(
          'recommendation_food_medium_additive',
          'Ürün içerik ve skor açısından orta seviyede dikkat gerektiriyor.'
        )
      : params.tt(
          'recommendation_food_medium_basic',
          'API skoruna göre ürün orta risk seviyesinde.'
        );
  }

  return params.hasApiScore
    ? params.tt(
        'recommendation_food_low_api',
        'API skoruna göre ürün düşük risk seviyesinde görünüyor.'
      )
    : params.tt(
        'recommendation_food_low_clean',
        'İçerik temiz ve güvenle değerlendirilebilir görünüyor.'
      );
};

export const DetailScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<DetailRoute>();
  const {
    trackNotFoundAddProductTapped,
    trackNotFoundRetryTapped,
    trackNotFoundViewed,
  } = useMissingProductFlow();

  const layout = useAppScreenLayout({
    contentBottomExtra: 120,
    contentBottomMin: 150,
    floatingBottomExtra: 12,
    floatingBottomMin: 12,
  });

  const tt = useCallback(
    (key: string, fallback: string) => {
      const value = t(key, { defaultValue: fallback });
      return value === key ? fallback : value;
    },
    [t]
  );

  const {
    barcode,
    entrySource = 'unknown',
  } = route.params;
  const { setAnalysis, currentProduct, currentAnalysis } = useScanStore();

  const normalizedRouteBarcode = useMemo(
    () => String(barcode || '').replace(/[^\d]/g, '').trim(),
    [barcode]
  );

  const isCurrentBarcodeInStore = currentProduct?.barcode === normalizedRouteBarcode;

  const [loading, setLoading] = useState(!isCurrentBarcodeInStore);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [notFoundReason, setNotFoundReason] = useState<'not_found' | 'invalid_barcode' | 'unknown' | null>(null);

  const [localProduct, setLocalProduct] = useState<Product | null>(
    isCurrentBarcodeInStore ? currentProduct : null
  );
  const [localAnalysis, setLocalAnalysis] = useState<AnalysisResult | null>(
    isCurrentBarcodeInStore ? currentAnalysis : null
  );
  const [lookupContext, setLookupContext] = useState<DetailLookupContext>(() => {
    if (isCurrentBarcodeInStore && currentProduct) {
      return {
        source: mapStoreSourceToLookupSource(currentProduct.sourceName),
      };
    }

    return {};
  });

  const lastResolvedBarcodeRef = useRef<string | null>(null);
  const lastSavedHistoryKeyRef = useRef<string | null>(null);
  const lastTrackedDetailViewKeyRef = useRef<string | null>(null);
  const lastInterstitialAttemptKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (isCurrentBarcodeInStore && currentProduct) {
      setLocalProduct(currentProduct);
      setLocalAnalysis(currentAnalysis ?? null);
      setLoading(false);
      setError(null);
      setNotFoundReason(null);
      setLookupContext({
        source: mapStoreSourceToLookupSource(currentProduct.sourceName),
      });
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
      ? tt('source_open_food_facts', 'Open Food Facts')
      : tt('source_open_beauty_facts', 'Open Beauty Facts');
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

  const riskCompoundLabel = useMemo(() => {
    return translateRiskCompound(tt, displayedAnalysis?.riskLevel);
  }, [displayedAnalysis?.riskLevel, tt]);

  const hasApiScoreSignal = useMemo(() => {
    return (
      typeof displayedProduct?.score === 'number' ||
      Boolean(displayedProduct?.grade?.trim())
    );
  }, [displayedProduct?.grade, displayedProduct?.score]);

  const recommendationText = useMemo(() => {
    if (!displayedProduct || !displayedAnalysis) {
      return '';
    }

    return buildLocalizedRecommendation({
      tt,
      type: displayedProduct.type,
      riskLevel: displayedAnalysis.riskLevel,
      foundECodesCount: displayedAnalysis.foundECodes.length,
      hasApiScore: hasApiScoreSignal,
    });
  }, [displayedAnalysis, displayedProduct, hasApiScoreSignal, tt]);

  const summaryText = useMemo(() => {
    if (!displayedAnalysis) {
      return '';
    }

    return buildLocalizedAnalysisSummary({
      tt,
      foundECodesCount: displayedAnalysis.foundECodes.length,
      hasApiScore: hasApiScoreSignal,
    });
  }, [displayedAnalysis, hasApiScoreSignal, tt]);

  const familyAlerts = useMemo(() => {
    if (!displayedProduct || !displayedAnalysis) return [];

    const alerts = [];

    if (normalizeRiskLevelKey(displayedAnalysis.riskLevel) === 'high') {
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

  const shareProductUrl = useMemo(() => {
    return buildProductShareUrl(
      normalizedRouteBarcode,
      displayedProduct?.type,
      displayedProduct?.sourceName
    );
  }, [displayedProduct?.sourceName, displayedProduct?.type, normalizedRouteBarcode]);

  const shareMessage = useMemo(() => {
    return (
      `${displayedProduct?.brand || tt('unknown_brand', 'Bilinmeyen Marka')} - ${displayedProduct?.name || tt('unnamed_product', 'İsimsiz Ürün')}\n` +
      `${tt('source', 'Kaynak')}: ${sourceLabel}\n` +
      `${tt('origin_label', 'Menşei')}: ${actualOriginLabel}\n` +
      `GS1: ${gs1PrefixLabel}\n` +
      `${tt('analysis_summary', 'Analiz Özeti')}: ${riskCompoundLabel}\n` +
      `${tt('score_label', 'Skor')}: ${displayScore}/100\n` +
      `${tt('grade_note_label', 'Not')}: ${displayGrade}\n` +
      `${tt('barcode_label', 'Barkod')}: ${normalizedRouteBarcode}`
    );
  }, [
    actualOriginLabel,
    displayGrade,
    displayScore,
    displayedProduct?.brand,
    displayedProduct?.name,
    gs1PrefixLabel,
    normalizedRouteBarcode,
    riskCompoundLabel,
    sourceLabel,
    tt,
  ]);

  const sharePreviewBody = useMemo(() => {
    return `${tt('score_label', 'Skor')}: ${displayScore}/100 • ${riskCompoundLabel} • ${sourceLabel}`;
  }, [displayScore, riskCompoundLabel, sourceLabel, tt]);

  const openShareSheet = useCallback(() => {
    setShareSheetVisible(true);
  }, []);

  const closeShareSheet = useCallback(() => {
    setShareSheetVisible(false);
  }, []);

  const openLinkOrFallback = useCallback(
    async (url: string) => {
      try {
        await Linking.openURL(url);
      } catch (linkError) {
        console.warn('Share link open failed, falling back to system share:', linkError);
        await Share.share({
          message: `${shareMessage}\n${shareProductUrl}`,
          url: shareProductUrl,
        });
      }
    },
    [shareMessage, shareProductUrl]
  );

  const loadProduct = useCallback(async () => {
    if (!normalizedRouteBarcode) {
      setError(tt('invalid_barcode', 'Geçersiz barkod formatı'));
      setNotFoundReason('invalid_barcode');
      setLoading(false);

      await trackNotFoundViewed({
        barcode: normalizedRouteBarcode,
        reason: 'invalid_barcode',
        entryPoint: 'detail_not_found',
      });

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
      setNotFoundReason(null);

      const result: ProductLookupResult = await lookupProductByBarcode(normalizedRouteBarcode);

      if (!result.found) {
        useScanStore.getState().markNotFound(result.barcode);

        const resolvedReason =
          result.reason === 'invalid_barcode' ? 'invalid_barcode' : 'not_found';

        if (result.reason === 'invalid_barcode') {
          setError(tt('invalid_barcode', 'Geçersiz barkod formatı'));
        } else {
          setError(tt('product_not_found', 'Ürün verisi bulunamadı'));
        }

        setNotFoundReason(resolvedReason);
        setLocalProduct(null);
        setLocalAnalysis(null);
        setLookupContext({
          lookupMeta: result.lookupMeta,
        });
        lastResolvedBarcodeRef.current = normalizedRouteBarcode;

        await trackNotFoundViewed({
          barcode: normalizedRouteBarcode,
          reason: resolvedReason,
          entryPoint: 'detail_not_found',
        });

        return;
      }

      const product = result.product;
      const analysis = analyzeProduct(product);

      setLocalProduct(product);
      setLocalAnalysis(analysis);
      setAnalysis(product, analysis);
      setNotFoundReason(null);
      setLookupContext({
        source: result.source,
        cacheTier: result.lookupMeta?.cacheTier,
        lookupMeta: result.lookupMeta,
      });
      lastResolvedBarcodeRef.current = normalizedRouteBarcode;

      const historySaveKey = `${product.barcode}-${analysis.score}`;

      if (lastSavedHistoryKeyRef.current !== historySaveKey) {
        try {
          await Promise.resolve(saveProductToHistory(product, analysis.score));
          void enqueueRemoteHistorySync({
            product,
            score: analysis.score,
            riskLevel: analysis.riskLevel,
          });
          lastSavedHistoryKeyRef.current = historySaveKey;
        } catch (historyError) {
          console.warn('History save failed:', historyError);
        }
      }
    } catch (loadError) {
      console.error('Detail load failed:', loadError);
      setError(tt('error_generic', 'Bir hata oluştu'));
      setNotFoundReason('unknown');
      setLocalProduct(null);
      setLocalAnalysis(null);
      setLookupContext({});
    } finally {
      setLoading(false);
    }
  }, [
    localAnalysis,
    localProduct,
    normalizedRouteBarcode,
    setAnalysis,
    trackNotFoundViewed,
    tt,
  ]);

  useEffect(() => {
    if (isCurrentBarcodeInStore && currentProduct) {
      return;
    }

    if (lastResolvedBarcodeRef.current === normalizedRouteBarcode && localProduct && localAnalysis) {
      return;
    }

    void loadProduct();
  }, [
    currentProduct,
    isCurrentBarcodeInStore,
    loadProduct,
    localAnalysis,
    localProduct,
    normalizedRouteBarcode,
  ]);

  useEffect(() => {
    if (!displayedProduct || !displayedAnalysis || !normalizedRouteBarcode) {
      return;
    }

    const source = lookupContext.source ?? mapStoreSourceToLookupSource(displayedProduct.sourceName);
    const trackingKey = [
      normalizedRouteBarcode,
      source ?? 'unknown',
      lookupContext.cacheTier ?? 'unknown',
    ].join(':');

    if (lastTrackedDetailViewKeyRef.current === trackingKey) {
      return;
    }

    lastTrackedDetailViewKeyRef.current = trackingKey;

    void analyticsService.trackProductDetailViewed({
      barcode: normalizedRouteBarcode,
      source,
      cacheTier: lookupContext.cacheTier,
      lookupMeta: lookupContext.lookupMeta,
      productType: displayedProduct.type,
      productScore:
        typeof displayedProduct.score === 'number' ? displayedProduct.score : undefined,
    });
  }, [
    displayedAnalysis,
    displayedProduct,
    lookupContext.cacheTier,
    lookupContext.lookupMeta,
    lookupContext.source,
    normalizedRouteBarcode,
  ]);

  useEffect(() => {
    if (
      entrySource !== 'scanner' ||
      !displayedProduct ||
      !displayedAnalysis
    ) {
      return;
    }

    const attemptKey = [normalizedRouteBarcode, entrySource].join(':');

    if (lastInterstitialAttemptKeyRef.current === attemptKey) {
      return;
    }

    lastInterstitialAttemptKeyRef.current = attemptKey;

    let cancelled = false;

    const showDeferredInterstitial = async () => {
      try {
        const [entitlement, freeScan, policy, stats] = await Promise.all([
          entitlementService.getSnapshot(),
          freeScanPolicyService.getSnapshot(),
          adService.getCurrentPolicy(),
          adService.getStats(),
        ]);

        if (cancelled || entitlement.isPremium) {
          return;
        }

        if (freeScan.usedCount <= 3) {
          return;
        }

        if (!policy.enabled || !policy.interstitialEnabled) {
          return;
        }

        if (stats.dailyInterstitialCount >= policy.maxDailyInterstitials) {
          return;
        }

        if (!adService.isRewardedAdReady()) {
          await adService.prepareRewardedAd();
          await new Promise((resolve) => setTimeout(resolve, 240));
        }

        if (cancelled) {
          return;
        }

        const shown = await adService.showPreparedRewardedAd();

        if (!shown) {
          await adService.trackInterstitialShowFailure('interstitial_not_ready', {
            stage: 'detail_show_gate',
            screen: 'Detail',
            entrySource,
            barcode: normalizedRouteBarcode,
            successfulScanCount: freeScan.usedCount,
          });
          return;
        }

        await adService.recordInterstitialShown({
          shownAt: Date.now(),
          successfulScanCount: freeScan.usedCount,
        });
      } catch (error) {
        console.error('Detail interstitial show failed:', error);

        await adService.trackInterstitialShowFailure(error, {
          stage: 'detail_show',
          screen: 'Detail',
          entrySource,
          barcode: normalizedRouteBarcode,
          successfulScanCount: undefined,
        });
      }
    };

    void showDeferredInterstitial();

    return () => {
      cancelled = true;
    };
  }, [
    displayedAnalysis,
    displayedProduct,
    entrySource,
    normalizedRouteBarcode,
  ]);

  const handleRetry = useCallback(async () => {
    await trackNotFoundRetryTapped({
      barcode: normalizedRouteBarcode,
      reason: notFoundReason ?? 'unknown',
      entryPoint: 'detail_not_found',
    });

    lastResolvedBarcodeRef.current = null;
    lastTrackedDetailViewKeyRef.current = null;
    await loadProduct();
  }, [loadProduct, normalizedRouteBarcode, notFoundReason, trackNotFoundRetryTapped]);

  const handleShareSystem = useCallback(async () => {
    if (!displayedProduct || !displayedAnalysis) {
      Alert.alert(tt('error_title', 'Hata'), tt('data_not_ready', 'Veri hazır değil'));
      return;
    }

    try {
      closeShareSheet();
      await Share.share({
        message: `${shareMessage}\n${shareProductUrl}`,
        url: shareProductUrl,
      });
    } catch (shareError) {
      console.error('Share failed:', shareError);
      Alert.alert(tt('error_title', 'Hata'), tt('share_error', 'Paylaşım başarısız oldu'));
    }
  }, [
    closeShareSheet,
    displayedAnalysis,
    displayedProduct,
    shareMessage,
    shareProductUrl,
    tt,
  ]);

  const handleShareTwitter = useCallback(async () => {
    if (!displayedProduct || !displayedAnalysis) {
      Alert.alert(tt('error_title', 'Hata'), tt('data_not_ready', 'Veri hazır değil'));
      return;
    }

    closeShareSheet();

    const intentUrl =
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}` +
      `&url=${encodeURIComponent(shareProductUrl)}`;

    try {
      await openLinkOrFallback(intentUrl);
    } catch (shareError) {
      console.error('Twitter share failed:', shareError);
      Alert.alert(tt('error_title', 'Hata'), tt('share_error', 'Paylaşım başarısız oldu'));
    }
  }, [
    closeShareSheet,
    displayedAnalysis,
    displayedProduct,
    openLinkOrFallback,
    shareMessage,
    shareProductUrl,
    tt,
  ]);

  const handleShareFacebook = useCallback(async () => {
    if (!displayedProduct || !displayedAnalysis) {
      Alert.alert(tt('error_title', 'Hata'), tt('data_not_ready', 'Veri hazır değil'));
      return;
    }

    closeShareSheet();

    const sharerUrl =
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareProductUrl)}` +
      `&quote=${encodeURIComponent(shareMessage)}`;

    try {
      await openLinkOrFallback(sharerUrl);
    } catch (shareError) {
      console.error('Facebook share failed:', shareError);
      Alert.alert(tt('error_title', 'Hata'), tt('share_error', 'Paylaşım başarısız oldu'));
    }
  }, [
    closeShareSheet,
    displayedAnalysis,
    displayedProduct,
    openLinkOrFallback,
    shareMessage,
    shareProductUrl,
    tt,
  ]);

  const handleShareInstagram = useCallback(async () => {
    if (!displayedProduct || !displayedAnalysis) {
      Alert.alert(tt('error_title', 'Hata'), tt('data_not_ready', 'Veri hazır değil'));
      return;
    }

    try {
      closeShareSheet();
      await Share.share({
        message: `${shareMessage}\n${shareProductUrl}`,
        url: shareProductUrl,
      });
    } catch (shareError) {
      console.error('Instagram share failed:', shareError);
      Alert.alert(tt('error_title', 'Hata'), tt('share_error', 'Paylaşım başarısız oldu'));
    }
  }, [
    closeShareSheet,
    displayedAnalysis,
    displayedProduct,
    shareMessage,
    shareProductUrl,
    tt,
  ]);

  const shareSheetActions = useMemo(
    () => [
      {
        key: 'twitter',
        icon: 'logo-twitter' as const,
        title: tt('share_to_x', 'X / Twitter'),
        subtitle: tt(
          'share_to_x_desc',
          'Hazır tweet metniyle paylaşım akışını açar.'
        ),
        accentColor: '#1D9BF0',
        onPress: () => {
          void handleShareTwitter();
        },
      },
      {
        key: 'facebook',
        icon: 'logo-facebook' as const,
        title: tt('share_to_facebook', 'Facebook'),
        subtitle: tt(
          'share_to_facebook_desc',
          'Ürün bağlantısını ve özetini paylaşım ekranına taşır.'
        ),
        accentColor: '#1877F2',
        onPress: () => {
          void handleShareFacebook();
        },
      },
      {
        key: 'instagram',
        icon: 'logo-instagram' as const,
        title: tt('share_to_instagram', 'Instagram'),
        subtitle: tt(
          'share_to_instagram_desc',
          'Hazır açıklamayla sistem paylaşımını açar.'
        ),
        accentColor: '#E4405F',
        onPress: () => {
          void handleShareInstagram();
        },
      },
      {
        key: 'system',
        icon: 'share-social-outline' as const,
        title: tt('share_to_more', 'Diğer Uygulamalar'),
        subtitle: tt(
          'share_to_more_desc',
          'WhatsApp, Mail ve diğer uygulamalarda paylaşın.'
        ),
        accentColor: colors.primary,
        onPress: () => {
          void handleShareSystem();
        },
      },
    ],
    [
      colors.primary,
      handleShareFacebook,
      handleShareInstagram,
      handleShareSystem,
      handleShareTwitter,
      tt,
    ]
  );

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
        onPrimaryPress={() => {
          void trackNotFoundAddProductTapped({
            barcode: normalizedRouteBarcode,
            reason: notFoundReason ?? 'unknown',
            entryPoint: 'detail_not_found',
          });

          navigation.navigate('MissingProduct', { barcode: normalizedRouteBarcode });
        }}
        retryLabel={notFoundReason !== 'invalid_barcode' ? tt('retry', 'Tekrar Dene') : undefined}
        onRetry={notFoundReason !== 'invalid_barcode' ? handleRetry : undefined}
        colors={colors}
      />
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: layout.contentBottomPadding },
        ]}
      >
        <DetailHeroSection
          imageUri={productImageUri}
          isDark={isDark}
          badgeLabel={headerBadgeLabel}
          hasActualOrigin={hasActualOrigin}
          onBack={() => navigation.goBack()}
          onShare={openShareSheet}
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
                  ? applyTemplate(
                      tt(
                        'gs1_notice_with_origin',
                        'GS1 prefix bilgisi: {{gs1}}. Ürünün menşei alanı ayrıca gösterilir.'
                      ),
                      { gs1: gs1PrefixLabel }
                    )
                  : applyTemplate(
                      tt(
                        'gs1_notice_without_origin',
                        'Gerçek menşei bilgisi bulunamadı. Gösterilen GS1 alanı barkodun kayıt bölgesidir: {{gs1}}.'
                      ),
                      { gs1: gs1PrefixLabel }
                    )
              }
              colors={colors}
            />
          ) : null}

          <ScoreOverviewCard
            score={displayScore}
            grade={displayGrade}
            riskLabel={riskCompoundLabel}
            recommendationText={recommendationText}
            analysisColor={analysisColor}
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
            text={summaryText}
            colors={colors}
          />

          <AdditivesSection
            title={tt('additives', 'Katkı Maddeleri')}
            emptyLabel={tt('clean_content_detected', 'Belirgin katkı riski tespit edilmedi')}
            items={displayedAnalysis.foundECodes ?? []}
            analysisColor={analysisColor}
            unknownLabel={tt('unknown', 'Bilinmiyor')}
            formatRiskLabel={(risk) => translateRiskLevel(tt, risk)}
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

      <View
        style={[
          styles.adContainer,
          { bottom: layout.floatingBottomOffset },
        ]}
      >
        <AdBanner placement="detail_footer" />
      </View>

      <Modal
        visible={shareSheetVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeShareSheet}
      >
        <View style={styles.shareOverlay}>
          <TouchableOpacity
            style={styles.shareOverlayBackdrop}
            activeOpacity={1}
            onPress={closeShareSheet}
          />

          <View style={styles.shareSheetWrap}>
            <ShareSheet
              title={tt('share_sheet_title', 'Paylaş')}
              subtitle={tt(
                'share_sheet_subtitle',
                'Ürün özetini sosyal ağlarda veya diğer uygulamalarda paylaşın.'
              )}
              closeLabel={tt('share_sheet_close', 'Kapat')}
              previewTitle={
                displayedProduct?.name || tt('unnamed_product', 'İsimsiz Ürün')
              }
              previewSubtitle={
                displayedProduct?.brand || tt('unknown_brand', 'Bilinmeyen Marka')
              }
              previewBody={sharePreviewBody}
              actions={shareSheetActions}
              onClose={closeShareSheet}
              colors={colors}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {},
  content: {
    padding: 25,
  },
  adContainer: {
    position: 'absolute',
    width: '100%',
    alignItems: 'center',
  },
  shareOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  shareOverlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  shareSheetWrap: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    marginBottom: 8,
  },
});

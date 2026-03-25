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
import * as WebBrowser from 'expo-web-browser';

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
import { enrichMedicineProductWithProspectus } from '../../services/titckMedicine.service';
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
  ActionLinksSection,
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
  source?: 'food' | 'beauty' | 'medicine' | 'cache';
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
): 'food' | 'beauty' | 'medicine' | 'cache' | undefined => {
  if (sourceName === 'openfoodfacts') {
    return 'food';
  }

  if (sourceName === 'openbeautyfacts') {
    return 'beauty';
  }

  if (sourceName === 'titck') {
    return 'medicine';
  }

  return undefined;
};

const buildProductShareUrl = (
  barcode: string,
  productType?: Product['type'],
  sourceName?: Product['sourceName'],
  prospectusPdfUrl?: string,
  summaryPdfUrl?: string
): string => {
  const normalizedBarcode = String(barcode || '').replace(/[^\d]/g, '').trim();

  if (productType === 'medicine' || sourceName === 'titck') {
    return prospectusPdfUrl || summaryPdfUrl || 'https://www.titck.gov.tr/kubkt';
  }

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
  type: Product['type'];
  foundECodesCount: number;
  hasApiScore: boolean;
}): string => {
  if (params.type === 'medicine') {
    return params.tt(
      'medicine_summary_default',
      'Bu ilaç kaydı resmi TITCK veri kaynağından getirildi. Prospektüs ve kısa ürün bilgisini inceleyerek kullanın.'
    );
  }

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

  if (params.type === 'medicine') {
    return params.tt(
      'medicine_recommendation_default',
      'İlacı kullanmadan önce prospektüsü okuyun ve doktor veya eczacı yönlendirmesine göre hareket edin.'
    );
  }

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
    lookupMode = 'auto',
    prefetchedProduct,
    historyAlreadySaved = false,
  } = route.params;
  const { setAnalysis, currentProduct, currentAnalysis } = useScanStore();

  const normalizedRouteBarcode = useMemo(
    () => String(barcode || '').replace(/[^\d]/g, '').trim(),
    [barcode]
  );

  const prefetchedRouteProduct = useMemo(() => {
    if (!prefetchedProduct) {
      return null;
    }

    const normalizedPrefetchedBarcode = String(prefetchedProduct.barcode || '')
      .replace(/[^\d]/g, '')
      .trim();

    return normalizedPrefetchedBarcode === normalizedRouteBarcode
      ? prefetchedProduct
      : null;
  }, [normalizedRouteBarcode, prefetchedProduct]);

  const prefetchedRouteAnalysis = useMemo(() => {
    return prefetchedRouteProduct ? analyzeProduct(prefetchedRouteProduct) : null;
  }, [prefetchedRouteProduct]);

  const isCurrentBarcodeInStore = currentProduct?.barcode === normalizedRouteBarcode;

  const [loading, setLoading] = useState(
    !isCurrentBarcodeInStore && !prefetchedRouteProduct
  );
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [notFoundReason, setNotFoundReason] = useState<'not_found' | 'invalid_barcode' | 'unknown' | null>(null);

  const [localProduct, setLocalProduct] = useState<Product | null>(
    isCurrentBarcodeInStore ? currentProduct : prefetchedRouteProduct
  );
  const [localAnalysis, setLocalAnalysis] = useState<AnalysisResult | null>(
    isCurrentBarcodeInStore ? currentAnalysis : prefetchedRouteAnalysis
  );
  const [lookupContext, setLookupContext] = useState<DetailLookupContext>(() => {
    if (isCurrentBarcodeInStore && currentProduct) {
      return {
        source: mapStoreSourceToLookupSource(currentProduct.sourceName),
      };
    }

    if (prefetchedRouteProduct) {
      return {
        source: mapStoreSourceToLookupSource(prefetchedRouteProduct.sourceName),
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

  useEffect(() => {
    if (isCurrentBarcodeInStore || !prefetchedRouteProduct) {
      return;
    }

    setLocalProduct(prefetchedRouteProduct);
    setLocalAnalysis(prefetchedRouteAnalysis);
    setLoading(false);
    setError(null);
    setNotFoundReason(null);
    setLookupContext({
      source: mapStoreSourceToLookupSource(prefetchedRouteProduct.sourceName),
    });
  }, [
    isCurrentBarcodeInStore,
    prefetchedRouteAnalysis,
    prefetchedRouteProduct,
  ]);

  const originInfo = useMemo(
    () => barcodeDecoder.decode(normalizedRouteBarcode),
    [normalizedRouteBarcode]
  );

  const displayedProduct = localProduct;
  const displayedAnalysis = localAnalysis;
  const extendedProduct = displayedProduct as DisplayProduct | null;
  const isMedicineProduct = displayedProduct?.type === 'medicine';
  const analysisColor = displayedAnalysis?.color ?? '#888';

  const sourceLabel = useMemo(() => {
    if (!extendedProduct?.sourceName) return tt('source_unknown', 'Bilinmeyen Kaynak');

    return extendedProduct.sourceName === 'openfoodfacts'
      ? tt('source_open_food_facts', 'Open Food Facts')
      : extendedProduct.sourceName === 'titck'
        ? tt('source_titck', 'TITCK')
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
    if (extendedProduct?.type === 'medicine') {
      return (
        extendedProduct.license_status ||
        tt('medicine_license_status_unknown', 'Lisans durumu bilinmiyor')
      );
    }

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
    extendedProduct?.license_status,
    extendedProduct?.type,
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
      type: displayedProduct?.type ?? 'food',
      foundECodesCount: displayedAnalysis.foundECodes.length,
      hasApiScore: hasApiScoreSignal,
    });
  }, [displayedAnalysis, displayedProduct?.type, hasApiScoreSignal, tt]);

  const familyAlerts = useMemo(() => {
    if (!displayedProduct || !displayedAnalysis) return [];

    if (displayedProduct.type === 'medicine') {
      return [
        {
          id: 'medicine-official',
          title: tt('medicine_alert_title', 'Resmi ilaç kaydı'),
          description: tt(
            'medicine_alert_desc',
            'Bu bilgi TITCK ilaç kayıtlarından çözümlendi. Kullanım öncesi prospektüs ve sağlık profesyoneli yönlendirmesi dikkate alınmalıdır.'
          ),
          severity: 'info' as const,
        },
      ];
    }

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
    if (!displayedAnalysis || displayedProduct?.type === 'medicine') return false;
    return displayedAnalysis.score < 75;
  }, [displayedAnalysis, displayedProduct?.type]);

  const productImageUri = imageError
    ? 'https://via.placeholder.com/400?text=No+Image'
    : displayedProduct?.image_url || 'https://via.placeholder.com/400?text=No+Image';

  const metaChipItems = useMemo(
    () =>
      displayedProduct?.type === 'medicine'
        ? [
            {
              icon: 'server-outline' as const,
              label: sourceLabel,
            },
            {
              icon: 'medkit-outline' as const,
              label:
                displayedProduct.license_status ||
                tt('medicine_license_status_unknown', 'Lisans durumu bilinmiyor'),
            },
            {
              icon: 'document-text-outline' as const,
              label: `${tt('medicine_license_number', 'Ruhsat No')}: ${
                displayedProduct.license_number || '-'
              }`,
            },
            {
              icon: 'flask-outline' as const,
              label: `${tt('medicine_atc_code', 'ATC Kodu')}: ${
                displayedProduct.atc_code || '-'
              }`,
            },
          ]
        : [
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
    [
      actualOriginLabel,
      displayedProduct,
      gs1PrefixLabel,
      sourceLabel,
      tt,
    ]
  );

  const shareProductUrl = useMemo(() => {
    return buildProductShareUrl(
      normalizedRouteBarcode,
      displayedProduct?.type,
      displayedProduct?.sourceName,
      displayedProduct?.prospectus_pdf_url,
      displayedProduct?.summary_pdf_url
    );
  }, [
    displayedProduct?.prospectus_pdf_url,
    displayedProduct?.sourceName,
    displayedProduct?.summary_pdf_url,
    displayedProduct?.type,
    normalizedRouteBarcode,
  ]);

  const shareMessage = useMemo(() => {
    if (displayedProduct?.type === 'medicine') {
      return (
        `${displayedProduct.brand || tt('unknown_brand', 'Bilinmeyen Firma')} - ${
          displayedProduct.name || tt('unnamed_product', 'İsimsiz İlaç')
        }\n` +
        `${tt('medicine_active_ingredients', 'Etken Maddeler')}: ${
          displayedProduct.active_ingredients?.join(', ') ||
          displayedProduct.ingredients_text ||
          tt('unknown', 'Bilinmiyor')
        }\n` +
        `${tt('medicine_license_status', 'Lisans Durumu')}: ${
          displayedProduct.license_status || tt('unknown', 'Bilinmiyor')
        }\n` +
        `${tt('medicine_license_number', 'Ruhsat No')}: ${
          displayedProduct.license_number || '-'
        }\n` +
        `${tt('barcode_label', 'Barkod')}: ${normalizedRouteBarcode}`
      );
    }

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
    displayedProduct?.active_ingredients,
    displayedProduct?.brand,
    displayedProduct?.ingredients_text,
    displayedProduct?.license_number,
    displayedProduct?.license_status,
    displayedProduct?.name,
    displayedProduct?.type,
    gs1PrefixLabel,
    normalizedRouteBarcode,
    riskCompoundLabel,
    sourceLabel,
    tt,
  ]);

  const sharePreviewBody = useMemo(() => {
    if (displayedProduct?.type === 'medicine') {
      return `${tt('medicine_license_status', 'Lisans Durumu')}: ${
        displayedProduct.license_status || tt('unknown', 'Bilinmiyor')
      } • ${tt('medicine_active_ingredients', 'Etken Maddeler')}: ${
        displayedProduct.active_ingredients?.slice(0, 2).join(', ') ||
        displayedProduct.ingredients_text ||
        tt('unknown', 'Bilinmiyor')
      }`;
    }

    return `${tt('score_label', 'Skor')}: ${displayScore}/100 • ${riskCompoundLabel} • ${sourceLabel}`;
  }, [
    displayScore,
    displayedProduct?.active_ingredients,
    displayedProduct?.ingredients_text,
    displayedProduct?.license_status,
    displayedProduct?.type,
    riskCompoundLabel,
    sourceLabel,
    tt,
  ]);

  const openDocumentUrl = useCallback(
    async (url: string) => {
      try {
        await WebBrowser.openBrowserAsync(url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        });
      } catch (browserError) {
        console.warn('Document browser open failed, falling back to external URL:', browserError);
        await Linking.openURL(url);
      }
    },
    []
  );

  const medicineDocumentItems = useMemo(() => {
    if (displayedProduct?.type !== 'medicine') {
      return [];
    }

    const items = [];

    if (displayedProduct.prospectus_pdf_url) {
      items.push({
        key: 'prospectus',
        icon: 'document-attach-outline' as const,
        label: tt('medicine_open_prospectus', 'Prospektüsü Aç (KT PDF)'),
        helper:
          displayedProduct.prospectus_approval_date
            ? `${tt('medicine_last_updated', 'Onay tarihi')}: ${displayedProduct.prospectus_approval_date}`
            : tt(
                'medicine_document_helper',
                'Hasta kullanım talimatını uygulama içi tarayıcıda açar.'
              ),
        onPress: () => {
          void openDocumentUrl(displayedProduct.prospectus_pdf_url!);
        },
      });
    }

    if (displayedProduct.summary_pdf_url) {
      items.push({
        key: 'summary',
        icon: 'reader-outline' as const,
        label: tt('medicine_open_summary', 'KÜB Dosyasını Aç'),
        helper:
          displayedProduct.short_text_approval_date
            ? `${tt('medicine_last_updated', 'Onay tarihi')}: ${displayedProduct.short_text_approval_date}`
            : tt(
                'medicine_summary_helper',
                'Kısa ürün bilgisini resmi TITCK PDF kaynağında açar.'
              ),
        onPress: () => {
          void openDocumentUrl(displayedProduct.summary_pdf_url!);
        },
      });
    }

    return items;
  }, [displayedProduct, openDocumentUrl, tt]);

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
      if (!prefetchedRouteProduct) {
        setLoading(true);
      }
      setError(null);
      setImageError(false);
      setNotFoundReason(null);

      const result: ProductLookupResult = await lookupProductByBarcode(
        normalizedRouteBarcode,
        { lookupMode }
      );

      if (!result.found) {
        if (prefetchedRouteProduct && prefetchedRouteAnalysis) {
          console.warn('[DetailScreen] live lookup missed, keeping prefetched fallback:', {
            barcode: normalizedRouteBarcode,
            reason: result.reason,
          });

          setLocalProduct(prefetchedRouteProduct);
          setLocalAnalysis(prefetchedRouteAnalysis);
          setLookupContext({
            source: mapStoreSourceToLookupSource(prefetchedRouteProduct.sourceName),
            lookupMeta: result.lookupMeta,
          });
          lastResolvedBarcodeRef.current = normalizedRouteBarcode;
          return;
        }

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

      if (!historyAlreadySaved && lastSavedHistoryKeyRef.current !== historySaveKey) {
        try {
          await Promise.resolve(
            saveProductToHistory(
              product,
              product.type === 'medicine' ? null : analysis.score
            )
          );

          if (product.type !== 'medicine') {
            void enqueueRemoteHistorySync({
              product,
              score: analysis.score,
              riskLevel: analysis.riskLevel,
            });
          }

          lastSavedHistoryKeyRef.current = historySaveKey;
        } catch (historyError) {
          console.warn('History save failed:', historyError);
        }
      }
    } catch (loadError) {
      console.error('Detail load failed:', loadError);

      if (prefetchedRouteProduct && prefetchedRouteAnalysis) {
        setError(null);
        setNotFoundReason(null);
        setLocalProduct(prefetchedRouteProduct);
        setLocalAnalysis(prefetchedRouteAnalysis);
        setLookupContext({
          source: mapStoreSourceToLookupSource(prefetchedRouteProduct.sourceName),
        });
        lastResolvedBarcodeRef.current = normalizedRouteBarcode;
      } else {
        setError(tt('error_generic', 'Bir hata oluştu'));
        setNotFoundReason('unknown');
        setLocalProduct(null);
        setLocalAnalysis(null);
        setLookupContext({});
      }
    } finally {
      setLoading(false);
    }
  }, [
    localAnalysis,
    localProduct,
    historyAlreadySaved,
    lookupMode,
    normalizedRouteBarcode,
    prefetchedRouteAnalysis,
    prefetchedRouteProduct,
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
    if (
      !displayedProduct ||
      displayedProduct.type !== 'medicine' ||
      displayedProduct.prospectus_pdf_url ||
      displayedProduct.summary_pdf_url
    ) {
      return;
    }

    let cancelled = false;

    const enrichProspectus = async () => {
      const enrichedProduct = await enrichMedicineProductWithProspectus(displayedProduct);

      if (
        cancelled ||
        (!enrichedProduct.prospectus_pdf_url && !enrichedProduct.summary_pdf_url)
      ) {
        return;
      }

      setLocalProduct((current) => {
        if (!current || current.barcode !== enrichedProduct.barcode) {
          return current;
        }

        return {
          ...current,
          ...enrichedProduct,
        };
      });
    };

    void enrichProspectus();

    return () => {
      cancelled = true;
    };
  }, [
    displayedProduct,
    displayedProduct?.prospectus_pdf_url,
    displayedProduct?.summary_pdf_url,
    displayedProduct?.type,
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

          {isMedicineProduct ? (
            <NoticeCard
              text={tt(
                'medicine_notice',
                'Bu ilaç kaydı resmi TITCK veri kaynaklarından çözümlendi. Prospektüs ve KÜB PDF bağlantılarını aşağıdan açabilirsiniz.'
              )}
              colors={colors}
            />
          ) : FEATURES.productPresentation.gs1OriginLabelFixEnabled ? (
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

          {!isMedicineProduct ? (
            <ScoreOverviewCard
              score={displayScore}
              grade={displayGrade}
              riskLabel={riskCompoundLabel}
              recommendationText={recommendationText}
              analysisColor={analysisColor}
              colors={colors}
            />
          ) : null}

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
            title={
              isMedicineProduct
                ? tt('medicine_record_title', 'İlaç Kayıt Özeti')
                : tt('analysis_summary', 'Analiz Özeti')
            }
            text={summaryText}
            colors={colors}
          />

          {isMedicineProduct ? (
            <>
              <TextSection
                title={tt('medicine_active_ingredients', 'Etken Maddeler')}
                text={
                  displayedProduct.active_ingredients?.join(', ') ||
                  displayedProduct.ingredients_text ||
                  tt('medicine_active_ingredients_missing', 'Etken madde bilgisi bulunamadı')
                }
                colors={colors}
              />

              <TextSection
                title={tt('medicine_license_status', 'Lisans Durumu')}
                text={
                  displayedProduct.license_status ||
                  tt('medicine_license_status_unknown', 'Lisans durumu bilinmiyor')
                }
                colors={colors}
              />

              <TextSection
                title={tt('medicine_registration_info', 'Ruhsat Bilgisi')}
                text={
                  [
                    displayedProduct.license_number
                      ? `${tt('medicine_license_number', 'Ruhsat No')}: ${displayedProduct.license_number}`
                      : null,
                    displayedProduct.license_date
                      ? `${tt('medicine_license_date', 'Ruhsat Tarihi')}: ${displayedProduct.license_date}`
                      : null,
                    displayedProduct.suspension_date
                      ? `${tt('medicine_suspension_date', 'Askıya Alınma Tarihi')}: ${displayedProduct.suspension_date}`
                      : null,
                    displayedProduct.catalog_updated_at
                      ? `${tt('medicine_catalog_updated_at', 'Katalog Güncellemesi')}: ${displayedProduct.catalog_updated_at}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join('\n') ||
                  tt('medicine_registration_missing', 'Ruhsat ayrıntısı bulunamadı')
                }
                colors={colors}
              />

              {medicineDocumentItems.length ? (
                <ActionLinksSection
                  title={tt('medicine_documents', 'Prospektüs ve Belgeler')}
                  items={medicineDocumentItems}
                  colors={colors}
                />
              ) : (
                <NoticeCard
                  text={tt(
                    'medicine_documents_missing',
                    'Bu ilaç için prospektüs veya KÜB PDF kaydı şu anda çözümlenemedi.'
                  )}
                  colors={colors}
                />
              )}
            </>
          ) : (
            <>
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
            </>
          )}
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

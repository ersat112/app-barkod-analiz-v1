import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';

import { useAuth } from '../../context/AuthContext';
import {
  lookupProductByBarcode,
  type ProductLookupResult,
} from '../../services/productLookup.service';
import { FEATURES } from '../../config/features';
import { MARKET_GELSIN_RUNTIME } from '../../config/marketGelsinRuntime';
import { useTheme } from '../../context/ThemeContext';
import { useMissingProductFlow } from '../../hooks/useMissingProductFlow';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { adService } from '../../services/adService';
import { analyticsService } from '../../services/analytics.service';
import { saveProductToHistory } from '../../services/db';
import { entitlementService } from '../../services/entitlement.service';
import { freeScanPolicyService } from '../../services/freeScanPolicy.service';
import {
  getProductAlternativeSuggestions,
  type ProductAlternativeSuggestion,
} from '../../services/productAlternatives.service';
import {
  enrichMedicineProductWithIntendedUseSummary,
  enrichMedicineProductWithProspectus,
} from '../../services/titckMedicine.service';
import { enqueueRemoteHistorySync } from '../../services/historyRemoteSync.service';
import {
  buildMarketGelsinAlternativesRequest,
  buildMarketGelsinScanEventRequest,
} from '../../services/marketPricingContract.service';
import {
  fetchMarketAlternativePricing,
  fetchMarketProductOffers,
  postMarketScanEvent,
} from '../../services/marketPricing.service';
import {
  evaluateNutritionPreferences,
  hasActiveNutritionPreferences,
  type NutritionPreferenceEvaluation,
  type NutritionPreferenceKey,
} from '../../services/nutritionPreferences.service';
import { buildFamilyHealthAlerts } from '../../services/familyHealthProfile.service';
import { searchECodesInText } from '../../services/eCodesData';
import {
  resolveCanonicalCity,
  resolveCanonicalDistrict,
  resolveTurkeyCityCode,
} from '../../services/locationData';
import { usePreferenceStore } from '../../store/usePreferenceStore';
import { useScanStore } from '../../store/useScanStore';
import {
  analyzeProduct,
  type AnalysisResult,
  type Product,
} from '../../utils/analysis';
import { barcodeDecoder } from '../../utils/barcodeDecoder';

import { AdBanner } from '../../components/AdBanner';
import { AlternativeCard } from '../../components/AlternativeCard';
import { MarketOfferSheet } from '../../components/MarketOfferSheet';
import { MarketPriceTableCard } from '../../components/MarketPriceTableCard';
import {
  buildBestMarketOfferSummary,
  formatMarketDistance,
  formatMarketPrice,
  pickBestMarketOffer,
} from '../../components/marketPricingSummary';
import { FamilyHealthAlert } from '../../components/organisms/FamilyHealthAlert';
import { useAppScreenLayout } from '../../components/layout/useAppScreenLayout';
import {
  ActionLinksSection,
  AdditivesSection,
  CosmeticIngredientRiskSection,
  DetailErrorState,
  DetailHeroSection,
  DetailLoadingState,
  EvidenceSection,
  InfoActionCard,
  MetaChipsSection,
  MethodologySheet,
  NoticeCard,
  NutrientBalanceSection,
  ProductHighlightsSection,
  ProductHeadingSection,
  ScoreOverviewCard,
  ShareSheet,
  SummarySection,
  TextSection,
} from './detail/DetailSections';
import type {
  CosmeticIngredientInsightItem,
  MetaChipItem,
  MethodologySectionItem,
  NutrientBalanceItem,
  ProductHighlightItem,
} from './detail/DetailSections';
import type { ProductRepositoryCacheTier, ProductRepositoryLookupMeta } from '../../types/productRepository';
import type {
  MarketAlternativePricingEntry,
  MarketOffer,
  MarketProductOffersResponse,
} from '../../types/marketPricing';

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

type NutrientGaugeTone = 'darkGreen' | 'lightGreen' | 'orange' | 'red';

const getNutritionPreferenceLabel = (
  tt: TranslateFn,
  key: NutritionPreferenceKey
): string => {
  switch (key) {
    case 'glutenFree':
      return tt('preference_gluten_free', 'Glutensiz');
    case 'lactoseFree':
      return tt('preference_lactose_free', 'Laktozsuz');
    case 'palmOilFree':
      return tt('preference_palm_oil_free', 'Palmiye yağı uyarısı');
    case 'vegetarian':
      return tt('preference_vegetarian', 'Vejetaryen');
    case 'vegan':
      return tt('preference_vegan', 'Vegan');
    default:
      return key;
  }
};

const getNutritionStatusLabel = (
  tt: TranslateFn,
  status: NutritionPreferenceEvaluation['status']
): string => {
  switch (status) {
    case 'compatible':
      return tt('dietary_status_compatible', 'Uygun');
    case 'warning':
      return tt('dietary_status_warning', 'Dikkat');
    default:
      return tt('dietary_status_unknown', 'Belirsiz');
  }
};

const getNutritionEvaluationDetail = (
  tt: TranslateFn,
  evaluation: NutritionPreferenceEvaluation
): string => {
  const matchedValue = String(evaluation.matchedValue || '').replace(/^en:/i, '').trim();

  if (evaluation.status === 'compatible') {
    switch (evaluation.evidence) {
      case 'label':
        return tt(
          'dietary_detail_label_compatible',
          'Ürün etiketinde bu tercih için uyumlu bir işaret bulunuyor.'
        );
      case 'analysis':
        return tt(
          'dietary_detail_analysis_compatible',
          'İçerik analizi bu tercih için uyumlu bir sinyal veriyor.'
        );
      default:
        return tt(
          'dietary_detail_generic_compatible',
          'Bu tercih için olumlu bir uyumluluk sinyali bulundu.'
        );
    }
  }

  if (evaluation.status === 'warning') {
    switch (evaluation.evidence) {
      case 'allergen':
        return applyTemplate(
          tt(
            'dietary_detail_allergen_warning',
            'Alerjen bilgisinde {{value}} sinyali bulundu.'
          ),
          { value: matchedValue || tt('unknown', 'bilinmeyen içerik') }
        );
      case 'trace':
        return applyTemplate(
          tt(
            'dietary_detail_trace_warning',
            'İz içeriğinde {{value}} sinyali bulundu.'
          ),
          { value: matchedValue || tt('unknown', 'bilinmeyen içerik') }
        );
      case 'analysis':
        return tt(
          'dietary_detail_analysis_warning',
          'İçerik analizi bu tercih ile uyumsuz bir sinyal veriyor.'
        );
      case 'ingredient':
        return applyTemplate(
          tt(
            'dietary_detail_ingredient_warning',
            'İçerik metninde {{value}} ifadesi tespit edildi.'
          ),
          { value: matchedValue || tt('unknown', 'bilinmeyen içerik') }
        );
      default:
        return tt(
          'dietary_detail_generic_warning',
          'Bu tercih için dikkat gerektiren bir sinyal tespit edildi.'
        );
    }
  }

  return tt(
    'dietary_detail_unknown',
    'Bu tercih için yeterli veri bulunamadı.'
  );
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

const NUTRI_SCORE_OVERVIEW_URL =
  'https://www.santepubliquefrance.fr/en/nutri-score';
const WHO_FOPNL_GUIDANCE_URL =
  'https://apps.who.int/iris/bitstream/handle/10665/336988/WHO-EURO-2020-1569-41320-56234-eng.pdf?sequence=1&isAllowed=y';
const TITCK_PORTAL_URL = 'https://www.titck.gov.tr/kubkt';

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

const getNutrientToneColor = (tone: NutrientGaugeTone): string => {
  switch (tone) {
    case 'darkGreen':
      return '#18B56A';
    case 'lightGreen':
      return '#74C947';
    case 'orange':
      return '#E38B2D';
    case 'red':
    default:
      return '#D94B45';
  }
};

const getNumericNutriment = (
  nutriments: Record<string, unknown> | undefined,
  ...keys: string[]
): number | null => {
  for (const key of keys) {
    const value = nutriments?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
};

const formatNutrientValue = (
  value: number,
  unit: 'kcal' | 'g' | '%',
  locale: string
): string => {
  const maximumFractionDigits = unit === '%' ? 0 : value >= 10 ? 1 : 2;
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);

  return `${formatted} ${unit}`;
};

const buildLimitNutrientTone = (
  value: number,
  lowThreshold: number,
  lightThreshold: number,
  orangeThreshold: number
): NutrientGaugeTone => {
  if (value <= lowThreshold) return 'darkGreen';
  if (value <= lightThreshold) return 'lightGreen';
  if (value <= orangeThreshold) return 'orange';
  return 'red';
};

const buildEncourageNutrientTone = (
  value: number,
  lightThreshold: number,
  darkThreshold: number
): NutrientGaugeTone => {
  if (value >= darkThreshold) return 'darkGreen';
  if (value >= lightThreshold) return 'lightGreen';
  if (value > 0) return 'orange';
  return 'red';
};

const getNutrientEnvelope = (
  tt: TranslateFn,
  tone: NutrientGaugeTone,
  mode: 'limit' | 'encourage',
  subject: string
): string => {
  if (mode === 'limit') {
    switch (tone) {
      case 'darkGreen':
        return applyTemplate(
          tt('nutrient_envelope_limit_dark_green', 'Düşük {{subject}}'),
          { subject }
        );
      case 'lightGreen':
        return applyTemplate(
          tt('nutrient_envelope_limit_light_green', 'Düşük etkili {{subject}}'),
          { subject }
        );
      case 'orange':
        return applyTemplate(
          tt('nutrient_envelope_limit_orange', 'Biraz fazla {{subject}}'),
          { subject }
        );
      case 'red':
      default:
        return applyTemplate(
          tt('nutrient_envelope_limit_red', 'Çok {{subject}}'),
          { subject }
        );
    }
  }

  switch (tone) {
    case 'darkGreen':
      return applyTemplate(
        tt('nutrient_envelope_encourage_dark_green', 'Mükemmel miktarda {{subject}}'),
        { subject }
      );
    case 'lightGreen':
      return applyTemplate(
        tt('nutrient_envelope_encourage_light_green', 'İyi miktarda {{subject}}'),
        { subject }
      );
    case 'orange':
      return applyTemplate(
        tt('nutrient_envelope_encourage_orange', 'Az miktarda {{subject}}'),
        { subject }
      );
    case 'red':
    default:
      return applyTemplate(
        tt('nutrient_envelope_encourage_red', 'Çok düşük {{subject}}'),
        { subject }
      );
  }
};

const translateSignalKey = (tt: TranslateFn, key: 'nutrition' | 'processing' | 'additives'): string => {
  switch (key) {
    case 'nutrition':
      return tt('food_signal_nutrition_title', 'Besinsel kalite');
    case 'processing':
      return tt('food_signal_processing_title', 'İşlenme seviyesi');
    case 'additives':
      return tt('food_signal_additives_title', 'Katkı riski');
    default:
      return key;
  }
};

const buildFoodNutrientBalanceItems = (params: {
  product?: Product | null;
  tt: TranslateFn;
  locale: string;
}): NutrientBalanceItem[] => {
  const { product, tt, locale } = params;

  if (!product || product.type !== 'food') {
    return [];
  }

  const nutriments = product.nutriments || {};

  const items: NutrientBalanceItem[] = [];
  const pushItem = (item?: NutrientBalanceItem | null) => {
    if (item) {
      items.push(item);
    }
  };

  const energyKcal = getNumericNutriment(
    nutriments,
    'energy-kcal_100g',
    'energy-kcal_100ml',
    'energy-kcal',
    'energy-kcal_value'
  );
  if (typeof energyKcal === 'number') {
    const tone = buildLimitNutrientTone(energyKcal, 80, 240, 480);
    pushItem({
      key: 'energy',
      title: tt('nutrient_balance_energy_title', 'Kalori'),
      helper: tt('nutrient_balance_per_100', '100 g / 100 mL bazlı'),
      valueLabel: formatNutrientValue(energyKcal, 'kcal', locale),
      envelope: getNutrientEnvelope(tt, tone, 'limit', tt('nutrient_subject_calorie', 'kalori')),
      progress: Math.max(0, Math.min(1, energyKcal / 480)),
      accentColor: getNutrientToneColor(tone),
    });
  }

  const saturatedFat = getNumericNutriment(
    nutriments,
    'saturated-fat_100g',
    'saturated-fat_100ml',
    'saturated-fat'
  );
  if (typeof saturatedFat === 'number') {
    const tone = buildLimitNutrientTone(saturatedFat, 1, 3, 6);
    pushItem({
      key: 'saturated-fat',
      title: tt('nutrient_balance_saturated_fat_title', 'Doymuş yağ'),
      helper: tt('nutrient_balance_per_100', '100 g / 100 mL bazlı'),
      valueLabel: formatNutrientValue(saturatedFat, 'g', locale),
      envelope: getNutrientEnvelope(
        tt,
        tone,
        'limit',
        tt('nutrient_subject_saturated_fat', 'doymuş yağ')
      ),
      progress: Math.max(0, Math.min(1, saturatedFat / 10)),
      accentColor: getNutrientToneColor(tone),
    });
  }

  const sugars = getNumericNutriment(nutriments, 'sugars_100g', 'sugars_100ml', 'sugars');
  if (typeof sugars === 'number') {
    const tone = buildLimitNutrientTone(sugars, 4.5, 13.5, 27);
    pushItem({
      key: 'sugars',
      title: tt('nutrient_balance_sugar_title', 'Şeker'),
      helper: tt('nutrient_balance_per_100', '100 g / 100 mL bazlı'),
      valueLabel: formatNutrientValue(sugars, 'g', locale),
      envelope: getNutrientEnvelope(tt, tone, 'limit', tt('nutrient_subject_sugar', 'şeker')),
      progress: Math.max(0, Math.min(1, sugars / 45)),
      accentColor: getNutrientToneColor(tone),
    });
  }

  const salt = getNumericNutriment(nutriments, 'salt_100g', 'salt_100ml', 'salt');
  if (typeof salt === 'number') {
    const tone = buildLimitNutrientTone(salt, 0.225, 0.675, 1.35);
    pushItem({
      key: 'salt',
      title: tt('nutrient_balance_salt_title', 'Tuz'),
      helper: tt('nutrient_balance_per_100', '100 g / 100 mL bazlı'),
      valueLabel: formatNutrientValue(salt, 'g', locale),
      envelope: getNutrientEnvelope(tt, tone, 'limit', tt('nutrient_subject_salt', 'tuz')),
      progress: Math.max(0, Math.min(1, salt / 2.25)),
      accentColor: getNutrientToneColor(tone),
    });
  }

  const proteins = getNumericNutriment(
    nutriments,
    'proteins_100g',
    'proteins_100ml',
    'proteins'
  );
  if (typeof proteins === 'number') {
    const tone = buildEncourageNutrientTone(proteins, 4.8, 8);
    pushItem({
      key: 'proteins',
      title: tt('nutrient_balance_protein_title', 'Protein'),
      helper: tt('nutrient_balance_per_100', '100 g / 100 mL bazlı'),
      valueLabel: formatNutrientValue(proteins, 'g', locale),
      envelope: getNutrientEnvelope(
        tt,
        tone,
        'encourage',
        tt('nutrient_subject_protein', 'protein')
      ),
      progress: Math.max(0, Math.min(1, proteins / 8)),
      accentColor: getNutrientToneColor(tone),
    });
  }

  const fiber = getNumericNutriment(nutriments, 'fiber_100g', 'fiber_100ml', 'fiber');
  if (typeof fiber === 'number') {
    const tone = buildEncourageNutrientTone(fiber, 2.8, 4.7);
    pushItem({
      key: 'fiber',
      title: tt('nutrient_balance_fiber_title', 'Lif'),
      helper: tt('nutrient_balance_per_100', '100 g / 100 mL bazlı'),
      valueLabel: formatNutrientValue(fiber, 'g', locale),
      envelope: getNutrientEnvelope(tt, tone, 'encourage', tt('nutrient_subject_fiber', 'lif')),
      progress: Math.max(0, Math.min(1, fiber / 4.7)),
      accentColor: getNutrientToneColor(tone),
    });
  }

  const fruitVegetable = getNumericNutriment(
    nutriments,
    'fruits-vegetables-legumes-estimate-from-ingredients_100g',
    'fruits-vegetables-nuts-estimate-from-ingredients_100g',
    'fruits-vegetables-nuts_100g'
  );
  if (typeof fruitVegetable === 'number') {
    const tone = buildEncourageNutrientTone(fruitVegetable, 40, 80);
    pushItem({
      key: 'fruit-vegetable',
      title: tt('nutrient_balance_fruit_veg_title', 'Meyve / sebze'),
      helper: tt('nutrient_balance_estimated_share', 'Tahmini içerik oranı'),
      valueLabel: formatNutrientValue(fruitVegetable, '%', locale),
      envelope: getNutrientEnvelope(
        tt,
        tone,
        'encourage',
        tt('nutrient_subject_fruit_veg', 'meyve / sebze')
      ),
      progress: Math.max(0, Math.min(1, fruitVegetable / 100)),
      accentColor: getNutrientToneColor(tone),
    });
  }

  return items;
};

const buildFoodHighlights = (params: {
  product?: Product | null;
  analysis?: AnalysisResult | null;
  tt: TranslateFn;
  locale: string;
}): {
  negatives: ProductHighlightItem[];
  positives: ProductHighlightItem[];
} => {
  const { product, analysis, tt, locale } = params;

  if (!product || product.type !== 'food' || !analysis) {
    return { negatives: [], positives: [] };
  }

  const nutriments = product.nutriments || {};
  const negatives: ProductHighlightItem[] = [];
  const positives: ProductHighlightItem[] = [];

  const pushUnique = (
    list: ProductHighlightItem[],
    item?: ProductHighlightItem | null
  ) => {
    if (!item || list.some((entry) => entry.key === item.key)) {
      return;
    }

    list.push(item);
  };

  if (analysis.foundECodes.length > 0) {
    pushUnique(negatives, {
      key: 'additives',
      title: tt('food_highlight_additives_title', 'Katkı maddeleri'),
      detail:
        analysis.highRiskAdditiveCount > 0
          ? applyTemplate(
              tt(
                'food_highlight_additives_high_detail',
                '{{count}} katkı sinyali bulundu. Kaçınılması önerilen bileşenler içeriyor.'
              ),
              { count: analysis.foundECodes.length }
            )
          : applyTemplate(
              tt(
                'food_highlight_additives_detail',
                '{{count}} katkı sinyali bulundu. İçerik daha dikkatli okunmalı.'
              ),
              { count: analysis.foundECodes.length }
            ),
      accentColor: '#D94B45',
    });
  }

  const calories = getNumericNutriment(
    nutriments,
    'energy-kcal_100g',
    'energy-kcal_100ml',
    'energy-kcal',
    'energy-kcal_value'
  );
  if (typeof calories === 'number') {
    const tone = buildLimitNutrientTone(calories, 80, 240, 480);
    if (tone === 'orange' || tone === 'red') {
      pushUnique(negatives, {
        key: 'calories',
        title: tt('food_highlight_calories_title', 'Kalori'),
        detail:
          tone === 'red'
            ? applyTemplate(
                tt('food_highlight_calories_red', '100 g / mL için yüksek enerji: {{value}}.'),
                { value: formatNutrientValue(calories, 'kcal', locale) }
              )
            : applyTemplate(
                tt('food_highlight_calories_orange', '100 g / mL için biraz yüksek enerji: {{value}}.'),
                { value: formatNutrientValue(calories, 'kcal', locale) }
              ),
        accentColor: getNutrientToneColor(tone),
      });
    }
  }

  const salt = getNumericNutriment(nutriments, 'salt_100g', 'salt_100ml', 'salt');
  if (typeof salt === 'number') {
    const tone = buildLimitNutrientTone(salt, 0.225, 0.675, 1.35);
    if (tone === 'orange' || tone === 'red') {
      pushUnique(negatives, {
        key: 'salt',
        title: tt('food_highlight_salt_title', 'Tuz'),
        detail:
          tone === 'red'
            ? applyTemplate(
                tt('food_highlight_salt_red', '100 g / mL için çok tuzlu: {{value}}.'),
                { value: formatNutrientValue(salt, 'g', locale) }
              )
            : applyTemplate(
                tt('food_highlight_salt_orange', '100 g / mL için biraz fazla tuz içeriyor: {{value}}.'),
                { value: formatNutrientValue(salt, 'g', locale) }
              ),
        accentColor: getNutrientToneColor(tone),
      });
    }
  }

  const sugar = getNumericNutriment(nutriments, 'sugars_100g', 'sugars_100ml', 'sugars');
  if (typeof sugar === 'number') {
    const tone = buildLimitNutrientTone(sugar, 4.5, 13.5, 27);
    if (tone === 'orange' || tone === 'red') {
      pushUnique(negatives, {
        key: 'sugar-negative',
        title: tt('food_highlight_sugar_title', 'Şeker'),
        detail:
          tone === 'red'
            ? applyTemplate(
                tt('food_highlight_sugar_red', '100 g / mL için yüksek şeker: {{value}}.'),
                { value: formatNutrientValue(sugar, 'g', locale) }
              )
            : applyTemplate(
                tt('food_highlight_sugar_orange', '100 g / mL için biraz fazla şeker: {{value}}.'),
                { value: formatNutrientValue(sugar, 'g', locale) }
              ),
        accentColor: getNutrientToneColor(tone),
      });
    } else {
      pushUnique(positives, {
        key: 'sugar-positive',
        title: tt('food_highlight_low_sugar_title', 'Şeker'),
        detail:
          tone === 'darkGreen'
            ? tt('food_highlight_low_sugar_dark', 'Şeker yükü düşük görünüyor.')
            : tt('food_highlight_low_sugar_light', 'Şeker etkisi düşük seviyede kalıyor.'),
        accentColor: getNutrientToneColor(tone),
      });
    }
  }

  const protein = getNumericNutriment(nutriments, 'proteins_100g', 'proteins_100ml', 'proteins');
  if (typeof protein === 'number') {
    const tone = buildEncourageNutrientTone(protein, 4.8, 8);
    if (tone === 'darkGreen' || tone === 'lightGreen') {
      pushUnique(positives, {
        key: 'protein',
        title: tt('food_highlight_protein_title', 'Protein'),
        detail:
          tone === 'darkGreen'
            ? applyTemplate(
                tt('food_highlight_protein_dark', 'Protein miktarı güçlü: {{value}}.'),
                { value: formatNutrientValue(protein, 'g', locale) }
              )
            : applyTemplate(
                tt('food_highlight_protein_light', 'Protein desteği var: {{value}}.'),
                { value: formatNutrientValue(protein, 'g', locale) }
              ),
        accentColor: getNutrientToneColor(tone),
      });
    }
  }

  const fiber = getNumericNutriment(nutriments, 'fiber_100g', 'fiber_100ml', 'fiber');
  if (typeof fiber === 'number') {
    const tone = buildEncourageNutrientTone(fiber, 2.8, 4.7);
    if (tone === 'darkGreen' || tone === 'lightGreen') {
      pushUnique(positives, {
        key: 'fiber',
        title: tt('food_highlight_fiber_title', 'Lif'),
        detail:
          tone === 'darkGreen'
            ? applyTemplate(
                tt('food_highlight_fiber_dark', 'Lif miktarı güçlü: {{value}}.'),
                { value: formatNutrientValue(fiber, 'g', locale) }
              )
            : applyTemplate(
                tt('food_highlight_fiber_light', 'Lif desteği var: {{value}}.'),
                { value: formatNutrientValue(fiber, 'g', locale) }
              ),
        accentColor: getNutrientToneColor(tone),
      });
    }
  }

  const fruitVegetable = getNumericNutriment(
    nutriments,
    'fruits-vegetables-legumes-estimate-from-ingredients_100g',
    'fruits-vegetables-nuts-estimate-from-ingredients_100g',
    'fruits-vegetables-nuts_100g'
  );
  if (typeof fruitVegetable === 'number') {
    const tone = buildEncourageNutrientTone(fruitVegetable, 40, 80);
    if (tone === 'darkGreen' || tone === 'lightGreen') {
      pushUnique(positives, {
        key: 'fruit-veg',
        title: tt('food_highlight_fruit_veg_title', 'Meyve / sebze'),
        detail:
          tone === 'darkGreen'
            ? applyTemplate(
                tt('food_highlight_fruit_veg_dark', 'Meyve / sebze oranı yüksek: {{value}}.'),
                { value: formatNutrientValue(fruitVegetable, '%', locale) }
              )
            : applyTemplate(
                tt('food_highlight_fruit_veg_light', 'İyi bir meyve / sebze oranı var: {{value}}.'),
                { value: formatNutrientValue(fruitVegetable, '%', locale) }
              ),
        accentColor: getNutrientToneColor(tone),
      });
    }
  }

  return {
    negatives: negatives.slice(0, 3),
    positives: positives.slice(0, 3),
  };
};

const normalizeIngredientEntry = (value: string): string =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^\W+|\W+$/g, '')
    .trim();

const splitIngredientsText = (value?: string | null): string[] => {
  return String(value || '')
    .split(/[,;\n]+/)
    .map(normalizeIngredientEntry)
    .filter(Boolean);
};

const getCosmeticRiskColor = (label: string): string => {
  const normalized = label.toLowerCase();
  if (normalized.includes('yüksek') || normalized.includes('high')) return '#D94B45';
  if (normalized.includes('orta') || normalized.includes('moderate')) return '#E38B2D';
  if (normalized.includes('düşük') || normalized.includes('low')) return '#74C947';
  return '#94A3B8';
};

const buildCosmeticIngredientInsights = (params: {
  product?: Product | null;
  tt: TranslateFn;
}): CosmeticIngredientInsightItem[] => {
  const { product, tt } = params;

  if (!product || product.type !== 'beauty') {
    return [];
  }

  const parsed = splitIngredientsText(product.ingredients_text);
  const unique = Array.from(new Set(parsed)).slice(0, 24);

  const ranked = unique.map((ingredient, index) => {
    const matches = searchECodesInText(ingredient);
    const matched = matches[0];

    if (matched) {
      const riskLabel = translateRiskLevel(tt, matched.risk);
      return {
        order: matched.risk === 'Yüksek' ? 0 : matched.risk === 'Orta' ? 1 : 2,
        item: {
          key: `${ingredient}-${index}`,
          title: ingredient,
          riskLabel,
          accentColor: getCosmeticRiskColor(riskLabel),
          summary: `${matched.category} • ${matched.description}`,
          detail: matched.impact,
        } satisfies CosmeticIngredientInsightItem,
      };
    }

    return {
      order: 3,
      item: {
        key: `${ingredient}-${index}`,
        title: ingredient,
        riskLabel: tt('beauty_ingredient_no_clear_signal', 'Belirgin risk sinyali yok'),
        accentColor: '#94A3B8',
        summary: tt(
          'beauty_ingredient_no_clear_signal_detail',
          'Bu içerik için mevcut yerel risk kütüphanesinde doğrudan bir eşleşme bulunmadı.'
        ),
      } satisfies CosmeticIngredientInsightItem,
    };
  });

  return ranked
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.item);
};

const getMedicineTherapeuticAreaSummary = (
  tt: TranslateFn,
  atcCode?: string | null
): string | null => {
  const normalizedCode = String(atcCode || '').trim().toUpperCase();

  if (!normalizedCode) {
    return null;
  }

  const groupMap: Record<string, string> = {
    A: tt(
      'medicine_atc_group_a',
      'Sindirim sistemi ve metabolizma ile ilişkili bir tedavi grubunda yer alır.'
    ),
    B: tt(
      'medicine_atc_group_b',
      'Kan ve kan yapıcı organlarla ilişkili bir tedavi grubunda yer alır.'
    ),
    C: tt(
      'medicine_atc_group_c',
      'Kalp ve damar sistemiyle ilişkili bir tedavi grubunda yer alır.'
    ),
    D: tt(
      'medicine_atc_group_d',
      'Dermatolojik kullanım alanına yakın bir tedavi grubunda yer alır.'
    ),
    G: tt(
      'medicine_atc_group_g',
      'Genitoüriner sistem ve ilgili hormonal kullanım alanlarına yakın bir tedavi grubunda yer alır.'
    ),
    H: tt(
      'medicine_atc_group_h',
      'Sistemik hormonal preparatlar grubunda yer alır.'
    ),
    J: tt(
      'medicine_atc_group_j',
      'Sistemik anti-enfektif tedavi grubunda yer alır.'
    ),
    L: tt(
      'medicine_atc_group_l',
      'Onkoloji veya immün düzenleyici tedavi grubunda yer alır.'
    ),
    M: tt(
      'medicine_atc_group_m',
      'Kas-iskelet sistemiyle ilişkili bir tedavi grubunda yer alır.'
    ),
    N: tt(
      'medicine_atc_group_n',
      'Sinir sistemiyle ilişkili bir tedavi grubunda yer alır.'
    ),
    P: tt(
      'medicine_atc_group_p',
      'Antiparaziter veya benzeri koruyucu kullanım alanlarına yakın bir tedavi grubunda yer alır.'
    ),
    R: tt(
      'medicine_atc_group_r',
      'Solunum sistemiyle ilişkili bir tedavi grubunda yer alır.'
    ),
    S: tt(
      'medicine_atc_group_s',
      'Duyu organlarıyla ilişkili bir tedavi grubunda yer alır.'
    ),
    V: tt(
      'medicine_atc_group_v',
      'Çeşitli tıbbi kullanım alanlarını kapsayan bir tedavi grubunda yer alır.'
    ),
  };

  const groupSummary = groupMap[normalizedCode.charAt(0)];

  if (!groupSummary) {
    return null;
  }

  return applyTemplate(
    tt(
      'medicine_atc_summary_template',
      'ATC sınıfı {{code}}. {{summary}}'
    ),
    {
      code: normalizedCode,
      summary: groupSummary,
    }
  );
};

const buildAlternativeSubtitle = (
  tt: TranslateFn,
  productType: Product['type'],
  suggestion: ProductAlternativeSuggestion,
  marketHint?: string | null
): string => {
  const parts: string[] = [];

  if (suggestion.scoreDelta > 0) {
    parts.push(
      applyTemplate(
        tt(
          'alternative_reason_score_delta',
          '+{{count}} puan daha yüksek analiz skoru sundu.'
        ),
        { count: suggestion.scoreDelta }
      )
    );
  }

  if (productType === 'food' && suggestion.novaImprovement > 0) {
    parts.push(
      tt(
        'alternative_reason_food_processing',
        'Daha düşük işlenme seviyesiyle öne çıkıyor.'
      )
    );
  }

  if (suggestion.additiveImprovement > 0) {
    parts.push(
      productType === 'food'
        ? tt(
            'alternative_reason_food_additives',
            'Katkı sinyali daha sade görünüyor.'
          )
        : tt(
            'alternative_reason_beauty_additives',
            'İçerik sinyali daha sade görünüyor.'
          )
    );
  }

  if (!parts.length && suggestion.sharedTokenCount > 0) {
    parts.push(
      tt(
        'alternative_reason_similarity',
        'Benzer kullanım amacı için daha iyi bir seçenek olabilir.'
      )
    );
  }

  if (marketHint) {
    parts.push(marketHint);
  }

  return parts.join(' ');
};

const buildAlternativeBadge = (
  tt: TranslateFn,
  suggestion: ProductAlternativeSuggestion,
  index: number
): string => {
  if (index === 0) {
    return tt('alternative_best_badge', 'En iyi eşleşme');
  }

  if (suggestion.candidateSource === 'favorite') {
    return tt('alternative_favorite_badge', 'Favorilerden');
  }

  return tt('alternative_badge', 'Öneri');
};

const buildAlternativeMarketHint = (params: {
  tt: TranslateFn;
  locale: string;
  offer?: MarketOffer | null;
  locationLabel?: string | null;
}): string | null => {
  if (!params.offer) {
    return null;
  }

  const location = params.locationLabel || params.offer.cityName || params.tt('location', 'Konum');

  return applyTemplate(
    params.tt(
      'alternative_reason_market_price',
      '{{location}} için {{market}} fiyatı {{price}}.'
    ),
    {
      location,
      market: params.offer.marketName,
      price: formatMarketPrice(params.locale, params.offer.price, params.offer.currency),
    }
  );
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
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const nutritionPreferences = usePreferenceStore((state) => state.nutritionPreferences);
  const familyHealthProfile = usePreferenceStore((state) => state.familyHealthProfile);
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
  const [methodologySheetVisible, setMethodologySheetVisible] = useState(false);
  const [marketOfferSheet, setMarketOfferSheet] = useState<MarketOffer | null>(null);
  const [notFoundReason, setNotFoundReason] = useState<'not_found' | 'invalid_barcode' | 'unknown' | null>(null);
  const [marketOffersLoading, setMarketOffersLoading] = useState(false);
  const [marketOffersError, setMarketOffersError] = useState<string | null>(null);
  const [marketOffersResponse, setMarketOffersResponse] =
    useState<MarketProductOffersResponse | null>(null);
  const [alternativePricingByBarcode, setAlternativePricingByBarcode] = useState<
    Record<string, MarketAlternativePricingEntry>
  >({});

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
  const lastMarketScanSignalKeyRef = useRef<string | null>(null);

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
  const preferredLocale = i18n.language || 'tr-TR';

  const profileCity = useMemo(() => {
    const fallbackCity = String(profile?.city || '').trim();
    return (resolveCanonicalCity(profile?.city) ?? fallbackCity) || null;
  }, [profile?.city]);
  const profileDistrict = useMemo(() => {
    if (!profileCity) {
      return null;
    }

    const fallbackDistrict = String(profile?.district || '').trim();

    return (
      (resolveCanonicalDistrict(profileCity, profile?.district) ??
        fallbackDistrict) ||
      null
    );
  }, [profile?.district, profileCity]);
  const profileCityCode = useMemo(
    () => resolveTurkeyCityCode(profileCity),
    [profileCity]
  );
  const marketPricingLocationLabel = useMemo(() => {
    if (profileCity && profileDistrict) {
      return `${profileCity} / ${profileDistrict}`;
    }

    return profileCity || profileDistrict || null;
  }, [profileCity, profileDistrict]);

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

  const foodDataTransparencyText = useMemo(() => {
    if (!displayedAnalysis || displayedProduct?.type !== 'food') {
      return null;
    }

    if (displayedAnalysis.signalCoverage === 'full') {
      return tt(
        'food_signal_transparency_full',
        'Bu skor besinsel kalite, işlenme seviyesi ve katkı sinyalleri birlikte değerlendirilerek üretildi.'
      );
    }

    const missingLabels = displayedAnalysis.missingSignals
      .map((key) => translateSignalKey(tt, key))
      .join(', ');

    if (displayedAnalysis.signalCoverage === 'partial') {
      return applyTemplate(
        tt(
          'food_signal_transparency_partial',
          'Bu skor mevcut verilerle üretildi. Eksik kalan sinyaller: {{missing}}.'
        ),
        { missing: missingLabels }
      );
    }

    return applyTemplate(
      tt(
        'food_signal_transparency_limited',
        'Bu ürün için veri sınırlı. Skor yalnızca eldeki sinyallerle üretildi; eksik alanlar: {{missing}}.'
      ),
      { missing: missingLabels || tt('unknown', 'Bilinmiyor') }
    );
  }, [displayedAnalysis, displayedProduct?.type, tt]);

  const nutrientBalanceItems = useMemo(() => {
    return buildFoodNutrientBalanceItems({
      product: displayedProduct,
      tt,
      locale: preferredLocale,
    });
  }, [displayedProduct, preferredLocale, tt]);

  const foodHighlights = useMemo(() => {
    return buildFoodHighlights({
      product: displayedProduct,
      analysis: displayedAnalysis,
      tt,
      locale: preferredLocale,
    });
  }, [displayedAnalysis, displayedProduct, preferredLocale, tt]);

  const cosmeticIngredientInsights = useMemo(() => {
    return buildCosmeticIngredientInsights({
      product: displayedProduct,
      tt,
    });
  }, [displayedProduct, tt]);

  const methodologySignalLabels = useMemo(() => {
    if (!displayedProduct || !displayedAnalysis || displayedProduct.type === 'medicine') {
      return [];
    }

    const labels: string[] = [];
    const normalizedGrade = String(displayedProduct.grade || '')
      .trim()
      .toUpperCase();

    if (typeof displayedProduct.score === 'number') {
      labels.push(tt('methodology_signal_api_score', 'API skoru'));
    }

    if (['A', 'B', 'C', 'D', 'E'].includes(normalizedGrade)) {
      labels.push(tt('methodology_signal_grade', 'ürün derecesi'));
    }

    if (displayedProduct.type === 'food' && displayedAnalysis.novaGroup) {
      labels.push(tt('methodology_signal_nova', 'NOVA sınıfı'));
    }

    if (displayedProduct.ingredients_text?.trim()) {
      labels.push(tt('ingredients', 'İçerik'));
    }

    if (displayedAnalysis.foundECodes.length > 0) {
      labels.push(tt('methodology_signal_additive_matches', 'eşleşen katkı maddeleri'));
    }

    if (displayedProduct.type === 'beauty' && displayedProduct.usage_instructions?.trim()) {
      labels.push(tt('methodology_signal_usage', 'kullanım bilgisi'));
    }

    return labels;
  }, [displayedAnalysis, displayedProduct, tt]);

  const methodologySourceTags = useMemo(() => {
    if (!displayedProduct || displayedProduct.type === 'medicine') {
      return [];
    }

    if (displayedProduct.type === 'food') {
      return [
        tt('source_tag_community', 'Topluluk veritabanı'),
        tt('source_tag_processing_model', 'Besin / NOVA modeli'),
        tt('source_tag_ingredient_scan', 'İçerik taraması'),
      ];
    }

    return [
      tt('source_tag_community', 'Topluluk veritabanı'),
      tt('source_tag_ingredient_scan', 'İçerik taraması'),
      tt('source_tag_precautionary', 'İhtiyat ilkesi'),
    ];
  }, [displayedProduct, tt]);

  const methodologySections = useMemo<MethodologySectionItem[]>(() => {
    if (!displayedProduct || !displayedAnalysis || displayedProduct.type === 'medicine') {
      return [];
    }

    const signalsText = methodologySignalLabels.length
      ? applyTemplate(
          tt(
            'methodology_signals_available',
            'Bu ürün için şu sinyaller kullanıldı: {{signals}}.'
          ),
          { signals: methodologySignalLabels.join(', ') }
        )
      : tt(
          'methodology_signals_missing',
          'Bu ürün için yalnızca temel kayıt bilgileri mevcut; sinyal verisi sınırlı.'
        );

    if (displayedProduct.type === 'food') {
      const missingLabels = displayedAnalysis.missingSignals
        .map((key) => translateSignalKey(tt, key))
        .join(', ');

      const coverageBody =
        displayedAnalysis.signalCoverage === 'full'
          ? tt(
              'methodology_coverage_full',
              'Üç sinyal de mevcut. Genel skor, besinsel kalite, işlenme seviyesi ve katkı riskinin birlikte yorumlanmasıyla oluştu.'
            )
          : displayedAnalysis.signalCoverage === 'partial'
            ? applyTemplate(
                tt(
                  'methodology_coverage_partial',
                  'Bazı sinyaller eksik: {{missing}}. Genel skor yalnızca eldeki verilerle üretildi.'
                ),
                { missing: missingLabels }
              )
            : applyTemplate(
                tt(
                  'methodology_coverage_limited',
                  'Veri sınırlı: {{missing}}. Bu sonuç yönlendirici bir sinyal olarak görülmeli.'
                ),
                { missing: missingLabels || tt('unknown', 'Bilinmiyor') }
              );

      return [
        {
          key: 'how',
          title: tt('score_methodology_section_how', 'Skor nasıl oluştu?'),
          body: tt(
            'methodology_food_how_body',
            'Gıda skoru; resmi besin puanı, NOVA işlenme seviyesi ve içerikteki katkı sinyallerinin birlikte yorumlanmasıyla oluşur.'
          ),
        },
        {
          key: 'signals',
          title: tt('score_methodology_section_signals', 'Kullanılan sinyaller'),
          body: signalsText,
        },
        {
          key: 'coverage',
          title: tt('score_methodology_section_coverage', 'Veri kapsamı'),
          body: coverageBody,
        },
      ];
    }

    const beautyMissingParts: string[] = [];

    if (!displayedProduct.ingredients_text?.trim()) {
      beautyMissingParts.push(tt('ingredients', 'İçerik'));
    }

    if (
      typeof displayedProduct.score !== 'number' &&
      !String(displayedProduct.grade || '').trim()
    ) {
      beautyMissingParts.push(tt('methodology_signal_api_score', 'API skoru'));
    }

    if (!displayedProduct.usage_instructions?.trim()) {
      beautyMissingParts.push(tt('methodology_signal_usage', 'kullanım bilgisi'));
    }

    const beautyLimitsBody = beautyMissingParts.length
      ? applyTemplate(
          tt(
            'methodology_beauty_limits_missing',
            'Bazı kozmetik sinyalleri eksik: {{missing}}. Bu yorum ihtiyatlı bir özet olarak görülmeli.'
          ),
          { missing: beautyMissingParts.join(', ') }
        )
      : tt(
          'methodology_beauty_limits_full',
          'Temel kozmetik sinyalleri mevcut. Yorum, içerik verisi ve mevcut kaynak kaydıyla birlikte okunmalıdır.'
        );

    return [
      {
        key: 'how',
        title: tt('score_methodology_section_how', 'Skor nasıl oluştu?'),
        body: tt(
          'methodology_beauty_how_body',
          'Kozmetik yorumu; mevcut kaynak skoru, içerik metni ve tespit edilen bileşen sinyallerinin birlikte değerlendirilmesiyle oluşur.'
        ),
      },
      {
        key: 'signals',
        title: tt('score_methodology_section_signals', 'Kullanılan sinyaller'),
        body: signalsText,
      },
      {
        key: 'limits',
        title: tt('score_methodology_section_limits', 'Yorum sınırları'),
        body: beautyLimitsBody,
      },
    ];
  }, [
    displayedAnalysis,
    displayedProduct,
    methodologySignalLabels,
    tt,
  ]);

  const beautyMethodologyText = useMemo(() => {
    if (!displayedProduct || displayedProduct.type !== 'beauty') {
      return null;
    }

    const hasIngredientSignal = Boolean(displayedProduct.ingredients_text?.trim());
    const hasSourceSignal =
      typeof displayedProduct.score === 'number' || Boolean(displayedProduct.grade?.trim());

    if (hasIngredientSignal && hasSourceSignal) {
      return tt(
        'beauty_methodology_text_full',
        'Bu kozmetik yorumu; mevcut kaynak skoru, içerik metni ve kullanım bağlamı birlikte okunarak üretilir. Sonuç tıbbi tanı vermez, ihtiyatlı bir kullanıcı özetidir.'
      );
    }

    return tt(
      'beauty_methodology_text_limited',
      'Bu kozmetik yorumunda veri sınırlı olabilir. Mevcut kayıt ve içerik sinyalleri üzerinden ihtiyatlı bir özet sunulur.'
    );
  }, [displayedProduct, tt]);

  const scientificEvidenceSummary = useMemo(() => {
    if (!displayedProduct) {
      return '';
    }

    if (displayedProduct.type === 'medicine') {
      return tt(
        'scientific_basis_medicine_summary',
        'Bu kayıt resmi TITCK ilaç kataloğu ve varsa prospektüs/KÜB belgeleri üzerinden çözümlendi. İlaç değerlendirmesi topluluk yorumu değil, resmi kayıt zincirine dayanır.'
      );
    }

    if (displayedProduct.type === 'beauty') {
      return tt(
        'scientific_basis_beauty_summary',
        'Kozmetik yorumu; ürün kaydı, içerik metni ve tespit edilen içerik sinyalleri birlikte okunarak oluşturulur. Bu yüzey tıbbi karar yerine ihtiyatlı kullanıcı farkındalığı sağlar.'
      );
    }

    return tt(
      'scientific_basis_food_summary',
      'Gıda yorumu; zorunlu besin tablosunu tamamlayan resmi Nutri-Score alanları, NOVA işlenme seviyesi ve içerik taramasından gelen katkı sinyalleri birlikte değerlendirilerek oluşturulur.'
    );
  }, [displayedProduct, tt]);

  const scientificEvidenceTags = useMemo(() => {
    if (!displayedProduct) {
      return [];
    }

    if (displayedProduct.type === 'medicine') {
      return [
        tt('scientific_tag_official_record', 'Resmi kayıt'),
        tt('scientific_tag_regulatory_document', 'Düzenleyici belge'),
      ];
    }

    if (displayedProduct.type === 'beauty') {
      return [
        tt('source_tag_community', 'Topluluk veritabanı'),
        tt('source_tag_ingredient_scan', 'İçerik taraması'),
        tt('source_tag_precautionary', 'İhtiyat ilkesi'),
      ];
    }

    return [
      tt('source_tag_community', 'Topluluk veritabanı'),
      tt('source_tag_processing_model', 'Besin / NOVA modeli'),
      tt('source_tag_ingredient_scan', 'İçerik taraması'),
    ];
  }, [displayedProduct, tt]);

  const familyAlerts = useMemo(() => {
    if (!displayedProduct || !displayedAnalysis) return [];

    const alerts = buildFamilyHealthAlerts({
      product: displayedProduct,
      analysis: displayedAnalysis,
      profile: familyHealthProfile,
      tt,
    });

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
  }, [displayedAnalysis, displayedProduct, familyHealthProfile, tt]);

  const showAlternativeCard = useMemo(() => {
    if (!displayedAnalysis || displayedProduct?.type === 'medicine') return false;
    return displayedAnalysis.score < 75;
  }, [displayedAnalysis, displayedProduct?.type]);

  const nutritionPreferenceEvaluations = useMemo(() => {
    if (
      !displayedProduct ||
      displayedProduct.type !== 'food' ||
      !hasActiveNutritionPreferences(nutritionPreferences)
    ) {
      return [];
    }

    return evaluateNutritionPreferences(displayedProduct, nutritionPreferences);
  }, [displayedProduct, nutritionPreferences]);

  const nutritionSuitabilityText = useMemo(() => {
    if (!nutritionPreferenceEvaluations.length) {
      return null;
    }

    return nutritionPreferenceEvaluations
      .map((item) => {
        return `${getNutritionPreferenceLabel(tt, item.key)}: ${getNutritionStatusLabel(
          tt,
          item.status
        )} — ${getNutritionEvaluationDetail(tt, item)}`;
      })
      .join('\n');
  }, [nutritionPreferenceEvaluations, tt]);

  const alternativeSuggestions = useMemo(() => {
    if (!displayedProduct || !displayedAnalysis || displayedProduct.type === 'medicine') {
      return [];
    }

    if (displayedAnalysis.score >= 75) {
      return [];
    }

    return getProductAlternativeSuggestions({
      product: displayedProduct,
      analysis: displayedAnalysis,
      limit: 3,
      nutritionPreferences,
    });
  }, [displayedAnalysis, displayedProduct, nutritionPreferences]);

  useEffect(() => {
    if (!MARKET_GELSIN_RUNTIME.isEnabled || !normalizedRouteBarcode) {
      return;
    }

    const nextSignalKey = [
      normalizedRouteBarcode,
      profileCityCode ?? '',
      profileDistrict ?? '',
    ].join(':');

    if (lastMarketScanSignalKeyRef.current === nextSignalKey) {
      return;
    }

    lastMarketScanSignalKeyRef.current = nextSignalKey;

    void postMarketScanEvent(
      buildMarketGelsinScanEventRequest({
        barcode: normalizedRouteBarcode,
        cityCode: profileCityCode ?? null,
        districtName: profileDistrict ?? null,
        platform: 'native',
        scannedAt: new Date().toISOString(),
        appVersion: Constants.expoConfig?.version ?? null,
      })
    ).catch((signalError) => {
      console.error('[DetailScreen] market scan signal failed:', signalError);
    });
  }, [normalizedRouteBarcode, profileCityCode, profileDistrict]);

  useEffect(() => {
    if (
      !MARKET_GELSIN_RUNTIME.isEnabled ||
      !displayedProduct ||
      displayedProduct.type === 'medicine' ||
      !profileCityCode
    ) {
      setMarketOffersResponse(null);
      setMarketOffersError(null);
      setMarketOffersLoading(false);
      return;
    }

    let cancelled = false;

    const loadMarketOffers = async () => {
      try {
        setMarketOffersLoading(true);
        setMarketOffersError(null);

        const nextResponse = await fetchMarketProductOffers(normalizedRouteBarcode, {
          cityCode: profileCityCode,
          districtName: profileDistrict ?? undefined,
          limit: 24,
          includeOutOfStock: true,
        });

        if (cancelled) {
          return;
        }

        setMarketOffersResponse(nextResponse);
      } catch (loadError) {
        console.error('[DetailScreen] market offers load failed:', loadError);

        if (cancelled) {
          return;
        }

        setMarketOffersResponse(null);
        setMarketOffersError(
          tt(
            'market_pricing_error',
            'Fiyat katmanı şu anda yüklenemedi. Daha sonra tekrar deneyebilirsiniz.'
          )
        );
      } finally {
        if (!cancelled) {
          setMarketOffersLoading(false);
        }
      }
    };

    void loadMarketOffers();

    return () => {
      cancelled = true;
    };
  }, [
    displayedProduct,
    normalizedRouteBarcode,
    profileCityCode,
    profileDistrict,
    tt,
  ]);

  useEffect(() => {
    if (
      !MARKET_GELSIN_RUNTIME.isEnabled ||
      !displayedProduct ||
      displayedProduct.type === 'medicine' ||
      !profileCityCode ||
      !alternativeSuggestions.length
    ) {
      setAlternativePricingByBarcode({});
      return;
    }

    const candidateBarcodes = alternativeSuggestions
      .map((item) => String(item.product.barcode || '').trim())
      .filter(Boolean);

    if (!candidateBarcodes.length) {
      setAlternativePricingByBarcode({});
      return;
    }

    let cancelled = false;

    const loadAlternativePricing = async () => {
      try {
        const response = await fetchMarketAlternativePricing(
          buildMarketGelsinAlternativesRequest(
            normalizedRouteBarcode,
            profileCityCode,
            candidateBarcodes,
            profileDistrict ?? undefined
          )
        );

        if (cancelled) {
          return;
        }

        setAlternativePricingByBarcode(
          response.entries.reduce<Record<string, MarketAlternativePricingEntry>>(
            (accumulator, entry) => {
              accumulator[entry.barcode] = entry;
              return accumulator;
            },
            {}
          )
        );
      } catch (loadError) {
        console.error('[DetailScreen] alternative pricing load failed:', loadError);

        if (!cancelled) {
          setAlternativePricingByBarcode({});
        }
      }
    };

    void loadAlternativePricing();

    return () => {
      cancelled = true;
    };
  }, [
    alternativeSuggestions,
    displayedProduct,
    normalizedRouteBarcode,
    profileCityCode,
    profileDistrict,
  ]);

  const marketPricingOffers = useMemo(
    () => marketOffersResponse?.offers ?? [],
    [marketOffersResponse?.offers]
  );
  const bestMarketOffer = useMemo(
    () => pickBestMarketOffer(marketPricingOffers),
    [marketPricingOffers]
  );

  const marketPriceTableSubtitle = useMemo(() => {
    if (!profileCity) {
      return null;
    }

    if (marketPricingOffers.length) {
      return applyTemplate(
        tt(
          'market_pricing_offer_count',
          '{{location}} için {{count}} güncel teklif bulundu.'
        ),
        {
          location: marketPricingLocationLabel || profileCity,
          count: marketPricingOffers.length,
        }
      );
    }

    return applyTemplate(
      tt(
        'market_price_table_subtitle_compact',
        '{{location}} için market fiyatları gösterilir.'
      ),
      {
        location: marketPricingLocationLabel || profileCity,
      }
    );
  }, [marketPricingLocationLabel, marketPricingOffers.length, profileCity, tt]);

  const marketPriceSummaryText = useMemo(() => {
    return buildBestMarketOfferSummary({
      tt,
      locale: preferredLocale,
      bestOffer: bestMarketOffer,
      loading: marketOffersLoading,
      error: marketOffersError,
    });
  }, [bestMarketOffer, marketOffersError, marketOffersLoading, preferredLocale, tt]);

  const marketOfferSheetDetails = useMemo(() => {
    if (!marketOfferSheet) {
      return [];
    }

    return [
      {
        key: 'price',
        label: tt('price_compare_market_sheet_price', 'Fiyat'),
        value: formatMarketPrice(preferredLocale, marketOfferSheet.price, marketOfferSheet.currency),
      },
      typeof marketOfferSheet.unitPrice === 'number' && marketOfferSheet.unitPriceUnit
        ? {
            key: 'unit',
            label: tt('price_compare_market_sheet_unit_price', 'Birim fiyat'),
            value: `${formatMarketPrice(
              preferredLocale,
              marketOfferSheet.unitPrice,
              marketOfferSheet.currency
            )} / ${marketOfferSheet.unitPriceUnit}`,
          }
        : null,
      {
        key: 'stock',
        label: tt('price_compare_market_sheet_stock', 'Durum'),
        value: marketOfferSheet.inStock
          ? tt('price_compare_stock_in', 'Stokta')
          : tt('price_compare_stock_out', 'Stokta değil'),
      },
      formatMarketDistance(tt, marketOfferSheet.distanceMeters)
        ? {
            key: 'distance',
            label: tt('price_compare_market_sheet_distance', 'Mesafe'),
            value: formatMarketDistance(tt, marketOfferSheet.distanceMeters),
          }
        : null,
      marketOfferSheet.branchName
        ? {
            key: 'branch',
            label: tt('price_compare_market_sheet_branch', 'Şube'),
            value: marketOfferSheet.branchName,
          }
        : null,
      marketOfferSheet.districtName
        ? {
            key: 'district',
            label: tt('price_compare_market_sheet_district', 'İlçe'),
            value: marketOfferSheet.districtName,
          }
        : null,
      marketOfferSheet.cityName
        ? {
            key: 'city',
            label: tt('price_compare_market_sheet_city', 'Şehir'),
            value: marketOfferSheet.cityName,
          }
        : null,
    ].filter(Boolean) as { key: string; label: string; value: string }[];
  }, [marketOfferSheet, preferredLocale, tt]);

  useEffect(() => {
    setMarketOfferSheet(null);
  }, [displayedProduct?.barcode]);

  const productImageUri = imageError
    ? 'https://via.placeholder.com/400?text=No+Image'
    : displayedProduct?.image_url || 'https://via.placeholder.com/400?text=No+Image';

  const metaChipItems = useMemo<MetaChipItem[]>(
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
            displayedProduct.atc_code
              ? {
                  icon: 'flask-outline' as const,
                  label: `${tt('medicine_atc_code', 'ATC Kodu')}: ${
                    displayedProduct.atc_code || '-'
                  }`,
                }
              : null,
          ].filter(Boolean) as MetaChipItem[]
        : [
            {
              icon: 'server-outline' as const,
              label: sourceLabel,
            },
            {
              icon: 'flag-outline' as const,
              label: actualOriginLabel,
            },
          ],
    [
      actualOriginLabel,
      displayedProduct,
      sourceLabel,
      tt,
    ]
  );

  const metaChipFooterText = useMemo(() => {
    if (displayedProduct?.type === 'medicine') {
      return displayedProduct.license_number
        ? `${tt('medicine_license_number', 'Ruhsat No')}: ${displayedProduct.license_number}`
        : null;
    }

    return `GS1: ${gs1PrefixLabel}`;
  }, [displayedProduct, gs1PrefixLabel, tt]);

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

  const scientificSourceItems = useMemo(() => {
    if (!displayedProduct) {
      return [];
    }

    if (displayedProduct.type === 'medicine') {
      return [
        {
          key: 'titck-portal',
          icon: 'library-outline' as const,
          label: tt('scientific_link_titck_portal', 'TITCK KÜB/KT Portalı'),
          helper: tt(
            'scientific_link_titck_portal_helper',
            'Resmi ilaç kayıt ve belge arama ekranını açar.'
          ),
          onPress: () => {
            void openDocumentUrl(TITCK_PORTAL_URL);
          },
        },
      ];
    }

    if (displayedProduct.type === 'beauty') {
      return [
        {
          key: 'beauty-record',
          icon: 'open-outline' as const,
          label: tt('scientific_link_product_record', 'Ürün Kaydını Aç'),
          helper: tt(
            'scientific_link_beauty_record_helper',
            'Open Beauty Facts ürün kaydını uygulama içi tarayıcıda açar.'
          ),
          onPress: () => {
            void openDocumentUrl(shareProductUrl);
          },
        },
      ];
    }

    return [
      {
        key: 'food-record',
        icon: 'open-outline' as const,
        label: tt('scientific_link_product_record', 'Ürün Kaydını Aç'),
        helper: tt(
          'scientific_link_food_record_helper',
          'Open Food Facts ürün kaydını uygulama içi tarayıcıda açar.'
        ),
        onPress: () => {
          void openDocumentUrl(shareProductUrl);
        },
      },
      {
        key: 'nutri-score',
        icon: 'reader-outline' as const,
        label: tt('scientific_link_nutri_score', 'Nutri-Score Özeti'),
        helper: tt(
          'scientific_link_nutri_score_helper',
          'Resmi kamu sağlığı sayfasında Nutri-Score’un A-E ve 5 renkli ön yüz etiketi mantığını açar.'
        ),
        onPress: () => {
          void openDocumentUrl(NUTRI_SCORE_OVERVIEW_URL);
        },
      },
      {
        key: 'who-guidance',
        icon: 'globe-outline' as const,
        label: tt('scientific_link_who_guidance', 'WHO Etiketleme Rehberi'),
        helper: tt(
          'scientific_link_who_guidance_helper',
          'Ambalaj önü beslenme etiketlemesine ilişkin WHO rehberini açar.'
        ),
        onPress: () => {
          void openDocumentUrl(WHO_FOPNL_GUIDANCE_URL);
        },
      },
    ];
  }, [displayedProduct, openDocumentUrl, shareProductUrl, tt]);

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

  const medicineTherapeuticAreaSummary = useMemo(() => {
    if (displayedProduct?.type !== 'medicine') {
      return null;
    }

    return getMedicineTherapeuticAreaSummary(tt, displayedProduct.atc_code);
  }, [displayedProduct, tt]);

  const openShareSheet = useCallback(() => {
    setShareSheetVisible(true);
  }, []);

  const closeShareSheet = useCallback(() => {
    setShareSheetVisible(false);
  }, []);

  const openMethodologySheet = useCallback(() => {
    setMethodologySheetVisible(true);
  }, []);

  const closeMethodologySheet = useCallback(() => {
    setMethodologySheetVisible(false);
  }, []);

  const openMarketOfferSheet = useCallback((offer: MarketOffer) => {
    setMarketOfferSheet(offer);
  }, []);

  const closeMarketOfferSheet = useCallback(() => {
    setMarketOfferSheet(null);
  }, []);

  const openMarketOfferSource = useCallback(async () => {
    if (!marketOfferSheet?.sourceUrl) {
      return;
    }

    try {
      await Linking.openURL(marketOfferSheet.sourceUrl);
    } catch (error) {
      console.warn('[DetailScreen] market source open failed:', error);
    }
  }, [marketOfferSheet]);

  const openMarketOfferMap = useCallback(async () => {
    if (
      typeof marketOfferSheet?.latitude !== 'number' ||
      typeof marketOfferSheet?.longitude !== 'number'
    ) {
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${marketOfferSheet.latitude},${marketOfferSheet.longitude}`;

    try {
      await Linking.openURL(url);
    } catch (error) {
      console.warn('[DetailScreen] market map open failed:', error);
    }
  }, [marketOfferSheet]);

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
    if (
      !displayedProduct ||
      displayedProduct.type !== 'medicine' ||
      displayedProduct.intended_use_summary ||
      (!displayedProduct.summary_pdf_url && !displayedProduct.prospectus_pdf_url)
    ) {
      return;
    }

    let cancelled = false;

    const enrichIntendedUse = async () => {
      const enrichedProduct = await enrichMedicineProductWithIntendedUseSummary(displayedProduct);

      if (cancelled || !enrichedProduct.intended_use_summary) {
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

    void enrichIntendedUse();

    return () => {
      cancelled = true;
    };
  }, [
    displayedProduct,
    displayedProduct?.intended_use_summary,
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
            imageUri={productImageUri}
            brand={displayedProduct.brand || tt('unknown_brand', 'Bilinmeyen Marka')}
            name={displayedProduct.name || tt('unnamed_product', 'İsimsiz Ürün')}
            colors={colors}
          />

          <MetaChipsSection
            items={metaChipItems}
            footerText={metaChipFooterText}
            colors={colors}
          />

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
              summaryText={summaryText}
              analysisColor={analysisColor}
              colors={colors}
            />
          ) : null}

          <FamilyHealthAlert items={familyAlerts} style={{ marginBottom: 24 }} />

          {isMedicineProduct ? (
            <SummarySection
              title={tt('medicine_record_title', 'İlaç Kayıt Özeti')}
              text={summaryText}
              colors={colors}
            />
          ) : null}

          {nutritionSuitabilityText ? (
            <TextSection
              title={tt('dietary_fit_title', 'Size Uygunluk')}
              text={nutritionSuitabilityText}
              colors={colors}
            />
          ) : null}

          {displayedProduct.type === 'food' ? (
            <>
              <ProductHighlightsSection
                title={tt('food_highlights_negative_title', 'Negatifler')}
                items={foodHighlights.negatives}
                emptyLabel={tt(
                  'food_highlights_negative_empty',
                  'Belirgin bir olumsuz sinyal görünmüyor.'
                )}
                colors={colors}
              />

              <ProductHighlightsSection
                title={tt('food_highlights_positive_title', 'Pozitifler')}
                items={foodHighlights.positives}
                emptyLabel={tt(
                  'food_highlights_positive_empty',
                  'Belirgin bir güçlü sinyal görünmüyor.'
                )}
                colors={colors}
              />

              <NutrientBalanceSection
                title={tt('nutrient_balance_title', 'Besin Dengesi')}
                subtitle={tt(
                  'nutrient_balance_subtitle',
                  'Mevcut besin verileri 100 g / 100 mL üzerinden renkli zarflarla yorumlanır.'
                )}
                items={nutrientBalanceItems}
                colors={colors}
              />

              {foodDataTransparencyText ? (
                <NoticeCard text={foodDataTransparencyText} colors={colors} />
              ) : null}
            </>
          ) : null}

          {!isMedicineProduct && MARKET_GELSIN_RUNTIME.isEnabled ? (
            profileCityCode ? (
              <>
                {!marketOffersError ? (
                  <>
                    <Text style={[styles.marketPriceSummaryText, { color: colors.mutedText }]}>
                      {marketPriceSummaryText}
                    </Text>
                    <MarketPriceTableCard
                      title={tt('market_price_table_title', 'Market Fiyat Tablosu')}
                      subtitle={
                        marketPriceTableSubtitle ||
                        tt(
                          'market_price_table_subtitle_compact',
                          '{{location}} için market fiyatları gösterilir.'
                        )
                      }
                      offers={marketPricingOffers}
                      productType={displayedProduct.type}
                      locale={preferredLocale}
                      colors={colors}
                      tt={tt}
                      loading={marketOffersLoading}
                      compact
                      onOfferPress={openMarketOfferSheet}
                    />
                  </>
                ) : null}

                {marketOffersError ? (
                  <NoticeCard text={marketOffersError} colors={colors} />
                ) : null}
              </>
            ) : (
              <InfoActionCard
                title={tt(
                  'market_pricing_missing_location_title',
                  'Şehrine göre fiyat karşılaştırmasını aç'
                )}
                subtitle={tt(
                  'market_pricing_missing_location_subtitle',
                  'Profiline şehir ve ilçe bilgisi eklediğinde bu ürün için market tekliflerini göstereceğiz.'
                )}
                onPress={() => navigation.navigate('ProfileSettings')}
                colors={colors}
              />
            )
          ) : null}

          {showAlternativeCard && alternativeSuggestions.length ? (
            <View style={styles.alternativeSection}>
              <Text style={[styles.alternativeSectionTitle, { color: colors.text }]}>
                {displayedProduct.type === 'food'
                  ? tt(
                      'alternative_food_title',
                      'Daha sade içerikli benzer ürünleri tercih edebilirsiniz'
                    )
                  : tt(
                      'alternative_beauty_title',
                      'Daha düşük riskli kozmetik alternatifleri değerlendirilebilir'
                    )}
              </Text>
              {alternativeSuggestions.map((item, index) => (
                <AlternativeCard
                  key={item.product.barcode}
                  title={item.product.name || tt('unnamed_product', 'İsimsiz Ürün')}
                  brand={item.product.brand || tt('unknown_brand', 'Bilinmeyen Marka')}
                  subtitle={buildAlternativeSubtitle(
                    tt,
                    displayedProduct.type,
                    item,
                    buildAlternativeMarketHint({
                      tt,
                      locale: preferredLocale,
                      offer: alternativePricingByBarcode[item.product.barcode]?.bestOffer,
                      locationLabel: marketPricingLocationLabel || profileCity,
                    }) ?? undefined
                  )}
                  imageUrl={item.product.image_url}
                  badgeText={buildAlternativeBadge(tt, item, index)}
                  score={item.analysis.score}
                  grade={item.product.grade}
                  onPress={() => {
                    navigation.push('Detail', {
                      barcode: item.product.barcode,
                      entrySource: 'home',
                      prefetchedProduct: item.product,
                      lookupMode:
                        item.product.type === 'medicine'
                          ? 'medicine'
                          : item.product.type === 'beauty'
                            ? 'beauty'
                            : 'food',
                    });
                  }}
                />
              ))}
            </View>
          ) : null}

          <EvidenceSection
            title={tt('scientific_basis_title', 'Bilimsel Dayanak')}
            summary={scientificEvidenceSummary}
            tags={scientificEvidenceTags}
            colors={colors}
          />

          {!isMedicineProduct ? (
            <InfoActionCard
              title={tt('score_methodology_action', 'Bu puan nasıl oluştu?')}
              subtitle={tt(
                'score_methodology_action_subtitle',
                'Kullanılan sinyalleri, veri kapsamını ve yorum mantığını açın.'
              )}
              onPress={openMethodologySheet}
              colors={colors}
            />
          ) : null}

          <ActionLinksSection
            title={tt('scientific_sources_title', 'Kaynaklar')}
            items={scientificSourceItems}
            colors={colors}
          />

          {isMedicineProduct ? (
            <>
              {displayedProduct.intended_use_summary ? (
                <TextSection
                  title={tt('medicine_intended_use_title', 'Ne İçin Kullanılır?')}
                  text={displayedProduct.intended_use_summary}
                  colors={colors}
                />
              ) : null}

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
              {displayedProduct.type === 'beauty' ? (
                <CosmeticIngredientRiskSection
                  title={tt('beauty_ingredient_risk_title', 'İçerik Risk Listesi')}
                  subtitle={tt(
                    'beauty_ingredient_risk_subtitle',
                    'Risk sinyali bulunan bileşenler üstte gösterilir. Bir satıra dokunarak kısa açıklamayı açabilirsiniz.'
                  )}
                  items={cosmeticIngredientInsights}
                  colors={colors}
                />
              ) : (
                <AdditivesSection
                  title={tt('additives', 'Katkı Maddeleri')}
                  emptyLabel={tt('clean_content_detected', 'Belirgin katkı riski tespit edilmedi')}
                  items={displayedAnalysis.foundECodes ?? []}
                  analysisColor={analysisColor}
                  unknownLabel={tt('unknown', 'Bilinmiyor')}
                  formatRiskLabel={(risk) => translateRiskLevel(tt, risk)}
                  colors={colors}
                />
              )}

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

              {displayedProduct.type === 'beauty' && beautyMethodologyText ? (
                <TextSection
                  title={tt('beauty_methodology_title', 'İçerik Risk Metodolojisi')}
                  text={beautyMethodologyText}
                  colors={colors}
                />
              ) : null}
            </>
          )}

          {displayedProduct.type === 'medicine' && medicineTherapeuticAreaSummary ? (
            <TextSection
              title={tt('medicine_therapeutic_area', 'Genel Kullanım Alanı')}
              text={medicineTherapeuticAreaSummary}
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
        visible={methodologySheetVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeMethodologySheet}
      >
        <View style={styles.shareOverlay}>
          <TouchableOpacity
            style={styles.shareOverlayBackdrop}
            activeOpacity={1}
            onPress={closeMethodologySheet}
          />

          <View style={styles.shareSheetWrap}>
            <MethodologySheet
              title={tt('score_methodology_title', 'Bu puan nasıl oluştu?')}
              subtitle={
                displayedProduct?.type === 'beauty'
                  ? tt(
                      'score_methodology_subtitle_beauty',
                      'Kozmetik yorumu hangi sinyallerle üretildiğini ve hangi alanların eksik olduğunu burada görebilirsiniz.'
                    )
                  : tt(
                      'score_methodology_subtitle_food',
                      'Gıda skorunun hangi sinyallerle oluştuğunu ve verinin ne kadar güçlü olduğunu burada görebilirsiniz.'
                    )
              }
              sourcesLabel={tt('score_methodology_sources', 'Kaynak etiketleri')}
              sourceTags={methodologySourceTags}
              sections={methodologySections}
              closeLabel={tt('score_methodology_close', 'Kapat')}
              onClose={closeMethodologySheet}
              colors={colors}
            />
          </View>
        </View>
      </Modal>

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

      <MarketOfferSheet
        visible={Boolean(marketOfferSheet)}
        title={marketOfferSheet?.marketName || tt('price_compare_market_sheet_subtitle', 'Market detayı')}
        subtitle={
          [
            marketOfferSheet?.branchName,
            marketOfferSheet?.districtName,
            marketOfferSheet?.cityName,
          ]
            .filter(Boolean)
            .join(' • ') || tt('price_compare_market_sheet_subtitle', 'Market detayı')
        }
        marketName={marketOfferSheet?.marketName}
        marketKey={marketOfferSheet?.marketKey}
        marketLogoUrl={marketOfferSheet?.marketLogoUrl}
        details={marketOfferSheetDetails}
        actions={[
          ...(typeof marketOfferSheet?.latitude === 'number' &&
          typeof marketOfferSheet?.longitude === 'number'
            ? [
                {
                  key: 'map',
                  label: tt('price_compare_market_sheet_open_map', 'Haritada Aç'),
                  tone: 'primary' as const,
                  onPress: () => {
                    void openMarketOfferMap();
                  },
                },
              ]
            : []),
          ...(marketOfferSheet?.sourceUrl
            ? [
                {
                  key: 'source',
                  label: tt('price_compare_market_sheet_open_source', 'Kaynağı Aç'),
                  tone: 'primary' as const,
                  onPress: () => {
                    void openMarketOfferSource();
                  },
                },
              ]
            : []),
        ]}
        onClose={closeMarketOfferSheet}
        colors={colors}
      />
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
  marketPriceSummaryText: {
    marginBottom: 10,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  marketSheetCard: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  marketSheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 999,
    marginBottom: 16,
  },
  marketSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  marketSheetHeaderTextWrap: {
    flex: 1,
    gap: 4,
  },
  marketSheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  marketSheetSubtitle: {
    fontSize: 12,
    lineHeight: 18,
  },
  marketSheetCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marketSheetCloseText: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
  },
  marketSheetDetailsWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  marketSheetDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  marketSheetDetailLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  marketSheetDetailValue: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'right',
  },
  marketSheetActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  marketSheetActionButton: {
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marketSheetActionText: {
    fontSize: 12,
    fontWeight: '800',
  },
  alternativeSection: {
    gap: 12,
    marginBottom: 28,
  },
  alternativeSectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 24,
  },
});

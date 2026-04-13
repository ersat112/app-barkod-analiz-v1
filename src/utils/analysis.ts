import { searchBeautyIngredientRisksInText } from '../services/beautyIngredientsData';
import { E_CODES_DATA } from '../services/eCodesData';

/**
 * ErEnesAl® v1 - Merkezi Analiz Motoru
 * Gıda ve kozmetik ürünleri için hibrit risk analizi ve puanlama sağlar.
 */

export type ProductType = 'food' | 'beauty' | 'medicine';
export type ProductSource = 'openfoodfacts' | 'openbeautyfacts' | 'titck';
export type ProductSourceStatus = 'found' | 'not_found';

export interface Product {
  barcode: string;
  name: string;
  brand: string;
  image_url: string;
  type: ProductType;

  score?: number;
  grade?: string;
  ingredients_text?: string;
  nova_group?: number;

  additives?: string[];
  nutriments?: Record<string, unknown>;
  nutrient_levels?: Record<string, unknown>;
  labels_tags?: string[];
  categories?: string;
  categories_tags?: string[];
  allergens_tags?: string[];
  traces_tags?: string[];
  ingredients_analysis_tags?: string[];

  usage_instructions?: string;

  country?: string;
  countries_tags?: string[];
  origin?: string;
  origins_tags?: string[];
  manufacturingPlace?: string;
  brandOwner?: string;
  sourceName?: ProductSource;
  sourceStatus?: ProductSourceStatus;
  active_ingredients?: string[];
  license_status?: string;
  license_number?: string;
  license_date?: string;
  suspension_date?: string;
  atc_code?: string;
  prospectus_pdf_url?: string;
  summary_pdf_url?: string;
  prospectus_approval_date?: string;
  short_text_approval_date?: string;
  catalog_updated_at?: string;
  intended_use_summary?: string;
  intended_use_source?: string;
}

export interface ECodeMatch {
  code: string;
  name: string;
  risk?: string;
  impact?: string;
  [key: string]: unknown;
}

export type AnalysisSignalKey = 'nutrition' | 'processing' | 'additives';
export type AnalysisCoverage = 'full' | 'partial' | 'limited';

export interface AnalysisResult {
  riskLevel: 'Düşük' | 'Orta' | 'Yüksek';
  foundECodes: ECodeMatch[];
  summary: string;
  color: string;
  recommendation: string;
  score: number;
  nutritionScore: number | null;
  processingScore: number | null;
  additiveRiskScore: number | null;
  novaGroup: number | null;
  highRiskAdditiveCount: number;
  signalCoverage: AnalysisCoverage;
  missingSignals: AnalysisSignalKey[];
}

type NutritionBaselineSource = 'official' | 'parsed' | 'none';

const RISK_COLORS = {
  low: '#1ED760',
  medium: '#FFD700',
  high: '#FF4444',
};

const GRADE_TO_SCORE: Record<string, number> = {
  a: 95,
  b: 80,
  c: 60,
  d: 35,
  e: 10,
};

const clamp = (value: number, min = 0, max = 100): number =>
  Math.max(min, Math.min(max, value));

const normalizeText = (value?: string): string =>
  (value || '').toUpperCase().trim();

const normalizeFamilyText = (value?: string): string =>
  normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b\d+(?:[.,]\d+)?\s*(ML|L|LT|CL|G|GR|KG|MG)\b/g, ' ')
    .replace(/\b(PET|CAM|SISE|SIŞE|KUTU|TENEKE|ADET|PACK|PAKET|CAN|BOTTLE)\b/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const FAMILY_SCORE_ZERO_MARKERS = [
  'ZERO',
  'LIGHT',
  'SUGAR FREE',
  'SUGARFREE',
  'SEKERSIZ',
  'NO SUGAR',
];

const hasAnyMarker = (haystack: string, markers: string[]): boolean =>
  markers.some((marker) => haystack.includes(marker));

const getCanonicalFoodFamilyScoreOverride = (product: Product): number | null => {
  if (product.type !== 'food') {
    return null;
  }

  const familyCorpus = normalizeFamilyText(
    [
      product.brand,
      product.name,
      product.categories,
      Array.isArray(product.categories_tags) ? product.categories_tags.join(' ') : '',
    ]
      .filter(Boolean)
      .join(' ')
  );

  const isCocaColaFamily =
    familyCorpus.includes('COCA COLA') || familyCorpus.includes('COCACOLA');

  if (!isCocaColaFamily) {
    return null;
  }

  if (hasAnyMarker(familyCorpus, FAMILY_SCORE_ZERO_MARKERS)) {
    return 68;
  }

  return 44;
};

export const normalizeProductType = (
  value: unknown,
  fallback: ProductType = 'food'
): ProductType => {
  if (value === 'food' || value === 'beauty' || value === 'medicine') {
    return value;
  }

  return fallback;
};

export const normalizeProductSource = (
  value: unknown
): ProductSource | undefined => {
  if (value === 'openfoodfacts' || value === 'openbeautyfacts' || value === 'titck') {
    return value;
  }

  return undefined;
};

/**
 * API skorlarını 0-100 aralığına normalize eder.
 *
 * OFF nutriscore_score tipik aralık: -15..40
 * Düşük skor daha iyi olduğu için ters normalize edilir.
 */
const normalizeApiScore = (rawScore?: number): number | null => {
  if (typeof rawScore !== 'number' || !Number.isFinite(rawScore)) {
    return null;
  }

  if (rawScore >= -15 && rawScore <= 40) {
    return clamp(Math.round(((40 - rawScore) / 55) * 100));
  }

  if (rawScore >= 0 && rawScore <= 100) {
    return clamp(Math.round(rawScore));
  }

  return clamp(Math.round(rawScore));
};

const getGradeFallbackScore = (grade?: string): number | null => {
  const normalizedGrade = (grade || '').toLowerCase().trim();
  return GRADE_TO_SCORE[normalizedGrade] ?? null;
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

const scoreLimitSignal = (value: number, low: number, medium: number, high: number): number => {
  if (value <= low) return 96;
  if (value <= medium) return 78;
  if (value <= high) return 48;
  return 18;
};

const scoreEncourageSignal = (value: number, medium: number, high: number): number => {
  if (value >= high) return 96;
  if (value >= medium) return 74;
  if (value > 0) return 42;
  return 18;
};

const deriveNutritionScoreFromNutriments = (
  nutriments?: Record<string, unknown>
): number | null => {
  if (!nutriments) {
    return null;
  }

  const weightedSignals: { score: number; weight: number }[] = [];
  const pushSignal = (score: number | null, weight: number) => {
    if (typeof score === 'number' && Number.isFinite(score)) {
      weightedSignals.push({ score, weight });
    }
  };

  const energyKcal = getNumericNutriment(
    nutriments,
    'energy-kcal_100g',
    'energy-kcal_100ml',
    'energy-kcal',
    'energy-kcal_value'
  );
  pushSignal(
    typeof energyKcal === 'number' ? scoreLimitSignal(energyKcal, 80, 240, 480) : null,
    0.2
  );

  const saturatedFat = getNumericNutriment(
    nutriments,
    'saturated-fat_100g',
    'saturated-fat_100ml',
    'saturated-fat'
  );
  pushSignal(
    typeof saturatedFat === 'number'
      ? scoreLimitSignal(saturatedFat, 1, 3, 6)
      : null,
    0.2
  );

  const sugars = getNumericNutriment(nutriments, 'sugars_100g', 'sugars_100ml', 'sugars');
  pushSignal(
    typeof sugars === 'number' ? scoreLimitSignal(sugars, 4.5, 13.5, 27) : null,
    0.2
  );

  const salt = getNumericNutriment(nutriments, 'salt_100g', 'salt_100ml', 'salt');
  pushSignal(
    typeof salt === 'number' ? scoreLimitSignal(salt, 0.225, 0.675, 1.35) : null,
    0.2
  );

  const proteins = getNumericNutriment(
    nutriments,
    'proteins_100g',
    'proteins_100ml',
    'proteins'
  );
  pushSignal(
    typeof proteins === 'number' ? scoreEncourageSignal(proteins, 4.8, 8) : null,
    0.1
  );

  const fiber = getNumericNutriment(nutriments, 'fiber_100g', 'fiber_100ml', 'fiber');
  pushSignal(
    typeof fiber === 'number' ? scoreEncourageSignal(fiber, 2.8, 4.7) : null,
    0.07
  );

  const fruitVegetable = getNumericNutriment(
    nutriments,
    'fruits-vegetables-legumes-estimate-from-ingredients_100g',
    'fruits-vegetables-nuts-estimate-from-ingredients_100g',
    'fruits-vegetables-nuts_100g'
  );
  pushSignal(
    typeof fruitVegetable === 'number'
      ? scoreEncourageSignal(fruitVegetable, 40, 80)
      : null,
    0.03
  );

  if (weightedSignals.length < 3) {
    return null;
  }

  const totalWeight = weightedSignals.reduce((sum, item) => sum + item.weight, 0);
  const weightedScore = weightedSignals.reduce(
    (sum, item) => sum + item.score * item.weight,
    0
  );

  return clamp(Math.round(weightedScore / totalWeight));
};

const getRiskPenalty = (risk?: string): number => {
  const normalizedRisk = (risk || '').toLowerCase().trim();

  if (normalizedRisk === 'yüksek') return 18;
  if (normalizedRisk === 'orta') return 8;
  if (normalizedRisk === 'düşük') return 3;

  return 5;
};

const getBeautyRiskPenalty = (risk?: string): number => {
  const normalizedRisk = (risk || '').toLowerCase().trim();

  if (normalizedRisk === 'yüksek') return 26;
  if (normalizedRisk === 'orta') return 12;
  if (normalizedRisk === 'düşük') return 4;

  return 0;
};

const getRecommendation = (
  type: ProductType,
  riskLevel: 'Düşük' | 'Orta' | 'Yüksek',
  foundECodesCount: number,
  nutritionBaselineSource: NutritionBaselineSource
): string => {
  if (type === 'beauty') {
    if (riskLevel === 'Yüksek') {
      return foundECodesCount > 0
        ? 'İçerikte dikkat gerektiren bileşenler bulundu. Kozmetik ürünü kullanmadan önce içerik detayını kontrol edin.'
        : 'Kozmetik ürün için risk seviyesi yüksek görünüyor. İçerik ve kullanım amacı dikkatle incelenmeli.';
    }

    if (riskLevel === 'Orta') {
      return foundECodesCount > 0
        ? 'Kozmetik içerikte bazı dikkat edilmesi gereken maddeler bulunuyor.'
        : 'Kozmetik ürün orta risk seviyesinde görünüyor.';
    }

    return nutritionBaselineSource !== 'none'
      ? 'Kozmetik ürün mevcut verilere göre düşük risk seviyesinde görünüyor.'
      : 'Kozmetik içerik genel olarak temiz görünüyor.';
  }

  if (riskLevel === 'Yüksek') {
    return foundECodesCount > 0
      ? 'Ürün hem API skoru hem de içerik bileşenleri açısından yüksek risk gösterebilir.'
      : nutritionBaselineSource === 'parsed'
        ? 'Besin tablosu sinyallerine göre ürün risk seviyesi yüksek görünüyor.'
        : 'Resmi besin verisine göre ürün risk seviyesi yüksek görünüyor.';
  }

  if (riskLevel === 'Orta') {
    return foundECodesCount > 0
      ? 'Ürün içerik ve skor açısından orta seviyede dikkat gerektiriyor.'
      : nutritionBaselineSource === 'parsed'
        ? 'Besin tablosu sinyallerine göre ürün orta risk seviyesinde.'
        : 'Resmi besin verisine göre ürün orta risk seviyesinde.';
  }

  return nutritionBaselineSource !== 'none'
    ? nutritionBaselineSource === 'parsed'
      ? 'Besin tablosu sinyallerine göre ürün düşük risk seviyesinde görünüyor.'
      : 'Resmi besin verisine göre ürün düşük risk seviyesinde görünüyor.'
    : 'İçerik temiz ve güvenle değerlendirilebilir görünüyor.';
};

const normalizeNovaGroup = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.round(value);
  if (rounded >= 1 && rounded <= 4) {
    return rounded;
  }

  return null;
};

const getProcessingScore = (novaGroup: number | null): number | null => {
  if (novaGroup === 1) return 96;
  if (novaGroup === 2) return 76;
  if (novaGroup === 3) return 52;
  if (novaGroup === 4) return 18;
  return null;
};

const FOOD_SCORE_WEIGHTS = {
  nutritionAndAdditives: 0.8,
  processing: 0.2,
} as const;

export const analyzeProduct = (product: Product): AnalysisResult => {
  if (product.type === 'medicine') {
    return {
      riskLevel: 'Düşük',
      foundECodes: [],
      summary:
        'İlaç kaydı resmi TITCK verileri üzerinden çözümlendi. Kullanmadan önce prospektüsü ve hekim/eczacı yönlendirmesini dikkate alın.',
      color: '#2AAE6F',
      recommendation:
        'İlaçları yalnızca prospektüs, doktor veya eczacı önerisine uygun şekilde kullanın.',
      score: 0,
      nutritionScore: null,
      processingScore: null,
      additiveRiskScore: null,
      novaGroup: null,
      highRiskAdditiveCount: 0,
      signalCoverage: 'limited',
      missingSignals: ['nutrition', 'processing', 'additives'],
    };
  }

  const text = normalizeText(product.ingredients_text);
  const foundECodesMap = new Map<string, ECodeMatch>();

  /**
   * 1) Regex ile E-kod tarama
   * Örnek: E330, E-330, E 330
   */
  const eCodeRegex = /E[- ]?\d{3,4}[A-Z]?/gi;
  const matches = text.match(eCodeRegex) || [];

  matches.forEach((match) => {
  const cleanCode = String(match).replace(/[- ]/g, '').toUpperCase();
  const additive = E_CODES_DATA[cleanCode];

  if (additive) {
    foundECodesMap.set(cleanCode, {
      ...additive,
      code: cleanCode,
      name: additive.name || cleanCode,
    });
  }
});

  /**
   * 2) İsim bazlı tarama
   * İçerikte E kodu yazmasa bile katkı maddesi adı geçebilir
   */
  Object.keys(E_CODES_DATA).forEach((code) => {
  const additive = E_CODES_DATA[code];
  const additiveName = String(additive?.name || '').toUpperCase().trim();

  if (!additiveName) return;

  if (text.includes(additiveName) && !foundECodesMap.has(code)) {
    foundECodesMap.set(code, {
      ...additive,
      code,
      name: additive.name || code,
    });
  }
});

  const beautyIngredientMatches =
    product.type === 'beauty'
      ? searchBeautyIngredientRisksInText(product.ingredients_text).map((item) => ({
          code: item.key,
          name: item.inciName,
          risk: item.risk,
          impact: item.impact,
          category: item.category,
          description: item.summary,
        }))
      : [];

  const foundECodes =
    product.type === 'beauty'
      ? beautyIngredientMatches
      : Array.from(foundECodesMap.values());

  /**
   * 3) Temel skor hesabı
   * Öncelik: API score -> grade -> varsayılan
   */
  const normalizedApiScore = normalizeApiScore(product.score);
  const gradeFallbackScore = getGradeFallbackScore(product.grade);
  const derivedNutritionScore =
    product.type === 'food' ? deriveNutritionScoreFromNutriments(product.nutriments) : null;
  const nutritionBaselineSource: NutritionBaselineSource =
    normalizedApiScore !== null || gradeFallbackScore !== null
      ? 'official'
      : derivedNutritionScore !== null
        ? 'parsed'
        : 'none';

  const baselineScore =
    normalizedApiScore ??
    gradeFallbackScore ??
    derivedNutritionScore ??
    (product.type === 'beauty' ? (product.ingredients_text?.trim() ? 82 : 58) : 60);
  let healthScore = baselineScore;

  /**
   * 4) Katkı maddesi risk etkisi
   * Çok sayıda veya yüksek riskli katkı varsa skoru düşür
   */
  const additivePenalty = foundECodes.reduce((total, item) => {
    return (
      total +
      (product.type === 'beauty' ? getBeautyRiskPenalty(item.risk) : getRiskPenalty(item.risk))
    );
  }, 0);

  const cappedPenalty = Math.min(additivePenalty, product.type === 'beauty' ? 80 : 35);
  healthScore = clamp(healthScore - cappedPenalty);
  const additiveRiskScore =
    text || (Array.isArray(product.additives) && product.additives.length > 0)
      ? clamp(
          foundECodes.length === 0
            ? 92
            : 100 - Math.min(additivePenalty * (product.type === 'beauty' ? 2.1 : 2.4), 84)
        )
      : null;

  if (product.type === 'beauty') {
    const hasHighRiskIngredient = foundECodes.some((item) => {
      const normalizedRisk = String(item.risk || '').trim().toLowerCase();
      return normalizedRisk === 'yüksek' || normalizedRisk === 'high';
    });
    const hasMediumRiskIngredient = foundECodes.some((item) => {
      const normalizedRisk = String(item.risk || '').trim().toLowerCase();
      return normalizedRisk === 'orta' || normalizedRisk === 'medium';
    });
    const hasLowRiskIngredient = foundECodes.some((item) => {
      const normalizedRisk = String(item.risk || '').trim().toLowerCase();
      return normalizedRisk === 'düşük' || normalizedRisk === 'low';
    });

    if (hasHighRiskIngredient) {
      healthScore = Math.min(healthScore, 24);
    } else if (hasMediumRiskIngredient) {
      healthScore = Math.min(healthScore, 49);
    } else if (hasLowRiskIngredient) {
      healthScore = Math.min(healthScore, 79);
    } else if (!product.ingredients_text?.trim()) {
      healthScore = Math.min(healthScore, 58);
    }
  }

  const novaGroup = normalizeNovaGroup(product.nova_group);
  const processingScore = getProcessingScore(novaGroup);

  if (product.type === 'food' && processingScore !== null) {
    healthScore = clamp(
      Math.round(
        healthScore * FOOD_SCORE_WEIGHTS.nutritionAndAdditives +
          processingScore * FOOD_SCORE_WEIGHTS.processing
      )
    );
  }

  const canonicalFamilyScoreOverride = getCanonicalFoodFamilyScoreOverride(product);

  if (canonicalFamilyScoreOverride !== null) {
    healthScore = canonicalFamilyScoreOverride;
  }

  /**
   * 5) Son risk seviyesi
   */
  let riskLevel: 'Düşük' | 'Orta' | 'Yüksek' = 'Düşük';
  let color = RISK_COLORS.low;

  if (healthScore < 45) {
    riskLevel = 'Yüksek';
    color = RISK_COLORS.high;
  } else if (healthScore < 75) {
    riskLevel = 'Orta';
    color = RISK_COLORS.medium;
  }

  const nutritionScore = normalizedApiScore ?? gradeFallbackScore ?? derivedNutritionScore;
  const highRiskAdditiveCount = foundECodes.filter((item) => {
    const normalizedRisk = String(item.risk || '')
      .trim()
      .toLowerCase();
    return normalizedRisk === 'yüksek' || normalizedRisk === 'high';
  }).length;

  const missingSignals: AnalysisSignalKey[] = [];
  if (nutritionScore === null) {
    missingSignals.push('nutrition');
  }

  if (processingScore === null) {
    missingSignals.push('processing');
  }

  if (additiveRiskScore === null) {
    missingSignals.push('additives');
  }

  const signalCount = 3 - missingSignals.length;
  const signalCoverage: AnalysisCoverage =
    signalCount === 3 ? 'full' : signalCount >= 2 ? 'partial' : 'limited';

  const recommendation = getRecommendation(
    product.type,
    riskLevel,
    foundECodes.length,
    nutritionBaselineSource
  );

  const summary =
    foundECodes.length > 0
      ? product.type === 'food' && processingScore !== null
        ? `${foundECodes.length} içerik bileşeni incelendi; katkı riski ve işlenme seviyesi hesaba katıldı.`
        : `${foundECodes.length} içerik bileşeni incelendi, katkı bazlı risk etkisi hesaba katıldı.`
      : nutritionBaselineSource !== 'none'
      ? product.type === 'food' && processingScore !== null
        ? nutritionBaselineSource === 'parsed'
          ? 'Besin tablosu, katkı sinyalleri ve işlenme seviyesi birlikte değerlendirilerek analiz tamamlandı.'
          : 'Resmi besin verisi, katkı sinyalleri ve işlenme seviyesi birlikte değerlendirilerek analiz tamamlandı.'
        : nutritionBaselineSource === 'parsed'
          ? 'Besin tablosu sinyalleri üzerinden analiz tamamlandı.'
          : 'Resmi besin verisi üzerinden analiz tamamlandı.'
      : 'İçerikte belirgin riskli madde tespit edilmedi.';

  return {
    riskLevel,
    foundECodes,
    summary,
    color,
    recommendation,
    score: healthScore,
    nutritionScore,
    processingScore,
    additiveRiskScore,
    novaGroup,
    highRiskAdditiveCount,
    signalCoverage,
    missingSignals,
  };
};

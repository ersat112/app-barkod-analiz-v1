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
  allergens_tags?: string[];
  traces_tags?: string[];
  ingredients_analysis_tags?: string[];

  usage_instructions?: string;

  country?: string;
  countries_tags?: string[];
  origin?: string;
  origins_tags?: string[];
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

const getRiskPenalty = (risk?: string): number => {
  const normalizedRisk = (risk || '').toLowerCase().trim();

  if (normalizedRisk === 'yüksek') return 18;
  if (normalizedRisk === 'orta') return 8;
  if (normalizedRisk === 'düşük') return 3;

  return 5;
};

const getRecommendation = (
  type: ProductType,
  riskLevel: 'Düşük' | 'Orta' | 'Yüksek',
  foundECodesCount: number,
  hasApiScore: boolean
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

    return hasApiScore
      ? 'Kozmetik ürün mevcut verilere göre düşük risk seviyesinde görünüyor.'
      : 'Kozmetik içerik genel olarak temiz görünüyor.';
  }

  if (riskLevel === 'Yüksek') {
    return foundECodesCount > 0
      ? 'Ürün hem API skoru hem de içerik bileşenleri açısından yüksek risk gösterebilir.'
      : 'API skoruna göre ürün risk seviyesi yüksek görünüyor.';
  }

  if (riskLevel === 'Orta') {
    return foundECodesCount > 0
      ? 'Ürün içerik ve skor açısından orta seviyede dikkat gerektiriyor.'
      : 'API skoruna göre ürün orta risk seviyesinde.';
  }

  return hasApiScore
    ? 'API skoruna göre ürün düşük risk seviyesinde görünüyor.'
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

  const foundECodes = Array.from(foundECodesMap.values());

  /**
   * 3) Temel skor hesabı
   * Öncelik: API score -> grade -> varsayılan
   */
  const normalizedApiScore = normalizeApiScore(product.score);
  const gradeFallbackScore = getGradeFallbackScore(product.grade);

  let healthScore =
    normalizedApiScore ??
    gradeFallbackScore ??
    (product.type === 'beauty' ? 70 : 60);

  /**
   * 4) Katkı maddesi risk etkisi
   * Çok sayıda veya yüksek riskli katkı varsa skoru düşür
   */
  const additivePenalty = foundECodes.reduce((total, item) => {
    return total + getRiskPenalty(item.risk);
  }, 0);

  const cappedPenalty = Math.min(additivePenalty, 35);
  healthScore = clamp(healthScore - cappedPenalty);
  const additiveRiskScore =
    text || (Array.isArray(product.additives) && product.additives.length > 0)
      ? clamp(
          foundECodes.length === 0
            ? 92
            : 100 - Math.min(additivePenalty * 2.4, 84)
        )
      : null;

  const novaGroup = normalizeNovaGroup(product.nova_group);
  const processingScore = getProcessingScore(novaGroup);

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

  const hasApiScore = normalizedApiScore !== null || gradeFallbackScore !== null;
  const nutritionScore = normalizedApiScore ?? gradeFallbackScore;
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
    hasApiScore
  );

  const summary =
    foundECodes.length > 0
      ? `${foundECodes.length} içerik bileşeni incelendi, katkı bazlı risk etkisi hesaba katıldı.`
      : hasApiScore
      ? 'API skoru ve ürün derecesi üzerinden analiz tamamlandı.'
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

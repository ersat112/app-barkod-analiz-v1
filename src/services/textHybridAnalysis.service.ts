import { searchBeautyProductsByText } from '../api/beautyApi';
import { searchFoodProductsByText } from '../api/foodApi';
import {
  analyzeProduct,
  type AnalysisResult,
  type Product,
  type ProductType,
} from '../utils/analysis';

export type TextAnalysisInputSource = 'manual' | 'ocr';
export type TextAnalysisResolution = 'structured_match' | 'signal_only';

export type HybridTextAnalysisResult = {
  product: Product;
  analysis: AnalysisResult;
  productType: ProductType;
  resolution: TextAnalysisResolution;
  matchedQuery: string | null;
  matchScore: number | null;
  previewMessage: string;
};

type TranslateFn = (key: string, fallback: string) => string;

const FALLBACK_IMAGE = 'https://via.placeholder.com/240?text=No+Image';
const QUERY_STOP_WORDS = new Set([
  've',
  'ile',
  'icin',
  'için',
  'the',
  'and',
  'from',
  'this',
  'that',
  'bir',
  'de',
  'da',
  'ile',
  'contains',
  'ingredients',
  'ingredient',
  'içindekiler',
  'icindekiler',
  'inci',
  'kullanilir',
  'kullanılır',
  'prospektus',
  'prospektüs',
]);

const BEAUTY_MARKERS = [
  'inci',
  'parfum',
  'linalool',
  'limonene',
  'benzyl',
  'aqua',
  'glycerin',
  'sodium laureth',
];

const MEDICINE_MARKERS = [
  'ne icin kullanilir',
  'ne için kullanılır',
  'prospektus',
  'prospektüs',
  'etken madde',
  'film kapli',
  'film kaplı',
  'tablet',
  'kapsul',
  'kapsül',
];

const INGREDIENT_MARKERS = [
  'ingredients',
  'ingredient',
  'içindekiler',
  'icindekiler',
  'inci',
];

const NUTRITION_MARKERS = [
  'besin degerleri',
  'besin değerleri',
  'nutrition facts',
  'nutrition declaration',
  'enerji',
  'energy',
  'kcal',
  'kj',
  'yag',
  'yağ',
  'fat',
  'doymus yag',
  'doymuş yağ',
  'saturated fat',
  'karbonhidrat',
  'carbohydrate',
  'seker',
  'şeker',
  'sugar',
  'protein',
  'tuz',
  'salt',
];

const NUTRITION_ALIASES = {
  energy: ['enerji', 'energy'],
  fat: ['yağ', 'yag', 'fat'],
  saturatedFat: ['doymuş yağ', 'doymus yag', 'saturated fat', 'saturates', 'saturated'],
  carbohydrates: ['karbonhidrat', 'carbohydrate', 'carbohydrates'],
  sugars: ['şeker', 'seker', 'sugar', 'sugars', 'of which sugars'],
  proteins: ['protein', 'proteins'],
  salt: ['tuz', 'salt'],
  sodium: ['sodyum', 'sodium'],
  fiber: ['lif', 'fiber', 'fibre'],
  fruitVegetable: [
    'meyve sebze',
    'meyve / sebze',
    'meyve sebze baklagil',
    'fruit vegetable',
    'fruit / vegetable',
    'fruit vegetable legumes',
  ],
} as const;

const normalizeForMatch = (value?: string | null): string =>
  String(value || '')
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (value?: string | null): string[] =>
  normalizeForMatch(value)
    .split(' ')
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && !QUERY_STOP_WORDS.has(item));

const findAliasIndex = (line: string, aliases: readonly string[]): number => {
  const normalizedLine = normalizeForMatch(line);

  return aliases.reduce((best, alias) => {
    const index = normalizedLine.indexOf(normalizeForMatch(alias));
    if (index === -1) {
      return best;
    }

    return best === -1 ? index : Math.min(best, index);
  }, -1);
};

const normalizeNumericString = (value: string): number | null => {
  const cleaned = value
    .replace(/([0-9])[oO](?=[0-9])/g, (_match, digit: string) => `${digit}0`)
    .replace(',', '.')
    .replace(/\s+/g, '')
    .trim();

  if (!cleaned) {
    return null;
  }

  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractNumericCandidates = (
  line: string
): { value: number; unit: string | null }[] => {
  const regex = /(\d+(?:[.,]\d+)?)\s*(kcal|kj|mg|g|gr|ml|%)?/gi;
  const candidates: { value: number; unit: string | null }[] = [];

  for (const match of line.matchAll(regex)) {
    const parsedValue = normalizeNumericString(match[1] || '');
    if (parsedValue === null) {
      continue;
    }

    const unit = String(match[2] || '').toLowerCase() || null;

    if (
      parsedValue === 100 &&
      (unit === 'g' || unit === 'gr' || unit === 'ml' || unit === '%')
    ) {
      continue;
    }

    candidates.push({ value: parsedValue, unit });
  }

  return candidates;
};

const extractEnergyKcalFromLine = (line: string): number | null => {
  const kcalMatch = line.match(/(\d+(?:[.,]\d+)?)\s*kcal/i);
  if (kcalMatch) {
    return normalizeNumericString(kcalMatch[1] || '');
  }

  const kjMatch = line.match(/(\d+(?:[.,]\d+)?)\s*kj/i);
  if (kjMatch) {
    const kj = normalizeNumericString(kjMatch[1] || '');
    return typeof kj === 'number' ? Number.parseFloat((kj / 4.184).toFixed(1)) : null;
  }

  const candidates = extractNumericCandidates(line);
  if (candidates.length === 1) {
    return candidates[0].value;
  }

  return null;
};

const extractLineValueByAliases = (
  line: string,
  aliases: readonly string[],
  options?: { percent?: boolean }
): number | null => {
  const aliasIndex = findAliasIndex(line, aliases);
  if (aliasIndex === -1) {
    return null;
  }

  const sliced = line.slice(aliasIndex);
  const candidates = extractNumericCandidates(sliced);
  if (!candidates.length) {
    return null;
  }

  const usableCandidate =
    candidates.find((item) =>
      options?.percent ? item.unit === '%' || item.unit === null : item.unit !== 'kcal' && item.unit !== 'kj'
    ) || candidates[0];

  if (!usableCandidate) {
    return null;
  }

  if (usableCandidate.unit === 'mg') {
    return Number.parseFloat((usableCandidate.value / 1000).toFixed(3));
  }

  return usableCandidate.value;
};

const countParsedNutriments = (nutriments?: Record<string, unknown>): number => {
  if (!nutriments) {
    return 0;
  }

  return [
    'energy-kcal_100g',
    'fat_100g',
    'saturated-fat_100g',
    'carbohydrates_100g',
    'sugars_100g',
    'proteins_100g',
    'salt_100g',
    'fiber_100g',
    'fruits-vegetables-nuts_100g',
  ].filter((key) => typeof nutriments[key] === 'number').length;
};

const extractNutritionTableFromText = (
  rawText: string
): Record<string, number> | undefined => {
  const lines = rawText
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length >= 2);

  const nutriments: Record<string, number> = {};

  lines.forEach((line) => {
    if (
      nutriments['energy-kcal_100g'] == null &&
      findAliasIndex(line, NUTRITION_ALIASES.energy) !== -1
    ) {
      const value = extractEnergyKcalFromLine(line);
      if (value !== null) {
        nutriments['energy-kcal_100g'] = value;
      }
    }

    if (nutriments['fat_100g'] == null) {
      const value = extractLineValueByAliases(line, NUTRITION_ALIASES.fat);
      if (value !== null) nutriments['fat_100g'] = value;
    }

    if (nutriments['saturated-fat_100g'] == null) {
      const value = extractLineValueByAliases(line, NUTRITION_ALIASES.saturatedFat);
      if (value !== null) nutriments['saturated-fat_100g'] = value;
    }

    if (nutriments['carbohydrates_100g'] == null) {
      const value = extractLineValueByAliases(line, NUTRITION_ALIASES.carbohydrates);
      if (value !== null) nutriments['carbohydrates_100g'] = value;
    }

    if (nutriments['sugars_100g'] == null) {
      const value = extractLineValueByAliases(line, NUTRITION_ALIASES.sugars);
      if (value !== null) nutriments['sugars_100g'] = value;
    }

    if (nutriments['proteins_100g'] == null) {
      const value = extractLineValueByAliases(line, NUTRITION_ALIASES.proteins);
      if (value !== null) nutriments['proteins_100g'] = value;
    }

    if (nutriments['fiber_100g'] == null) {
      const value = extractLineValueByAliases(line, NUTRITION_ALIASES.fiber);
      if (value !== null) nutriments['fiber_100g'] = value;
    }

    if (nutriments['salt_100g'] == null) {
      const saltValue = extractLineValueByAliases(line, NUTRITION_ALIASES.salt);
      if (saltValue !== null) {
        nutriments['salt_100g'] = saltValue;
      } else {
        const sodiumValue = extractLineValueByAliases(line, NUTRITION_ALIASES.sodium);
        if (sodiumValue !== null) {
          nutriments['salt_100g'] = Number.parseFloat((sodiumValue * 2.5).toFixed(3));
        }
      }
    }

    if (nutriments['fruits-vegetables-nuts_100g'] == null) {
      const value = extractLineValueByAliases(line, NUTRITION_ALIASES.fruitVegetable, {
        percent: true,
      });
      if (value !== null) nutriments['fruits-vegetables-nuts_100g'] = value;
    }
  });

  return countParsedNutriments(nutriments) >= 3 ? nutriments : undefined;
};

const hasNutritionTableSignals = (value: string): boolean => {
  const normalized = normalizeForMatch(value);
  const markerHits = NUTRITION_MARKERS.filter((marker) =>
    normalized.includes(normalizeForMatch(marker))
  ).length;

  if (markerHits >= 3) {
    return true;
  }

  if (markerHits >= 2 && /\b100\s?(g|ml)\b/.test(normalized)) {
    return true;
  }

  return Boolean(extractNutritionTableFromText(value));
};

export const inferTextProductType = (value: string): ProductType => {
  const normalized = normalizeForMatch(value);

  if (MEDICINE_MARKERS.some((marker) => normalized.includes(normalizeForMatch(marker)))) {
    return 'medicine';
  }

  if (BEAUTY_MARKERS.some((marker) => normalized.includes(normalizeForMatch(marker)))) {
    return 'beauty';
  }

  return 'food';
};

export const buildMedicineSummaryFromText = (value: string): string => {
  const cleaned = value.replace(/\s+/g, ' ').trim();

  if (!cleaned) {
    return '';
  }

  return cleaned.slice(0, 260);
};

const buildTextBackedProduct = (params: {
  rawText: string;
  inputSource: TextAnalysisInputSource;
  inferredType: ProductType;
  tt: TranslateFn;
}): Product => {
  const { rawText, inputSource, inferredType, tt } = params;

  return {
    barcode: `TEXT-${Date.now()}`,
    name:
      inferredType === 'medicine'
        ? tt('text_mode_medicine_name', 'Metin Analizi • İlaç')
        : inferredType === 'beauty'
          ? tt('text_mode_beauty_name', 'Metin Analizi • Kozmetik')
          : tt('text_mode_food_name', 'Metin Analizi • Gıda'),
    brand:
      inputSource === 'ocr'
        ? tt('text_mode_brand_ocr', 'Kameradan okunan metin')
        : tt('text_mode_brand', 'Elle girilen metin'),
    image_url: FALLBACK_IMAGE,
    type: inferredType,
    ingredients_text: rawText,
    nutriments:
      inferredType === 'food' ? extractNutritionTableFromText(rawText) : undefined,
    intended_use_summary:
      inferredType === 'medicine' ? buildMedicineSummaryFromText(rawText) : undefined,
    sourceName:
      inferredType === 'medicine'
        ? 'titck'
        : inferredType === 'beauty'
          ? 'openbeautyfacts'
          : 'openfoodfacts',
  };
};

const extractCandidateQueries = (rawText: string): string[] => {
  const normalizedText = rawText.replace(/\r/g, '\n');
  const lines = normalizedText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.length >= 3);

  const preferredLines = lines.filter((line) => {
    const normalizedLine = normalizeForMatch(line);

    if (!normalizedLine) {
      return false;
    }

    if (INGREDIENT_MARKERS.some((marker) => normalizedLine.includes(normalizeForMatch(marker)))) {
      return false;
    }

    if (line.length > 48) {
      return false;
    }

    const commaCount = (line.match(/,/g) || []).length;
    if (commaCount >= 2) {
      return false;
    }

    return tokenize(line).length >= 2;
  });

  const joinedHeadline = preferredLines.slice(0, 2).join(' ').trim();
  const queries = Array.from(
    new Set(
      [
        preferredLines[0],
        joinedHeadline,
        preferredLines[1],
        tokenize(rawText).slice(0, 5).join(' '),
      ]
        .map((item) => String(item || '').replace(/\s+/g, ' ').trim())
        .filter((item) => item.length >= 3)
    )
  );

  return queries.slice(0, 3);
};

const computeIngredientOverlap = (ocrText: string, product: Product): number => {
  const sourceTokens = new Set(tokenize(ocrText));
  const ingredientTokens = tokenize(product.ingredients_text);

  if (!sourceTokens.size || ingredientTokens.length === 0) {
    return 0;
  }

  let matches = 0;
  ingredientTokens.forEach((token) => {
    if (sourceTokens.has(token)) {
      matches += 1;
    }
  });

  return Math.min(matches, 12);
};

const rankStructuredCandidate = (params: {
  product: Product;
  rawText: string;
  query: string;
  inferredType: ProductType;
}): number => {
  const { product, rawText, query, inferredType } = params;

  if (product.type !== inferredType) {
    return -1;
  }

  const normalizedRaw = normalizeForMatch(rawText);
  const normalizedName = normalizeForMatch(product.name);
  const normalizedBrand = normalizeForMatch(product.brand);
  const queryTokens = new Set(tokenize(query));
  const candidateTokens = new Set(tokenize(`${product.brand} ${product.name}`));

  let score = 0;

  if (normalizedName && normalizedRaw.includes(normalizedName)) {
    score += 34;
  }

  if (normalizedBrand && normalizedRaw.includes(normalizedBrand)) {
    score += 18;
  }

  queryTokens.forEach((token) => {
    if (candidateTokens.has(token)) {
      score += 14;
    }
  });

  score += computeIngredientOverlap(rawText, product) * 2;

  if (product.image_url) {
    score += 6;
  }

  if (typeof product.score === 'number' && Number.isFinite(product.score)) {
    score += 8;
  }

  if (product.ingredients_text) {
    score += 4;
  }

  return score;
};

const findStructuredCandidate = async (params: {
  rawText: string;
  inferredType: ProductType;
}): Promise<{ product: Product; query: string; score: number } | null> => {
  const { rawText, inferredType } = params;

  if (inferredType === 'medicine') {
    return null;
  }

  const queries = extractCandidateQueries(rawText);

  if (!queries.length) {
    return null;
  }

  const searchFn =
    inferredType === 'beauty' ? searchBeautyProductsByText : searchFoodProductsByText;

  let bestMatch: { product: Product; query: string; score: number } | null = null;

  for (const query of queries) {
    const candidates = await searchFn(query, 5);

    candidates.forEach((product) => {
      const score = rankStructuredCandidate({
        product,
        rawText,
        query,
        inferredType,
      });

      if (score < 46) {
        return;
      }

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { product, query, score };
      }
    });
  }

  return bestMatch;
};

const mergeStructuredProductWithRawText = (product: Product, rawText: string): Product => {
  const hasIngredientMarker = INGREDIENT_MARKERS.some((marker) =>
    normalizeForMatch(rawText).includes(normalizeForMatch(marker))
  );
  const parsedNutriments = extractNutritionTableFromText(rawText);
  const currentNutrimentCount = countParsedNutriments(product.nutriments);
  const parsedNutrimentCount = countParsedNutriments(parsedNutriments);

  const nextProduct: Product =
    parsedNutrimentCount > currentNutrimentCount
      ? {
          ...product,
          nutriments: {
            ...(product.nutriments || {}),
            ...(parsedNutriments || {}),
          },
        }
      : product;

  if (!hasIngredientMarker) {
    return nextProduct;
  }

  const currentIngredientsLength = String(product.ingredients_text || '').trim().length;
  const incomingLength = rawText.trim().length;

  if (incomingLength <= currentIngredientsLength) {
    return nextProduct;
  }

  return {
    ...nextProduct,
    ingredients_text: rawText.trim(),
  };
};

export const resolveHybridTextAnalysis = async (params: {
  rawText: string;
  inputSource: TextAnalysisInputSource;
  tt: TranslateFn;
}): Promise<HybridTextAnalysisResult> => {
  const { rawText, inputSource, tt } = params;
  const trimmedText = rawText.trim();

  if (trimmedText.length < 12) {
    throw new Error('TEXT_TOO_SHORT');
  }

  const inferredType = inferTextProductType(trimmedText);
  const includesNutritionSignals =
    inferredType === 'food' ? hasNutritionTableSignals(trimmedText) : false;
  const structuredMatch = await findStructuredCandidate({
    rawText: trimmedText,
    inferredType,
  });

  if (structuredMatch) {
    const mergedProduct = mergeStructuredProductWithRawText(
      structuredMatch.product,
      trimmedText
    );
    const analysis = analyzeProduct(mergedProduct);

    return {
      product: mergedProduct,
      analysis,
      productType: inferredType,
      resolution: 'structured_match',
      matchedQuery: structuredMatch.query,
      matchScore: structuredMatch.score,
      previewMessage:
        inferredType === 'beauty'
          ? tt(
              'text_mode_structured_match_beauty_message',
              'Metin, Open Beauty Facts adaylarıyla eşleştirildi. Yapısal ürün verisi kullanılarak analiz güçlendirildi.'
            )
          : tt(
              'text_mode_structured_match_food_message',
              'Metin, Open Food Facts adaylarıyla eşleştirildi. Yapısal ürün verisi kullanılarak analiz güçlendirildi.'
            ),
    };
  }

  const textBackedProduct = buildTextBackedProduct({
    rawText: trimmedText,
    inputSource,
    inferredType,
    tt,
  });
  const analysis = analyzeProduct(textBackedProduct);

  return {
    product: textBackedProduct,
    analysis,
    productType: inferredType,
    resolution: 'signal_only',
    matchedQuery: null,
    matchScore: null,
    previewMessage:
      inferredType === 'medicine'
        ? tt(
            'text_mode_medicine_message',
            'Metinden resmi kullanım sinyali yorumlandı. Prospektüs yerine geçmez.'
          )
        : inferredType === 'food' && !includesNutritionSignals
          ? tt(
              inputSource === 'ocr'
                ? 'text_mode_food_ocr_ingredients_only_message'
                : 'text_mode_food_manual_ingredients_only_message',
              inputSource === 'ocr'
                ? 'Yalnız içerik metni okunabildi. Besin değerleri tablosu okunmadığı için sonuç sınırlı olabilir ve resmi besin puanı yerine geçmez.'
                : 'Yalnız içerik metni girildi. Besin değerleri tablosu olmadan çıkan sonuç sınırlı olabilir ve resmi besin puanı yerine geçmez.'
            )
        : inferredType === 'food'
          ? tt(
              inputSource === 'ocr'
                ? 'text_mode_food_ocr_with_nutrition_message'
                : 'text_mode_food_manual_with_nutrition_message',
              inputSource === 'ocr'
                ? 'İçerik ve besin değerleri birlikte okundu. Güçlü ürün eşleşmesi bulunamadığı için sonuç yine yönlendiricidir.'
                : 'İçerik ve besin değerleri birlikte girildi. Güçlü ürün eşleşmesi bulunamadığı için sonuç yine yönlendiricidir.'
            )
        : inputSource === 'ocr'
          ? tt(
              'text_mode_ocr_preview_message',
              'Kameradan okunan metinle içerik sinyali çıkarıldı. Güçlü ürün eşleşmesi bulunamadığı için bu sonuç barkod kadar kesin değildir.'
            )
          : tt(
              'text_mode_preview_message',
              'Metin üzerinden içerik sinyali çıkarıldı. Güçlü ürün eşleşmesi bulunamadığı için bu sonuç barkod kadar kesin değildir.'
            ),
  };
};

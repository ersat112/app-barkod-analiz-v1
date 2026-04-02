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

  if (!hasIngredientMarker) {
    return product;
  }

  const currentIngredientsLength = String(product.ingredients_text || '').trim().length;
  const incomingLength = rawText.trim().length;

  if (incomingLength <= currentIngredientsLength) {
    return product;
  }

  return {
    ...product,
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

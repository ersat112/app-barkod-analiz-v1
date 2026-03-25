import axios from 'axios';
import i18n from 'i18next';
import { Product } from '../utils/analysis';

export type FactsSource = 'openfoodfacts' | 'openbeautyfacts';

export type FactsApiResult = {
  product: Product | null;
  source: FactsSource;
  found: boolean;
  raw?: unknown;
};

export const DEFAULT_TIMEOUT = 12000;

export const buildFactsClient = (baseURL: string) =>
  axios.create({
    baseURL,
    timeout: DEFAULT_TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'ErEnesAl/1.0 (Barcode Analysis App)',
    },
  });

export const normalizeBarcode = (barcode: string): string =>
  String(barcode || '').replace(/[^\d]/g, '').trim();

export const isBarcodeValid = (barcode: string): boolean =>
  /^\d{8,14}$/.test(normalizeBarcode(barcode));

export const normalizeScore = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

export const safeArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];

export const safeObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const safeText = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
};

const containsCyrillic = (value: string): boolean => /[\u0400-\u04FF]/u.test(value);

const CYRILLIC_TO_LATIN_MAP: Record<string, string> = {
  А: 'A', а: 'a', Б: 'B', б: 'b', В: 'V', в: 'v', Г: 'G', г: 'g',
  Д: 'D', д: 'd', Е: 'E', е: 'e', Ё: 'E', ё: 'e', Ж: 'Zh', ж: 'zh',
  З: 'Z', з: 'z', И: 'I', и: 'i', Й: 'Y', й: 'y', К: 'K', к: 'k',
  Л: 'L', л: 'l', М: 'M', м: 'm', Н: 'N', н: 'n', О: 'O', о: 'o',
  П: 'P', п: 'p', Р: 'R', р: 'r', С: 'S', с: 's', Т: 'T', т: 't',
  У: 'U', у: 'u', Ф: 'F', ф: 'f', Х: 'H', х: 'h', Ц: 'Ts', ц: 'ts',
  Ч: 'Ch', ч: 'ch', Ш: 'Sh', ш: 'sh', Щ: 'Shch', щ: 'shch',
  Ъ: '', ъ: '', Ы: 'Y', ы: 'y', Ь: '', ь: '', Э: 'E', э: 'e',
  Ю: 'Yu', ю: 'yu', Я: 'Ya', я: 'ya', І: 'I', і: 'i', Ї: 'Yi',
  ї: 'yi', Є: 'Ye', є: 'ye', Ґ: 'G', ґ: 'g',
};

const transliterateCyrillic = (value: string): string =>
  value.replace(/[\u0400-\u04FF]/gu, (character) => CYRILLIC_TO_LATIN_MAP[character] ?? '');

export const sanitizeFactsText = (value: unknown, fallback = ''): string => {
  const rawText = safeText(value);

  if (!rawText) {
    return fallback;
  }

  const normalized = containsCyrillic(rawText)
    ? transliterateCyrillic(rawText)
    : rawText;

  const compact = normalized.replace(/\s+/g, ' ').trim();
  return compact || fallback;
};

const getActiveLanguage = (): string => {
  return String(i18n.language || 'tr')
    .toLowerCase()
    .split('-')[0];
};

export const resolveLocalizedName = (
  p: Record<string, unknown>,
  fallback: string
): string => {
  const language = getActiveLanguage();
  const orderedCandidates =
    language === 'tr'
      ? [
          p.product_name_tr,
          p.generic_name_tr,
          p.product_name_en,
          p.generic_name_en,
          p.product_name,
          p.generic_name,
        ]
      : language === 'en'
        ? [
            p.product_name_en,
            p.generic_name_en,
            p.product_name,
            p.generic_name,
            p.product_name_tr,
            p.generic_name_tr,
          ]
        : [
            p.product_name_en,
            p.generic_name_en,
            p.product_name,
            p.generic_name,
            p.product_name_tr,
            p.generic_name_tr,
          ];

  const normalizedCandidates = orderedCandidates
    .map((value) => sanitizeFactsText(value))
    .filter((value) => value.length > 0);

  const latinPreferredCandidate = normalizedCandidates.find(
    (value) => !containsCyrillic(value)
  );

  return latinPreferredCandidate || normalizedCandidates[0] || fallback;
};

export const resolveBrand = (p: Record<string, unknown>, fallback: string): string =>
  sanitizeFactsText(p.brands, fallback);

export const resolveImage = (p: Record<string, unknown>): string =>
  String(
    p.image_front_url ||
      p.image_url ||
      p.image_front_small_url ||
      ''
  );

export const resolveIngredients = (p: Record<string, unknown>): string =>
  String(
    p.ingredients_text ||
      p.ingredients_text_tr ||
      p.ingredients_text_en ||
      ''
  );

export const resolveCountry = (p: Record<string, unknown>): string =>
  String(p.countries || p.countries_en || '');

export const resolveOrigin = (p: Record<string, unknown>): string =>
  String(p.origins || p.origins_en || '');

export const resolveGrade = (p: Record<string, unknown>): string =>
  String(
    p.nutriscore_grade ||
      p.nutrition_grades ||
      p.ecoscore_grade ||
      'unknown'
  );

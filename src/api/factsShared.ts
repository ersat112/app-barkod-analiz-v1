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

  return value.normalize('NFKC').replace(/\s+/g, ' ').trim();
};

export const sanitizeFactsText = (value: unknown, fallback = ''): string => {
  const rawText = safeText(value);

  if (!rawText) {
    return fallback;
  }

  const compact = rawText.replace(/\s+/g, ' ').trim();
  return compact || fallback;
};

const getActiveLanguage = (): string => {
  return String(i18n.language || 'tr')
    .toLowerCase()
    .split('-')[0];
};

const SUPPORTED_FACTS_LANGUAGES = ['tr', 'en', 'de', 'fr'] as const;

const getLanguagePriority = (): string[] => {
  const activeLanguage = getActiveLanguage();
  const ordered = [
    activeLanguage,
    'en',
    'tr',
    'de',
    'fr',
  ].filter(Boolean);

  return [...new Set(ordered)];
};

const getLocalizedCandidates = (
  p: Record<string, unknown>,
  baseKeys: string[]
): string[] => {
  const languagePriority = getLanguagePriority();
  const candidates: string[] = [];

  for (const language of languagePriority) {
    for (const baseKey of baseKeys) {
      candidates.push(`${baseKey}_${language}`);
    }
  }

  for (const baseKey of baseKeys) {
    candidates.push(baseKey);
  }

  for (const language of SUPPORTED_FACTS_LANGUAGES) {
    for (const baseKey of baseKeys) {
      candidates.push(`${baseKey}_${language}`);
    }
  }

  return [...new Set(candidates)]
    .map((key) => sanitizeFactsText(p[key]))
    .filter((value) => value.length > 0);
};

export const resolveLocalizedName = (
  p: Record<string, unknown>,
  fallback: string
): string => {
  const candidates = getLocalizedCandidates(p, ['product_name', 'generic_name']);
  return candidates[0] || fallback;
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
  getLocalizedCandidates(p, ['ingredients_text'])[0] || '';

const humanizeFactsTag = (value: string): string => {
  const normalized = String(value || '')
    .trim()
    .replace(/^[a-z]{2}:/i, '')
    .replace(/[_-]+/g, ' ');

  if (!normalized) {
    return '';
  }

  return normalized
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const resolveFactsListText = (
  directValue: unknown,
  tagValue: unknown,
  fallback = ''
): string => {
  const directText = sanitizeFactsText(directValue);

  if (directText) {
    return directText;
  }

  const tagText = safeArray(tagValue)
    .map((item) => humanizeFactsTag(item))
    .filter(Boolean)
    .join(', ');

  return sanitizeFactsText(tagText, fallback);
};

export const resolveCountry = (p: Record<string, unknown>): string =>
  resolveFactsListText(p.countries || p.countries_en, p.countries_tags, '');

export const resolveCategories = (p: Record<string, unknown>): string =>
  resolveFactsListText(p.categories || p.categories_en, p.categories_tags, '');

export const resolveOrigin = (p: Record<string, unknown>): string =>
  resolveFactsListText(p.origins || p.origins_en, p.origins_tags, '');

export const resolveManufacturingPlace = (
  p: Record<string, unknown>,
  fallback = ''
): string =>
  resolveFactsListText(
    p.manufacturing_places,
    p.manufacturing_places_tags,
    fallback
  );

export const resolveBrandOwner = (
  p: Record<string, unknown>,
  fallback = ''
): string =>
  sanitizeFactsText(
    p.brand_owner || p.brands_owner || p.owners,
    fallback
  );

export const resolveGrade = (p: Record<string, unknown>): string =>
  String(
    p.nutriscore_grade ||
      p.nutrition_grades ||
      p.ecoscore_grade ||
      'unknown'
  );

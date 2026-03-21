import axios from 'axios';
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

export const resolveLocalizedName = (p: Record<string, unknown>, fallback: string): string =>
  String(
    p.product_name ||
      p.product_name_tr ||
      p.product_name_en ||
      p.generic_name ||
      p.generic_name_tr ||
      p.generic_name_en ||
      fallback
  );

export const resolveBrand = (p: Record<string, unknown>, fallback: string): string =>
  String(p.brands || fallback);

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
import { MissingProductDraft } from '../types/contribution';

export const buildMissingProductDraft = (
  barcode: string,
  partial?: Partial<MissingProductDraft>
): MissingProductDraft => ({
  barcode,
  name: partial?.name || '',
  brand: partial?.brand || '',
  country: partial?.country || '',
  origin: partial?.origin || '',
  ingredients_text: partial?.ingredients_text || '',
  image_uri: partial?.image_uri || '',
  type: partial?.type || 'unknown',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  status: 'draft',
});
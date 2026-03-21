export type MissingProductDraft = {
  barcode: string;
  name?: string;
  brand?: string;
  country?: string;
  origin?: string;
  ingredients_text?: string;
  image_uri?: string;
  type?: 'food' | 'beauty' | 'unknown';
  created_at: string;
  updated_at?: string;
  status: 'draft' | 'ready_for_review' | 'submitted';
};
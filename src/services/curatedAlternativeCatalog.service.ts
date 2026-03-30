import curatedCatalog from '../assets/data/curatedAlternativeCatalog.json';
import type { Product, ProductType } from '../utils/analysis';

type CuratedAlternativeMapping = {
  barcode?: string;
  type?: ProductType;
  alternativeBarcodes?: string[];
};

type CuratedAlternativeCatalogPayload = {
  version?: number;
  mappings?: CuratedAlternativeMapping[];
  products?: Product[];
};

const normalizeBarcode = (value: unknown): string =>
  String(value ?? '').replace(/[^\d]/g, '').trim();

const payload = curatedCatalog as CuratedAlternativeCatalogPayload;

const curatedProductsByBarcode = new Map<string, Product>();
const curatedMappingsByBarcode = new Map<string, CuratedAlternativeMapping>();

(payload.products ?? []).forEach((product) => {
  const barcode = normalizeBarcode(product.barcode);

  if (!barcode) {
    return;
  }

  curatedProductsByBarcode.set(barcode, {
    ...product,
    barcode,
  });
});

(payload.mappings ?? []).forEach((mapping) => {
  const barcode = normalizeBarcode(mapping.barcode);

  if (!barcode) {
    return;
  }

  curatedMappingsByBarcode.set(barcode, {
    ...mapping,
    barcode,
    alternativeBarcodes: (mapping.alternativeBarcodes ?? []).map((item) =>
      normalizeBarcode(item)
    ),
  });
});

export const getCuratedAlternativeProducts = (product: Product): Product[] => {
  if (product.type === 'medicine') {
    return [];
  }

  const mapping = curatedMappingsByBarcode.get(normalizeBarcode(product.barcode));

  if (!mapping) {
    return [];
  }

  return (mapping.alternativeBarcodes ?? [])
    .map((barcode) => curatedProductsByBarcode.get(barcode) ?? null)
    .filter(
      (candidate): candidate is Product =>
        candidate !== null &&
        candidate.type === product.type &&
        normalizeBarcode(candidate.barcode) !== normalizeBarcode(product.barcode)
    );
};

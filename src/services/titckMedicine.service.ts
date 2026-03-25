import * as XLSX from 'xlsx';

import type { Product } from '../utils/analysis';
// Generated from the official TITCK XLSX so medicine barcode resolution keeps
// working even when the dynamic module page does not expose the attachment URL.
import bundledCatalog from '../assets/data/titckMedicineCatalog.json';

const TITCK_DYNAMIC_MODULE_URL = 'https://www.titck.gov.tr/dinamikmodul/85';
const TITCK_KUBKT_PAGE_URL = 'https://www.titck.gov.tr/kubkt';
const TITCK_KUBKT_DATA_URL = 'https://www.titck.gov.tr/getkubktviewdatatable';

const CATALOG_TTL_MS = 1000 * 60 * 60 * 12;
const PROSPECTUS_TTL_MS = 1000 * 60 * 60 * 6;

type TitckMedicineCatalogEntry = {
  barcode: string;
  name: string;
  searchName: string;
  activeIngredient: string;
  activeIngredients: string[];
  atcCode: string;
  licenseHolder: string;
  licenseDate: string;
  licenseNumber: string;
  licenseStatusCode: string;
  licenseStatus: string;
  suspensionDate: string;
  catalogUpdatedAt: string;
};

type TitckMedicineCatalogSnapshot = {
  fetchedAt: number;
  sourceUrl: string;
  catalogUpdatedAt: string;
  entriesByBarcode: Map<string, TitckMedicineCatalogEntry>;
};

type BundledCatalogPayload = {
  catalogUpdatedAt?: string;
  source?: string;
  entryCount?: number;
  entries?: Partial<TitckMedicineCatalogEntry>[];
};

type TitckProspectusRecord = {
  name: string;
  element: string;
  firmName: string;
  confirmationDateKub: string;
  confirmationDateKt: string;
  documentPathKub: string;
  documentPathKt: string;
};

type TitckProspectusLookup = {
  prospectusPdfUrl?: string;
  summaryPdfUrl?: string;
  prospectusApprovalDate?: string;
  shortTextApprovalDate?: string;
};

type ProspectusCacheEntry = {
  fetchedAt: number;
  result: TitckProspectusLookup | null;
};

type TitckProspectusResponse = {
  data?: TitckProspectusRecord[];
  recordsFiltered?: number;
  recordsTotal?: number;
  message?: string;
};

let catalogSnapshot: TitckMedicineCatalogSnapshot | null = null;
let catalogPromise: Promise<TitckMedicineCatalogSnapshot> | null = null;
let remoteCatalogRefreshPromise: Promise<void> | null = null;
const prospectusCache = new Map<string, ProspectusCacheEntry>();

const DATATABLE_COLUMNS = [
  'name',
  'element',
  'firmName',
  'confirmationDateKub',
  'confirmationDateKt',
  'documentPathKub',
  'documentPathKt',
] as const;

const safeText = (value?: string | null, fallback = ''): string => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
};

const normalizeBarcode = (value: unknown): string => {
  return String(value ?? '').replace(/[^\d]/g, '').trim();
};

const normalizeWhitespace = (value: string): string => {
  return safeText(value).replace(/\s+/g, ' ').trim();
};

const normalizeSearchText = (value: string): string => {
  return normalizeWhitespace(value)
    .toLocaleUpperCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
};

const splitActiveIngredients = (value: string): string[] => {
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    return [];
  }

  return Array.from(
    new Set(
      normalized
        .split(/\s*\+\s*|[;,/\n\t]+/g)
        .map((item) => normalizeWhitespace(item))
        .filter((item) => item.length > 0)
    )
  );
};

const resolveLicenseStatus = (code: unknown): string => {
  switch (String(code ?? '').trim()) {
    case '1':
      return 'Madde 23 gerekçeli askıda';
    case '2':
      return 'Farmakovijilans gerekçeli askıda';
    case '3':
      return 'Madde 22 gerekçeli askıda';
    default:
      return 'Ruhsatı aktif';
  }
};

const extractCatalogUpdatedAt = (sourceUrl: string): string => {
  const match = sourceUrl.match(/(\d{2}\.\d{2}\.\d{4})/);
  return match?.[1] ?? '';
};

const extractHref = (html: string): string | undefined => {
  const match = html.match(/href="([^"]+)"/i);
  return match?.[1];
};

const extractKubktToken = (html: string): string | null => {
  const match = html.match(/_token:\s*"([^"]+)"/i);
  return match?.[1] ?? null;
};

const resolveWorkbookSourceUrl = (html: string): string | null => {
  const match = html.match(/https?:\/\/[^"'\\\s>]+\.xlsx/iu);
  return match?.[0] ?? null;
};

const buildKubktSearchParams = (searchValue: string, token: string): string => {
  const params = new URLSearchParams();
  params.set('draw', '1');

  DATATABLE_COLUMNS.forEach((column, index) => {
    params.set(`columns[${index}][data]`, column);
    params.set(`columns[${index}][searchable]`, 'true');
    params.set(`columns[${index}][orderable]`, 'true');
    params.set(`columns[${index}][search][value]`, '');
    params.set(`columns[${index}][search][regex]`, 'false');
  });

  params.set('order[0][column]', '0');
  params.set('order[0][dir]', 'asc');
  params.set('start', '0');
  params.set('length', '10');
  params.set('search[value]', searchValue);
  params.set('search[regex]', 'false');
  params.set('_token', token);

  return params.toString();
};

const createWorkbookHeaders = (): HeadersInit => ({
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
});

const createAjaxHeaders = (): HeadersInit => ({
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  Origin: 'https://www.titck.gov.tr',
  Referer: TITCK_KUBKT_PAGE_URL,
  'X-Requested-With': 'XMLHttpRequest',
});

const createCatalogSnapshotFromEntries = (
  entries: TitckMedicineCatalogEntry[],
  sourceUrl: string,
  catalogUpdatedAt: string
): TitckMedicineCatalogSnapshot => {
  return {
    fetchedAt: Date.now(),
    sourceUrl,
    catalogUpdatedAt,
    entriesByBarcode: new Map(entries.map((entry) => [entry.barcode, entry])),
  };
};

const parseCatalogRows = (
  rows: (string | number | null)[][],
  sourceUrl: string
): TitckMedicineCatalogSnapshot => {
  const entries: TitckMedicineCatalogEntry[] = [];
  const catalogUpdatedAt = extractCatalogUpdatedAt(sourceUrl);

  rows.slice(2).forEach((row) => {
    const barcode = normalizeBarcode(row[1]);

    if (!barcode) {
      return;
    }

    const name = normalizeWhitespace(String(row[2] ?? ''));
    const activeIngredient = normalizeWhitespace(String(row[3] ?? ''));
    const atcCode = normalizeWhitespace(String(row[4] ?? ''));
    const licenseHolder = normalizeWhitespace(String(row[5] ?? ''));
    const licenseDate = normalizeWhitespace(String(row[6] ?? ''));
    const licenseNumber = normalizeWhitespace(String(row[7] ?? ''));
    const licenseStatusCode = normalizeWhitespace(String(row[11] ?? '0'));
    const suspensionDate = normalizeWhitespace(String(row[12] ?? ''));

    entries.push({
      barcode,
      name,
      searchName: normalizeWhitespace(name.split(',')[0] || name),
      activeIngredient,
      activeIngredients: splitActiveIngredients(activeIngredient),
      atcCode,
      licenseHolder,
      licenseDate,
      licenseNumber,
      licenseStatusCode,
      licenseStatus: resolveLicenseStatus(licenseStatusCode),
      suspensionDate,
      catalogUpdatedAt,
    });
  });

  return createCatalogSnapshotFromEntries(entries, sourceUrl, catalogUpdatedAt);
};

const normalizeBundledEntry = (
  value: Partial<TitckMedicineCatalogEntry>
): TitckMedicineCatalogEntry | null => {
  const barcode = normalizeBarcode(value.barcode);

  if (!barcode) {
    return null;
  }

  const activeIngredient = normalizeWhitespace(value.activeIngredient ?? '');

  return {
    barcode,
    name: normalizeWhitespace(value.name ?? ''),
    searchName:
      normalizeWhitespace(value.searchName ?? '') ||
      normalizeWhitespace(String(value.name ?? '').split(',')[0] || ''),
    activeIngredient,
    activeIngredients: Array.isArray(value.activeIngredients)
      ? value.activeIngredients
          .map((item) => normalizeWhitespace(String(item)))
          .filter((item) => item.length > 0)
      : splitActiveIngredients(activeIngredient),
    atcCode: normalizeWhitespace(value.atcCode ?? ''),
    licenseHolder: normalizeWhitespace(value.licenseHolder ?? ''),
    licenseDate: normalizeWhitespace(value.licenseDate ?? ''),
    licenseNumber: normalizeWhitespace(value.licenseNumber ?? ''),
    licenseStatusCode: normalizeWhitespace(value.licenseStatusCode ?? '0'),
    licenseStatus: resolveLicenseStatus(value.licenseStatusCode),
    suspensionDate: normalizeWhitespace(value.suspensionDate ?? ''),
    catalogUpdatedAt: normalizeWhitespace(value.catalogUpdatedAt ?? ''),
  };
};

const loadBundledCatalogSnapshot = (): TitckMedicineCatalogSnapshot => {
  const payload = bundledCatalog as BundledCatalogPayload;
  const catalogUpdatedAt = normalizeWhitespace(payload.catalogUpdatedAt ?? '19.03.2026');
  const entries = (payload.entries ?? [])
    .map((entry) =>
      normalizeBundledEntry({
        ...entry,
        catalogUpdatedAt,
      })
    )
    .filter((entry): entry is TitckMedicineCatalogEntry => entry !== null);

  return createCatalogSnapshotFromEntries(
    entries,
    String(payload.source || 'bundled_titck_catalog'),
    catalogUpdatedAt
  );
};

const fetchRemoteCatalogSnapshot = async (): Promise<TitckMedicineCatalogSnapshot> => {
  const pageResponse = await fetch(TITCK_DYNAMIC_MODULE_URL, {
    headers: createWorkbookHeaders(),
  });

  const pageHtml = await pageResponse.text();
  const sourceUrl = resolveWorkbookSourceUrl(pageHtml);

  if (!sourceUrl) {
    throw new Error('titck_medicine_catalog_xlsx_not_found');
  }

  const workbookResponse = await fetch(sourceUrl, {
    headers: createWorkbookHeaders(),
  });

  if (!workbookResponse.ok) {
    throw new Error(`titck_medicine_catalog_download_failed:${workbookResponse.status}`);
  }

  const workbookBytes = new Uint8Array(await workbookResponse.arrayBuffer());
  const workbook = XLSX.read(workbookBytes, { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];

  if (!worksheet) {
    throw new Error('titck_medicine_catalog_sheet_missing');
  }

  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(worksheet, {
    header: 1,
    raw: false,
    defval: '',
  });

  return parseCatalogRows(rows, sourceUrl);
};

const refreshRemoteCatalogInBackground = (): void => {
  if (remoteCatalogRefreshPromise) {
    return;
  }

  remoteCatalogRefreshPromise = (async () => {
    try {
      const remoteSnapshot = await fetchRemoteCatalogSnapshot();
      catalogSnapshot = remoteSnapshot;
    } catch (remoteCatalogError) {
      console.warn('[TitckMedicine] remote catalog refresh skipped:', {
        error: remoteCatalogError,
      });
    } finally {
      remoteCatalogRefreshPromise = null;
    }
  })();
};

const loadCatalogSnapshot = async (): Promise<TitckMedicineCatalogSnapshot> => {
  if (catalogSnapshot) {
    if (Date.now() - catalogSnapshot.fetchedAt >= CATALOG_TTL_MS) {
      refreshRemoteCatalogInBackground();
    }

    return catalogSnapshot;
  }

  if (catalogPromise) {
    return catalogPromise;
  }

  catalogPromise = (async () => {
    catalogSnapshot = loadBundledCatalogSnapshot();
    refreshRemoteCatalogInBackground();
    return catalogSnapshot;
  })();

  try {
    return await catalogPromise;
  } finally {
    catalogPromise = null;
  }
};

const searchKubktProspectus = async (
  entry: TitckMedicineCatalogEntry
): Promise<TitckProspectusLookup | null> => {
  const cacheKey = `${entry.searchName}::${entry.licenseHolder}`;
  const cached = prospectusCache.get(cacheKey);

  if (cached && Date.now() - cached.fetchedAt < PROSPECTUS_TTL_MS) {
    return cached.result;
  }

  const pageResponse = await fetch(TITCK_KUBKT_PAGE_URL, {
    headers: createWorkbookHeaders(),
    credentials: 'include',
  });
  const pageHtml = await pageResponse.text();
  const token = extractKubktToken(pageHtml);

  if (!token) {
    prospectusCache.set(cacheKey, {
      fetchedAt: Date.now(),
      result: null,
    });
    return null;
  }

  const response = await fetch(TITCK_KUBKT_DATA_URL, {
    method: 'POST',
    headers: createAjaxHeaders(),
    body: buildKubktSearchParams(entry.searchName, token),
    credentials: 'include',
  });

  if (!response.ok) {
    prospectusCache.set(cacheKey, {
      fetchedAt: Date.now(),
      result: null,
    });
    return null;
  }

  const payload = (await response.json()) as TitckProspectusResponse;
  const records = Array.isArray(payload.data) ? payload.data : [];

  const normalizedSearchName = normalizeSearchText(entry.searchName);
  const normalizedFullName = normalizeSearchText(entry.name);
  const normalizedFirm = normalizeSearchText(entry.licenseHolder);
  const normalizedIngredient = normalizeSearchText(entry.activeIngredient);

  const bestRecord =
    [...records]
      .map((record) => {
        const recordName = normalizeSearchText(record.name);
        const recordFirm = normalizeSearchText(record.firmName);
        const recordElement = normalizeSearchText(record.element);
        let score = 0;

        if (recordName === normalizedSearchName) {
          score += 120;
        }

        if (recordName === normalizedFullName) {
          score += 100;
        }

        if (recordName.startsWith(normalizedSearchName)) {
          score += 80;
        }

        if (normalizedFullName.startsWith(recordName)) {
          score += 60;
        }

        if (recordFirm === normalizedFirm) {
          score += 40;
        }

        if (recordElement === normalizedIngredient) {
          score += 30;
        }

        if (recordName.includes(normalizedSearchName)) {
          score += 20;
        }

        return { record, score };
      })
      .sort((left, right) => right.score - left.score)[0]?.record ?? null;

  if (!bestRecord) {
    prospectusCache.set(cacheKey, {
      fetchedAt: Date.now(),
      result: null,
    });
    return null;
  }

  const result: TitckProspectusLookup = {
    summaryPdfUrl: extractHref(bestRecord.documentPathKub),
    prospectusPdfUrl: extractHref(bestRecord.documentPathKt),
    prospectusApprovalDate: safeText(bestRecord.confirmationDateKt) || undefined,
    shortTextApprovalDate: safeText(bestRecord.confirmationDateKub) || undefined,
  };

  prospectusCache.set(cacheKey, {
    fetchedAt: Date.now(),
    result,
  });

  return result;
};

const mapEntryToProduct = (
  entry: TitckMedicineCatalogEntry,
  catalogUpdatedAt: string,
  prospectus?: TitckProspectusLookup | null
): Product => {
  return {
    barcode: entry.barcode,
    name: entry.name || 'İsimsiz İlaç',
    brand: entry.licenseHolder || 'Bilinmeyen Firma',
    image_url: '',
    type: 'medicine',
    ingredients_text: entry.activeIngredient,
    sourceName: 'titck',
    country: 'Türkiye',
    origin: 'Türkiye',
    active_ingredients: entry.activeIngredients,
    license_status: entry.licenseStatus,
    license_number: entry.licenseNumber,
    license_date: entry.licenseDate,
    suspension_date: entry.suspensionDate || undefined,
    atc_code: entry.atcCode,
    prospectus_pdf_url: prospectus?.prospectusPdfUrl,
    summary_pdf_url: prospectus?.summaryPdfUrl,
    prospectus_approval_date: prospectus?.prospectusApprovalDate,
    short_text_approval_date: prospectus?.shortTextApprovalDate,
    catalog_updated_at: entry.catalogUpdatedAt || catalogUpdatedAt,
  };
};

export const fetchMedicineProduct = async (
  barcode: string
): Promise<Product | null> => {
  const normalizedBarcode = normalizeBarcode(barcode);

  if (!normalizedBarcode) {
    return null;
  }

  try {
    console.log('[TitckMedicine] catalog lookup started:', normalizedBarcode);

    const catalog = await loadCatalogSnapshot();
    const entry = catalog.entriesByBarcode.get(normalizedBarcode);

    if (!entry) {
      console.warn('[TitckMedicine] barcode not found in catalog:', normalizedBarcode);
      return null;
    }
    const product = mapEntryToProduct(entry, catalog.catalogUpdatedAt);

    console.log('[TitckMedicine] success:', {
      barcode: normalizedBarcode,
      name: product.name,
      hasProspectus: false,
    });

    return product;
  } catch (error) {
    console.error('[TitckMedicine] request failed:', {
      barcode: normalizedBarcode,
      error,
    });
    return null;
  }
};

export const prewarmMedicineCatalog = async (): Promise<void> => {
  await loadCatalogSnapshot();
};

export const enrichMedicineProductWithProspectus = async (
  product: Product
): Promise<Product> => {
  if (product.type !== 'medicine') {
    return product;
  }

  if (product.prospectus_pdf_url || product.summary_pdf_url) {
    return product;
  }

  const normalizedBarcode = normalizeBarcode(product.barcode);

  if (!normalizedBarcode) {
    return product;
  }

  try {
    const catalog = await loadCatalogSnapshot();
    const entry = catalog.entriesByBarcode.get(normalizedBarcode);

    if (!entry) {
      return product;
    }

    const prospectus = await searchKubktProspectus(entry);

    if (!prospectus) {
      return product;
    }

    return {
      ...product,
      ...mapEntryToProduct(entry, catalog.catalogUpdatedAt, prospectus),
      image_url: product.image_url,
      score: product.score,
      grade: product.grade,
      sourceStatus: product.sourceStatus,
    };
  } catch (error) {
    console.warn('[TitckMedicine] prospectus enrichment failed:', {
      barcode: normalizedBarcode,
      error,
    });

    return product;
  }
};

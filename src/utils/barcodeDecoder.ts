/**
 * ErEnesAl® v1 - Profesyonel Barkod Çözümleme ve GS1 Ön Ek Motoru
 *
 * Not:
 * - GS1 prefix bilgisi gerçek üretim menşeini garanti etmez.
 * - Bu bilgi çoğunlukla barkodun kayıtlı olduğu GS1 organizasyonunu ifade eder.
 * - Ürün origin/country bilgisi varsa öncelik her zaman ürün datasındadır.
 */

export interface BarcodeMetadata {
  isValid: boolean;
  type: 'EAN-13' | 'EAN-8' | 'UPC-A' | 'UPC-E' | 'UNKNOWN';
  country?: string;
  gs1PrefixCountry?: string;
  normalizedData: string;
  prefix?: string;
  upcaEquivalent?: string;
  hasGs1PrefixInfo: boolean;
  registrationRegionLabel?: string;
}

type BarcodeType = BarcodeMetadata['type'];

type PrefixRange = {
  start: number;
  end: number;
  country: string;
};

const GS1_PREFIX_RANGES: PrefixRange[] = [
  { start: 0, end: 19, country: 'ABD / Kanada' },
  { start: 30, end: 39, country: 'ABD (İlaç)' },
  { start: 300, end: 379, country: 'Fransa / Monako' },
  { start: 380, end: 380, country: 'Bulgaristan' },
  { start: 383, end: 383, country: 'Slovenya' },
  { start: 385, end: 385, country: 'Hırvatistan' },
  { start: 387, end: 387, country: 'Bosna-Hersek' },
  { start: 389, end: 389, country: 'Karadağ' },
  { start: 400, end: 440, country: 'Almanya' },
  { start: 450, end: 459, country: 'Japonya' },
  { start: 460, end: 469, country: 'Rusya' },
  { start: 470, end: 470, country: 'Kırgızistan' },
  { start: 471, end: 471, country: 'Tayvan' },
  { start: 474, end: 474, country: 'Estonya' },
  { start: 475, end: 475, country: 'Letonya' },
  { start: 476, end: 476, country: 'Azerbaycan' },
  { start: 477, end: 477, country: 'Litvanya' },
  { start: 478, end: 478, country: 'Özbekistan' },
  { start: 479, end: 479, country: 'Sri Lanka' },
  { start: 480, end: 480, country: 'Filipinler' },
  { start: 481, end: 481, country: 'Belarus' },
  { start: 482, end: 482, country: 'Ukrayna' },
  { start: 484, end: 484, country: 'Moldova' },
  { start: 485, end: 485, country: 'Ermenistan' },
  { start: 486, end: 486, country: 'Gürcistan' },
  { start: 487, end: 487, country: 'Kazakistan' },
  { start: 488, end: 488, country: 'Tacikistan' },
  { start: 489, end: 489, country: 'Hong Kong' },
  { start: 490, end: 499, country: 'Japonya' },
  { start: 500, end: 509, country: 'Birleşik Krallık' },
  { start: 520, end: 521, country: 'Yunanistan' },
  { start: 528, end: 528, country: 'Lübnan' },
  { start: 529, end: 529, country: 'Güney Kıbrıs' },
  { start: 530, end: 530, country: 'Arnavutluk' },
  { start: 531, end: 531, country: 'Makedonya' },
  { start: 535, end: 535, country: 'Malta' },
  { start: 539, end: 539, country: 'İrlanda' },
  { start: 540, end: 549, country: 'Belçika / Lüksemburg' },
  { start: 560, end: 560, country: 'Portekiz' },
  { start: 569, end: 569, country: 'İzlanda' },
  { start: 570, end: 579, country: 'Danimarka / Grönland' },
  { start: 590, end: 590, country: 'Polonya' },
  { start: 594, end: 594, country: 'Romanya' },
  { start: 599, end: 599, country: 'Macaristan' },
  { start: 600, end: 601, country: 'Güney Afrika' },
  { start: 603, end: 603, country: 'Gana' },
  { start: 604, end: 604, country: 'Senegal' },
  { start: 608, end: 608, country: 'Bahreyn' },
  { start: 609, end: 609, country: 'Mauritius' },
  { start: 611, end: 611, country: 'Fas' },
  { start: 613, end: 613, country: 'Cezayir' },
  { start: 615, end: 615, country: 'Nijerya' },
  { start: 616, end: 616, country: 'Kenya' },
  { start: 618, end: 618, country: 'Fildişi Sahili' },
  { start: 619, end: 619, country: 'Tunus' },
  { start: 620, end: 620, country: 'Tanzanya' },
  { start: 621, end: 621, country: 'Suriye' },
  { start: 622, end: 622, country: 'Mısır' },
  { start: 623, end: 623, country: 'Brunei' },
  { start: 624, end: 624, country: 'Libya' },
  { start: 625, end: 625, country: 'Ürdün' },
  { start: 626, end: 626, country: 'İran' },
  { start: 627, end: 627, country: 'Kuveyt' },
  { start: 628, end: 628, country: 'Suudi Arabistan' },
  { start: 629, end: 629, country: 'B.A.E.' },
  { start: 640, end: 649, country: 'Finlandiya' },
  { start: 690, end: 699, country: 'Çin' },
  { start: 700, end: 709, country: 'Norveç' },
  { start: 729, end: 729, country: 'İsrail' },
  { start: 730, end: 739, country: 'İsveç' },
  { start: 740, end: 740, country: 'Guatemala' },
  { start: 741, end: 741, country: 'El Salvador' },
  { start: 742, end: 742, country: 'Honduras' },
  { start: 743, end: 743, country: 'Nikaragua' },
  { start: 744, end: 744, country: 'Kosta Rika' },
  { start: 745, end: 745, country: 'Panama' },
  { start: 746, end: 746, country: 'Dominik Cumh.' },
  { start: 750, end: 750, country: 'Meksika' },
  { start: 754, end: 755, country: 'Kanada' },
  { start: 759, end: 759, country: 'Venezuela' },
  { start: 760, end: 769, country: 'İsviçre / Lihtenştayn' },
  { start: 770, end: 771, country: 'Kolombiya' },
  { start: 773, end: 773, country: 'Uruguay' },
  { start: 775, end: 775, country: 'Peru' },
  { start: 777, end: 777, country: 'Bolivya' },
  { start: 778, end: 779, country: 'Arjantin' },
  { start: 780, end: 780, country: 'Şili' },
  { start: 784, end: 784, country: 'Paraguay' },
  { start: 786, end: 786, country: 'Ekvador' },
  { start: 789, end: 790, country: 'Brezilya' },
  { start: 800, end: 839, country: 'İtalya' },
  { start: 840, end: 849, country: 'İspanya' },
  { start: 850, end: 850, country: 'Küba' },
  { start: 858, end: 858, country: 'Slovakya' },
  { start: 859, end: 859, country: 'Çekya' },
  { start: 860, end: 860, country: 'Sırbistan' },
  { start: 865, end: 865, country: 'Moğolistan' },
  { start: 867, end: 867, country: 'Kuzey Kore' },
  { start: 868, end: 869, country: 'Türkiye' },
  { start: 870, end: 879, country: 'Hollanda' },
  { start: 880, end: 880, country: 'Güney Kore' },
  { start: 884, end: 884, country: 'Kamboçya' },
  { start: 885, end: 885, country: 'Tayland' },
  { start: 888, end: 888, country: 'Singapur' },
  { start: 890, end: 890, country: 'Hindistan' },
  { start: 893, end: 893, country: 'Vietnam' },
  { start: 896, end: 896, country: 'Pakistan' },
  { start: 899, end: 899, country: 'Endonezya' },
  { start: 900, end: 919, country: 'Avusturya' },
  { start: 930, end: 939, country: 'Avustralya' },
  { start: 940, end: 949, country: 'Yeni Zelanda' },
  { start: 955, end: 955, country: 'Malezya' },
  { start: 958, end: 958, country: 'Makao' },
];

const sanitizeBarcode = (rawData: string): string =>
  String(rawData || '').replace(/\D/g, '').trim();

const calculateCheckDigit = (body: string): number | null => {
  if (!/^\d+$/.test(body)) return null;

  const sum = body
    .split('')
    .map(Number)
    .reverse()
    .reduce((acc, digit, idx) => acc + (idx % 2 === 0 ? digit * 3 : digit), 0);

  return (10 - (sum % 10)) % 10;
};

const validateStandardChecksum = (barcode: string): boolean => {
  if (!/^\d+$/.test(barcode) || barcode.length < 2) return false;

  const body = barcode.slice(0, -1);
  const checkDigit = Number(barcode.slice(-1));
  const calculated = calculateCheckDigit(body);

  return calculated !== null && calculated === checkDigit;
};

const expandUPCEToUPCA = (upce: string): string | null => {
  const normalized = sanitizeBarcode(upce);

  if (!/^\d{8}$/.test(normalized)) return null;

  const numberSystem = normalized[0];
  const checkDigit = normalized[7];

  if (numberSystem !== '0' && numberSystem !== '1') return null;

  const d1 = normalized[1];
  const d2 = normalized[2];
  const d3 = normalized[3];
  const d4 = normalized[4];
  const d5 = normalized[5];
  const d6 = normalized[6];

  let upcaBody = '';

  if (d6 === '0' || d6 === '1' || d6 === '2') {
    upcaBody = `${numberSystem}${d1}${d2}${d6}0000${d3}${d4}${d5}`;
  } else if (d6 === '3') {
    upcaBody = `${numberSystem}${d1}${d2}${d3}00000${d4}${d5}`;
  } else if (d6 === '4') {
    upcaBody = `${numberSystem}${d1}${d2}${d3}${d4}00000${d5}`;
  } else {
    upcaBody = `${numberSystem}${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  }

  const calculated = calculateCheckDigit(upcaBody);
  if (calculated === null || String(calculated) !== checkDigit) {
    return null;
  }

  return `${upcaBody}${checkDigit}`;
};

const getCountryByPrefix = (prefix: number): string => {
  const match = GS1_PREFIX_RANGES.find(
    (range) => prefix >= range.start && prefix <= range.end
  );

  return match?.country || 'Uluslararası / Bilinmiyor';
};

const getRegistrationRegionLabel = (prefix?: string): string | undefined => {
  if (!prefix) {
    return undefined;
  }

  const parsed = parseInt(prefix, 10);

  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  const gs1Country = getCountryByPrefix(parsed);
  return `GS1 kayıt bölgesi: ${gs1Country}`;
};

const resolveType = (
  normalized: string,
  hintedType?: string
): { type: BarcodeType; isValid: boolean; upcaEquivalent?: string } => {
  const hint = (hintedType || '').toLowerCase();

  if (hint.includes('upc-e')) {
    const expanded = expandUPCEToUPCA(normalized);
    return {
      type: 'UPC-E',
      isValid: !!expanded,
      upcaEquivalent: expanded || undefined,
    };
  }

  if (hint.includes('upc-a')) {
    return {
      type: 'UPC-A',
      isValid: normalized.length === 12 && validateStandardChecksum(normalized),
    };
  }

  if (hint.includes('ean-13') || hint.includes('ean13')) {
    return {
      type: 'EAN-13',
      isValid: normalized.length === 13 && validateStandardChecksum(normalized),
    };
  }

  if (hint.includes('ean-8') || hint.includes('ean8')) {
    return {
      type: 'EAN-8',
      isValid: normalized.length === 8 && validateStandardChecksum(normalized),
    };
  }

  if (normalized.length === 13) {
    return {
      type: 'EAN-13',
      isValid: validateStandardChecksum(normalized),
    };
  }

  if (normalized.length === 12) {
    return {
      type: 'UPC-A',
      isValid: validateStandardChecksum(normalized),
    };
  }

  if (normalized.length === 8) {
    const upceExpanded = expandUPCEToUPCA(normalized);

    if (upceExpanded) {
      return {
        type: 'UPC-E',
        isValid: true,
        upcaEquivalent: upceExpanded,
      };
    }

    return {
      type: 'EAN-8',
      isValid: validateStandardChecksum(normalized),
    };
  }

  return {
    type: 'UNKNOWN',
    isValid: false,
  };
};

export const barcodeDecoder = {
  getCountryByPrefix,

  validateChecksum: (barcode: string): boolean => {
    const normalized = sanitizeBarcode(barcode);

    if (normalized.length === 8) {
      return validateStandardChecksum(normalized) || !!expandUPCEToUPCA(normalized);
    }

    if (normalized.length === 12 || normalized.length === 13) {
      return validateStandardChecksum(normalized);
    }

    return false;
  },

  expandUPCEToUPCA,

  decode: (rawData: string, hintedType?: string): BarcodeMetadata => {
    const normalized = sanitizeBarcode(rawData);
    const { type, isValid, upcaEquivalent } = resolveType(normalized, hintedType);

    const prefixSource = upcaEquivalent || normalized;
    const prefix =
      prefixSource.length >= 3 ? prefixSource.substring(0, 3) : undefined;

    const gs1PrefixCountry =
      isValid && prefix ? getCountryByPrefix(parseInt(prefix, 10)) : undefined;

    return {
      isValid,
      type,
      normalizedData: normalized,
      prefix,
      upcaEquivalent,
      country: gs1PrefixCountry,
      gs1PrefixCountry,
      hasGs1PrefixInfo: !!gs1PrefixCountry,
      registrationRegionLabel: getRegistrationRegionLabel(prefix),
    };
  },
};

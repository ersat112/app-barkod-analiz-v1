import i18n from 'i18next';
import type { AnalysisResult, Product } from '../utils/analysis';
import { E_CODES_DATA, type ECodeInfo } from './eCodesData';

export type FamilyAllergenKey =
  | 'gluten'
  | 'milk'
  | 'egg'
  | 'peanut'
  | 'treeNuts'
  | 'soy'
  | 'sesame'
  | 'fish'
  | 'shellfish'
  | 'molluscs'
  | 'mustard'
  | 'celery'
  | 'lupin'
  | 'sulfites';

export type FamilyHealthGoalKey =
  | 'lowerSugar'
  | 'lowerSalt'
  | 'cleanIngredients';

export type FamilyHealthProfile = {
  allergens: FamilyAllergenKey[];
  watchedAdditives: string[];
  healthGoals: FamilyHealthGoalKey[];
};

export const FAMILY_ALLERGEN_KEYS: FamilyAllergenKey[] = [
  'gluten',
  'milk',
  'egg',
  'peanut',
  'treeNuts',
  'soy',
  'sesame',
  'fish',
  'shellfish',
  'molluscs',
  'mustard',
  'celery',
  'lupin',
  'sulfites',
];

export const FAMILY_HEALTH_GOAL_KEYS: FamilyHealthGoalKey[] = [
  'lowerSugar',
  'lowerSalt',
  'cleanIngredients',
];

export type FamilyAllergenDefinition = {
  key: FamilyAllergenKey;
  label: string;
  shortDescription: string;
  detail: string;
  watchTerms: string[];
};

export type FamilyHealthGoalDefinition = {
  key: FamilyHealthGoalKey;
  label: string;
  shortDescription: string;
  detail: string;
};

export type FamilyHealthAlertSummary = {
  id: string;
  title: string;
  description: string;
  severity?: 'info' | 'warning' | 'danger' | 'success';
};

export const DEFAULT_FAMILY_HEALTH_PROFILE: FamilyHealthProfile = {
  allergens: [],
  watchedAdditives: [],
  healthGoals: [],
};

const isTurkishAppLanguage = (language?: string): boolean =>
  String(language || i18n.resolvedLanguage || i18n.language || 'tr')
    .toLowerCase()
    .startsWith('tr');

export const FAMILY_ALLERGEN_DEFINITIONS: FamilyAllergenDefinition[] = [
  {
    key: 'gluten',
    label: 'Gluten',
    shortDescription: 'Bugday, arpa ve cavdar iceren urunlerde dikkat ister.',
    detail:
      'Gluten hassasiyeti olan bireylerde bugday, arpa, cavdar ve benzeri tahil iceren urunlerde dikkat gerekir.',
    watchTerms: ['gluten', 'wheat', 'bugday', 'barley', 'arpa', 'rye', 'cavdar', 'spelt'],
  },
  {
    key: 'milk',
    label: 'Sut ve Laktoz',
    shortDescription: 'Sut, laktoz ve whey sinyalleri icin kullanilir.',
    detail:
      'Sut veya laktoz hassasiyeti olan bireyler icin laktoz, sut tozu, whey ve benzeri turevlerde dikkat gerekir.',
    watchTerms: ['milk', 'sut', 'lactose', 'laktoz', 'whey', 'cream', 'krema'],
  },
  {
    key: 'egg',
    label: 'Yumurta',
    shortDescription: 'Yumurta ve albumin iceren urunler icin sinyal verir.',
    detail:
      'Yumurta alerjisi olan bireylerde yumurta, albumin ve benzeri turevleri iceren urunlerde dikkat gerekir.',
    watchTerms: ['egg', 'yumurta', 'albumin'],
  },
  {
    key: 'peanut',
    label: 'Yer Fistigi',
    shortDescription: 'Yer fistigi ve turevlerini takip etmek icin kullanilir.',
    detail:
      'Yer fistigi alerjisi ciddi reaksiyonlara yol acabilecegi icin, yer fistigi ve turevlerinde acik uyari gerekir.',
    watchTerms: ['peanut', 'yer fistigi', 'yerfistigi', 'arachis'],
  },
  {
    key: 'treeNuts',
    label: 'Sert Kabuklu Yemişler',
    shortDescription: 'Badem, findik, ceviz ve benzeri yemisleri kapsar.',
    detail:
      'Badem, findik, ceviz, kaju ve benzeri sert kabuklu yemisler aile profilinde ayrica takip edilmelidir.',
    watchTerms: [
      'hazelnut',
      'findik',
      'almond',
      'badem',
      'walnut',
      'ceviz',
      'cashew',
      'pistachio',
      'antep fistigi',
    ],
  },
  {
    key: 'soy',
    label: 'Soya',
    shortDescription: 'Soya ve soya turevleri icin kontrol katmani ekler.',
    detail:
      'Soya hassasiyetinde soya proteini, soya lesitini ve benzeri turevler dikkate alinmalidir.',
    watchTerms: ['soy', 'soya'],
  },
  {
    key: 'sesame',
    label: 'Susam',
    shortDescription: 'Susam ve tahin bazli urunlerde sinyal verir.',
    detail:
      'Susam alerjisi olan bireyler icin susam, tahin ve ilgili turevlerin acik bicimde takip edilmesi gerekir.',
    watchTerms: ['sesame', 'susam', 'tahin'],
  },
  {
    key: 'fish',
    label: 'Balık',
    shortDescription: 'Balık ve balık proteinleri için uyarı üretir.',
    detail:
      'Balık alerjisi olan bireyler için balık, balık proteini ve ilgili türevler ayrı dikkat gerektirir.',
    watchTerms: ['fish', 'balik', 'somon', 'ton baligi', 'anchovy', 'anchov', 'cod'],
  },
  {
    key: 'shellfish',
    label: 'Kabuklu Deniz Ürünleri',
    shortDescription: 'Karides, yengeç ve benzeri kabuklular için sinyal verir.',
    detail:
      'Kabuklu deniz ürünü alerjilerinde karides, yengeç, ıstakoz ve benzeri türler için net uyarı gerekir.',
    watchTerms: ['shrimp', 'karides', 'prawn', 'crab', 'yengec', 'lobster', 'istakoz'],
  },
  {
    key: 'molluscs',
    label: 'Yumuşakçalar',
    shortDescription: 'Midye, kalamar ve benzeri yumuşakçaları izler.',
    detail:
      'Midye, kalamar, ahtapot ve benzeri yumuşakçalar aile profiline ayrı hassas madde olarak eklenebilir.',
    watchTerms: ['mussel', 'midye', 'squid', 'kalamar', 'octopus', 'ahtapot', 'clam'],
  },
  {
    key: 'mustard',
    label: 'Hardal',
    shortDescription: 'Hardal ve hardal tohumu içeren ürünleri izler.',
    detail:
      'Hardal hassasiyeti olan bireylerde hardal tohumu, hardal unu ve sos türevlerinde dikkat gerekir.',
    watchTerms: ['mustard', 'hardal', 'mustard seed'],
  },
  {
    key: 'celery',
    label: 'Kereviz',
    shortDescription: 'Kereviz ve kereviz kökü türevleri için sinyal verir.',
    detail:
      'Kereviz alerjisi olan bireylerde kereviz sapı, kereviz kökü ve kurutulmuş kereviz türevleri de önemlidir.',
    watchTerms: ['celery', 'kereviz', 'celeriac'],
  },
  {
    key: 'lupin',
    label: 'Lupin',
    shortDescription: 'Lupin unu ve lupin türevlerini takip eder.',
    detail:
      'Bazı glutensiz ve özel karışımlarda görülen lupin, ayrı bir hassas madde olarak takip edilmelidir.',
    watchTerms: ['lupin', 'lupine', 'acı bakla'],
  },
  {
    key: 'sulfites',
    label: 'Sülfitler',
    shortDescription: 'Sülfit ve kükürt dioksit sinyallerini izler.',
    detail:
      'Sülfit hassasiyetinde sülfit, sulfur dioxide ve ilgili koruyucu sinyalleri dikkatle izlenmelidir.',
    watchTerms: ['sulfite', 'sulfit', 'sulfites', 'sulfitler', 'sulphite', 'sulfur dioxide'],
  },
];

export const FAMILY_HEALTH_GOAL_DEFINITIONS: FamilyHealthGoalDefinition[] = [
  {
    key: 'lowerSugar',
    label: 'Daha az seker',
    shortDescription: 'Yuksek sekerli gidalarda erken uyari verir.',
    detail:
      'Ailede seker tuketimini azaltmak isteyenler icin yuksek seker yogunluguna sahip urunler ayrica vurgulanir.',
  },
  {
    key: 'lowerSalt',
    label: 'Daha az tuz',
    shortDescription: 'Tuz yogunlugu yuksek urunleri one cikarir.',
    detail:
      'Ozellikle tansiyon ve gunluk tuz tuketimi takibinde, yuksek tuzlu urunler ayri bir dikkat karti alir.',
  },
  {
    key: 'cleanIngredients',
    label: 'Daha temiz icerik',
    shortDescription: 'Katki yogunlugu yuksek urunlerde uyari verir.',
    detail:
      'Daha sade ve temiz icerik arayan aileler icin katkı maddesi yogunlugu yuksek urunler ayri vurgulanir.',
  },
];

const localizeFamilyAllergenDefinition = (
  definition: FamilyAllergenDefinition,
  language?: string
): FamilyAllergenDefinition => {
  const isTurkish = isTurkishAppLanguage(language);

  switch (definition.key) {
    case 'gluten':
      return {
        ...definition,
        label: 'Gluten',
        shortDescription: isTurkish
          ? 'Bugday, arpa ve cavdar iceren urunlerde dikkat ister.'
          : 'Flags products that contain wheat, barley, or rye.',
        detail: isTurkish
          ? 'Gluten hassasiyeti olan bireylerde bugday, arpa, cavdar ve benzeri tahil iceren urunlerde dikkat gerekir.'
          : 'For people with gluten sensitivity, products containing wheat, barley, rye, or similar grains need extra caution.',
      };
    case 'milk':
      return {
        ...definition,
        label: isTurkish ? 'Sut ve Laktoz' : 'Milk & Lactose',
        shortDescription: isTurkish
          ? 'Sut, laktoz ve whey sinyalleri icin kullanilir.'
          : 'Tracks milk, lactose, and whey-related signals.',
        detail: isTurkish
          ? 'Sut veya laktoz hassasiyeti olan bireyler icin laktoz, sut tozu, whey ve benzeri turevlerde dikkat gerekir.'
          : 'For people sensitive to milk or lactose, lactose, milk powder, whey, and related derivatives should be reviewed carefully.',
      };
    case 'egg':
      return {
        ...definition,
        label: isTurkish ? 'Yumurta' : 'Egg',
        shortDescription: isTurkish
          ? 'Yumurta ve albumin iceren urunler icin sinyal verir.'
          : 'Flags products containing egg or albumin.',
        detail: isTurkish
          ? 'Yumurta alerjisi olan bireylerde yumurta, albumin ve benzeri turevleri iceren urunlerde dikkat gerekir.'
          : 'For people with egg allergy, products containing egg, albumin, or similar derivatives require attention.',
      };
    case 'peanut':
      return {
        ...definition,
        label: isTurkish ? 'Yer Fistigi' : 'Peanut',
        shortDescription: isTurkish
          ? 'Yer fistigi ve turevlerini takip etmek icin kullanilir.'
          : 'Tracks peanuts and peanut-derived ingredients.',
        detail: isTurkish
          ? 'Yer fistigi alerjisi ciddi reaksiyonlara yol acabilecegi icin, yer fistigi ve turevlerinde acik uyari gerekir.'
          : 'Because peanut allergy can trigger severe reactions, peanuts and peanut derivatives should be called out clearly.',
      };
    case 'treeNuts':
      return {
        ...definition,
        label: isTurkish ? 'Sert Kabuklu Yemişler' : 'Tree Nuts',
        shortDescription: isTurkish
          ? 'Badem, findik, ceviz ve benzeri yemisleri kapsar.'
          : 'Covers almonds, hazelnuts, walnuts, and similar nuts.',
        detail: isTurkish
          ? 'Badem, findik, ceviz, kaju ve benzeri sert kabuklu yemisler aile profilinde ayrica takip edilmelidir.'
          : 'Almonds, hazelnuts, walnuts, cashews, and similar tree nuts should be tracked as a separate family sensitivity.',
      };
    case 'soy':
      return {
        ...definition,
        label: isTurkish ? 'Soya' : 'Soy',
        shortDescription: isTurkish
          ? 'Soya ve soya turevleri icin kontrol katmani ekler.'
          : 'Adds a check layer for soy and soy derivatives.',
        detail: isTurkish
          ? 'Soya hassasiyetinde soya proteini, soya lesitini ve benzeri turevler dikkate alinmalidir.'
          : 'For soy sensitivity, soy protein, soy lecithin, and related derivatives should be considered.',
      };
    case 'sesame':
      return {
        ...definition,
        label: isTurkish ? 'Susam' : 'Sesame',
        shortDescription: isTurkish
          ? 'Susam ve tahin bazli urunlerde sinyal verir.'
          : 'Flags sesame and tahini-based products.',
        detail: isTurkish
          ? 'Susam alerjisi olan bireyler icin susam, tahin ve ilgili turevlerin acik bicimde takip edilmesi gerekir.'
          : 'For sesame allergy, sesame, tahini, and related derivatives should be monitored explicitly.',
      };
    case 'fish':
      return {
        ...definition,
        label: isTurkish ? 'Balık' : 'Fish',
        shortDescription: isTurkish
          ? 'Balık ve balık proteinleri için uyarı üretir.'
          : 'Flags fish and fish-protein ingredients.',
        detail: isTurkish
          ? 'Balık alerjisi olan bireyler için balık, balık proteini ve ilgili türevler ayrı dikkat gerektirir.'
          : 'For people with fish allergy, fish, fish protein, and related derivatives need separate attention.',
      };
    case 'shellfish':
      return {
        ...definition,
        label: isTurkish ? 'Kabuklu Deniz Ürünleri' : 'Shellfish',
        shortDescription: isTurkish
          ? 'Karides, yengeç ve benzeri kabuklular için sinyal verir.'
          : 'Flags shrimp, crab, and similar shellfish.',
        detail: isTurkish
          ? 'Kabuklu deniz ürünü alerjilerinde karides, yengeç, ıstakoz ve benzeri türler için net uyarı gerekir.'
          : 'For shellfish allergies, shrimp, crab, lobster, and similar species require clear warnings.',
      };
    case 'molluscs':
      return {
        ...definition,
        label: isTurkish ? 'Yumuşakçalar' : 'Molluscs',
        shortDescription: isTurkish
          ? 'Midye, kalamar ve benzeri yumuşakçaları izler.'
          : 'Tracks mussels, squid, and similar molluscs.',
        detail: isTurkish
          ? 'Midye, kalamar, ahtapot ve benzeri yumuşakçalar aile profiline ayrı hassas madde olarak eklenebilir.'
          : 'Mussels, squid, octopus, and similar molluscs can be tracked as a separate family sensitivity.',
      };
    case 'mustard':
      return {
        ...definition,
        label: isTurkish ? 'Hardal' : 'Mustard',
        shortDescription: isTurkish
          ? 'Hardal ve hardal tohumu içeren ürünleri izler.'
          : 'Tracks products containing mustard or mustard seed.',
        detail: isTurkish
          ? 'Hardal hassasiyeti olan bireylerde hardal tohumu, hardal unu ve sos türevlerinde dikkat gerekir.'
          : 'For mustard sensitivity, mustard seed, mustard flour, and sauce derivatives should be reviewed carefully.',
      };
    case 'celery':
      return {
        ...definition,
        label: isTurkish ? 'Kereviz' : 'Celery',
        shortDescription: isTurkish
          ? 'Kereviz ve kereviz kökü türevleri için sinyal verir.'
          : 'Flags celery and celeriac-derived ingredients.',
        detail: isTurkish
          ? 'Kereviz alerjisi olan bireylerde kereviz sapı, kereviz kökü ve kurutulmuş kereviz türevleri de önemlidir.'
          : 'For celery allergy, celery stalk, celeriac, and dried celery derivatives are also important.',
      };
    case 'lupin':
      return {
        ...definition,
        label: isTurkish ? 'Lupin' : 'Lupin',
        shortDescription: isTurkish
          ? 'Lupin unu ve lupin türevlerini takip eder.'
          : 'Tracks lupin flour and lupin derivatives.',
        detail: isTurkish
          ? 'Bazı glutensiz ve özel karışımlarda görülen lupin, ayrı bir hassas madde olarak takip edilmelidir.'
          : 'Lupin, often found in some gluten-free and specialty mixes, should be tracked as a separate sensitivity.',
      };
    case 'sulfites':
      return {
        ...definition,
        label: isTurkish ? 'Sülfitler' : 'Sulfites',
        shortDescription: isTurkish
          ? 'Sülfit ve kükürt dioksit sinyallerini izler.'
          : 'Tracks sulfite and sulfur dioxide signals.',
        detail: isTurkish
          ? 'Sülfit hassasiyetinde sülfit, sulfur dioxide ve ilgili koruyucu sinyalleri dikkatle izlenmelidir.'
          : 'For sulfite sensitivity, sulfites, sulfur dioxide, and related preservative signals should be reviewed carefully.',
      };
    default:
      return definition;
  }
};

const localizeFamilyHealthGoalDefinition = (
  definition: FamilyHealthGoalDefinition,
  language?: string
): FamilyHealthGoalDefinition => {
  const isTurkish = isTurkishAppLanguage(language);

  switch (definition.key) {
    case 'lowerSugar':
      return {
        ...definition,
        label: isTurkish ? 'Daha az seker' : 'Lower sugar',
        shortDescription: isTurkish
          ? 'Yuksek sekerli gidalarda erken uyari verir.'
          : 'Highlights high-sugar products earlier.',
        detail: isTurkish
          ? 'Ailede seker tuketimini azaltmak isteyenler icin yuksek seker yogunluguna sahip urunler ayrica vurgulanir.'
          : 'Products with higher sugar density are highlighted for families that want to reduce sugar intake.',
      };
    case 'lowerSalt':
      return {
        ...definition,
        label: isTurkish ? 'Daha az tuz' : 'Lower salt',
        shortDescription: isTurkish
          ? 'Tuz yogunlugu yuksek urunleri one cikarir.'
          : 'Highlights products with higher salt density.',
        detail: isTurkish
          ? 'Ozellikle tansiyon ve gunluk tuz tuketimi takibinde, yuksek tuzlu urunler ayri bir dikkat karti alir.'
          : 'Especially for blood pressure and daily salt tracking, high-salt products get an extra caution state.',
      };
    case 'cleanIngredients':
      return {
        ...definition,
        label: isTurkish ? 'Daha temiz icerik' : 'Cleaner ingredients',
        shortDescription: isTurkish
          ? 'Katki yogunlugu yuksek urunlerde uyari verir.'
          : 'Flags products with denser additive signals.',
        detail: isTurkish
          ? 'Daha sade ve temiz icerik arayan aileler icin katkı maddesi yogunlugu yuksek urunler ayri vurgulanir.'
          : 'Products with denser additive signals are highlighted for families seeking simpler ingredient lists.',
      };
    default:
      return definition;
  }
};

export const getFamilyAllergenDefinitions = (
  language?: string
): FamilyAllergenDefinition[] =>
  FAMILY_ALLERGEN_DEFINITIONS.map((item) =>
    localizeFamilyAllergenDefinition(item, language)
  );

export const getFamilyHealthGoalDefinitions = (
  language?: string
): FamilyHealthGoalDefinition[] =>
  FAMILY_HEALTH_GOAL_DEFINITIONS.map((item) =>
    localizeFamilyHealthGoalDefinition(item, language)
  );

const HIGH_RISK_HOME_CODES = [
  'E951',
  'E250',
  'E211',
  'E129',
  'E102',
  'E621',
  'E950',
  'E300',
  'E322',
  'E440',
] as const;

const normalizeValue = (value?: string | null): string =>
  String(value || '')
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .trim();

const getNumericNutriment = (
  nutriments: Record<string, unknown> | undefined,
  key: string
): number | null => {
  const value = nutriments?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

export const getFamilyAllergenDefinition = (
  key: FamilyAllergenKey,
  language?: string
): FamilyAllergenDefinition | undefined => {
  return getFamilyAllergenDefinitions(language).find((item) => item.key === key);
};

export const getFamilyHealthGoalDefinition = (
  key: FamilyHealthGoalKey,
  language?: string
): FamilyHealthGoalDefinition | undefined => {
  return getFamilyHealthGoalDefinitions(language).find((item) => item.key === key);
};

export const getHomeAdditiveSpotlights = (): ECodeInfo[] => {
  return HIGH_RISK_HOME_CODES.map((code) => E_CODES_DATA[code]).filter(
    (item): item is ECodeInfo => Boolean(item)
  );
};

export const normalizeWatchedAdditiveCode = (value?: string | null): string => {
  return String(value || '')
    .toUpperCase()
    .replace(/[- ]/g, '')
    .trim();
};

export const normalizeFamilyHealthProfile = (
  input: unknown
): FamilyHealthProfile | undefined => {
  if (!input || typeof input !== 'object') {
    return undefined;
  }

  const record = input as Record<string, unknown>;
  const allergens = Array.isArray(record.allergens)
    ? Array.from(
        new Set(
          record.allergens.filter((item): item is FamilyAllergenKey =>
            FAMILY_ALLERGEN_KEYS.includes(item as FamilyAllergenKey)
          )
        )
      )
    : [];
  const watchedAdditives = Array.isArray(record.watchedAdditives)
    ? Array.from(
        new Set(
          record.watchedAdditives
            .map((item) => normalizeWatchedAdditiveCode(String(item || '')))
            .filter(Boolean)
        )
      )
    : [];
  const healthGoals = Array.isArray(record.healthGoals)
    ? Array.from(
        new Set(
          record.healthGoals.filter((item): item is FamilyHealthGoalKey =>
            FAMILY_HEALTH_GOAL_KEYS.includes(item as FamilyHealthGoalKey)
          )
        )
      )
    : [];

  if (!allergens.length && !watchedAdditives.length && !healthGoals.length) {
    return undefined;
  }

  return {
    allergens,
    watchedAdditives,
    healthGoals,
  };
};

export const matchesProductAllergen = (
  product: Product,
  allergenKey: FamilyAllergenKey
): boolean => {
  const definition = getFamilyAllergenDefinition(allergenKey);

  if (!definition) {
    return false;
  }

  const watchTerms = definition.watchTerms.map(normalizeValue);
  const haystack = [
    ...(product.allergens_tags || []),
    ...(product.traces_tags || []),
    product.ingredients_text || '',
  ]
    .map(normalizeValue)
    .join(' ');

  return watchTerms.some((term) => haystack.includes(term));
};

export const buildFamilyHealthAlerts = (params: {
  product: Product;
  analysis: AnalysisResult;
  profile: FamilyHealthProfile;
  tt: (key: string, fallback: string) => string;
}): FamilyHealthAlertSummary[] => {
  const { product, analysis, profile, tt } = params;
  const alerts: FamilyHealthAlertSummary[] = [];
  const isTurkish = isTurkishAppLanguage();

  if (product.type === 'medicine') {
    alerts.push({
      id: 'medicine-official',
      title: tt('medicine_alert_title', 'Official medicine record'),
      description: tt(
        'medicine_alert_desc',
        'This information was resolved from official medicine records. The leaflet and guidance from healthcare professionals should be considered before use.'
      ),
      severity: 'info',
    });
    return alerts;
  }

  if (analysis.riskLevel === 'Yüksek') {
    alerts.push({
      id: 'high-risk-general',
      title: tt('family_high_risk_title', 'Caution for sensitive use'),
      description: tt(
        'family_high_risk_desc',
        'The overall analysis of this product appears high risk. The ingredients should be reviewed carefully before regular use or consumption.'
      ),
      severity: 'danger',
    });
  }

  const matchingAllergens = profile.allergens
    .map((key) => getFamilyAllergenDefinition(key))
    .filter((item): item is FamilyAllergenDefinition => Boolean(item))
    .filter((item) => matchesProductAllergen(product, item.key));

  matchingAllergens.forEach((allergen) => {
    alerts.push({
      id: `allergen-${allergen.key}`,
      title: isTurkish
        ? `${allergen.label} hassasiyeti icin uyari`
        : `${allergen.label} sensitivity alert`,
      description: isTurkish
        ? `${allergen.label} profilde izleniyor. Bu urunde ilgili sinyal bulundu, ambalaj ve icerik tekrar kontrol edilmelidir.`
        : `${allergen.label} is being tracked in the family profile. A related signal was detected in this product, so the pack and ingredients should be reviewed again.`,
      severity: 'danger',
    });
  });

  const watchedAdditives = new Set(
    profile.watchedAdditives.map((item) => normalizeWatchedAdditiveCode(item))
  );
  const matchedWatchedAdditives = analysis.foundECodes.filter((item) =>
    watchedAdditives.has(normalizeWatchedAdditiveCode(item.code))
  );

  if (matchedWatchedAdditives.length > 0) {
    alerts.push({
      id: 'watched-additives',
      title: tt('family_watched_additives_title', 'Tracked additive detected'),
      description: matchedWatchedAdditives
        .map((item) => `${item.code} ${item.name}`)
        .join(', '),
      severity: 'warning',
    });
  }

  if (product.type === 'food') {
    if (profile.healthGoals.includes('lowerSugar')) {
      const sugar = getNumericNutriment(product.nutriments, 'sugars_100g');
      if (typeof sugar === 'number' && sugar >= 10) {
        alerts.push({
          id: 'goal-sugar',
          title: tt('family_goal_sugar_title', 'Sugar goal caution'),
          description: tt(
            'family_goal_sugar_desc',
            'This product appears high in sugar per 100 g / ml.'
          ),
          severity: 'warning',
        });
      }
    }

    if (profile.healthGoals.includes('lowerSalt')) {
      const salt = getNumericNutriment(product.nutriments, 'salt_100g');
      if (typeof salt === 'number' && salt >= 1.2) {
        alerts.push({
          id: 'goal-salt',
          title: tt('family_goal_salt_title', 'Salt goal caution'),
          description: tt(
            'family_goal_salt_desc',
            'This product appears high in salt density.'
          ),
          severity: 'warning',
        });
      }
    }
  }

  if (
    profile.healthGoals.includes('cleanIngredients') &&
    analysis.foundECodes.length > 0
  ) {
    alerts.push({
      id: 'goal-clean-ingredients',
      title: tt('family_goal_clean_title', 'Cleaner ingredients focus'),
      description: tt(
        'family_goal_clean_desc',
        'Tracked additive signals were found in this product. Simpler ingredient alternatives may be worth considering.'
      ),
      severity: 'info',
    });
  }

  return alerts;
};

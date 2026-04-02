import type { AnalysisResult, Product } from '../utils/analysis';
import { E_CODES_DATA, type ECodeInfo } from './eCodesData';

export type FamilyAllergenKey =
  | 'gluten'
  | 'milk'
  | 'egg'
  | 'peanut'
  | 'treeNuts'
  | 'soy'
  | 'sesame';

export type FamilyHealthGoalKey =
  | 'lowerSugar'
  | 'lowerSalt'
  | 'cleanIngredients';

export type FamilyHealthProfile = {
  allergens: FamilyAllergenKey[];
  watchedAdditives: string[];
  healthGoals: FamilyHealthGoalKey[];
};

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

const HIGH_RISK_HOME_CODES = ['E951', 'E250', 'E211', 'E129', 'E102'] as const;

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
  key: FamilyAllergenKey
): FamilyAllergenDefinition | undefined => {
  return FAMILY_ALLERGEN_DEFINITIONS.find((item) => item.key === key);
};

export const getFamilyHealthGoalDefinition = (
  key: FamilyHealthGoalKey
): FamilyHealthGoalDefinition | undefined => {
  return FAMILY_HEALTH_GOAL_DEFINITIONS.find((item) => item.key === key);
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

  if (product.type === 'medicine') {
    alerts.push({
      id: 'medicine-official',
      title: tt('medicine_alert_title', 'Resmi ilaç kaydı'),
      description: tt(
        'medicine_alert_desc',
        'Bu bilgi resmi ilaç kaydından çözümlendi. Kullanım öncesi prospektüs ve sağlık profesyoneli yönlendirmesi dikkate alınmalıdır.'
      ),
      severity: 'info',
    });
    return alerts;
  }

  if (analysis.riskLevel === 'Yüksek') {
    alerts.push({
      id: 'high-risk-general',
      title: tt('family_high_risk_title', 'Hassas kullanım için dikkat'),
      description: tt(
        'family_high_risk_desc',
        'Bu ürünün genel analiz sonucu yüksek risk seviyesinde görünüyor. Düzenli tüketim veya kullanım öncesi içerik dikkatle incelenmelidir.'
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
      title: `${allergen.label} hassasiyeti icin uyari`,
      description: `${allergen.label} profilde izleniyor. Bu urunde ilgili sinyal bulundu, ambalaj ve icerik tekrar kontrol edilmelidir.`,
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
      title: tt('family_watched_additives_title', 'Izlenen katki maddesi bulundu'),
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
          title: tt('family_goal_sugar_title', 'Seker odagi icin dikkat'),
          description: tt(
            'family_goal_sugar_desc',
            'Bu urunun 100 g / ml basina seker degeri yuksek gorunuyor.'
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
          title: tt('family_goal_salt_title', 'Tuz odagi icin dikkat'),
          description: tt(
            'family_goal_salt_desc',
            'Bu urunun tuz yogunlugu yuksek gorunuyor.'
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
      title: tt('family_goal_clean_title', 'Daha temiz icerik odagi'),
      description: tt(
        'family_goal_clean_desc',
        'Bu urunde izlenen katki sinyalleri bulundu. Daha sade icerikli alternatifler dusunulebilir.'
      ),
      severity: 'info',
    });
  }

  return alerts;
};

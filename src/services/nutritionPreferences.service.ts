import type { Product } from '../utils/analysis';

export type NutritionPreferenceKey =
  | 'glutenFree'
  | 'lactoseFree'
  | 'palmOilFree'
  | 'vegetarian'
  | 'vegan';

export type NutritionPreferences = Record<NutritionPreferenceKey, boolean>;

export type NutritionPreferenceStatus = 'compatible' | 'warning' | 'unknown';
export type NutritionPreferenceEvidence =
  | 'label'
  | 'analysis'
  | 'allergen'
  | 'trace'
  | 'ingredient'
  | 'none';

export type NutritionPreferenceEvaluation = {
  key: NutritionPreferenceKey;
  status: NutritionPreferenceStatus;
  evidence: NutritionPreferenceEvidence;
  matchedValue?: string;
};

export const NUTRITION_PREFERENCE_KEYS: NutritionPreferenceKey[] = [
  'glutenFree',
  'lactoseFree',
  'palmOilFree',
  'vegetarian',
  'vegan',
];

export const DEFAULT_NUTRITION_PREFERENCES: NutritionPreferences = {
  glutenFree: false,
  lactoseFree: false,
  palmOilFree: false,
  vegetarian: false,
  vegan: false,
};

const normalizeTag = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const normalizeText = (value?: string | null): string =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const findTagMatch = (tags: string[] | undefined, fragments: string[]): string | undefined => {
  if (!Array.isArray(tags) || !tags.length) {
    return undefined;
  }

  const normalizedTags = tags.map((tag) => normalizeTag(tag));

  return normalizedTags.find((tag) =>
    fragments.some((fragment) => tag.includes(normalizeTag(fragment)))
  );
};

const findIngredientMatch = (
  ingredientsText: string | undefined,
  patterns: RegExp[]
): string | undefined => {
  const normalizedIngredients = normalizeText(ingredientsText);

  if (!normalizedIngredients) {
    return undefined;
  }

  for (const pattern of patterns) {
    const match = normalizedIngredients.match(pattern);

    if (match?.[0]) {
      return match[0].trim();
    }
  }

  return undefined;
};

const evaluateGlutenFree = (product: Product): NutritionPreferenceEvaluation => {
  const labelMatch = findTagMatch(product.labels_tags, [
    'gluten-free',
    'no-gluten',
    'sans-gluten',
  ]);

  if (labelMatch) {
    return {
      key: 'glutenFree',
      status: 'compatible',
      evidence: 'label',
      matchedValue: labelMatch,
    };
  }

  const allergenMatch =
    findTagMatch(product.allergens_tags, ['gluten', 'wheat', 'barley', 'rye', 'spelt']) ??
    findTagMatch(product.traces_tags, ['gluten', 'wheat', 'barley', 'rye', 'spelt']);

  if (allergenMatch) {
    return {
      key: 'glutenFree',
      status: 'warning',
      evidence: findTagMatch(product.allergens_tags, [allergenMatch]) ? 'allergen' : 'trace',
      matchedValue: allergenMatch,
    };
  }

  const ingredientMatch = findIngredientMatch(product.ingredients_text, [
    /\bgluten\b/u,
    /\bbugday\b/u,
    /\bwheat\b/u,
    /\barpa\b/u,
    /\bbarley\b/u,
    /\bcavdar\b/u,
    /\brye\b/u,
  ]);

  if (ingredientMatch) {
    return {
      key: 'glutenFree',
      status: 'warning',
      evidence: 'ingredient',
      matchedValue: ingredientMatch,
    };
  }

  return { key: 'glutenFree', status: 'unknown', evidence: 'none' };
};

const evaluateLactoseFree = (product: Product): NutritionPreferenceEvaluation => {
  const labelMatch = findTagMatch(product.labels_tags, [
    'lactose-free',
    'no-lactose',
    'sans-lactose',
  ]);

  if (labelMatch) {
    return {
      key: 'lactoseFree',
      status: 'compatible',
      evidence: 'label',
      matchedValue: labelMatch,
    };
  }

  const allergenMatch =
    findTagMatch(product.allergens_tags, ['milk']) ??
    findTagMatch(product.traces_tags, ['milk']);

  if (allergenMatch) {
    return {
      key: 'lactoseFree',
      status: 'warning',
      evidence: findTagMatch(product.allergens_tags, [allergenMatch]) ? 'allergen' : 'trace',
      matchedValue: allergenMatch,
    };
  }

  const ingredientMatch = findIngredientMatch(product.ingredients_text, [
    /\blacktoz\b/u,
    /\blactose\b/u,
    /\bmilk\b/u,
    /\bmilk powder\b/u,
    /\bwhey\b/u,
    /\bpeynir alti suyu\b/u,
    /\bkrem[aıi]?\b/u,
    /\bcream\b/u,
    /\bsut\b/u,
  ]);

  if (ingredientMatch) {
    return {
      key: 'lactoseFree',
      status: 'warning',
      evidence: 'ingredient',
      matchedValue: ingredientMatch,
    };
  }

  return { key: 'lactoseFree', status: 'unknown', evidence: 'none' };
};

const evaluatePalmOilFree = (product: Product): NutritionPreferenceEvaluation => {
  const labelMatch = findTagMatch(product.labels_tags, [
    'no-palm-oil',
    'palm-oil-free',
    'sans-huile-de-palme',
  ]);

  if (labelMatch) {
    return {
      key: 'palmOilFree',
      status: 'compatible',
      evidence: 'label',
      matchedValue: labelMatch,
    };
  }

  const ingredientMatch = findIngredientMatch(product.ingredients_text, [
    /\bpalm oil\b/u,
    /\bpalm fat\b/u,
    /\bpalm kernel\b/u,
    /\bpalmolein\b/u,
    /\bhurma yagi\b/u,
    /\bpalmiye yagi\b/u,
    /\bpalmist\b/u,
  ]);

  if (ingredientMatch) {
    return {
      key: 'palmOilFree',
      status: 'warning',
      evidence: 'ingredient',
      matchedValue: ingredientMatch,
    };
  }

  return { key: 'palmOilFree', status: 'unknown', evidence: 'none' };
};

const evaluateVegetarian = (product: Product): NutritionPreferenceEvaluation => {
  const analysisCompatible = findTagMatch(product.ingredients_analysis_tags, [
    'vegetarian',
  ]);
  const analysisIncompatible = findTagMatch(product.ingredients_analysis_tags, [
    'non-vegetarian',
  ]);

  if (analysisIncompatible) {
    return {
      key: 'vegetarian',
      status: 'warning',
      evidence: 'analysis',
      matchedValue: analysisIncompatible,
    };
  }

  if (analysisCompatible || findTagMatch(product.labels_tags, ['vegetarian'])) {
    return {
      key: 'vegetarian',
      status: 'compatible',
      evidence: analysisCompatible ? 'analysis' : 'label',
      matchedValue: analysisCompatible ?? findTagMatch(product.labels_tags, ['vegetarian']),
    };
  }

  const ingredientMatch = findIngredientMatch(product.ingredients_text, [
    /\bgelatin\b/u,
    /\bjelatin\b/u,
    /\bfish\b/u,
    /\banchovy\b/u,
    /\btuna\b/u,
    /\bton baligi\b/u,
    /\bchicken\b/u,
    /\btavuk\b/u,
    /\bbeef\b/u,
    /\bdana\b/u,
    /\bpork\b/u,
    /\bdomuz\b/u,
    /\bcollagen\b/u,
    /\bkolajen\b/u,
  ]);

  if (ingredientMatch) {
    return {
      key: 'vegetarian',
      status: 'warning',
      evidence: 'ingredient',
      matchedValue: ingredientMatch,
    };
  }

  return { key: 'vegetarian', status: 'unknown', evidence: 'none' };
};

const evaluateVegan = (product: Product): NutritionPreferenceEvaluation => {
  const analysisCompatible = findTagMatch(product.ingredients_analysis_tags, ['vegan']);
  const analysisIncompatible = findTagMatch(product.ingredients_analysis_tags, ['non-vegan']);

  if (analysisIncompatible) {
    return {
      key: 'vegan',
      status: 'warning',
      evidence: 'analysis',
      matchedValue: analysisIncompatible,
    };
  }

  if (analysisCompatible || findTagMatch(product.labels_tags, ['vegan'])) {
    return {
      key: 'vegan',
      status: 'compatible',
      evidence: analysisCompatible ? 'analysis' : 'label',
      matchedValue: analysisCompatible ?? findTagMatch(product.labels_tags, ['vegan']),
    };
  }

  const ingredientMatch = findIngredientMatch(product.ingredients_text, [
    /\bmilk\b/u,
    /\bsut\b/u,
    /\bcream\b/u,
    /\bkrem[aıi]?\b/u,
    /\bwhey\b/u,
    /\blacktoz\b/u,
    /\blactose\b/u,
    /\bhoney\b/u,
    /\bball?\b/u,
    /\begg\b/u,
    /\byumurta\b/u,
    /\bgelatin\b/u,
    /\bjelatin\b/u,
    /\bcollagen\b/u,
    /\bkolajen\b/u,
    /\bbeeswax\b/u,
    /\bshellac\b/u,
    /\bcasein\b/u,
  ]);

  if (ingredientMatch) {
    return {
      key: 'vegan',
      status: 'warning',
      evidence: 'ingredient',
      matchedValue: ingredientMatch,
    };
  }

  return { key: 'vegan', status: 'unknown', evidence: 'none' };
};

export const getActiveNutritionPreferenceKeys = (
  preferences: NutritionPreferences
): NutritionPreferenceKey[] =>
  NUTRITION_PREFERENCE_KEYS.filter((key) => preferences[key]);

export const hasActiveNutritionPreferences = (preferences: NutritionPreferences): boolean =>
  getActiveNutritionPreferenceKeys(preferences).length > 0;

export const evaluateNutritionPreference = (
  product: Product,
  key: NutritionPreferenceKey
): NutritionPreferenceEvaluation => {
  switch (key) {
    case 'glutenFree':
      return evaluateGlutenFree(product);
    case 'lactoseFree':
      return evaluateLactoseFree(product);
    case 'palmOilFree':
      return evaluatePalmOilFree(product);
    case 'vegetarian':
      return evaluateVegetarian(product);
    case 'vegan':
      return evaluateVegan(product);
    default:
      return { key, status: 'unknown', evidence: 'none' };
  }
};

export const evaluateNutritionPreferences = (
  product: Product,
  preferences: NutritionPreferences
): NutritionPreferenceEvaluation[] => {
  if (product.type !== 'food') {
    return [];
  }

  return getActiveNutritionPreferenceKeys(preferences).map((key) =>
    evaluateNutritionPreference(product, key)
  );
};

export const isProductCompatibleWithNutritionPreferences = (
  product: Product,
  preferences: NutritionPreferences
): boolean => {
  const evaluations = evaluateNutritionPreferences(product, preferences);
  return evaluations.every((item) => item.status !== 'warning');
};

export const isProductStrictlyCompatibleWithNutritionPreferences = (
  product: Product,
  preferences: NutritionPreferences
): boolean => {
  const evaluations = evaluateNutritionPreferences(product, preferences);
  return evaluations.length > 0 && evaluations.every((item) => item.status === 'compatible');
};

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MarketSearchProduct } from '../types/marketPricing';

const PRICE_COMPARE_FAVORITES_STORAGE_KEY = 'price_compare_favorites_v1';
const MAX_PRICE_COMPARE_FAVORITES = 80;

export type PriceCompareFavoriteRecord = {
  key: string;
  barcode: string | null;
  productId: string | null;
  product: MarketSearchProduct;
  updatedAt: string;
};

type PriceCompareFavoriteState = {
  order: string[];
  items: Record<string, PriceCompareFavoriteRecord>;
};

const createEmptyState = (): PriceCompareFavoriteState => ({
  order: [],
  items: {},
});

const normalizeIdentityPart = (value?: string | null): string | null => {
  const normalized = String(value || '').trim();
  return normalized.length ? normalized : null;
};

const getBarcodeKey = (barcode?: string | null): string | null => {
  const normalized = normalizeIdentityPart(barcode);
  return normalized ? `barcode:${normalized}` : null;
};

const getProductIdKey = (productId?: string | null): string | null => {
  const normalized = normalizeIdentityPart(productId);
  return normalized ? `product:${normalized}` : null;
};

const clampState = (state: PriceCompareFavoriteState): PriceCompareFavoriteState => {
  const nextOrder = state.order.slice(0, MAX_PRICE_COMPARE_FAVORITES);
  const nextItems = nextOrder.reduce<Record<string, PriceCompareFavoriteRecord>>((acc, key) => {
    const record = state.items[key];

    if (record) {
      acc[key] = record;
    }

    return acc;
  }, {});

  return {
    order: nextOrder,
    items: nextItems,
  };
};

const readState = async (): Promise<PriceCompareFavoriteState> => {
  try {
    const raw = await AsyncStorage.getItem(PRICE_COMPARE_FAVORITES_STORAGE_KEY);

    if (!raw) {
      return createEmptyState();
    }

    const parsed = JSON.parse(raw) as Partial<PriceCompareFavoriteState> | null;
    const order = Array.isArray(parsed?.order)
      ? parsed!.order.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : [];
    const items =
      parsed && typeof parsed.items === 'object' && parsed.items
        ? (parsed.items as Record<string, PriceCompareFavoriteRecord>)
        : {};

    return clampState({
      order,
      items,
    });
  } catch (error) {
    console.warn('[priceCompareFavorites] read failed:', error);
    return createEmptyState();
  }
};

const writeState = async (state: PriceCompareFavoriteState): Promise<PriceCompareFavoriteState> => {
  const nextState = clampState(state);

  try {
    await AsyncStorage.setItem(
      PRICE_COMPARE_FAVORITES_STORAGE_KEY,
      JSON.stringify(nextState)
    );
  } catch (error) {
    console.warn('[priceCompareFavorites] write failed:', error);
  }

  return nextState;
};

const buildPrimaryKey = (product: Pick<MarketSearchProduct, 'barcode' | 'productId'>): string | null =>
  getBarcodeKey(product.barcode) ?? getProductIdKey(product.productId);

const collectMatchingKeys = (
  state: PriceCompareFavoriteState,
  product: Pick<MarketSearchProduct, 'barcode' | 'productId'>
): string[] => {
  const normalizedBarcode = normalizeIdentityPart(product.barcode);
  const normalizedProductId = normalizeIdentityPart(product.productId);

  return state.order.filter((key) => {
    const record = state.items[key];

    if (!record) {
      return false;
    }

    return (
      (normalizedBarcode && record.barcode === normalizedBarcode) ||
      (normalizedProductId && record.productId === normalizedProductId)
    );
  });
};

const upsertStateRecord = (
  state: PriceCompareFavoriteState,
  product: MarketSearchProduct,
  options?: {
    prepend?: boolean;
    ifExistsOnly?: boolean;
  }
): PriceCompareFavoriteState => {
  const primaryKey = buildPrimaryKey(product);

  if (!primaryKey) {
    return state;
  }

  const matchingKeys = collectMatchingKeys(state, product);
  const existingRecord = matchingKeys
    .map((key) => state.items[key])
    .find((record): record is PriceCompareFavoriteRecord => Boolean(record));

  if (options?.ifExistsOnly && !existingRecord) {
    return state;
  }

  const nextItems = { ...state.items };
  let nextOrder = state.order.filter((key) => !matchingKeys.includes(key) || key === primaryKey);

  matchingKeys.forEach((key) => {
    if (key !== primaryKey) {
      delete nextItems[key];
    }
  });

  const nextRecord: PriceCompareFavoriteRecord = {
    key: primaryKey,
    barcode: normalizeIdentityPart(product.barcode),
    productId: normalizeIdentityPart(product.productId),
    product,
    updatedAt: new Date().toISOString(),
  };

  nextItems[primaryKey] = nextRecord;

  if (!nextOrder.includes(primaryKey)) {
    nextOrder = options?.prepend === false ? [...nextOrder, primaryKey] : [primaryKey, ...nextOrder];
  } else if (options?.prepend !== false) {
    nextOrder = [primaryKey, ...nextOrder.filter((key) => key !== primaryKey)];
  }

  return {
    order: nextOrder,
    items: nextItems,
  };
};

export const getPriceCompareFavoriteKey = (
  product: Pick<MarketSearchProduct, 'barcode' | 'productId'>
): string | null => buildPrimaryKey(product);

export const listPriceCompareFavorites = async (
  limit = 40
): Promise<PriceCompareFavoriteRecord[]> => {
  const state = await readState();

  return state.order
    .slice(0, Math.max(1, Math.min(Math.round(limit), MAX_PRICE_COMPARE_FAVORITES)))
    .map((key) => state.items[key])
    .filter((record): record is PriceCompareFavoriteRecord => Boolean(record));
};

export const mergePriceCompareFavorites = async (
  products: MarketSearchProduct[],
  options?: {
    prependNew?: boolean;
    updateExistingOnly?: boolean;
  }
): Promise<PriceCompareFavoriteRecord[]> => {
  let nextState = await readState();

  products.forEach((product) => {
    nextState = upsertStateRecord(nextState, product, {
      prepend: options?.prependNew ?? true,
      ifExistsOnly: options?.updateExistingOnly ?? false,
    });
  });

  const savedState = await writeState(nextState);
  return savedState.order.map((key) => savedState.items[key]).filter(Boolean);
};

export const togglePriceCompareFavorite = async (
  product: MarketSearchProduct
): Promise<boolean> => {
  const primaryKey = buildPrimaryKey(product);

  if (!primaryKey) {
    return false;
  }

  const state = await readState();
  const matchingKeys = collectMatchingKeys(state, product);
  const currentlyFavorite = matchingKeys.length > 0;

  if (currentlyFavorite) {
    const nextOrder = state.order.filter((key) => !matchingKeys.includes(key));
    const nextItems = { ...state.items };

    matchingKeys.forEach((key) => {
      delete nextItems[key];
    });

    await writeState({
      order: nextOrder,
      items: nextItems,
    });

    return false;
  }

  await writeState(upsertStateRecord(state, product, { prepend: true }));
  return true;
};

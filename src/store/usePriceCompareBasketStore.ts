import { create } from 'zustand';

import type { SavedPriceCompareCartEntry } from '../services/priceCompareShoppingList.service';
import type {
  MarketProductOffersResponse,
  MarketSearchProduct,
} from '../types/marketPricing';

export type PriceCompareCartEntry = SavedPriceCompareCartEntry;

type PriceCompareBasketState = {
  entries: PriceCompareCartEntry[];
  shoppingListName: string;
  activeSavedListId: string | null;
  setShoppingListName: (value: string) => void;
  setActiveSavedListId: (value: string | null) => void;
  addOrIncrementEntry: (
    product: MarketSearchProduct,
    offersResponse: MarketProductOffersResponse
  ) => void;
  removeEntry: (productId: string) => void;
  clearEntries: () => void;
  increaseQuantity: (productId: string) => void;
  decreaseQuantity: (productId: string) => void;
  replaceEntries: (entries: PriceCompareCartEntry[]) => void;
};

const getProductIdentity = (item: MarketSearchProduct): string =>
  item.productId || item.id || item.barcode || `${item.productName}-${item.brand || ''}`;

export const usePriceCompareBasketStore = create<PriceCompareBasketState>((set) => ({
  entries: [],
  shoppingListName: '',
  activeSavedListId: null,

  setShoppingListName: (value) =>
    set({
      shoppingListName: value,
    }),

  setActiveSavedListId: (value) =>
    set({
      activeSavedListId: value,
    }),

  addOrIncrementEntry: (product, offersResponse) =>
    set((state) => {
      const identity = getProductIdentity(product);
      const existingIndex = state.entries.findIndex(
        (item) => getProductIdentity(item.product) === identity
      );

      if (existingIndex === -1) {
        return {
          entries: [
            ...state.entries,
            {
              product,
              offersResponse,
              quantity: 1,
            },
          ],
        };
      }

      return {
        entries: state.entries.map((item, index) =>
          index === existingIndex
            ? {
                ...item,
                offersResponse,
                quantity: item.quantity + 1,
              }
            : item
        ),
      };
    }),

  removeEntry: (productId) =>
    set((state) => ({
      entries: state.entries.filter(
        (item) => getProductIdentity(item.product) !== productId
      ),
    })),

  clearEntries: () =>
    set({
      entries: [],
      activeSavedListId: null,
    }),

  increaseQuantity: (productId) =>
    set((state) => ({
      entries: state.entries.map((item) =>
        getProductIdentity(item.product) === productId
          ? {
              ...item,
              quantity: item.quantity + 1,
            }
          : item
      ),
    })),

  decreaseQuantity: (productId) =>
    set((state) => ({
      entries: state.entries.flatMap((item) => {
        if (getProductIdentity(item.product) !== productId) {
          return [item];
        }

        if (item.quantity <= 1) {
          return [];
        }

        return [
          {
            ...item,
            quantity: item.quantity - 1,
          },
        ];
      }),
    })),

  replaceEntries: (entries) =>
    set({
      entries: entries.map((entry) => ({
        product: entry.product,
        offersResponse: entry.offersResponse,
        quantity: Math.max(1, entry.quantity),
      })),
    }),
}));

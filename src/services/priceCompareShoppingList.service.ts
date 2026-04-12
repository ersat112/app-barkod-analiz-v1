import i18n from 'i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';

import { db } from '../config/firebase';
import type {
  MarketProductOffersResponse,
  MarketSearchProduct,
} from '../types/marketPricing';

const PRICE_COMPARE_SAVED_LISTS_STORAGE_KEY = '@price_compare_saved_lists_v1';
const MAX_SAVED_LISTS = 8;
const USERS_COLLECTION = 'users';
const SHOPPING_LISTS_SUBCOLLECTION = 'shopping_lists';

export const getDefaultPriceCompareListName = (): string => {
  const value = i18n.t('price_compare_default_list_name', {
    defaultValue: 'Shopping List',
  });
  return value === 'price_compare_default_list_name' ? 'Shopping List' : value;
};

export type SavedPriceCompareCartEntry = {
  product: MarketSearchProduct;
  offersResponse: MarketProductOffersResponse;
  quantity: number;
};

export type SavedPriceCompareList = {
  id: string;
  name: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  isPinned?: boolean;
  entries: SavedPriceCompareCartEntry[];
};

type SavedPriceCompareListPersistenceOptions = {
  userId?: string | null;
};

const sortSavedLists = (lists: SavedPriceCompareList[]): SavedPriceCompareList[] =>
  [...lists].sort((left, right) => {
    if (Boolean(left.isPinned) !== Boolean(right.isPinned)) {
      return left.isPinned ? -1 : 1;
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });

const normalizeEntryQuantity = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }

  return Math.max(1, Math.round(parsed));
};

const normalizeSavedList = (value: unknown): SavedPriceCompareList | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const rawEntries = Array.isArray(payload.entries) ? payload.entries : [];
  const entries = rawEntries
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return null;
      }

      const candidate = entry as Record<string, unknown>;
      const product = candidate.product as MarketSearchProduct | undefined;
      const offersResponse = candidate.offersResponse as MarketProductOffersResponse | undefined;

      if (!product || !offersResponse) {
        return null;
      }

      return {
        product,
        offersResponse,
        quantity: normalizeEntryQuantity(candidate.quantity),
      } satisfies SavedPriceCompareCartEntry;
    })
    .filter(Boolean) as SavedPriceCompareCartEntry[];

  if (!entries.length) {
    return null;
  }

  const id = typeof payload.id === 'string' && payload.id.trim() ? payload.id.trim() : null;

  if (!id) {
    return null;
  }

  const name =
    typeof payload.name === 'string' && payload.name.trim()
      ? payload.name.trim()
      : getDefaultPriceCompareListName();

  const updatedAt =
    typeof payload.updatedAt === 'string' && payload.updatedAt.trim()
      ? payload.updatedAt.trim()
      : new Date().toISOString();
  const createdAt =
    typeof payload.createdAt === 'string' && payload.createdAt.trim()
      ? payload.createdAt.trim()
      : updatedAt;

  return {
    id,
    name,
    itemCount: entries.reduce((sum, item) => sum + item.quantity, 0),
    createdAt,
    updatedAt,
    isPinned: Boolean(payload.isPinned),
    entries,
  };
};

function resolveShoppingListsCollection(userId: string) {
  return collection(db, USERS_COLLECTION, userId, SHOPPING_LISTS_SUBCOLLECTION);
}

async function loadLocalSavedPriceCompareLists(): Promise<SavedPriceCompareList[]> {
  try {
    const raw = await AsyncStorage.getItem(PRICE_COMPARE_SAVED_LISTS_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortSavedLists(parsed.map(normalizeSavedList).filter(Boolean) as SavedPriceCompareList[]);
  } catch (error) {
    console.warn('[priceCompareShoppingList] load failed:', error);
    return [];
  }
}

async function persistSavedLists(lists: SavedPriceCompareList[]): Promise<void> {
  await AsyncStorage.setItem(
    PRICE_COMPARE_SAVED_LISTS_STORAGE_KEY,
    JSON.stringify(sortSavedLists(lists).slice(0, MAX_SAVED_LISTS))
  );
}

async function loadRemoteSavedPriceCompareLists(
  userId: string
): Promise<SavedPriceCompareList[]> {
  const snapshot = await getDocs(resolveShoppingListsCollection(userId));

  return sortSavedLists(
    snapshot.docs
      .map((document) =>
        normalizeSavedList({
          id: document.id,
          ...document.data(),
        })
      )
      .filter(Boolean) as SavedPriceCompareList[]
  );
}

async function syncRemoteSavedPriceCompareLists(
  userId: string,
  lists: SavedPriceCompareList[]
): Promise<void> {
  const collectionRef = resolveShoppingListsCollection(userId);
  const existingSnapshot = await getDocs(collectionRef);
  const existingIds = new Set(existingSnapshot.docs.map((document) => document.id));
  const nextIds = new Set(lists.map((item) => item.id));

  await Promise.all(
    lists.map((item) =>
      setDoc(doc(collectionRef, item.id), {
        id: item.id,
        name: item.name,
        itemCount: item.itemCount,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        isPinned: Boolean(item.isPinned),
        ownerType: 'self',
        entries: item.entries,
      })
    )
  );

  await Promise.all(
    Array.from(existingIds)
      .filter((documentId) => !nextIds.has(documentId))
      .map((documentId) => deleteDoc(doc(collectionRef, documentId)))
  );
}

export async function loadSavedPriceCompareLists(
  options?: SavedPriceCompareListPersistenceOptions
): Promise<SavedPriceCompareList[]> {
  const localLists = await loadLocalSavedPriceCompareLists();
  const normalizedUserId = options?.userId?.trim();

  if (!normalizedUserId) {
    return localLists;
  }

  try {
    const remoteLists = await loadRemoteSavedPriceCompareLists(normalizedUserId);

    if (!remoteLists.length) {
      if (localLists.length) {
        await syncRemoteSavedPriceCompareLists(normalizedUserId, localLists);
      }

      return localLists;
    }

    await persistSavedLists(remoteLists);
    return remoteLists;
  } catch (error) {
    console.warn('[priceCompareShoppingList] remote load failed:', error);
    return localLists;
  }
}

export async function savePriceCompareList(input: {
  id?: string | null;
  name: string;
  entries: SavedPriceCompareCartEntry[];
}, options?: SavedPriceCompareListPersistenceOptions): Promise<SavedPriceCompareList[]> {
  const existing = await loadSavedPriceCompareLists(options);
  const now = new Date().toISOString();
  const normalizedName = input.name.trim() || getDefaultPriceCompareListName();
  const normalizedEntries = input.entries
    .map((entry) => ({
      product: entry.product,
      offersResponse: entry.offersResponse,
      quantity: normalizeEntryQuantity(entry.quantity),
    }))
    .filter((entry) => entry.product && entry.offersResponse);

  if (!normalizedEntries.length) {
    return existing;
  }

  const nextList: SavedPriceCompareList = {
    id: input.id?.trim() || `shopping-list-${Date.now()}`,
    name: normalizedName,
    itemCount: normalizedEntries.reduce((sum, item) => sum + item.quantity, 0),
    createdAt:
      existing.find((item) => item.id === input.id?.trim())?.createdAt || now,
    updatedAt: now,
    isPinned: existing.find((item) => item.id === input.id?.trim())?.isPinned ?? false,
    entries: normalizedEntries,
  };

  const remaining = existing.filter((item) => item.id !== nextList.id);
  const nextLists = sortSavedLists([nextList, ...remaining]).slice(0, MAX_SAVED_LISTS);
  await persistSavedLists(nextLists);
  if (options?.userId?.trim()) {
    await syncRemoteSavedPriceCompareLists(options.userId.trim(), nextLists);
  }
  return nextLists;
}

export async function deleteSavedPriceCompareList(
  listId: string,
  options?: SavedPriceCompareListPersistenceOptions
): Promise<SavedPriceCompareList[]> {
  const existing = await loadSavedPriceCompareLists(options);
  const nextLists = existing.filter((item) => item.id !== listId);
  await persistSavedLists(nextLists);
  if (options?.userId?.trim()) {
    await syncRemoteSavedPriceCompareLists(options.userId.trim(), nextLists);
  }
  return nextLists;
}

export async function togglePinSavedPriceCompareList(
  listId: string,
  options?: SavedPriceCompareListPersistenceOptions
): Promise<SavedPriceCompareList[]> {
  const existing = await loadSavedPriceCompareLists(options);
  const nextLists = existing.map((item) =>
    item.id === listId
      ? {
          ...item,
          isPinned: !item.isPinned,
          updatedAt: new Date().toISOString(),
        }
      : item
  );
  await persistSavedLists(nextLists);
  if (options?.userId?.trim()) {
    await syncRemoteSavedPriceCompareLists(options.userId.trim(), nextLists);
  }
  return sortSavedLists(nextLists);
}

export async function duplicateSavedPriceCompareList(
  listId: string,
  options?: SavedPriceCompareListPersistenceOptions
): Promise<SavedPriceCompareList[]> {
  const existing = await loadSavedPriceCompareLists(options);
  const target = existing.find((item) => item.id === listId);

  if (!target) {
    return existing;
  }

  const now = new Date().toISOString();
  const duplicate: SavedPriceCompareList = {
    ...target,
    id: `shopping-list-${Date.now()}`,
    name: `${target.name} Kopya`,
    createdAt: now,
    updatedAt: now,
    isPinned: false,
  };

  const nextLists = sortSavedLists([duplicate, ...existing]).slice(0, MAX_SAVED_LISTS);
  await persistSavedLists(nextLists);
  if (options?.userId?.trim()) {
    await syncRemoteSavedPriceCompareLists(options.userId.trim(), nextLists);
  }
  return nextLists;
}

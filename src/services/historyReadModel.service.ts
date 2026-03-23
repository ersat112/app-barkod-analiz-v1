import type { HistoryEntry } from './db';
import {
  getHistoryPage,
  removeHistoryEntry,
  HISTORY_PAGE_SIZE,
} from './history.service';
import {
  groupHistoryEntriesByDate,
  parseHistoryCreatedAt,
  type HistoryFeedPageReadModel,
  type HistoryListTranslationFn,
  type HistoryPageQuery,
  type HistorySection,
  type ParsedHistoryCreatedAt,
} from '../types/history';

export function areHistoryEntriesEqual(
  left: HistoryEntry[],
  right: HistoryEntry[]
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const current = left[index];
    const next = right[index];

    if (
      current.id !== next.id ||
      current.barcode !== next.barcode ||
      current.updated_at !== next.updated_at
    ) {
      return false;
    }
  }

  return true;
}

export function groupHistoryFeedSections(
  items: HistoryEntry[],
  t: HistoryListTranslationFn
): HistorySection[] {
  return groupHistoryEntriesByDate(items, t);
}

export function parseHistoryFeedCreatedAt(
  createdAt?: string | null
): ParsedHistoryCreatedAt {
  return parseHistoryCreatedAt(createdAt);
}

export function getHistoryFeedPageReadModel(
  params: HistoryPageQuery & {
    t: HistoryListTranslationFn;
  }
): HistoryFeedPageReadModel {
  const page = getHistoryPage({
    limit: params.limit ?? HISTORY_PAGE_SIZE,
    offset: params.offset ?? 0,
    query: params.query ?? '',
    type: params.type ?? 'all',
  });

  return {
    ...page,
    sections: groupHistoryFeedSections(page.items, params.t),
  };
}

export function removeHistoryEntryFromFeed(id: number): void {
  removeHistoryEntry(id);
}
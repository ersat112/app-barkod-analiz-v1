import {
  deleteHistoryEntryById,
  getHistoryPage as getHistoryPageFromRepository,
  normalizeHistoryRow,
} from './db/history.repository';
import type { HistoryEntry } from './db';
import type {
  HistoryFilterType,
  HistoryPageResult,
  HistoryRow,
} from '../types/history';
import { HISTORY_PAGE_SIZE } from '../types/history';

export { HISTORY_PAGE_SIZE };
export type { HistoryFilterType, HistoryPageResult, HistoryRow };

export { normalizeHistoryRow };

export const getHistoryPage = ({
  limit = HISTORY_PAGE_SIZE,
  offset = 0,
  query = '',
  type = 'all',
}: {
  limit?: number;
  offset?: number;
  query?: string;
  type?: HistoryFilterType;
}): HistoryPageResult => {
  return getHistoryPageFromRepository({
    limit,
    offset,
    query,
    type,
  });
};

export const removeHistoryEntry = (id: number): void => {
  deleteHistoryEntryById(id);
};

export type { HistoryEntry };
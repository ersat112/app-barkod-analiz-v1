import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type HistoryEntry } from '../services/db';
import {
  getHistoryPage,
  HISTORY_PAGE_SIZE,
  removeHistoryEntry,
  type HistoryFilterType,
} from '../services/history.service';

export type HistorySection = {
  title: string;
  rawDate: string;
  data: HistoryEntry[];
};

const getLocalDateKey = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseCreatedAt = (createdAt?: string | null) => {
  if (!createdAt) {
    return { datePart: '', timePart: '--:--' };
  }

  const iso = createdAt.replace(' ', 'T');
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    const [datePart = '', timePart = ''] = createdAt.split(' ');
    return {
      datePart,
      timePart: timePart ? timePart.slice(0, 5) : '--:--',
    };
  }

  const datePart = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
  const timePart = `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`;

  return { datePart, timePart };
};

const formatDateTitle = (
  rawDate: string,
  t: (key: string, fallback: string) => string
): string => {
  const today = getLocalDateKey();
  const yesterday = getLocalDateKey(new Date(Date.now() - 86400000));

  if (rawDate === today) return t('today', 'Bugün');
  if (rawDate === yesterday) return t('yesterday', 'Dün');

  return rawDate;
};

const groupHistoryByDate = (
  data: HistoryEntry[],
  t: (key: string, fallback: string) => string
): HistorySection[] => {
  const grouped = data.reduce<Record<string, HistorySection>>((acc, item) => {
    const { datePart } = parseCreatedAt(item.created_at);
    const rawDate = datePart || 'unknown-date';

    if (!acc[rawDate]) {
      acc[rawDate] = {
        title: formatDateTitle(rawDate, t),
        rawDate,
        data: [],
      };
    }

    acc[rawDate].data.push(item);
    return acc;
  }, {});

  return Object.values(grouped).sort((a, b) => b.rawDate.localeCompare(a.rawDate));
};

const areHistoryEntriesEqual = (
  left: HistoryEntry[],
  right: HistoryEntry[]
): boolean => {
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
};

export const usePaginatedHistory = (
  t: (key: string, fallback: string) => string
) => {
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const [searchQuery, setSearchQueryState] = useState('');
  const [selectedType, setSelectedTypeState] =
    useState<HistoryFilterType>('all');

  const offsetRef = useRef(0);
  const busyRef = useRef(false);
  const initializedFilterEffectRef = useRef(false);
  const searchQueryRef = useRef('');
  const selectedTypeRef = useRef<HistoryFilterType>('all');

  const sections = useMemo(() => groupHistoryByDate(items, t), [items, t]);
  const hasActiveFilters = useMemo(() => {
    return searchQuery.trim().length > 0 || selectedType !== 'all';
  }, [searchQuery, selectedType]);

  const loadInitial = useCallback(async () => {
    if (busyRef.current) {
      return;
    }

    try {
      busyRef.current = true;
      setLoading(true);
      setLoadError(null);
      setHasMore(true);
      offsetRef.current = 0;

      const page = await Promise.resolve(
        getHistoryPage({
          limit: HISTORY_PAGE_SIZE,
          offset: 0,
          query: searchQueryRef.current,
          type: selectedTypeRef.current,
        })
      );

      setItems((current) => {
        if (areHistoryEntriesEqual(current, page.items)) {
          return current;
        }

        return page.items;
      });

      setHasMore(page.hasMore);
      offsetRef.current = page.nextOffset;
    } catch (error) {
      console.error('[usePaginatedHistory] loadInitial failed:', error);
      setItems([]);
      setHasMore(false);
      setLoadError('history_load_failed');
    } finally {
      setLoading(false);
      setRefreshing(false);
      busyRef.current = false;
    }
  }, []);

  const refresh = useCallback(async () => {
    if (busyRef.current) {
      return;
    }

    setRefreshing(true);
    await loadInitial();
  }, [loadInitial]);

  const loadMore = useCallback(async () => {
    if (busyRef.current || !hasMore || loading || refreshing) {
      return;
    }

    try {
      busyRef.current = true;
      setLoadingMore(true);

      const page = await Promise.resolve(
        getHistoryPage({
          limit: HISTORY_PAGE_SIZE,
          offset: offsetRef.current,
          query: searchQueryRef.current,
          type: selectedTypeRef.current,
        })
      );

      setItems((prev) => {
        if (!page.items.length) {
          return prev;
        }

        const merged = [...prev, ...page.items];

        if (areHistoryEntriesEqual(prev, merged)) {
          return prev;
        }

        return merged;
      });

      setHasMore(page.hasMore);
      offsetRef.current = page.nextOffset;
    } catch (error) {
      console.error('[usePaginatedHistory] loadMore failed:', error);
    } finally {
      setLoadingMore(false);
      busyRef.current = false;
    }
  }, [hasMore, loading, refreshing]);

  const deleteEntry = useCallback(
    async (id: number) => {
      await Promise.resolve(removeHistoryEntry(id));
      await loadInitial();
    },
    [loadInitial]
  );

  const setSearchQuery = useCallback((value: string) => {
    if (searchQueryRef.current === value) {
      return;
    }

    searchQueryRef.current = value;
    setSearchQueryState(value);
  }, []);

  const setSelectedType = useCallback((value: HistoryFilterType) => {
    if (selectedTypeRef.current === value) {
      return;
    }

    selectedTypeRef.current = value;
    setSelectedTypeState(value);
  }, []);

  const clearFilters = useCallback(() => {
    if (searchQueryRef.current === '' && selectedTypeRef.current === 'all') {
      return;
    }

    searchQueryRef.current = '';
    selectedTypeRef.current = 'all';
    setSearchQueryState('');
    setSelectedTypeState('all');
  }, []);

  useEffect(() => {
    if (!initializedFilterEffectRef.current) {
      initializedFilterEffectRef.current = true;
      return;
    }

    void loadInitial();
  }, [searchQuery, selectedType, loadInitial]);

  return {
    items,
    sections,
    loading,
    loadingMore,
    refreshing,
    loadError,
    hasMore,
    searchQuery,
    selectedType,
    hasActiveFilters,
    loadInitial,
    refresh,
    loadMore,
    deleteEntry,
    setSearchQuery,
    setSelectedType,
    clearFilters,
    parseCreatedAt,
  };
};
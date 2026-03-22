import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type HistoryEntry } from '../services/db';
import {
  getHistoryPage,
  HISTORY_PAGE_SIZE,
  removeHistoryEntry,
  type HistoryFilterType,
} from '../services/history.service';
import {
  groupHistoryEntriesByDate,
  parseHistoryCreatedAt,
  type HistorySection,
} from '../types/history';

export type { HistorySection };

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

  const sections = useMemo(
    () => groupHistoryEntriesByDate(items, t),
    [items, t]
  );

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

      setItems(page.items);
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

      setItems((prev) => [...prev, ...page.items]);
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
    searchQueryRef.current = value;
    setSearchQueryState(value);
  }, []);

  const setSelectedType = useCallback((value: HistoryFilterType) => {
    selectedTypeRef.current = value;
    setSelectedTypeState(value);
  }, []);

  const clearFilters = useCallback(() => {
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
    parseCreatedAt: parseHistoryCreatedAt,
  };
};
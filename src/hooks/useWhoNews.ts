import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchWhoNews,
  type WhoNewsSnapshot,
} from '../services/whoNews.service';

const WHO_NEWS_STALE_MS = 30 * 60 * 1000;

type CacheEntry = {
  loadedAt: number;
  snapshot: WhoNewsSnapshot;
};

const cache = new Map<string, CacheEntry>();

export const useWhoNews = (locale: string) => {
  const [snapshot, setSnapshot] = useState<WhoNewsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busyRef = useRef(false);

  const load = useCallback(
    async (options?: { force?: boolean }) => {
      const force = Boolean(options?.force);
      const normalizedLocale = String(locale || 'en').toLowerCase();
      const now = Date.now();
      const cached = cache.get(normalizedLocale);

      if (busyRef.current) {
        return;
      }

      if (!force && cached && now - cached.loadedAt < WHO_NEWS_STALE_MS) {
        setSnapshot(cached.snapshot);
        setLoading(false);
        setRefreshing(false);
        setError(null);
        return;
      }

      try {
        busyRef.current = true;
        setError(null);

        const nextSnapshot = await fetchWhoNews(normalizedLocale);

        cache.set(normalizedLocale, {
          loadedAt: now,
          snapshot: nextSnapshot,
        });

        setSnapshot(nextSnapshot);
      } catch (loadError) {
        console.error('[useWhoNews] load failed:', loadError);
        setError('who_news_load_failed');
      } finally {
        setLoading(false);
        setRefreshing(false);
        busyRef.current = false;
      }
    },
    [locale]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load({ force: true });
  }, [load]);

  return {
    snapshot,
    loading,
    refreshing,
    error,
    refresh,
  };
};

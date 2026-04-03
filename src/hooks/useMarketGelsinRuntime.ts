import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import {
  getMarketGelsinRuntimeSnapshot,
  type MarketGelsinRuntimeSnapshot,
} from '../config/marketGelsinRuntime';
import { resolveMarketGelsinRuntimeConfig } from '../services/marketGelsinRuntimeConfig.service';

type UseMarketGelsinRuntimeResult = {
  snapshot: MarketGelsinRuntimeSnapshot;
  loading: boolean;
  refresh: (options?: { forceRefresh?: boolean }) => Promise<void>;
};

export function useMarketGelsinRuntime(): UseMarketGelsinRuntimeResult {
  const [snapshot, setSnapshot] = useState<MarketGelsinRuntimeSnapshot>(
    getMarketGelsinRuntimeSnapshot()
  );
  const [loading, setLoading] = useState<boolean>(false);

  const refresh = useCallback(async (options?: { forceRefresh?: boolean }) => {
    setLoading(true);

    try {
      const nextSnapshot = await resolveMarketGelsinRuntimeConfig({
        forceRefresh: Boolean(options?.forceRefresh),
        allowStale: !options?.forceRefresh,
      });
      setSnapshot(nextSnapshot);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();

      return undefined;
    }, [refresh])
  );

  return {
    snapshot,
    loading,
    refresh,
  };
}

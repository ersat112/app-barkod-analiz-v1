import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  TOTAL_SCAN_COUNT: 'ad_total_scan_count',
  LAST_INTERSTITIAL_AT: 'ad_last_interstitial_at',
} as const;

type AdStats = {
  totalScanCount: number;
  lastInterstitialAt: number | null;
};

const parseNumber = (value: string | null, fallback = 0): number => {
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const adService = {
  async getStats(): Promise<AdStats> {
    try {
      const [totalScanCountRaw, lastInterstitialAtRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.TOTAL_SCAN_COUNT),
        AsyncStorage.getItem(STORAGE_KEYS.LAST_INTERSTITIAL_AT),
      ]);

      const totalScanCount = parseNumber(totalScanCountRaw, 0);
      const lastInterstitialAt =
        lastInterstitialAtRaw == null ? null : parseNumber(lastInterstitialAtRaw, 0);

      return {
        totalScanCount,
        lastInterstitialAt:
          lastInterstitialAt && lastInterstitialAt > 0 ? lastInterstitialAt : null,
      };
    } catch (error) {
      console.log('[AdService] getStats failed:', error);
      return {
        totalScanCount: 0,
        lastInterstitialAt: null,
      };
    }
  },

  async reset(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.TOTAL_SCAN_COUNT,
        STORAGE_KEYS.LAST_INTERSTITIAL_AT,
      ]);

      console.log('[AdService] counters reset');
    } catch (error) {
      console.log('[AdService] reset failed:', error);
    }
  },

  /**
   * Kural:
   * 1. tarama => reklam
   * 2. tarama => yok
   * 3. tarama => reklam
   * 4. tarama => yok
   */
  async shouldShowAd(): Promise<boolean> {
    try {
      const stats = await this.getStats();
      const nextCount = stats.totalScanCount + 1;
      const shouldShow = nextCount % 2 === 1;

      await AsyncStorage.setItem(
        STORAGE_KEYS.TOTAL_SCAN_COUNT,
        String(nextCount)
      );

      if (shouldShow) {
        await AsyncStorage.setItem(
          STORAGE_KEYS.LAST_INTERSTITIAL_AT,
          String(Date.now())
        );
      }

      console.log(
        '[AdService] scan count:',
        nextCount,
        '| show interstitial:',
        shouldShow
      );

      return shouldShow;
    } catch (error) {
      console.log('[AdService] shouldShowAd failed:', error);
      return false;
    }
  },
};
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FEATURES } from '../config/features';

const STORAGE_KEYS = {
  TOTAL_SCAN_COUNT: 'ad_total_scan_count',
  LAST_INTERSTITIAL_AT: 'ad_last_interstitial_at',
  LAST_INTERSTITIAL_SCAN_COUNT: 'ad_last_interstitial_scan_count',
} as const;

type AdStats = {
  totalScanCount: number;
  lastInterstitialAt: number | null;
  lastInterstitialScanCount: number | null;
};

const parseNumber = (value: string | null, fallback = 0): number => {
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const INTERSTITIAL_POLICY = {
  warmupScanCount: 3,
  scansBetweenInterstitials: 4,
  minCooldownMs: 1000 * 90,
};

export const adService = {
  async getStats(): Promise<AdStats> {
    try {
      const [
        totalScanCountRaw,
        lastInterstitialAtRaw,
        lastInterstitialScanCountRaw,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.TOTAL_SCAN_COUNT),
        AsyncStorage.getItem(STORAGE_KEYS.LAST_INTERSTITIAL_AT),
        AsyncStorage.getItem(STORAGE_KEYS.LAST_INTERSTITIAL_SCAN_COUNT),
      ]);

      const totalScanCount = parseNumber(totalScanCountRaw, 0);
      const lastInterstitialAt =
        lastInterstitialAtRaw == null ? null : parseNumber(lastInterstitialAtRaw, 0);
      const lastInterstitialScanCount =
        lastInterstitialScanCountRaw == null
          ? null
          : parseNumber(lastInterstitialScanCountRaw, 0);

      return {
        totalScanCount,
        lastInterstitialAt:
          lastInterstitialAt && lastInterstitialAt > 0 ? lastInterstitialAt : null,
        lastInterstitialScanCount:
          lastInterstitialScanCount && lastInterstitialScanCount > 0
            ? lastInterstitialScanCount
            : null,
      };
    } catch (error) {
      console.log('[AdService] getStats failed:', error);
      return {
        totalScanCount: 0,
        lastInterstitialAt: null,
        lastInterstitialScanCount: null,
      };
    }
  },

  async reset(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.TOTAL_SCAN_COUNT,
        STORAGE_KEYS.LAST_INTERSTITIAL_AT,
        STORAGE_KEYS.LAST_INTERSTITIAL_SCAN_COUNT,
      ]);

      console.log('[AdService] counters reset');
    } catch (error) {
      console.log('[AdService] reset failed:', error);
    }
  },

  async shouldShowAd(): Promise<boolean> {
    try {
      const stats = await this.getStats();
      const now = Date.now();
      const nextCount = stats.totalScanCount + 1;

      await AsyncStorage.setItem(
        STORAGE_KEYS.TOTAL_SCAN_COUNT,
        String(nextCount)
      );

      if (!FEATURES.scanner.reducedInterstitialEnabled) {
        const shouldShowLegacy = nextCount % 2 === 1;

        if (shouldShowLegacy) {
          await AsyncStorage.multiSet([
            [STORAGE_KEYS.LAST_INTERSTITIAL_AT, String(now)],
            [STORAGE_KEYS.LAST_INTERSTITIAL_SCAN_COUNT, String(nextCount)],
          ]);
        }

        console.log('[AdService] legacy policy', {
          nextCount,
          shouldShowLegacy,
        });

        return shouldShowLegacy;
      }

      if (nextCount <= INTERSTITIAL_POLICY.warmupScanCount) {
        console.log('[AdService] warmup period active', { nextCount });
        return false;
      }

      const scansSinceLastInterstitial =
        stats.lastInterstitialScanCount == null
          ? nextCount
          : nextCount - stats.lastInterstitialScanCount;

      const cooldownPassed =
        stats.lastInterstitialAt == null ||
        now - stats.lastInterstitialAt >= INTERSTITIAL_POLICY.minCooldownMs;

      const cadencePassed =
        scansSinceLastInterstitial >= INTERSTITIAL_POLICY.scansBetweenInterstitials;

      const shouldShow = cadencePassed && cooldownPassed;

      if (shouldShow) {
        await AsyncStorage.multiSet([
          [STORAGE_KEYS.LAST_INTERSTITIAL_AT, String(now)],
          [STORAGE_KEYS.LAST_INTERSTITIAL_SCAN_COUNT, String(nextCount)],
        ]);
      }

      console.log('[AdService] reduced policy', {
        nextCount,
        scansSinceLastInterstitial,
        cooldownPassed,
        cadencePassed,
        shouldShow,
      });

      return shouldShow;
    } catch (error) {
      console.log('[AdService] shouldShowAd failed:', error);
      return false;
    }
  },
};

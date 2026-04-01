import { getEnvBoolean, getEnvNumber, getEnvString, hasEnvOverride } from './appRuntime';

export type MarketGelsinRuntimeSource = 'env_override' | 'fallback';

const normalizeBaseUrl = (value: string): string =>
  value.trim().replace(/\/+$/g, '');

const baseUrl = normalizeBaseUrl(getEnvString('EXPO_PUBLIC_MARKET_GELSIN_API_URL', ''));
const enabledByEnv = getEnvBoolean('EXPO_PUBLIC_MARKET_GELSIN_ENABLED', Boolean(baseUrl));
const timeoutMs = Math.max(3000, getEnvNumber('EXPO_PUBLIC_MARKET_GELSIN_TIMEOUT_MS', 8000));

export const MARKET_GELSIN_RUNTIME = Object.freeze({
  source: (
    hasEnvOverride('EXPO_PUBLIC_MARKET_GELSIN_API_URL') ||
    hasEnvOverride('EXPO_PUBLIC_MARKET_GELSIN_ENABLED') ||
    hasEnvOverride('EXPO_PUBLIC_MARKET_GELSIN_TIMEOUT_MS')
      ? 'env_override'
      : 'fallback'
  ) as MarketGelsinRuntimeSource,
  baseUrl,
  timeoutMs,
  isEnabled: Boolean(baseUrl) && enabledByEnv,
});

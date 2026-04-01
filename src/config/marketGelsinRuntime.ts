import { NativeModules, Platform } from 'react-native';

import { APP_RUNTIME, getEnvBoolean, getEnvNumber, getEnvString, hasEnvOverride } from './appRuntime';

export type MarketGelsinRuntimeSource = 'env_override' | 'development_fallback' | 'fallback';

const normalizeBaseUrl = (value: string): string =>
  value.trim().replace(/\/+$/g, '');

const resolveDevelopmentHost = (): string | null => {
  if (!APP_RUNTIME.isDevelopment) {
    return null;
  }

  const scriptUrl = String(NativeModules?.SourceCode?.scriptURL || '').trim();

  if (scriptUrl) {
    try {
      const parsed = new URL(scriptUrl);
      const hostname = parsed.hostname.trim();

      if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
        return hostname;
      }
    } catch {
      // Development fallback below handles malformed URLs.
    }
  }

  return Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
};

const developmentFallbackBaseUrl = (() => {
  const host = resolveDevelopmentHost();
  return host ? `http://${host}:8040` : '';
})();

const envBaseUrl = normalizeBaseUrl(getEnvString('EXPO_PUBLIC_MARKET_GELSIN_API_URL', ''));
const baseUrl = envBaseUrl || normalizeBaseUrl(developmentFallbackBaseUrl);
const enabledByEnv = getEnvBoolean(
  'EXPO_PUBLIC_MARKET_GELSIN_ENABLED',
  Boolean(envBaseUrl || developmentFallbackBaseUrl)
);
const timeoutMs = Math.max(3000, getEnvNumber('EXPO_PUBLIC_MARKET_GELSIN_TIMEOUT_MS', 8000));

export const MARKET_GELSIN_RUNTIME = Object.freeze({
  source: (
    hasEnvOverride('EXPO_PUBLIC_MARKET_GELSIN_API_URL') ||
    hasEnvOverride('EXPO_PUBLIC_MARKET_GELSIN_ENABLED') ||
    hasEnvOverride('EXPO_PUBLIC_MARKET_GELSIN_TIMEOUT_MS')
      ? 'env_override'
      : developmentFallbackBaseUrl
        ? 'development_fallback'
        : 'fallback'
  ) as MarketGelsinRuntimeSource,
  baseUrl,
  timeoutMs,
  isEnabled: Boolean(baseUrl) && enabledByEnv,
});

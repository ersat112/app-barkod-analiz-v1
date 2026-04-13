import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  extra: {
    ...config.extra,
    ...(process.env.EXPO_PUBLIC_MARKET_GELSIN_API_URL
      ? {
          EXPO_PUBLIC_MARKET_GELSIN_API_URL:
            process.env.EXPO_PUBLIC_MARKET_GELSIN_API_URL,
        }
      : {}),
    ...(process.env.EXPO_PUBLIC_MARKET_GELSIN_ENABLED
      ? {
          EXPO_PUBLIC_MARKET_GELSIN_ENABLED:
            process.env.EXPO_PUBLIC_MARKET_GELSIN_ENABLED,
        }
      : {}),
    ...(process.env.EXPO_PUBLIC_MARKET_GELSIN_TIMEOUT_MS
      ? {
          EXPO_PUBLIC_MARKET_GELSIN_TIMEOUT_MS:
            process.env.EXPO_PUBLIC_MARKET_GELSIN_TIMEOUT_MS,
        }
      : {}),
  },
});

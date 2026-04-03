import type { ExpoConfig } from 'expo/config';

import appJson from './app.json';

const baseConfig = appJson.expo as ExpoConfig;

export default (): ExpoConfig => ({
  ...baseConfig,
  extra: {
    ...baseConfig.extra,
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

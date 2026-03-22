import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type AppEnvironment = 'development' | 'preview' | 'production';

type RuntimeSource = 'fallback' | 'env_override';

const ENV = process.env as Record<string, string | undefined>;

function normalizeString(value?: string | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getOptionalEnvString(key: string): string | null {
  return normalizeString(ENV[key]);
}

export function getEnvString(key: string, fallback: string): string {
  return getOptionalEnvString(key) ?? fallback;
}

export function getEnvBoolean(key: string, fallback: boolean): boolean {
  const raw = getOptionalEnvString(key);

  if (!raw) {
    return fallback;
  }

  const normalized = raw.toLowerCase();

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

export function getEnvNumber(key: string, fallback: number): number {
  const raw = getOptionalEnvString(key);

  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);

  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getEnvCsv(key: string, fallback: string[]): string[] {
  const raw = getOptionalEnvString(key);

  if (!raw) {
    return fallback;
  }

  const items = raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return items.length > 0 ? items : fallback;
}

function resolveAppEnvironment(): AppEnvironment {
  const explicitEnv = getOptionalEnvString('EXPO_PUBLIC_APP_ENV')?.toLowerCase();

  if (explicitEnv === 'production') {
    return 'production';
  }

  if (explicitEnv === 'preview' || explicitEnv === 'staging') {
    return 'preview';
  }

  if (explicitEnv === 'development' || explicitEnv === 'dev') {
    return 'development';
  }

  return __DEV__ ? 'development' : 'production';
}

const executionEnvironment =
  Constants.executionEnvironment ?? 'unknown';

const isExpoGo = executionEnvironment === 'storeClient';
const appEnvironment = resolveAppEnvironment();

export const APP_RUNTIME = Object.freeze({
  appEnvironment,
  runtimeSource: (getOptionalEnvString('EXPO_PUBLIC_APP_ENV')
    ? 'env_override'
    : 'fallback') as RuntimeSource,
  isDevelopment: appEnvironment === 'development',
  isPreview: appEnvironment === 'preview',
  isProduction: appEnvironment === 'production',
  isExpoGo,
  isNativeBuild: !isExpoGo,
  executionEnvironment,
  platform: Platform.OS,
});
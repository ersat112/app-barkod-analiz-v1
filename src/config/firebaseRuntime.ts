import type { FirebaseOptions } from 'firebase/app';

import { getEnvString } from './appRuntime';

export type FirebaseRuntimeSource = 'env_override' | 'fallback';
export type FirebaseRuntimeEffectiveSource =
  | 'env_override'
  | 'fallback'
  | 'fallback_recovery';

export type FirebaseRuntimeDiagnosticsSnapshot = {
  fetchedAt: string;
  source: FirebaseRuntimeSource;
  effectiveSource: FirebaseRuntimeEffectiveSource;
  authPersistenceEnabled: boolean;
  hasRuntimeOverrides: boolean;
  hasInvalidRuntimeOverride: boolean;
  isConfigComplete: boolean;
  isEffectiveConfigComplete: boolean;
  missingKeys: string[];
  projectId: string;
  configPresence: {
    apiKey: boolean;
    authDomain: boolean;
    projectId: boolean;
    storageBucket: boolean;
    messagingSenderId: boolean;
    appId: boolean;
  };
};

export const FIREBASE_FALLBACK_CONFIG: FirebaseOptions = Object.freeze({
  apiKey: 'AIzaSyCGQQASVvLt9XbXOt2GSb3Vlg5gf95IosU',
  authDomain: 'barkodanaliz-5ed4b.firebaseapp.com',
  projectId: 'barkodanaliz-5ed4b',
  storageBucket: 'barkodanaliz-5ed4b.firebasestorage.app',
  messagingSenderId: '1054230654930',
  appId: '1:1054230654930:web:d9f0f54eb64f46747b620b',
});

const runtimeConfig: FirebaseOptions = Object.freeze({
  apiKey: getEnvString(
    'EXPO_PUBLIC_FIREBASE_API_KEY',
    FIREBASE_FALLBACK_CONFIG.apiKey ?? ''
  ),
  authDomain: getEnvString(
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    FIREBASE_FALLBACK_CONFIG.authDomain ?? ''
  ),
  projectId: getEnvString(
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    FIREBASE_FALLBACK_CONFIG.projectId ?? ''
  ),
  storageBucket: getEnvString(
    'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
    FIREBASE_FALLBACK_CONFIG.storageBucket ?? ''
  ),
  messagingSenderId: getEnvString(
    'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    FIREBASE_FALLBACK_CONFIG.messagingSenderId ?? ''
  ),
  appId: getEnvString(
    'EXPO_PUBLIC_FIREBASE_APP_ID',
    FIREBASE_FALLBACK_CONFIG.appId ?? ''
  ),
});

const hasRuntimeOverrides = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
].some((key) => Boolean(process.env[key]?.trim()));

const source: FirebaseRuntimeSource = hasRuntimeOverrides ? 'env_override' : 'fallback';

const configPresence = Object.freeze({
  apiKey: Boolean(runtimeConfig.apiKey?.trim()),
  authDomain: Boolean(runtimeConfig.authDomain?.trim()),
  projectId: Boolean(runtimeConfig.projectId?.trim()),
  storageBucket: Boolean(runtimeConfig.storageBucket?.trim()),
  messagingSenderId: Boolean(runtimeConfig.messagingSenderId?.trim()),
  appId: Boolean(runtimeConfig.appId?.trim()),
});

const missingKeys = Object.entries(configPresence)
  .filter(([, value]) => !value)
  .map(([key]) => key);

const isConfigComplete = missingKeys.length === 0;
const hasInvalidRuntimeOverride = hasRuntimeOverrides && !isConfigComplete;

const effectiveConfig: FirebaseOptions = hasInvalidRuntimeOverride
  ? FIREBASE_FALLBACK_CONFIG
  : runtimeConfig;

const effectiveSource: FirebaseRuntimeEffectiveSource = hasInvalidRuntimeOverride
  ? 'fallback_recovery'
  : source;

const effectiveConfigPresence = Object.freeze({
  apiKey: Boolean(effectiveConfig.apiKey?.trim()),
  authDomain: Boolean(effectiveConfig.authDomain?.trim()),
  projectId: Boolean(effectiveConfig.projectId?.trim()),
  storageBucket: Boolean(effectiveConfig.storageBucket?.trim()),
  messagingSenderId: Boolean(effectiveConfig.messagingSenderId?.trim()),
  appId: Boolean(effectiveConfig.appId?.trim()),
});

const isEffectiveConfigComplete = Object.values(effectiveConfigPresence).every(Boolean);

export const FIREBASE_RUNTIME = Object.freeze({
  source,
  effectiveSource,
  config: runtimeConfig,
  effectiveConfig,
  authPersistenceEnabled: true,
  hasRuntimeOverrides,
  hasInvalidRuntimeOverride,
  isConfigComplete,
  isEffectiveConfigComplete,
  missingKeys,
});

export function isFirebaseRuntimeReady(): boolean {
  return FIREBASE_RUNTIME.isEffectiveConfigComplete;
}

export function getFirebaseRuntimeDiagnosticsSnapshot(): FirebaseRuntimeDiagnosticsSnapshot {
  return {
    fetchedAt: new Date().toISOString(),
    source: FIREBASE_RUNTIME.source,
    effectiveSource: FIREBASE_RUNTIME.effectiveSource,
    authPersistenceEnabled: FIREBASE_RUNTIME.authPersistenceEnabled,
    hasRuntimeOverrides: FIREBASE_RUNTIME.hasRuntimeOverrides,
    hasInvalidRuntimeOverride: FIREBASE_RUNTIME.hasInvalidRuntimeOverride,
    isConfigComplete: FIREBASE_RUNTIME.isConfigComplete,
    isEffectiveConfigComplete: FIREBASE_RUNTIME.isEffectiveConfigComplete,
    missingKeys: [...FIREBASE_RUNTIME.missingKeys],
    projectId: FIREBASE_RUNTIME.effectiveConfig.projectId?.trim() || '',
    configPresence,
  };
}
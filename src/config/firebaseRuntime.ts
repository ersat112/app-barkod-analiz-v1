import type { FirebaseOptions } from 'firebase/app';

import { getEnvString } from './appRuntime';

const FALLBACK_FIREBASE_CONFIG: FirebaseOptions = Object.freeze({
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
    FALLBACK_FIREBASE_CONFIG.apiKey ?? ''
  ),
  authDomain: getEnvString(
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    FALLBACK_FIREBASE_CONFIG.authDomain ?? ''
  ),
  projectId: getEnvString(
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    FALLBACK_FIREBASE_CONFIG.projectId ?? ''
  ),
  storageBucket: getEnvString(
    'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
    FALLBACK_FIREBASE_CONFIG.storageBucket ?? ''
  ),
  messagingSenderId: getEnvString(
    'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    FALLBACK_FIREBASE_CONFIG.messagingSenderId ?? ''
  ),
  appId: getEnvString(
    'EXPO_PUBLIC_FIREBASE_APP_ID',
    FALLBACK_FIREBASE_CONFIG.appId ?? ''
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

export const FIREBASE_RUNTIME = Object.freeze({
  source: hasRuntimeOverrides ? 'env_override' : 'fallback',
  config: runtimeConfig,
  authPersistenceEnabled: true,
});
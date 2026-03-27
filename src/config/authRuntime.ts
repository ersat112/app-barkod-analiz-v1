import * as AuthSession from 'expo-auth-session';
import type { ActionCodeSettings } from 'firebase/auth';

import { APP_RUNTIME, getEnvString } from './appRuntime';

export type AuthRuntimePlatform = 'ios' | 'android' | 'web';

type GoogleRuntimeSnapshot = {
  androidClientId: string;
  iosClientId: string;
  webClientId: string;
  activePlatformClientId: string;
  hasActivePlatformClientId: boolean;
  missingKeys: string[];
};

const platform: AuthRuntimePlatform =
  APP_RUNTIME.platform === 'ios' || APP_RUNTIME.platform === 'android'
    ? APP_RUNTIME.platform
    : 'web';

const androidClientId = getEnvString('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID', '').trim();
const iosClientId = getEnvString('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', '').trim();
const webClientId = getEnvString('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', '').trim();
const emailContinueUrl = getEnvString('EXPO_PUBLIC_AUTH_EMAIL_CONTINUE_URL', '').trim();

const activePlatformClientId =
  platform === 'ios'
    ? iosClientId
    : platform === 'android'
      ? androidClientId
      : webClientId;

const missingGoogleKeys: string[] = [];

if (platform === 'android' && !androidClientId) {
  missingGoogleKeys.push('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID');
}

if (platform === 'ios' && !iosClientId) {
  missingGoogleKeys.push('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID');
}

if (platform === 'web' && !webClientId) {
  missingGoogleKeys.push('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
}

export const AUTH_RUNTIME = Object.freeze({
  platform,
  google: {
    androidClientId,
    iosClientId,
    webClientId,
    activePlatformClientId,
    hasActivePlatformClientId: Boolean(activePlatformClientId),
    missingKeys: missingGoogleKeys,
  } satisfies GoogleRuntimeSnapshot,
  emailVerification: {
    continueUrl: emailContinueUrl,
    hasContinueUrl: Boolean(emailContinueUrl),
  },
});

export function getGoogleAuthRedirectUri(): string {
  return AuthSession.makeRedirectUri({
    scheme: 'erenesal',
    path: 'oauthredirect',
    native: 'erenesal://oauthredirect',
  });
}

export function getEmailVerificationActionSettings(): ActionCodeSettings | undefined {
  if (!AUTH_RUNTIME.emailVerification.hasContinueUrl) {
    return undefined;
  }

  return {
    url: AUTH_RUNTIME.emailVerification.continueUrl,
    handleCodeInApp: false,
    iOS: {
      bundleId: 'com.ersat.barkodanaliz',
    },
    android: {
      packageName: 'com.ersat.erenesalv1',
      installApp: true,
      minimumVersion: '1',
    },
  };
}

import { Platform } from 'react-native';
import {
  GoogleSignin,
  statusCodes as googleStatusCodes,
} from '@react-native-google-signin/google-signin';
import {
  GoogleAuthProvider,
  signInWithCredential,
  type UserCredential,
} from 'firebase/auth';

import { AUTH_RUNTIME } from '../config/authRuntime';
import { auth } from '../config/firebase';

export type GoogleNativeAuthResult =
  | {
      type: 'success';
      userCredential: UserCredential;
    }
  | {
      type: 'cancelled';
    };

let googleNativeConfigured = false;

function ensureGoogleNativeConfigured(): void {
  if (googleNativeConfigured) {
    return;
  }

  GoogleSignin.configure({
    scopes: ['profile', 'email'],
    webClientId: AUTH_RUNTIME.google.webClientId || undefined,
    iosClientId: AUTH_RUNTIME.google.iosClientId || undefined,
  });

  googleNativeConfigured = true;
}

export function isGoogleNativeSignInReady(): boolean {
  return Platform.OS === 'android' && Boolean(AUTH_RUNTIME.google.webClientId);
}

export async function signInWithGoogleNativeFirebase(): Promise<GoogleNativeAuthResult> {
  if (!isGoogleNativeSignInReady()) {
    throw new Error('google_native_sign_in_not_ready');
  }

  ensureGoogleNativeConfigured();
  await GoogleSignin.hasPlayServices({
    showPlayServicesUpdateDialog: true,
  });

  const response = await GoogleSignin.signIn();

  if (response.type !== 'success') {
    return {
      type: 'cancelled',
    };
  }

  let idToken = response.data.idToken;

  if (!idToken) {
    const tokens = await GoogleSignin.getTokens();
    idToken = tokens.idToken;
  }

  if (!idToken) {
    throw new Error('google_credential_missing');
  }

  const credential = GoogleAuthProvider.credential(idToken);
  const userCredential = await signInWithCredential(auth, credential);

  return {
    type: 'success',
    userCredential,
  };
}

export function isGoogleNativePlayServicesError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === googleStatusCodes.PLAY_SERVICES_NOT_AVAILABLE
  );
}

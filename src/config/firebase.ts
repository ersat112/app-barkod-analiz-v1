import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
// @ts-ignore
import { getReactNativePersistence } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  FIREBASE_RUNTIME,
  getFirebaseRuntimeDiagnosticsSnapshot,
  isFirebaseRuntimeReady,
  type FirebaseRuntimeDiagnosticsSnapshot,
} from './firebaseRuntime';

export type FirebaseServicesDiagnosticsSnapshot = FirebaseRuntimeDiagnosticsSnapshot & {
  appName: string;
  firestoreEnabled: boolean;
  storageEnabled: boolean;
};

function createFirebaseApp(): FirebaseApp {
  if (getApps().length === 0) {
    return initializeApp(FIREBASE_RUNTIME.effectiveConfig);
  }

  return getApp();
}

function createFirebaseAuth(app: FirebaseApp): Auth {
  try {
    // @ts-ignore
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
}

const app: FirebaseApp = createFirebaseApp();
const auth: Auth = createFirebaseAuth(app);
const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);

const isFirebaseServicesReady = (): boolean => {
  return isFirebaseRuntimeReady();
};

const getFirebaseServicesDiagnosticsSnapshot =
  (): FirebaseServicesDiagnosticsSnapshot => {
    const runtimeSnapshot = getFirebaseRuntimeDiagnosticsSnapshot();

    return {
      ...runtimeSnapshot,
      appName: app.name,
      firestoreEnabled: isFirebaseServicesReady(),
      storageEnabled: isFirebaseServicesReady(),
    };
  };

export {
  app,
  auth,
  db,
  storage,
  getFirebaseServicesDiagnosticsSnapshot,
  isFirebaseServicesReady,
};
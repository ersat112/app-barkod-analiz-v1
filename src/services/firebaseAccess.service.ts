import {
  getFirebaseServicesDiagnosticsSnapshot,
  isFirebaseServicesReady,
} from '../config/firebase';
import { FEATURES } from '../config/features';
import { auth } from '../config/firebase';
import {
  resolveFirestoreRuntimeConfig,
  type FirestoreRuntimeConfigSnapshot,
} from './firestoreRuntimeConfig.service';

export type FirebaseAccessSnapshot = {
  fetchedAt: string;
  runtimeReady: boolean;
  runtimeSource: string;
  runtimeEffectiveSource: string;
  projectId: string;
  isAuthenticated: boolean;
  authUid: string | null;
  firestoreRuntimeConfigSource: FirestoreRuntimeConfigSnapshot['source'];
  firestoreRuntimeConfigVersion: number;
  sharedCacheReadAllowed: boolean;
  sharedCacheWriteAllowed: boolean;
  analyticsWriteAllowed: boolean;
  missingProductContributionWriteAllowed: boolean;
  adPolicyReadAllowed: boolean;
};

function hasAuthenticatedUser(): boolean {
  return Boolean(auth.currentUser?.uid);
}

function isAuthGateSatisfied(): boolean {
  if (!FEATURES.firebase.authenticatedUserRequired) {
    return true;
  }

  return hasAuthenticatedUser();
}

export const getFirebaseAccessSnapshot =
  async (): Promise<FirebaseAccessSnapshot> => {
    const servicesSnapshot = getFirebaseServicesDiagnosticsSnapshot();
    const runtimeConfig = await resolveFirestoreRuntimeConfig({
      allowStale: true,
    });

    const authenticated = hasAuthenticatedUser();
    const authGateSatisfied = isAuthGateSatisfied();
    const runtimeReady = isFirebaseServicesReady();

    const sharedCacheReadAllowed =
      runtimeReady &&
      authGateSatisfied &&
      FEATURES.productRepository.firestoreReadEnabled &&
      (!FEATURES.firebase.runtimeConfigRolloutEnabled ||
        runtimeConfig.allowSharedCacheReads);

    const sharedCacheWriteAllowed =
      runtimeReady &&
      authGateSatisfied &&
      FEATURES.productRepository.firestoreWriteEnabled &&
      (!FEATURES.firebase.runtimeConfigRolloutEnabled ||
        runtimeConfig.allowClientSharedCacheWrites);

    const analyticsWriteAllowed =
      runtimeReady &&
      authGateSatisfied &&
      FEATURES.ads.firestoreAnalyticsEnabled &&
      (!FEATURES.firebase.runtimeConfigRolloutEnabled ||
        runtimeConfig.allowClientAnalyticsWrites);

    const missingProductContributionWriteAllowed =
      runtimeReady &&
      authGateSatisfied &&
      FEATURES.missingProduct.firestoreContributionSyncEnabled &&
      (!FEATURES.firebase.runtimeConfigRolloutEnabled ||
        runtimeConfig.allowMissingProductContributionWrites);

    const adPolicyReadAllowed =
      runtimeReady &&
      authGateSatisfied &&
      FEATURES.ads.remotePolicyEnabled &&
      (!FEATURES.firebase.runtimeConfigRolloutEnabled ||
        runtimeConfig.allowAdPolicyReads);

    return {
      fetchedAt: new Date().toISOString(),
      runtimeReady,
      runtimeSource: servicesSnapshot.source,
      runtimeEffectiveSource: servicesSnapshot.effectiveSource,
      projectId: servicesSnapshot.projectId,
      isAuthenticated: authenticated,
      authUid: auth.currentUser?.uid ?? null,
      firestoreRuntimeConfigSource: runtimeConfig.source,
      firestoreRuntimeConfigVersion: runtimeConfig.version,
      sharedCacheReadAllowed,
      sharedCacheWriteAllowed,
      analyticsWriteAllowed,
      missingProductContributionWriteAllowed,
      adPolicyReadAllowed,
    };
  };

export const canReadSharedProductCache = async (): Promise<boolean> => {
  const snapshot = await getFirebaseAccessSnapshot();
  return snapshot.sharedCacheReadAllowed;
};

export const canWriteSharedProductCache = async (): Promise<boolean> => {
  const snapshot = await getFirebaseAccessSnapshot();
  return snapshot.sharedCacheWriteAllowed;
};

export const canWriteAnalyticsEvents = async (): Promise<boolean> => {
  const snapshot = await getFirebaseAccessSnapshot();
  return snapshot.analyticsWriteAllowed;
};

export const canReadAdRuntimeConfig = async (): Promise<boolean> => {
  const snapshot = await getFirebaseAccessSnapshot();
  return snapshot.adPolicyReadAllowed;
};
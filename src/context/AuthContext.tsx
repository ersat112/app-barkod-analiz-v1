import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';

import { auth } from '../config/firebase';
import {
  ensureUserProfileDocument,
  refreshCurrentUserProfile,
  updateCurrentUserFamilyHealthProfile,
  updateCurrentUserLocationContext,
  updateCurrentUserNutritionPreferences,
} from '../services/userProfile.service';
import { syncPurchaseProviderIdentity } from '../services/purchaseProvider.service';
import { DEFAULT_FAMILY_HEALTH_PROFILE } from '../services/familyHealthProfile.service';
import { getCurrentLocationContext } from '../services/locationPermission.service';
import { DEFAULT_NUTRITION_PREFERENCES } from '../services/nutritionPreferences.service';
import { usePreferenceStore } from '../store/usePreferenceStore';
import type { AppUserProfile } from '../types/userProfile';

type AuthContextValue = {
  user: User | null;
  profile: AppUserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'auth_profile_sync_failed';
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [loading, setLoading] = useState(Boolean(auth.currentUser));
  const [profileError, setProfileError] = useState<string | null>(null);
  const nutritionPreferences = usePreferenceStore((state) => state.nutritionPreferences);
  const familyHealthProfile = usePreferenceStore((state) => state.familyHealthProfile);
  const setNutritionPreferences = usePreferenceStore((state) => state.setNutritionPreferences);
  const setFamilyHealthProfile = usePreferenceStore((state) => state.setFamilyHealthProfile);
  const locationPermissionPrompted = usePreferenceStore(
    (state) => state.locationPermissionPrompted
  );
  const locationPermissionGranted = usePreferenceStore(
    (state) => state.locationPermissionGranted
  );
  const setLocationPermissionPrompted = usePreferenceStore(
    (state) => state.setLocationPermissionPrompted
  );
  const setLocationPermissionGranted = usePreferenceStore(
    (state) => state.setLocationPermissionGranted
  );

  const isMountedRef = useRef(true);
  const syncSequenceRef = useRef(0);
  const preloadedUserUidRef = useRef<string | null>(auth.currentUser?.uid ?? null);
  const lastSyncedNutritionPreferencesRef = useRef<string>('');
  const lastSyncedFamilyHealthProfileRef = useRef<string>('');

  const syncProfileForUser = useCallback(
    async (nextUser: User, options?: { trackLogin?: boolean }) => {
      const syncId = ++syncSequenceRef.current;

      try {
        await syncPurchaseProviderIdentity(nextUser.uid);

        const nextProfile = await ensureUserProfileDocument(nextUser, {
          trackLogin: Boolean(options?.trackLogin),
        });

        if (!isMountedRef.current || syncId !== syncSequenceRef.current) {
          return;
        }

        setProfile(nextProfile);
        setProfileError(null);

        if (nextProfile.nutritionPreferences) {
          setNutritionPreferences(nextProfile.nutritionPreferences);
          lastSyncedNutritionPreferencesRef.current = JSON.stringify(
            nextProfile.nutritionPreferences
          );
        } else {
          lastSyncedNutritionPreferencesRef.current = JSON.stringify(
            DEFAULT_NUTRITION_PREFERENCES
          );
        }

        if (nextProfile.familyHealthProfile) {
          setFamilyHealthProfile(nextProfile.familyHealthProfile);
          lastSyncedFamilyHealthProfileRef.current = JSON.stringify(
            nextProfile.familyHealthProfile
          );
        } else {
          lastSyncedFamilyHealthProfileRef.current = JSON.stringify(
            DEFAULT_FAMILY_HEALTH_PROFILE
          );
        }

        if (typeof nextProfile.locationContext?.permissionPrompted === 'boolean') {
          setLocationPermissionPrompted(nextProfile.locationContext.permissionPrompted);
        }

        if (typeof nextProfile.locationContext?.permissionGranted === 'boolean') {
          setLocationPermissionGranted(nextProfile.locationContext.permissionGranted);
        }
      } catch (error) {
        console.error('[AuthContext] profile reconcile failed:', error);

        if (!isMountedRef.current || syncId !== syncSequenceRef.current) {
          return;
        }

        setProfileError(toErrorMessage(error));
      } finally {
        if (!isMountedRef.current || syncId !== syncSequenceRef.current) {
          return;
        }

        setLoading(false);
      }
    },
    [
      setFamilyHealthProfile,
      setLocationPermissionGranted,
      setLocationPermissionPrompted,
      setNutritionPreferences,
    ]
  );

  const refreshProfile = useCallback(async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setProfile(null);
      setProfileError(null);
      return;
    }

    try {
      const nextProfile = await refreshCurrentUserProfile();

      if (!isMountedRef.current) {
        return;
      }

      setProfile(nextProfile);
      setProfileError(null);
    } catch (error) {
      console.error('[AuthContext] refreshProfile failed:', error);

      if (!isMountedRef.current) {
        return;
      }

      setProfileError(toErrorMessage(error));
    } finally {
      if (!isMountedRef.current) {
        return;
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    const initialUser = auth.currentUser;

    if (initialUser?.uid) {
      setUser(initialUser);
      setLoading(true);
      void syncProfileForUser(initialUser, { trackLogin: false });
    } else {
      setLoading(false);
    }

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        syncSequenceRef.current += 1;
        preloadedUserUidRef.current = null;
        void syncPurchaseProviderIdentity(null);
        setProfile(null);
        setProfileError(null);
        setLoading(false);
        return;
      }

       if (preloadedUserUidRef.current === nextUser.uid) {
        preloadedUserUidRef.current = null;
        return;
      }

      setLoading(true);
      void syncProfileForUser(nextUser, { trackLogin: true });
    });

    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, [syncProfileForUser]);

  useEffect(() => {
    const currentUser = auth.currentUser;

    if (!currentUser?.uid) {
      return;
    }

    const serializedPreferences = JSON.stringify(nutritionPreferences);

    if (serializedPreferences === lastSyncedNutritionPreferencesRef.current) {
      return;
    }

    if (
      !profile?.nutritionPreferences &&
      serializedPreferences === JSON.stringify(DEFAULT_NUTRITION_PREFERENCES)
    ) {
      return;
    }

    let cancelled = false;

    const syncNutritionPreferences = async () => {
      try {
        const nextProfile = await updateCurrentUserNutritionPreferences(nutritionPreferences);

        if (cancelled) {
          return;
        }

        lastSyncedNutritionPreferencesRef.current = serializedPreferences;

        if (nextProfile) {
          setProfile((current) => ({
            ...(current ?? {}),
            ...nextProfile,
          }));
        }
      } catch (error) {
        console.error('[AuthContext] nutrition preference sync failed:', error);
      }
    };

    void syncNutritionPreferences();

    return () => {
      cancelled = true;
    };
  }, [nutritionPreferences, profile?.nutritionPreferences]);

  useEffect(() => {
    const currentUser = auth.currentUser;

    if (!currentUser?.uid) {
      return;
    }

    const serializedFamilyHealthProfile = JSON.stringify(familyHealthProfile);

    if (serializedFamilyHealthProfile === lastSyncedFamilyHealthProfileRef.current) {
      return;
    }

    if (
      !profile?.familyHealthProfile &&
      serializedFamilyHealthProfile === JSON.stringify(DEFAULT_FAMILY_HEALTH_PROFILE)
    ) {
      return;
    }

    let cancelled = false;

    const syncFamilyProfile = async () => {
      try {
        const nextProfile = await updateCurrentUserFamilyHealthProfile(familyHealthProfile);

        if (cancelled) {
          return;
        }

        lastSyncedFamilyHealthProfileRef.current = serializedFamilyHealthProfile;

        if (nextProfile) {
          setProfile((current) => ({
            ...(current ?? {}),
            ...nextProfile,
          }));
        }
      } catch (error) {
        console.error('[AuthContext] family health profile sync failed:', error);
      }
    };

    void syncFamilyProfile();

    return () => {
      cancelled = true;
    };
  }, [familyHealthProfile, profile?.familyHealthProfile]);

  useEffect(() => {
    const currentUser = auth.currentUser;

    if (!currentUser?.uid || !locationPermissionPrompted) {
      return;
    }

    const permissionAlreadySynced =
      profile?.locationContext?.permissionPrompted === true &&
      profile?.locationContext?.permissionGranted === locationPermissionGranted;
    const hasResolvedLocation =
      !locationPermissionGranted ||
      Boolean(
        profile?.locationContext?.city ||
          profile?.locationContext?.district ||
          profile?.city ||
          profile?.district
      );

    if (permissionAlreadySynced && hasResolvedLocation) {
      return;
    }

    let cancelled = false;

    const syncLocationSnapshot = async () => {
      try {
        const currentLocation = locationPermissionGranted
          ? await getCurrentLocationContext()
          : null;

        const nextProfile = await updateCurrentUserLocationContext({
          permissionPrompted: true,
          permissionGranted: locationPermissionGranted,
          latitude: currentLocation?.latitude,
          longitude: currentLocation?.longitude,
          city: currentLocation?.city ?? profile?.city,
          district: currentLocation?.district ?? profile?.district,
          capturedAt: currentLocation ? new Date().toISOString() : undefined,
          source: 'device',
        });

        if (cancelled || !nextProfile) {
          return;
        }

        setProfile((current) => ({
          ...(current ?? {}),
          ...nextProfile,
        }));
      } catch (error) {
        console.error('[AuthContext] location snapshot sync failed:', error);
      }
    };

    void syncLocationSnapshot();

    return () => {
      cancelled = true;
    };
  }, [
    locationPermissionGranted,
    locationPermissionPrompted,
    profile?.city,
    profile?.district,
    profile?.locationContext?.city,
    profile?.locationContext?.district,
    profile?.locationContext?.permissionGranted,
    profile?.locationContext?.permissionPrompted,
  ]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      isAuthenticated: !!user,
      profileError,
      refreshProfile,
    }),
    [loading, profile, profileError, refreshProfile, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
};

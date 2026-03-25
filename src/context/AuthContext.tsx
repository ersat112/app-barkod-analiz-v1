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
} from '../services/userProfile.service';
import { syncPurchaseProviderIdentity } from '../services/purchaseProvider.service';
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

  const isMountedRef = useRef(true);
  const syncSequenceRef = useRef(0);
  const preloadedUserUidRef = useRef<string | null>(auth.currentUser?.uid ?? null);

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
    []
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

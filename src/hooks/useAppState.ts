import { useEffect, useMemo, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * ErEnesAl® v1 - Uygulama Yaşam Döngüsü Hook'u
 * Uygulamanın foreground / background / inactive durumunu takip eder.
 */

export type AppStateValue = AppStateStatus | 'unknown';

export type UseAppStateResult = {
  appState: AppStateValue;
  isActive: boolean;
  isBackground: boolean;
  isInactive: boolean;
};

export const useAppState = (): UseAppStateResult => {
  const initialState = AppState.currentState ?? 'unknown';
  const [appState, setAppState] = useState<AppStateValue>(initialState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      setAppState(nextAppState ?? 'unknown');
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return useMemo(
    () => ({
      appState,
      isActive: appState === 'active',
      isBackground: appState === 'background',
      isInactive: appState === 'inactive',
    }),
    [appState]
  );
};
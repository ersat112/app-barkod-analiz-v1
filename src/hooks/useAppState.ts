import { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

/**
 * ErEnesAl® v1 - Sistem Durum Takip Hook'u
 * Uygulamanın aktif mi yoksa arka planda mı olduğunu izler.
 */
export const useAppState = () => {
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      setAppState(nextAppState);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return appState;
};
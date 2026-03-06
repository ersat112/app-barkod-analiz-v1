import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * ErEnesAl® v1 - Kullanıcı Tercihleri Mağazası
 * Tema ve Dil ayarlarını kalıcı (Persistent) olarak saklar.
 */

interface PreferenceState {
  isDarkMode: boolean;
  language: string;
  isFirstLaunch: boolean;
  toggleTheme: () => void;
  setLanguage: (lang: string) => void;
  completeOnboarding: () => void;
}

export const usePreferenceStore = create<PreferenceState>()(
  persist(
    (set) => ({
      isDarkMode: true, // Varsayılan karanlık mod
      language: 'tr',
      isFirstLaunch: true,

      toggleTheme: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
      
      setLanguage: (lang) => set({ language: lang }),
      
      completeOnboarding: () => set({ isFirstLaunch: false }),
    }),
    {
      name: 'erenesal-preferences',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
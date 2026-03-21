import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppLanguage = 'tr' | 'en' | 'de' | 'fr';

type PreferenceState = {
  isDarkMode: boolean;
  language: AppLanguage;
  isFirstLaunch: boolean;
};

type PreferenceActions = {
  toggleTheme: () => void;
  setTheme: (value: boolean) => void;
  setLanguage: (lang: AppLanguage) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  setFirstLaunch: (value: boolean) => void;
  resetPreferences: () => void;
};

export type PreferenceStore = PreferenceState & PreferenceActions;

const DEFAULT_PREFERENCES: PreferenceState = {
  isDarkMode: true,
  language: 'tr',
  isFirstLaunch: true,
};

export const usePreferenceStore = create<PreferenceStore>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFERENCES,

      toggleTheme: () =>
        set((state) => ({
          isDarkMode: !state.isDarkMode,
        })),

      setTheme: (value) =>
        set({
          isDarkMode: value,
        }),

      setLanguage: (lang) =>
        set({
          language: lang,
        }),

      completeOnboarding: () =>
        set({
          isFirstLaunch: false,
        }),

      resetOnboarding: () =>
        set({
          isFirstLaunch: true,
        }),

      setFirstLaunch: (value) =>
        set({
          isFirstLaunch: value,
        }),

      resetPreferences: () =>
        set({
          ...DEFAULT_PREFERENCES,
        }),
    }),
    {
      name: 'erenesal-preferences',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isDarkMode: state.isDarkMode,
        language: state.language,
        isFirstLaunch: state.isFirstLaunch,
      }),
    }
  )
);
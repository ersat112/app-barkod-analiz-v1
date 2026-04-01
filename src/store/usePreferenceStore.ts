import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_NUTRITION_PREFERENCES,
  type NutritionPreferenceKey,
  type NutritionPreferences,
} from '../services/nutritionPreferences.service';

export type AppLanguage = 'tr' | 'en' | 'de' | 'fr';

type PreferenceState = {
  isDarkMode: boolean;
  language: AppLanguage;
  isFirstLaunch: boolean;
  notificationsEnabled: boolean;
  locationPermissionPrompted: boolean;
  locationPermissionGranted: boolean;
  nutritionPreferences: NutritionPreferences;
};

type PreferenceActions = {
  toggleTheme: () => void;
  setTheme: (value: boolean) => void;
  setLanguage: (lang: AppLanguage) => void;
  setNotificationsEnabled: (value: boolean) => void;
  setLocationPermissionPrompted: (value: boolean) => void;
  setLocationPermissionGranted: (value: boolean) => void;
  setNutritionPreference: (key: NutritionPreferenceKey, value: boolean) => void;
  setNutritionPreferences: (value: NutritionPreferences) => void;
  resetNutritionPreferences: () => void;
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
  notificationsEnabled: true,
  locationPermissionPrompted: false,
  locationPermissionGranted: false,
  nutritionPreferences: DEFAULT_NUTRITION_PREFERENCES,
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

      setNotificationsEnabled: (value) =>
        set({
          notificationsEnabled: value,
        }),

      setLocationPermissionPrompted: (value) =>
        set({
          locationPermissionPrompted: value,
        }),

      setLocationPermissionGranted: (value) =>
        set({
          locationPermissionGranted: value,
        }),

      setNutritionPreference: (key, value) =>
        set((state) => ({
          nutritionPreferences: {
            ...state.nutritionPreferences,
            [key]: value,
          },
        })),

      setNutritionPreferences: (value) =>
        set({
          nutritionPreferences: {
            ...DEFAULT_NUTRITION_PREFERENCES,
            ...value,
          },
        }),

      resetNutritionPreferences: () =>
        set({
          nutritionPreferences: DEFAULT_NUTRITION_PREFERENCES,
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
        notificationsEnabled: state.notificationsEnabled,
        locationPermissionPrompted: state.locationPermissionPrompted,
        locationPermissionGranted: state.locationPermissionGranted,
        nutritionPreferences: state.nutritionPreferences,
      }),
    }
  )
);

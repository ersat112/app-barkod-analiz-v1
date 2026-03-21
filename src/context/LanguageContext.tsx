import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import { getLocales } from 'expo-localization';

import tr from '../assets/locales/tr/common.json';
import en from '../assets/locales/en/common.json';
import de from '../assets/locales/de/common.json';
import fr from '../assets/locales/fr/common.json';

const STORAGE_KEY = 'erenesal-language';
const SUPPORTED_LANGUAGES = ['tr', 'en', 'de', 'fr'] as const;

type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const resources = {
  tr: { translation: tr },
  en: { translation: en },
  de: { translation: de },
  fr: { translation: fr },
};

const getDeviceLanguage = (): SupportedLanguage => {
  try {
    const locale = getLocales()?.[0];
    const code = locale?.languageCode?.toLowerCase() as SupportedLanguage | undefined;

    if (code && SUPPORTED_LANGUAGES.includes(code)) {
      return code;
    }

    return 'tr';
  } catch {
    return 'tr';
  }
};

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: getDeviceLanguage(),
    fallbackLng: 'tr',
    compatibilityJSON: 'v4',
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
  });
}

type LanguageContextValue = {
  locale: SupportedLanguage;
  supportedLanguages: SupportedLanguage[];
  ready: boolean;
  changeLanguage: (lang: string) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

type LanguageProviderProps = {
  children: ReactNode;
};

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  useTranslation();

  const [locale, setLocale] = useState<SupportedLanguage>(
    (i18n.language as SupportedLanguage) || 'tr'
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadSavedLanguage = async () => {
      try {
        const savedLang = await AsyncStorage.getItem(STORAGE_KEY);
        const fallbackLang = getDeviceLanguage();

        const nextLang =
          savedLang && SUPPORTED_LANGUAGES.includes(savedLang as SupportedLanguage)
            ? (savedLang as SupportedLanguage)
            : fallbackLang;

        await i18n.changeLanguage(nextLang);

        if (!mounted) return;
        setLocale(nextLang);
      } catch (error) {
        console.error('Language load failed:', error);

        if (!mounted) return;
        setLocale('tr');
      } finally {
        if (mounted) {
          setReady(true);
        }
      }
    };

    loadSavedLanguage();

    return () => {
      mounted = false;
    };
  }, []);

  const changeLanguage = useCallback(async (lang: string) => {
    const normalized = String(lang || '').toLowerCase() as SupportedLanguage;

    if (!SUPPORTED_LANGUAGES.includes(normalized)) {
      console.warn('Unsupported language ignored:', lang);
      return;
    }

    try {
      await i18n.changeLanguage(normalized);
      setLocale(normalized);
      await AsyncStorage.setItem(STORAGE_KEY, normalized);
      console.log('Language changed:', normalized);
    } catch (error) {
      console.error('Language change failed:', error);
    }
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      supportedLanguages: [...SUPPORTED_LANGUAGES],
      ready,
      changeLanguage,
    }),
    [changeLanguage, locale, ready]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = (): LanguageContextValue => {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider.');
  }

  return context;
};
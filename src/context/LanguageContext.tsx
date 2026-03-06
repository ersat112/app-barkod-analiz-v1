import React, { createContext, useState, useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 📚 Dil dosyalarını içeri aktarıyoruz
import tr from '../assets/locales/tr/common.json';
import en from '../assets/locales/en/common.json';
import de from '../assets/locales/de/common.json';
import fr from '../assets/locales/fr/common.json';

const resources = {
  tr: { translation: tr },
  en: { translation: en },
  de: { translation: de },
  fr: { translation: fr },
};

// ⚙️ i18n Yapılandırması
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: Localization.getLocales()[0].languageCode || 'tr',
    fallbackLng: 'tr',
    interpolation: { escapeValue: false },
  });
}

/**
 * 🌍 Dil Bağlamı (Language Context)
 */
const LanguageContext = createContext<any>(null);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const { t } = useTranslation();
  const [locale, setLocale] = useState(i18n.language);

  // Uygulama açıldığında kaydedilen dili geri getir
  useEffect(() => {
    const loadSavedLanguage = async () => {
      const savedLang = await AsyncStorage.getItem('user-language');
      if (savedLang) {
        await i18n.changeLanguage(savedLang);
        setLocale(savedLang);
      }
    };
    loadSavedLanguage();
  }, []);

  const changeLanguage = async (lang: string) => {
    try {
      await i18n.changeLanguage(lang);
      setLocale(lang);
      await AsyncStorage.setItem('user-language', lang);
      console.log(`Dil "zınk" diye değişti: ${lang}`);
    } catch (error) {
      console.error("Dil değiştirme hatası:", error);
    }
  };

  return (
    <LanguageContext.Provider value={{ locale, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

/**
 * ⚓ useLanguage Hook'u
 * SettingScreen ve diğer ekranlarda dili yönetmek için bu dışa aktarılır.
 */
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage, bir LanguageProvider içinde kullanılmalıdır!');
  }
  return context;
};

// Not: HomeScreen bileşenini bu dosyada tutmak yerine kendi dosyasına taşıman en iyisidir,
// ancak mantık değişmesin dediğin için yapıya zarar vermeden context'i dışa aktardık.
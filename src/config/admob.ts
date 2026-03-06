import { Platform } from 'react-native';
import { TestIds, RequestOptions } from 'react-native-google-mobile-ads';

/**
 * ErEnesAl® v1 - Merkezi AdMob Konfigürasyonu
 * Bu dosya, uygulama genelindeki tüm reklam birimlerinin kimliklerini
 * ve global reklam istek ayarlarını yönetir.
 */

// 🛠️ Gerçek Reklam Birimi Kimlikleri (AdMob Panelinden Alınanlar)
// Yayın öncesi bu alanları kendi gerçek ID'lerinle doldurmalısın.
const REAL_AD_UNITS = {
  INTERSTITIAL: {
    android: 'ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx',
    ios: 'ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx',
  },
  BANNER: {
    android: 'ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx',
    ios: 'ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx',
  },
  REWARDED: {
    android: 'ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx',
    ios: 'ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx',
  },
};

/**
 * Ortama Duyarlı Reklam ID Seçici
 * __DEV__ (Geliştirme) modunda otomatik olarak Google'ın güvenli Test ID'lerini kullanır.
 */
export const AD_UNIT_ID = __DEV__
  ? {
      INTERSTITIAL: TestIds.INTERSTITIAL,
      BANNER: TestIds.BANNER,
      REWARDED: TestIds.REWARDED,
    }
  : {
      INTERSTITIAL: Platform.select({
        ios: REAL_AD_UNITS.INTERSTITIAL.ios,
        android: REAL_AD_UNITS.INTERSTITIAL.android,
      }) as string,
      BANNER: Platform.select({
        ios: REAL_AD_UNITS.BANNER.ios,
        android: REAL_AD_UNITS.BANNER.android,
      }) as string,
      REWARDED: Platform.select({
        ios: REAL_AD_UNITS.REWARDED.ios,
        android: REAL_AD_UNITS.REWARDED.android,
      }) as string,
    };

/**
 * Global Reklam İsteği Yapılandırması
 * Hedefleme ve içerik kısıtlamaları buradan merkezi olarak yönetilir.
 */
export const GLOBAL_AD_CONFIG: RequestOptions = {
  requestNonPersonalizedAdsOnly: true, // KVKK/GDPR uyumluluğu için kişiselleştirilmemiş reklamlar
  keywords: ['health', 'food analysis', 'nutrition', 'barcode scanner', 'wellness'], // RPM artırmak için anahtar kelimeler
};

/**
 * Uygulama Genelinde Kullanılacak Reklam Birimi İsimleri
 */
export enum AdUnitType {
  SCAN_INTERSTITIAL = 'SCAN_INTERSTITIAL',
  HISTORY_BANNER = 'HISTORY_BANNER',
}
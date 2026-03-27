# Google Sign-In Smoke Test

Bu not, production benzeri Android build uzerinde Google giris dogrulamasini hizli ve tutarli sekilde yapmak icin kullanilir.

## Build On Kosullari

1. Android package `com.ersat.erenesalv1` ile build alinmis olmali.
2. Firebase Android app kimligi ayni package ile kayitli olmali.
3. Firebase Google provider aktif olmali.
4. Firebase Android app icinde SHA-1 ve SHA-256 ekli olmali.
5. Build icinde su env degerleri bulunmali:
   - `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
   - `EXPO_PUBLIC_AUTH_EMAIL_CONTINUE_URL`

## Kritik Not

EAS cloud build, `EXPO_PUBLIC_*` degerlerini build paketine yuklenen `.env` dosyasindan veya EAS environment degiskenlerinden alir. Build kuyruga girmeden once `.env` dosyasinin EAS upload paketine dahil oldugundan emin olun.

## Test Adimlari

1. Play test kanalindan yeni Android build'i cihaza yukle.
2. Uygulamayi temiz acilisla baslat.
3. Login ekraninda `Google ile Giris` butonu pasif olmamali.
4. Google hesabini sec ve giris akisini tamamla.
5. Beklenen sonuc:
   - Ana ekrana donus
   - Kullanici oturumu acik
   - Profil verisinin yuklenmesi
6. Logout yap.
7. Google ile tekrar giris yap.
8. Beklenen sonuc:
   - Tekrar ana ekrana donus
   - Yeni profil reconcile hatasi olmamasi

## Kabul Kriterleri

Asagidaki hatalar gorulmemeli:

1. `auth/invalid-credential`
2. `google_sign_in_unavailable`
3. `google_provider_disabled`
4. `google_auth_missing`

## Firebase Kontrolu

Giris sonrasi kontrol et:

1. `users/{uid}` dokumani olusmus olmali.
2. `email`
3. `displayName`
4. `providerIds`
5. `lastLoginAt`
   alanlari beklenen bicimde dolu olmali.

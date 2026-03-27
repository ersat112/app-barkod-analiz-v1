# Production Release Gate

Bu not, uygulamayi kontrollu beta seviyesinden production guven kapisina tasimak icin takip edecegimiz sirali kontrol listesidir.

## P0.1 Security Hardening

Tamamlandi:

1. `shared_product_cache` Firestore write kurali tekrar payload dogrulamasi yapiyor.
2. Firebase Storage icin `storage.rules` eklendi.
3. Storage upload path'leri kullaniciya baglandi:
   - `users/{uid}/...`
   - `missing-products/{uid}/...`
   - `products/{uid}/...`

Deploy sonrasi kontrol:

1. Firestore rules deploy edildi mi?
2. Storage rules deploy edildi mi?
3. Eksik urun gorseli yukleme auth'lu kullanicida basarili mi?
4. Baska kullanicinin path'ine yazma denemesi reddediliyor mu?

## P0.2 Google Sign-In Production Checklist

Kod tarafi hazir; bu adim console ve release dogrulamasi gerektirir.

### Firebase Console

1. `Authentication > Sign-in method > Google` etkin olmalı.
2. Destek e-posta adresi doldurulmali.
3. `Authentication > Settings > Authorized domains` icinde e-posta dogrulama continue URL domain'i tanimli olmali.

### Firebase App Config

1. Android app package:
   - `com.ersat.erenesalv1`
2. Play App Signing SHA-1 ve SHA-256 Firebase Android uygulamasina eklenmeli.
3. Gerekirse debug SHA ayrica tanimli olmali.

### Env / Build

1. `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` dolu olmali.
2. Gerekirse `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` de dolu olmali.
3. `EXPO_PUBLIC_AUTH_EMAIL_CONTINUE_URL` production domaine baglanmali.
4. Closed test / internal test build yeniden alinmali.

### Device Test

1. Uygulamayi Play uzerinden yuklenmis kapali test build ile ac.
2. Login ekraninda Google butonu pasif olmamali.
3. Google login tamamlandiginda:
   - Firebase user olusmali
   - `users/{uid}` profili olusmali
   - uygulama ana ekrana donmeli
4. Logout > tekrar login akisi temiz calismali.

Beklenen hata yok:

1. `auth/invalid-credential`
2. `google_sign_in_unavailable`
3. `google_provider_disabled`

## P0.3 Monetization / RevenueCat Gate

1. RevenueCat offering icinde gercek store product bagli olmali.
2. Google Play closed test billing hazir olmali.
3. Native release/preview build uzerinde:
   - purchase
   - restore
   - foreground re-sync
   - mismatch warning
   test edilmeli.

Detayli akis icin:

1. `docs/revenuecat-smoke-test.md`
2. `docs/revenuecat-billing-smoke-test.md`

## P0.4 Release Quality Gate

Release almadan once minimum:

1. `npm run type-check`
2. `npm run lint`
3. `npm run doctor`
4. Google login smoke test
5. Scanner smoke test
6. Shared cache write/read smoke test
7. Missing product image upload smoke test
8. RevenueCat smoke test
9. AdMob closed-test smoke test

Detayli reklam akis notu:

1. `docs/admob-closed-test-smoke-test.md`

## P1 Soft Launch Hardening

1. Crash raporlama ekle.
2. Scanner latency, cache hit rate ve auth failure metriklerini ayir.
3. Missing product moderation akisina admin operasyon notu ekle.

## P2 Full Production Readiness

1. Kritik akislar icin otomatik test ekle.
2. Release rollback checklist'i hazirla.
3. Push / campaign segmentation ve retention deneylerini planla.

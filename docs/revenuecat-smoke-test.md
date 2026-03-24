# RevenueCat Smoke Test Prep

Bu not, yerelde yaptigimiz operability surface degisikliklerinden sonra gercek cihaz smoke testine cikmadan once bakilacak minimum blocker listesidir.

## Mevcut blockerlar

1. Kök dizinde gercek RevenueCat anahtarlari ile doldurulmus bir `.env` dosyasi yok.
2. Varsayilan local monetization policy icinde `purchaseProviderEnabled` kapali.
3. Gercek satin alma akisi Expo Go yerine native dev build veya release build gerektiriyor.

## Hazirlik

1. `.env.example` dosyasini baz alarak kökte bir `.env` olustur.
2. `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` ve `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` alanlarini gercek RevenueCat project anahtarlari ile doldur.
3. `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` ve `EXPO_PUBLIC_REVENUECAT_OFFERING_ID` degerlerini dashboard ile eslestir.
4. Test build icin gerekli monetization rolloutlarini `.env` icindeki `EXPO_PUBLIC_MONETIZATION_*` override alanlariyla ac.
5. Expo Go yerine native dev build olustur.

## Kisa smoke test akisi

1. Settings > Premium ekranini ac ve diagnostics kartinda `Smoke: READY` durumunu kontrol et.
2. Annual purchase dene; beklenen sonuc `purchased` veya `already_active`.
3. Paywall'daki son sonuc kartinda provider, status, customer ve tx alanlarini kontrol et.
4. Settings diagnostics icindeki `Recent purchase / restore logs` bölümünde result kaydinin dustugunu dogrula.
5. Ayni hesapla restore dene; beklenen sonuc `restored`.
6. Login/logout ve app foreground donusunden sonra identity mismatch olusmadigini kontrol et.

## Not

Gercek anahtarlar ve rollout karari projeye özel oldugu icin bunlari koddan otomatik acmadim. Hazir degerleri verdiginde bir sonraki turda test build'e uygun rollout ayarini birlikte acariz.

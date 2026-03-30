# Monetization And Ads Config Audit

Bu not, build oncesi BarkodAnaliz'in reklam ve premium runtime eslesmesini tek yerde gormek icin tutulur.

## RevenueCat Runtime

Kaynak:

- `.env`
- `src/config/revenueCatRuntime.ts`
- `src/config/features.ts`

Beklenen Android degerleri:

- Android SDK key: `goog_malGvXKNyoptxJzAJxCKktalchG`
- Entitlement identifier: `BarkodAnaliz Pro`
- Offering identifier: `premium_annual_39_99_try`
- Annual product id: `premium_annual_39_99_try:annual`

Kod davranisi:

- Native satin alma yalnizca native build / release build icin acik.
- Runtime hazir degilse eksik env anahtarlari acik mesajla doner.
- Purchase package secimi offering > annual package > urun kimligi zinciriyle yapilir.
- `premium_annual_39_99_try:annual` eslesmesi bulunamazsa hata mesaji daha acik raporlanir.

## AdMob Runtime

Kaynak:

- `src/config/adRuntime.ts`
- `src/services/adService.ts`
- `src/components/AdBanner.tsx`

Kodun su an kullandigi Android fallback unit id'ler:

- App ID: `ca-app-pub-9503865696579023~4685281890`
- Interstitial: `ca-app-pub-9503865696579023/2717914905`
- Banner: `ca-app-pub-9503865696579023/5814530735`
- Rewarded: `ca-app-pub-9503865696579023/7004190022`
- App Open: `ca-app-pub-9503865696579023/7491631372`

Not:

- `.env` icinde AdMob unit override anahtarlari su an tanimli degilse kod bu fallback degerleri kullanir.
- AdMob panelinde yeni unit olusturulduysa, build oncesi bu degerler `.env` ile override edilmeli veya kod fallback'leri guncellenmelidir.

## Placement Map

Su anki kod yerlesimleri:

- `App Open`
  - `App.tsx`
  - cold start akisinda bir kez denenir
- `Interstitial`
  - `src/screens/main/ScannerScreen.tsx`
  - scan cadence ve cooldown kurallarina bagli calisir
- `Rewarded / tam ekran`
  - `src/screens/main/DetailScreen.tsx`
  - scanner kaynakli detail acilisinda policy kapilari gecerliyse denenir
- `Banner`
  - `src/screens/main/HomeScreen.tsx`
  - `src/screens/main/HistoryScreen.tsx`
  - `src/screens/main/DetailScreen.tsx`
  - `src/screens/main/SettingsScreen.tsx`
  - `src/screens/main/MissingProductScreen.tsx`

## Build Oncesi Son Kontrol

1. Yeni AdMob unit id'leri varsa `.env` veya kod eslesmesini guncelle.
2. RevenueCat dashboard'ta `BarkodAnaliz Pro` entitlement ve `premium_annual_39_99_try` offering bagini tekrar teyit et.
3. Closed test kullanicisinda Google Play test hesabinin aktif oldugunu kontrol et.
4. Build sonrasi:
   - Google login
   - premium purchase / restore
   - banner / interstitial / rewarded / app-open
   birlikte smoke test edilmelidir.

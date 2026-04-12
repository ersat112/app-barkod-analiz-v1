# Android Update Readiness Report

Tarih: 2026-04-04
Branch: `codex/turkiye-legal-hardening`

Bu rapor, Android AAB olusturma ve canli baglanti hazirligini tek yerde ozetler.

## Uretilen Artifact

- AAB yolu: `android/app/build/outputs/bundle/release/app-release.aab`
- Son dogrulanan SHA-256:
  - `8b3a2662366f89035ee07cd743668113cc48087831ce411aa3c797513ab602ec`

## Kod ve Build Durumu

- `npm run type-check`: gecti
- `npm run lint`: gecti
- `npm run bundle:android:release`: gecti

## Android Tarafinda Hazir Olan Canli Hatlar

### Firebase

- Firestore runtime config okumalari calisiyor
- `runtime_config` rollout modeli aktif
- market fiyat runtime'i remote config veya env ile acilabiliyor

### Google Sign-In

- Android package: `com.ersat.erenesalv1`
- `google-services.json` icinde bu package icin ayri Android app kaydi var
- Android Google client zinciri mevcut

### RevenueCat

- Android API key env'de var
- entitlement env'de var
- offering env'de var
- Android runtime seviyesi hazir

### Market Gelsin

- lokal API health kontrolu gecti
- mobil runtime zinciri aktif:
  - `env`
  - `Firestore runtime_config`
  - `cache`
  - emulator fallback

### Acik Veri ve Resmi Kaynaklar

- Open Food Facts erisilebilir
- TITCK erisilebilir

## Kodla Kapatilan Kritik Eksikler

### 1. Android release signing artik profesyonel sekilde konfigure edilebiliyor

`android/app/build.gradle` artik su secret/env/property degerlerini okuyabiliyor:

- `BARKODANALIZ_UPLOAD_STORE_FILE`
- `BARKODANALIZ_UPLOAD_STORE_PASSWORD`
- `BARKODANALIZ_UPLOAD_KEY_ALIAS`
- `BARKODANALIZ_UPLOAD_KEY_PASSWORD`

Bu sayede ayni kod tabaniyla:

- lokal debug-fallback bundle
- veya gercek Play upload keystore ile release bundle

uretilebilir.

### 2. Market Gelsin release runtime hattı hazir

Release'te market fiyatini acmak icin iki yol artik net:

1. build env ile `EXPO_PUBLIC_MARKET_GELSIN_RPC_BASE_URL` + tercihen `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   backward-compatible olarak `EXPO_PUBLIC_SUPABASE_ANON_KEY` da calisir
2. Firestore `runtime_config/market_gelsin_runtime`

### 3. Android release AAB fiziksel olarak uretildi

Build pipeline sadece teorik degil, yerelde dogrulanmis durumda.

## Bugun Hala Dis Girdi Bekleyen Konular

Bu maddeler kod degisikligiyle degil, gercek credential veya production degerle kapanir.

### 1. Play'e update atilacak bundle icin upload keystore gerekli

Bugunku lokal AAB, upload secret verilmedigi icin `debug.keystore` fallback'i ile uretildi.

Bu su anlama gelir:

- lokal dogrulama icin bundle var
- ama Play Console'a update atilacak son bundle icin gercek upload key verilmelidir

### 2. Market Gelsin production base URL repo icinde yok

Kod hazir, runtime hazir; ancak repo icinde public HTTPS production base URL yok.

Bu olmadan:

- lokal / emulator calisir
- ama release'in dis dunya market fiyatlari icin net production ucu tanimlanmis sayilmaz

### 3. iOS RevenueCat eksik

- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` su an bos

Bu Android AAB'i engellemez, ama tum platformlarda tam monetization hazirligi tamam degildir.

### 4. iOS Firebase / Google bundle hizasi sorunlu

Repo icinde:

- iOS Xcode target bundle id: `com.ersat.erenesalv1`
- `GoogleService-Info.plist` icindeki `BUNDLE_ID`: `com.ersat.barkodanaliz`

Bu Android AAB'i engellemez, ama iOS Google/Firebase tarafini tam saglikli saydirmiyor.

## Android Update Icin Son Gerekenler

Asagidaki 2 madde kapaninca Android update gercek anlamda hazir sayilir:

1. upload signing secret'lari tanimlanacak
2. production `market_gelsin` HTTPS base URL runtime'a yazilacak

## Onerilen Son Komutlar

### Upload signing ile AAB

Ornek:

- `BARKODANALIZ_UPLOAD_STORE_FILE=/abs/path/upload-keystore.jks`
- `BARKODANALIZ_UPLOAD_STORE_PASSWORD=...`
- `BARKODANALIZ_UPLOAD_KEY_ALIAS=...`
- `BARKODANALIZ_UPLOAD_KEY_PASSWORD=...`
- `npm run bundle:android:release`

### Market Gelsin production runtime seed

- `npm run market-gelsin:seed-runtime -- --base-url https://YOUR-PRODUCTION-HOST --enabled true`

## Net Hukum

Kod tabani Android AAB uretecek ve update'e hazirlanacak seviyeye geldi.

Ancak bugun itibariyla gercek production update oncesi disaridan verilmesi gereken iki kritik operasyon girdisi kalmistir:

- Play upload keystore
- Market Gelsin production HTTPS URL

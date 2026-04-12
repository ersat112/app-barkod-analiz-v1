# Release Readiness Brief

Bu dokuman, `codex/turkiye-legal-hardening` branch'i icin kisa PR ozeti ve build oncesi son kontrol listesini tek yerde toplar.

## PR Ozeti

Bu branch BarkodAnaliz'i soft launch oncesi daha guvenli ve daha acik bir urun haline getiren uc ana paketi birlestirir:

1. Turkiye odakli hukuk ve guven katmani
   - Uygulama ici yasal belgeler eklendi
   - Web'de yayinlanan hukuk sayfalari Turkiye mevzuati cercevesine gore duzenlendi
   - Kullanici hangi belge surumunu kabul ettigini profile yazan versiyonlu kabul sistemi eklendi

2. Urun metodolojisi ve kisisellestirme
   - Gida skorunda besinsel kalite, NOVA ve katki riski kirilimi gorunur hale getirildi
   - "Bu puan nasil olustu?" ve "Bilimsel Dayanak" yuzeyleri eklendi
   - Beslenme tercihleri ekrani ve profile senkronu eklendi
   - Dusuk skorlu urunlerde alternatif urun onerileri icin altyapi kuruldu
   - Ilaclarda prospektus/PDF tabanli "ne icin kullanilir" ozeti icin enrichment katmani eklendi

3. Monetization ve reklam runtime sertlestirmesi
   - RevenueCat runtime ve urun kimligi eslesmesi sertlestirildi
   - Annual product id `premium_annual_39_99_try:annual` olacak sekilde netlestirildi
   - Reklam unit map'i ve placement'lar dokumante edildi
   - Build oncesi env ornekleri gercek runtime beklentileriyle hizalandi

## Branch Ve Commitler

- Branch: `codex/turkiye-legal-hardening`
- `eafce7e` Add Turkey-aligned legal surfaces and acceptance tracking
- `13074fe` Ship methodology, preferences, and monetization hardening
- `dbebb38` Document ads and billing runtime mapping

## Build Oncesi Son Checklist

### 1. Kimlik ve Auth

- Android package `com.ersat.erenesalv1` olmali
- Firebase Android app bu package ile eslesmeli
- `google-services.json` guncel olmali
- Google Sign-In client id'leri son config ile uyumlu olmali
- iOS icin ek not:
  - `GoogleService-Info.plist` ile iOS bundle kimligi ayni olmali
  - bugunku repo durumunda iOS bundle hizasi ayrica teyit edilmelidir

### 2. RevenueCat

- Android SDK key dogru olmali
- Entitlement: `BarkodAnaliz Pro`
- Offering: `premium_annual_39_99_try`
- Annual product: `premium_annual_39_99_try:annual`
- Google Play closed test kullanicisi ve license testing hesabi teyit edilmeli

### 3. AdMob

- Unit id'ler dogru ve kodla eslesmis olmali
- Placement map teyit edilmeli:
  - App Open: cold start
  - Interstitial: scanner akisi
  - Rewarded / tam ekran: detail akisi
  - Banner: home, history, detail, settings, missing product
- `app-ads.txt` canli olmali

### 3.5. market_gelsin Runtime

- Release build icin iki yoldan biri secilmeli:
  - `EXPO_PUBLIC_MARKET_GELSIN_RPC_BASE_URL` ve tercihen `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` env ile dogrudan verilmeli
  - backward-compatible olarak `EXPO_PUBLIC_SUPABASE_ANON_KEY` da kabul edilir
  - veya Firestore `runtime_config/market_gelsin_runtime` dokumani hazir olmali
- Runtime dokumani kullanilacaksa su alanlar teyit edilmeli:
  - `baseUrl`
  - `apiKey` veya `publishableKey`
  - backward-compatible olarak `anonKey`
  - `enabled`
  - opsiyonel `timeoutMs`
- Seed etmek icin:
  - `npm run market-gelsin:seed-runtime -- --base-url https://... --api-key ... --enabled true`
  - veya `.env` hazirsa `npm run market-gelsin:seed-runtime:from-env`
- Not:
  - script loopback URL'leri (`127.0.0.1`, `localhost`, `10.0.2.2`) varsayilan olarak release runtime'a yazmaz
  - uygulama artik otomatik local fallback kullanmaz
- Ayarlardaki `Market Fiyat Tanilama` kartinda su alanlar kontrol edilmeli:
  - `Runtime: ON`
  - `API: ON`
  - `Base URL` dolu
  - `Status error` ve `Integrations error` bos

### 3.6. Android Release Signing

- Lokal `bundleRelease` artik gizli env / gradle property ile profesyonel upload keystore destekler:
  - `BARKODANALIZ_UPLOAD_STORE_FILE`
  - `BARKODANALIZ_UPLOAD_STORE_PASSWORD`
  - `BARKODANALIZ_UPLOAD_KEY_ALIAS`
  - `BARKODANALIZ_UPLOAD_KEY_PASSWORD`
- Bu degerler yoksa Gradle bilerek `debug.keystore` fallback'i ile bundle uretebilir.
- Play'e update atilacak bundle icin fallback degil, yukaridaki upload key kullanilmalidir.
- Lokal komut:
  - `npm run bundle:android:release`

### 4. Hukuk ve Guven

- Web hukuk sayfalari canli olmali
- Uygulama ici yasal ekranlar acilabiliyor olmali
- Ayarlarda belge surumu ve onay durumu gorunmeli
- Signup akisi hukuk kabulunu profile yaziyor olmali

### 5. Veri ve Firebase

- `users/{uid}` profile olusumu dogrulanmali
- `users/{uid}/scan_history` dogrulanmali
- `shared_product_cache/{barcode}` yazilari dogrulanmali
- `missing_product_contributions/*` yazilari dogrulanmali

### 6. UX ve Cihaz

- Alt navigator Android sistem tuslarina gomulmemeli
- Scanner kart acikken kamera pasif olmali
- Redmi 11 Pro dahil en az bir gercek cihazda pil farki yeniden gozlenmeli

## Build Sonrasi Smoke Test Sirasi

1. Google login
2. Premium satin alma
3. Restore
4. Banner / interstitial / rewarded / app-open
5. Firebase veri yazilari
6. Navigator ve scanner davranisi

## Basari Kriteri

Su maddeler ayni build'de temiz gecer ise branch soft launch adayi sayilabilir:

- Google login hatasiz tamamlanir
- Premium satin alma sheet'i acilir ve sonuc loglanir
- Restore sonucu anlamli doner
- Banner ve full-screen reklam akisi uygulamayi bozmaz
- Firebase profile / history / cache yazilari dogrulanir
- Navigator ve scanner davranisi cihazda temiz gorunur

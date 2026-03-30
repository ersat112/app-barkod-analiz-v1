# RevenueCat Billing Smoke Test

Bu not, Google login dogrulamasi temiz gectikten sonra production benzeri Android build uzerinde monetization kapisini kapatmak icin kullanilir.

## On Kosullar

1. Uygulama Play test kanalindan yuklenmis olmali.
2. RevenueCat dashboard icinde:
   - entitlement `BarkodAnaliz Pro` bagli olmali
   - offering `premium_annual_39_99_try` bagli olmali
   - annual package gercek store product `premium_annual_39_99_try:annual` ile eslesmis olmali
3. Google Play Console icinde ilgili subscription urunu aktif olmali.
4. Tester hesabi:
   - test kanalina dahil olmali
   - license testing / test kullanicisi olarak tanimli olmali
5. Uygulama icinde monetization rollout acik olmali:
   - `purchaseProviderEnabled`
   - `restoreEnabled`
   - `paywallEnabled`

## Ilk Kontrol

1. `Settings > Premium / Monetization` yuzeyini ac.
2. Su alanlari kontrol et:
   - provider runtime hazir
   - purchase provider enabled = acik
   - identity mismatch = yok
   - smoke status = ready ya da blocker listesi anlamli
3. `Recent purchase / restore logs` bolumu gorunuyor olmali.

## Satin Alma Akisi

1. `Premium Yillik Plan` ekranini ac.
2. Satin alma butonuna bas.
3. Beklenen sonuc:
   - Google Play satin alma sayfasi acilir
   - kullanici iptal ederse `cancelled`
   - satin alma tamamlanirsa `purchased` ya da `already_active`
4. Paywall ekranindaki son sonuc kartini kontrol et:
   - provider = `revenuecat`
   - status beklenen degerde
   - customer id gorunuyor
   - gerekiyorsa tx bilgisi gorunuyor

## Restore Akisi

1. Ayni hesapla `Satin Alimi Geri Yukle` aksiyonunu calistir.
2. Beklenen sonuc:
   - `restored`
   - ya da aktif satin alma yoksa `no_active_purchase`

## Identity Kontrolu

1. Login ol.
2. Logout yap.
3. Tekrar login ol.
4. Uygulamayi arka plana alip geri ac.
5. Beklenen sonuc:
   - identity mismatch warning cikmamali
   - foreground re-sync sonrasi provider customer id dogru kullaniciya bagli kalmali

## Hata Kodlari ve Yorumu

1. `ConfigurationError`
   - RevenueCat offering/package/product eslesmesi eksik
   - ozellikle `BarkodAnaliz Pro` entitlement veya `premium_annual_39_99_try:annual` package baglantisi kontrol edilmeli
2. `PurchaseNotAllowedError`
   - cihaz ya da build Google Play Billing icin uygun degil
3. `identityMismatchWarning`
   - auth uid ile provider identity senkronu bozulmus

## Kabul Kriterleri

1. Satin alma sheet aciliyor olmali.
2. Purchase sonucu loga dusmeli.
3. Restore sonucu loga dusmeli.
4. Identity mismatch olusmamali.
5. Premium durum refresh sonrasi korunmali.

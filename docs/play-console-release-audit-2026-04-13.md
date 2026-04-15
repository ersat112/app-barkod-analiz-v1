# Play Console Release Audit

Tarih: 2026-04-13

Bu not, BarkodAnaliz Android production yayini oncesi Play Console tarafinda
son kez kontrol edilmesi gereken alanlari repo ve runtime uzerinden toplar.

## 1. Android Izinleri

Repo ve native manifestte gorulen izinler:

- `android.permission.CAMERA`
- `android.permission.ACCESS_COARSE_LOCATION`
- `android.permission.ACCESS_FINE_LOCATION`
- `android.permission.INTERNET`
- `com.android.vending.BILLING`
- `android.permission.VIBRATE`
- `android.permission.READ_EXTERNAL_STORAGE` (`maxSdkVersion=32`)
- `android.permission.WRITE_EXTERNAL_STORAGE` (`maxSdkVersion=32`)
- `POST_NOTIFICATIONS` app config tarafinda tanimli

Yorum:

- `CAMERA`: barkod tarama ve eksik urun fotografi cekimi icin gerekli
- `ACCESS_COARSE_LOCATION` / `ACCESS_FINE_LOCATION`: market fiyat
  karsilastirmasi ve sehir / ilce baglami icin gerekli
- `BILLING`: premium satin alma icin gerekli
- `POST_NOTIFICATIONS`: akilli bildirimler icin gerekli
- `READ/WRITE_EXTERNAL_STORAGE` sadece eski Android surumleri icin image
  picker uyumlulugundan geliyor
- `RECORD_AUDIO` ve `SYSTEM_ALERT_WINDOW` kaldirildi

## 2. Canli Hukuki ve Reklam Yuzeyleri

Canli ve `200` donen URL'ler:

- Privacy policy:
  [https://barkodanaliz-5ed4b.web.app/legal/privacy.html](https://barkodanaliz-5ed4b.web.app/legal/privacy.html)
- Terms:
  [https://barkodanaliz-5ed4b.web.app/legal/terms.html](https://barkodanaliz-5ed4b.web.app/legal/terms.html)
- Medical disclaimer:
  [https://barkodanaliz-5ed4b.web.app/legal/medical.html](https://barkodanaliz-5ed4b.web.app/legal/medical.html)
- Premium terms:
  [https://barkodanaliz-5ed4b.web.app/legal/premium.html](https://barkodanaliz-5ed4b.web.app/legal/premium.html)
- Independence policy:
  [https://barkodanaliz-5ed4b.web.app/legal/independence.html](https://barkodanaliz-5ed4b.web.app/legal/independence.html)
- `app-ads.txt`:
  [https://barkodanaliz-5ed4b.web.app/app-ads.txt](https://barkodanaliz-5ed4b.web.app/app-ads.txt)

Destek kanali:

- `destekerenesal@gmail.com`

## 3. Data Safety Icin Repo Tabanli Okuma

Bu bolum hukuki tavsiye degildir; uygulama kodunda gorulen akislarin release
oncesi operasyonel ozetidir.

### 3.1 Toplanan veri siniflari

Kodda gorulen veri kategorileri:

- Hesap bilgileri
  - e-posta
  - ad / soyad / gorunen ad
  - telefon ve adres alanlari profil yapisinda mevcut
- Precise / approximate location
  - `latitude` / `longitude`
  - `city` / `district`
- App activity
  - tarama gecmisi
  - barkod sorgulari
  - urun detay goruntuleme
  - fiyat karsilastirma ve reklam analitik olaylari
- Photos
  - eksik urun bildirimi sirasinda kullanici secimiyle foto
- User content
  - missing product contribution taslaklari ve senkron kayitlari
- Device or other identifiers
  - Firebase auth uid
  - local analytics `installationId`
  - AdMob tarafinda Google reklam tanimlayicisi ihtimali
- Purchases
  - premium entitlement / subscription projection verisi

### 3.2 Toplanma / kullanilma amaci

Repoya gore ana amaclar:

- uygulama islevselligi
- hesap yonetimi ve kimlik dogrulama
- fiyat ve market karsilastirmasi
- premium / abonelik yonetimi
- eksik urun katkisi
- reklam uygunlugu ve monetization policy uygulamasi
- urun ve reklam analitikleri

### 3.3 Onemli notlar

- Konum verisi yalniz UI etiketi olarak kalmiyor; profile `latitude` /
  `longitude` yazilabiliyor. Bu nedenle Data Safety formunda konumu "hic
  toplamiyoruz" seklinde isaretlemek guvenli degil.
- Bildirimler local scheduling ile calisiyor. Repo icinde Expo push token alma
  akisi gorulmedi; yine de `expo-notifications` kullaniminin Play beyanlariyla
  son kez elle eslestirilmesi dogru olur.
- Reklam / SDK tarafinda Google Mobile Ads ve Firebase kullanimlari oldugu icin
  SDK kaynakli cihaz / reklam verisi toplama davranislari Play SDK
  dokumantasyonuyla birlikte son kez gozden gecirilmeli.
- Hesap silme icin acik uygulama ici self-service akisi repo icinde net
  gorunmedi; mevcut guvenli yorum "support channel ile talep" seviyesidir.

## 4. Magaza Metinleri

Ana Play Store listing paketi repo icinde ayrica hazirlandi:

- [`docs/play-store-listing-2026-04-13.md`](/Users/ersat/Desktop/app-barkod-analiz-v1/docs/play-store-listing-2026-04-13.md)

### 4.1 Kisa aciklama

`Barkod tara; skor, içerik ve market fiyatlarını tek ekranda gör.`

### 4.2 Tam aciklama

Tam aciklama ve Whats New metni listing paketinden kopyalanmalidir. Paket,
gida/kozmetik/ilac tarama, market fiyat tablosu, sepet karsilastirma,
favoriler, yardim merkezi ve tibbi uyari metnini birlikte icerir.

### 4.3 Destek bilgisi

- Destek e-postasi: `destekerenesal@gmail.com`
- Privacy policy URL:
  `https://barkodanaliz-5ed4b.web.app/legal/privacy.html`

## 5. Ekran Goruntuleri ve Listing Assetleri

Repo icinde bunlar bulundu:

- uygulama iconu:
  `/Users/ersat/Desktop/app-barkod-analiz-v1/assets/app-icon-barkodanaliz.png`
- splash ve nav icon assetleri

Play Store phone screenshot seti:

- [`assets/play-store/2026-04-13/01-scanner-gida-kozmetik.png`](/Users/ersat/Desktop/app-barkod-analiz-v1/assets/play-store/2026-04-13/01-scanner-gida-kozmetik.png)
- [`assets/play-store/2026-04-13/02-urun-detay-skor.png`](/Users/ersat/Desktop/app-barkod-analiz-v1/assets/play-store/2026-04-13/02-urun-detay-skor.png)
- [`assets/play-store/2026-04-13/03-fiyat-kategori-arama.png`](/Users/ersat/Desktop/app-barkod-analiz-v1/assets/play-store/2026-04-13/03-fiyat-kategori-arama.png)
- [`assets/play-store/2026-04-13/04-fiyat-sonuc-grid.png`](/Users/ersat/Desktop/app-barkod-analiz-v1/assets/play-store/2026-04-13/04-fiyat-sonuc-grid.png)
- [`assets/play-store/2026-04-13/05-sepet-market-karsilastirma.png`](/Users/ersat/Desktop/app-barkod-analiz-v1/assets/play-store/2026-04-13/05-sepet-market-karsilastirma.png)
- [`assets/play-store/2026-04-13/06-profil-ve-ayarlar.png`](/Users/ersat/Desktop/app-barkod-analiz-v1/assets/play-store/2026-04-13/06-profil-ve-ayarlar.png)

Yorum:

- Feature graphic / promo graphic repo icinde ayrica bulunmadi.
- Yayin oncesi Play Console icinde yuklu ekran goruntulerinin son kez manuel
  kontrol edilmesi gerekiyor.

## 6. EAS Build / Submit Durumu

Repo config:

- build profile: `production`
- Android build type: `app-bundle`
- submit profile `production`: `internal` track
- submit profile `productionStore`: `production` track

Onemli:

- `eas submit --profile production` su an `production` track'ine degil,
  `internal` track'ine gonderir.
- Production rollout icin `productionStore` profili kullanilmalidir.
- EAS `appVersionSource: remote` ve `autoIncrement: true` kullaniyor. Bu
  nedenle EAS production build tarafinda versionCode uzaktan yonetilir.
- Lokal `npm run bundle:android:release` kullanilirsa native
  `android/app/build.gradle` icindeki versionCode degeri dikkate alinir; bu
  yol Play'e yukleme icin kullanilacaksa versionCode ayrica artirilmalidir.

Bilinen son basarili production AAB:

- build id: `9bde42c0-128f-4091-89d3-c6ddfe5d3e0d`
- version: `1.0.1`
- versionCode: `8`
- tarih: `2026-04-04`

## 7. Release Karari Icin Son Manuel Kontrol

Play Console'da son kez elle bakilmasi gerekenler:

1. Data Safety cevaplari SDK davranislariyla uyumlu mu
2. Privacy policy URL dogru mu
3. Camera / location / notifications izin beyanlari store metniyle tutarli mi
4. Screenshot seti guncel UI'yi mi gosteriyor
5. Feature graphic var mi ve guncel marka dilini tasiyor mu
6. Production submit isteniyorsa track secimi `internal`da kalmadi mi

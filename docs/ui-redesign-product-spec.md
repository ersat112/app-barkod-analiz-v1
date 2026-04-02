# BarkodAnaliz UI Redesign Product Spec

Tarih: 2026-04-02

Bu dokuman, BarkodAnaliz uygulamasinin yeni ana deneyimini sade, hizli ve aile odakli bir yapiya tasimak icin urun kararlarini toplar.

## Neden Bu Degisim

Mevcut urun guclu ozellikler biriktirdi:
- barkod tarama
- gıda / kozmetik / ilac analizi
- market fiyat karsilastirma
- aile sagligi sinyalleri
- gecmis, favoriler, premium

Ancak ana ekran ve tarama akisinda kullaniciya tek bakista net karar yardimi veren hiyerarsi henuz yeterince guclu degil.

Yeni hedef:
- ana ekrani sadeleştirmek
- tarama girisini daha kontrollu yapmak
- aile sagligi mantigini urunun merkezine almak
- riskli katkı / alerjen bilgisini daha gorunur hale getirmek
- OCR tabanli "metin oku" akisini eklemek

## Ana Urun Ilkeleri

1. Uygulama acildiginda kullaniciya "bugun neye dikkat etmeliyim?" cevabini vermeli.
2. Tarama baslatmak tek bir butonla olmali, ama tarama tipi secimi acik olmali.
3. Gida, kozmetik, ilac ve OCR akislari ayni kamera ekraninda ama farkli modlarla yonetilmeli.
4. Alerjen ve katkı maddeleri "skorun arkasindaki neden" olarak ana urun yuzeyinde gorunmeli.
5. Aile profili ve kisisel hassasiyetler puandan ayri, ikinci bir anlam katmani olmali.
6. Tum ikincil ekranlarda net bir geri butonu olmalı.

## Yeni Bilgi Mimarisi

Alt navigasyon icin onerilen ana omurga:
- Ana Sayfa
- Gecmis
- Tara
- Fiyat
- Profil

Not:
- `Tara` ortada vurgulu ana aksiyon olarak kalmali.
- Her alt-seviye ekranda sol ustte geri butonu olmali.
- Tab ekranlari root level; detaylar push stack ile acilmali.

## 1. Tarama Girisi ve Kamera Akisi

### Mevcut sorun

Tarama butonuna basinaca dogrudan tek bir kamera deneyimi aciliyor. Kullanici hangi amacla taradigini ilk anda secemiyor.

### Yeni karar

`Tara` butonuna basildiginda yine dogrudan tek kamera acilacak.
Ancak kamera acilir acilmaz barkod tarama karesinin uzerinde mod secim butonlari gorunecek.

Modlar:
- Gida
- Kozmetik
- Ilac
- Metin

### Onerilen akış

1. Kullanici `Tara` butonuna basar.
2. Tek kamera ekrani acilir.
3. Barkod tarama karesinin ust veya alt bandinda 4 mod butonu gorunur:
   - `Gida`
   - `Kozmetik`
   - `Ilac`
   - `Metin`
4. Varsayilan mod:
   - genel scanner ekraninda `Gida`
   - ilac scanner kisayolundan gelinmisse `Ilac`
5. Kullanici butonlardan birine dokundugunda:
   - secili mod aktif rozetle vurgulanir
   - kamera ayni ekranda kalir
   - tarama / okuma mantigi secilen moda gore degisir
   - ayni anda bir `yardim baloncuk karti` gorunur
6. Kullanici baloncuk karti okuyup `Tamam` veya `Kapat` ile kapatir.
7. Baloncuk kapandiktan sonra secili modla tarama devam eder.

### Yardim baloncuk kartlari

Her mod seciminde, kullaniciya o modda ne yapmasi gerektigini anlatan kisa bir onboarding baloncugu gorunmeli.

Baloncuk davranisi:
- ilk secimde otomatik acilsin
- kullanici kapatinca kaybolsun
- ayni mod icin tekrar tekrar zorla acilmasin
- `?` veya bilgi ikonu ile tekrar acilabilsin

Baloncuk icerigi kisa olmali:

#### Gida
- urunun barkodunu kare icine hizala
- paketli gidalari tara
- skor, alerjen ve katkı analizi gelir

#### Kozmetik
- kozmetik urunun barkodunu tara
- inci/icerik bazli risk yorumu gelir
- uygun marketlerde fiyatlari da gorebilirsin

#### Ilac
- ilac kutusunun barkodunu tara
- resmi kayit, prospektus ve kullanim ozetini gor
- fiyat karti gosterilmez

#### Metin
- etiket veya prospektusteki metni kareye getir
- ozellikle `icindekiler`, `ingredients`, `inci`, `ne icin kullanilir` alanlarini okut
- OCR sonrasi analiz akisi calisir

### Kamera ekrani UI yerlesimi

Onerilen hiyerarsi:
- en ustte geri / torch / bilgi aksiyonlari
- ortada tarama karesi
- tarama karesine yakin yerde mod segmented-control benzeri butonlar
- mod secildiginde hemen altinda yardim baloncugu
- en altta hizli sonuc / preview karti

Bu kararın nedeni:
- kullanici kamera ekranindan cikmadan mod degistirebilir
- ozellikle `Gida / Kozmetik / Ilac / Metin` ayni zihinsel modelde toplanir
- yeni ekran gecisleri azalir
- akış daha hizli ve daha doğal hissedilir

### Mod davranislari

#### Gida Tara
- standart barkod scanner
- skor + alerjen + katkı + market fiyat karti

#### Kozmetik Tara
- barkod scanner
- ingredient risk odagi
- market fiyat karti sadece uygun marketlerde

#### Ilac Tara
- barkod scanner
- resmi kayit + prospektus + ne icin kullanilir
- fiyat modulu gosterilmez

#### Metin Oku
- kamera ile etiket / "icindekiler" / prospektus / INCI alanini oku
- OCR metni parse et
- kategoriye gore analiz et:
  - gida ise katkı/alergen sinyali
  - kozmetik ise ingredient analizi
  - ilac ise "ne icin kullanilir" veya prospektus bolumu

### Uygulama notu

Bu yaklasim onceki "ayri mod secim ekranı" onerisine gore daha iyi.
Cunku:
- kamera acilis hizini bozmaz
- kullaniciyi ekstra bir ara ekranda tutmaz
- tarama niyetini kamera icinde degistirmeye izin verir
- OCR / barkod modlari tek deneyimde birleşir

## 2. Metin Oku Akisi

Bu ozellik kritik ama kontrollu acilmali.

### Ilk sürüm

- Kullanici kamera ile sadece metin alanini ceker
- OCR sonucu ekranda gosterilir
- Kullanici duzeltme yapabilir
- Sonra `Analiz Et` butonu ile parser calisir

### OCR pipeline

1. goruntu al
2. text recognition
3. satirlari normalize et
4. kategori tahmini yap:
   - gida ingredient listesi
   - kozmetik INCI
   - ilac prospektus metni
5. ilgili analyzere gonder

### Guven sinyali

OCR sonuclari barkod kadar kesin olmadigi icin kullaniciya confidence rozetleri gosterilmeli:
- Yuksek guven
- Orta guven
- Manuel kontrol onerilir

## 3. Aile ve Saglik Profili

Bu ozellik bence zorunlu ve BarkodAnaliz'in cekirdek farki olabilir.

### Neden gerekli

Skor genel bir sinyal.
Ama kullanici karari genellikle su soruyla veriyor:
- "Bu urun cocugum icin uygun mu?"
- "Laktoz intoleransi olan biri icin risk var mi?"
- "Fistik alerjisi olan evde bu urun dikkat ister mi?"

### Veri modeli

`familyProfiles[]`

Her profil:
- `id`
- `name`
- `relation`
  - ben
  - cocuk
  - es
  - ebeveyn
  - diger
- `birthYear` veya yas araligi
- `sex` opsiyonel
- `isPregnant` opsiyonel
- `healthGoals[]`
- `allergens[]`
- `intolerances[]`
- `dietPreferences[]`
- `watchAdditives[]`
- `medicineWarnings[]` ilerisi icin

### UI önerisi

Profil ekraninda:
- Ben
- Aile Uyeleri
- Hassasiyetler
- Izlenen Alerjenler
- Izlenen Katki Kodlari

### Kullanım

Analiz ekraninda ek sinyal katmanı:
- Genel skor
- Senin icin uygunluk
- Aile icin dikkat

## 4. Ana Sayfa Yeni Yapısı

Kullanici istegine gore ana sayfa sade olmalı.

### Ana ekran ne göstermeli

Sadece iki temel blok:

1. `En Riskli Alerjenler ve Katkı Kodları`
2. `Son 10 Tarama`

Ekstra gürültü gösterilmemeli:
- challenge
- fazla kart
- fazla promosyon
- fazla istatistik

### Risk bloğu

Liste halinde:
- E951 Aspartam
- E621 Monosodyum Glutamat
- Süt
- Gluten
- Yer Fıstığı

Her satırda:
- kısa risk etiketi
- kategori
- izliyorum / izlemiyorum durumu

Satira basinca:
- yeni detay sayfasi acilir
- bilimsel dayanak
- hangi ürünlerde görülür
- neden dikkat edilir
- `Alerjen Olarak Ekle` veya `İzlenen Kodlara Ekle`

### Son 10 tarama

Kart veya liste:
- urun resmi
- isim
- tarih
- skor / ürün türü

`Tümünü Gör` butonu ile History ekranina gider.

## 5. Alerjen / Katkı Detay Sayfaları

Bu ekran yeni bir bilgi çekirdeği olacak.

### Zorunlu alanlar

- geri butonu
- kod / ad
- risk seviyesi
- hangi kaynaklara dayaniyor
- ne icin dikkat edilmeli
- hangi urunlerde karsilasilir
- aile profilinde izlenen madde olarak ekle butonu

### CTA

- `Alerjen Olarak Ekle`
- `İzlenen Katkı Olarak Ekle`
- `Bu maddeyi içeren ürünleri tara`

## 6. Geri Butonu Kuralı

Kural net olmalı:
- root tab ekranlari haric tum ekranlarda geri butonu gorunur
- scanner mod secimi, detail, price compare detail, alerjen detail, history detail, methodology, legal, profile subpages hepsinde geri butonu olacak

Bu, urunun guven ve gezilebilirlik hissini ciddi iyilestirir.

## 7. Geçmiş Deneyimi

### Ana sayfada

- sadece son 10 tarama
- gorsel olarak sade

### Tam geçmiş ekranı

Arama ve filtre desteklemeli:
- barkod
- ürün adı
- marka
- kategori
- gıda / kozmetik / ilaç
- tarih aralığı
- favoriler
- puan aralığı

### Geçmiş detayları

- tekrar aç
- favoriye ekle
- fiyat karşılaştır
- prospektüs / ingredient analizine git

## 8. Market Entegrasyonu

Market entegrasyonu mevcut planla devam etmeli, ama yeni UX kurallarına uymalı.

### Scanner ekranı

- tarama sonrası hızlı market fiyat tablosu
- ulusal market kolonlari
- saga kaydirarak lokal marketler

### Detail ekranı

- fiyat highlight kartlari
- market fiyat tablosu
- daha detayli fiyat / stok / mesafe

### Price Compare ekranı

- daha derin arama ve sepet optimizasyonu
- scanner/detail'deki tablo ile ayni görsel dil

## 9. Ekran Bazlı Öncelik

### P0

- tarama secim ekranı
- ana sayfa sadeleşmesi
- son 10 tarama
- evrensel geri butonu
- alerjen / katkı detay ekran şablonu

### P1

- aile ve sağlık profili
- izlenen alerjen/katkı listesi
- home risk bloğunun profile göre kişiselleşmesi
- history search / filtreler

### P2

- metin oku OCR
- OCR confidence
- manual correction
- ingredient / prospektus parser

### P3

- proaktif uyarilar
- aile bazli tavsiye kartlari
- fiyat alarmlariyla birlestirilmis risk/uygunluk bildirimleri

## 10. Teknoloji ve Veri İhtiyaçları

### OCR / Metin Oku

- text recognition engine
- satır normalize edici parser
- kategori belirleyici kurallar
- ingredient/allergen/additive dictionary

### Aile Profili

- Firestore profile schema genişlemesi
- local store cache
- family risk evaluator

### Alerjen / Katkı Detay

- canonical additive catalog
- canonical allergen catalog
- source links
- explanatory text model

### Geçmiş

- mevcut history altyapısı korunur
- full search index gerekir
- medicine / OCR history ayrımı eklenir

## 11. UX Kararları

### Ana sayfa

- tek odak
- daha az kart
- daha net tipografi
- daha guclu liste hiyerarsisi

### Kamera ekranı

- tarama modu ustte net
- preview karti alt kısımda daha akıllı
- market fiyat kartı hızlı karar yüzeyi

### Bilgi yoğunluğu

- ana sayfada az
- detail'de orta
- compare/history ekranlarında yuksek

## 12. Basarı Ölçütleri

Bu redesign basarili sayılırsa:
- ana sayfa ilk 5 saniyede anlaşılır
- kullanıcı taramaya hangi modla gireceğini düşünmeden seçer
- aile profili sayesinde “bana uygun mu” sinyali netleşir
- risk kodları daha görünür olur
- geçmişte arama ve tekrar kullanım artar
- OCR ile barkodsuz ürün/etiket anlama değeri açılır

## 13. Net Ürün Kararı

Bu redesign yapılmalı.

Ozellikle su 4 karar bence tartismasiz dogru:
- scan butonundan sonra mod seçimi
- aile ve sağlık profili
- ana sayfanın sadeleşmesi
- alerjen / katkı detay ekranları

Metin oku da çok güçlü, ama ilk günden en karmaşık katman olduğu için kontrollü fazda açılmalı.

# BarkodAnaliz Business Model ve Fiyatlandirma Plani

Bu not, BarkodAnaliz icin urun-monetization modelini sade, anlasilir ve
uygulanabilir hale getirmek icin hazirlandi.

Hedef:

- cekirdek degeri ucretsiz tutmak
- premium'u "zorla odetilen duvar" degil "bariz zaman ve para tasarrufu" haline getirmek
- reklam + abonelik dengesini bozmamak
- Market Gelsin entegrasyonunu premium'a dogru sekilde baglamak

## Urun Ilkesi

BarkodAnaliz'in cekirdek vaadi:

1. barkodu tara
2. urunu hizla anla
3. daha saglikli ve daha akilli secim yap

Bu nedenle cekirdek tarama deneyimi ucretsiz kalmalidir.

Premium'un sattigi sey:

- daha fazla kolaylik
- daha fazla kisilestirme
- daha guclu fiyat/market optimizasyonu
- reklamsiz ve daha temiz deneyim

## Ucretsiz Paket

Ucretsiz katmanda acik kalmasi gerekenler:

- barkod tarama
- urun skoru gorme
- temel metodoloji ve bilimsel dayanak ozetleri
- temel fiyat karsilastirma
- sinirli market/fiyat gorunumu
- reklamli kullanim

Ucretsiz paket icin onerilen sinir:

- kullanici urunu tarar
- skoru gorur
- temel fiyat farkini gorur
- en iyi 2-3 marketi veya referans fiyat ozetini gorur
- detayli market dagilimi, rota ve alarm ozellikleri premium'a kalir

Ucretsiz pakette tutulabilecek ek degerler:

- temel beslenme tercihleri uyarisi
- sinirli gecmis
- sinirli favori

Ancak bunlar premium'u oldurmemeli; asiri ciplak da birakilmamali.

## Premium Paket

Premium deger onermesi net olmali:

- reklamsiz deneyim
- daha cok market gorunurlugu
- zaman kazandiran sepet optimizasyonu
- konuma gore en ucuz rota
- tekrar eden alisverisleri hizlandiran aile/liste yapisi

Premium'a alinmasi mantikli ozellikler:

- reklamsiz kullanim
- gelismis market listesi optimizasyonu
- konuma gore en ucuz rota
- fiyat alarmi
- aile listesi
- tam gecmis ve favoriler
- ilac/prospektus gecmisi
- gelismis filtreler

Premium'da eklenebilecek ikinci dalga ozellikler:

- sehir bazli fiyat trendleri
- haftalik "sepette ne kadar tasarruf ettin" ozeti
- market bazli favori sepetler
- birden fazla aile uyesiyle ortak liste

## Paket Ayrimi

### Free

- tara
- skor gor
- temel fiyat kiyasi gor
- reklamli kullan

### Premium

- reklamsiz kullan
- tum marketleri gor
- gelismis sepet/market optimizasyonu
- en yakin ve en ucuz rota
- fiyat alarmi
- aile listesi
- tam gecmis ve favoriler
- ilac/prospektus gecmisi
- gelismis filtreler

## Fiyatlandirma Modeli

Iki plan yeterli:

- aylik
- yillik

Ucuncu paket su an gerekmez.

## Onerilen Fiyat Stratejisi

Bugunku urun seviyesi icin en dogru model:

1. Aylik plan:
   - daha dusuk giris bariyeri
   - denemek isteyen kullanici icin uygun

2. Yillik plan:
   - ana odak plan
   - paywall'da en cok vurgulanan plan
   - "en iyi deger" olarak sunulmali

### Onerilen fiyat mantigi

Asagidaki sayilar "nihai piyasa gercegi" degil, urun stratejisi onerileridir:

- Aylik: `49.99 TRY`
- Yillik: `399.99 TRY`

Bu yapida yillik plan, ayliga gore belirgin avantajli gorunur.

Alternatif daha yumusak giris:

- Aylik: `39.99 TRY`
- Yillik: `299.99 TRY`

Bu ikinci secenek, erken asama ve conversion odakli lansman icin daha guvenlidir.

## Mevcut Yillik 39.99 TRY Urunu Icin Not

Projede su an yillik urun kimligi `premium_annual_39_99_try:annual` olarak geciyor.

Bu fiyat:

- kapali test / erken erisim / introductory pricing icin kullanilabilir
- ama public final fiyat olarak cok dusuk kalabilir

En saglikli yol:

1. kapali testte mevcut urunu teknik olarak calistir
2. public lansman oncesi son fiyat kararini ver
3. gerekirse Google Play tarafinda yeni base plan veya yeni fiyatlama ile ilerle

## Paywall Konumlamasi

Paywall "uygulamayi kullanmak icin mecbur oldugun yer" gibi hissettirmemeli.

Dogru mesaj:

- daha fazla market gor
- daha akilli sepet yap
- reklamlardan kurtul
- ilac ve favori gecmisini kaybetme

Yanlis mesaj:

- taramak icin premium ol
- skoru gormek icin premium ol

## Premium'a Gecis Tetikleyicileri

En iyi premium giris anlari:

1. kullanici dusuk skorlu urunde "daha iyi alternatifleri" gormek isterken
2. kullanici fiyat karsilastirmada tum marketleri acmak isterken
3. kullanici sepete birden fazla urun ekleyip "en ucuz rota" isterken
4. kullanici fiyat alarmi kurmak isterken
5. kullanici reklamlardan sikayet etmeye basladiginda

## Reklam ve Premium Dengesi

Kural net olmali:

- ucretsiz kullanim reklamli
- premium kullanim reklamsiz

Ancak reklamlar deneyimi bozacak kadar agresif olmamali.

En dogru denge:

- scanner / detail / gecis anlarinda kontrollu tam ekran reklam
- sayfa iclerinde banner
- premium aktifse tum reklamlar bastirilir

## Hangi Ozellik Nerede Acilmali

### Hemen Ucretsiz

- tarama
- skor
- temel bilimsel dayanak
- temel fiyat kiyasi

### Hemen Premium

- reklamsiz kullanim
- gelismis market listesi
- tam fiyat karsilastirma
- fiyat alarmi
- aile listesi
- tam gecmis / favoriler
- ilac/prospektus gecmisi
- gelismis filtreler

### Sonraki Faz Premium

- en ucuz rota
- market bazli sepet dagitimi
- "tek market vs karisik sepet" tasarruf motoru

## En Dogru Lansman Sirasi

### Faz 1

- ucretsiz tarama + skor + temel fiyat kartlari
- premium reklamsiz kullanim
- premium tam fiyat karsilastirma
- premium gecmis / favoriler

### Faz 2

- premium fiyat alarmi
- premium aile listesi
- premium ilac/prospektus gecmisi

### Faz 3

- premium en ucuz rota
- premium karisik sepet optimizasyonu
- premium market bazli akilli tavsiyeler

## Basari Metriikleri

Takip edilmesi gereken temel metrikler:

- free -> premium donusum orani
- aylik plan / yillik plan dagilimi
- reklamlardan gelen gelir
- premium churn
- fiyat karsilastirma ekranindan premium'a gecis
- sepet ozelliginden premium'a gecis
- fiyat alarmi kurma denemeleri

## Net Oneri

Bugun icin en dogru is modeli:

- ucretsiz: tara + skor + temel fiyat kiyasi + reklamli kullanim
- premium: reklamsiz + tam market/fiyat optimizasyonu + gecmis/liste/uyari ozellikleri

En dogru plan yapisi:

- Aylik Premium
- Yillik Premium

En dogru urun vurgusu:

- BarkodAnaliz sadece "skor veren uygulama" degil
- "daha saglikli ve daha ekonomik alisveris asistani"


# BarkodAnaliz Scientific Scoring Backlog

## Purpose

Bu backlog, BarkodAnaliz'i yalnizca urun puani gosteren bir uygulama olmaktan cikarip, puanin nedenini bilimsel dayanaklariyla aciklayan, seffaf ve guvenilir bir analiz urunune donusturmek icin hazirlanmistir.

Bu dokuman, kullanicinin paylastigi Yuka Nutri-Score ve kozmetik kaynak metodolojisi referanslari uzerinden uretilmistir.

## Product Direction

Temel urun karari:
- Tek skorlu kara kutu yaklasimi yerine cok boyutlu ve aciklanabilir analiz modeli
- Gida icin besinsel kalite, islenme seviyesi ve katkı riski ayri katmanlar olarak gosterilecek
- Kozmetik icin icerik bazli risk siniflamasi ve bilimsel kaynak dayanaklari sunulacak
- Her sonuc ekraninda "Bu puan nasil olustu?" sorusunun cevabi verilecek

## Core Principles

- Skorlar tek bir kaynaga dayanmayacak
- Bilimsel kanit hiyerarsisi belirtilecek
- Resmi kurum gorusleri ve bagimsiz arastirmalar ayri etiketlenecek
- Kullaniciya risk, belirsizlik ve metodoloji seffaf bicimde sunulacak
- Tıbbi iddia ve hukuki risk olusturacak ifadelerden kacinilacak

## Phase Map

### Phase 1
- Mevcut skor katmanini aciklanabilir hale getirmek
- Gida ve kozmetik analizinde kaynak modelini gostermek

### Phase 2
- Nutri-Score / NOVA / katkı riski / kozmetik risk motorunu daha sistematik hale getirmek
- Kaynak seviyelendirmesi, veri modeli ve metodoloji ekranlarini eklemek

### Phase 3
- Daha zengin scientific explainability
- Regulator / source refresh pipeline
- Kaynak bazli changelog ve versiyonlama

## P0 Backlog

### P0.1 Detail ekranina "Bilimsel Dayanak" katmani ekle

Hedef:
Her analiz sonucunda kullaniciya skorun nedenini gostermek.

Teslimatlar:
- Detail ekraninda yeni bolum: `Bilimsel Dayanak`
- Kisa aciklama:
  - bu urun puani hangi mantikla olustu
  - hangi veri alanlari kullanildi
  - hangi alanlar eksik / bilinmiyor
- Kaynak etiketi:
  - resmi kurum
  - akademik yayin
  - topluluk/veritabani

Basari kriteri:
- Kullanici sadece puani degil, puanin mantigini da gorebilmeli

### P0.2 Gida skoru tek kart yerine 3 katmanli gostersin

Hedef:
Gida urunlerinde tek bir genel skor yerine alt boyutlarin ayrismasi.

Yeni katmanlar:
- Besinsel kalite
- Islenme seviyesi
- Katki / katkı maddesi riski

UI hedefi:
- 3 ayri mini kart
- her biri renkli ve aciklama satiri olan blok
- ustte genel ozet puani kalsin ama altinda bu 3 boyut gorunsun

Veri gereksinimi:
- mevcut nutrition alanlari
- mevcut additive / ingredient alanlari
- mevcut NOVA / processing alanlari

Basari kriteri:
- Kullanici "neden dusuk / neden iyi" sorusuna tek ekranda cevap bulmali

### P0.3 Kozmetik analizine "icerik risk metodolojisi" ekle

Hedef:
Kozmetik urun puanlarinin daha guvenilir algilanmasi.

Teslimatlar:
- Detail ekraninda `Icerik Risk Metodolojisi` karti
- Her ingredient icin:
  - dusuk / orta / yuksek risk
  - kisa neden
  - kaynak tipi
- Risk kategorileri:
  - potansiyel irritan
  - potansiyel endokrin bozucu
  - potansiyel alerjen
  - tartismali icerik

Basari kriteri:
- Kozmetik puani sadece "iyi / kotu" degil, icerik bazli aciklama ile verilmeli

### P0.4 "Bu puan nasil olustu?" bottom sheet

Hedef:
Skor mantigini kullaniciya dogrudan ogretmek.

Teslimatlar:
- detail ekraninda info/yardim aksiyonu
- tiklayinca acilan bottom sheet:
  - skor bileşenleri
  - agirliklarin insan diliyle ozeti
  - eksik veri durumunda fallback aciklamasi

Basari kriteri:
- Support uzerinden gelen "bu puan neden boyle" sorulari azalir

### P0.5 Bilinmeyen / eksik veri durumunu seffaflastir

Hedef:
Eksik veri varken kullaniciya sahte kesinlik hissi vermemek.

Teslimatlar:
- `Veri eksik`, `sinirli veri`, `kaynak dogrulanamadi` etiketleri
- grade/score yoksa tahmini veya sahte puan gostermeme
- confidence indicator

Basari kriteri:
- Hatali kesinlik yerine kontrollu guven seviyesi sunulur

## P1 Backlog

### P1.1 Nutri-Score benzeri bilimsel scoring engine

Hedef:
Mevcut gıda skorunu daha sistematik ve standardize etmek.

Yapilacaklar:
- Nutri-Score mantigina yakin veri cikarimi
- enerji, seker, doymus yag, tuz, lif, protein, meyve-sebze-baklagil orani gibi alanlarin normalize edilmesi
- urun kategorisine gore scoring adjustment

Not:
- Yuka'daki Nutri-Score birebir kopyalanmayacak
- BarkodAnaliz kendi aciklayabilir scoring modelini kuracak

### P1.2 NOVA entegrasyonunu urun diliyle ayristir

Hedef:
Islenme seviyesi ile besin kalitesini karistirmamak.

Teslimatlar:
- `Besinsel kalite`
- `Islenme seviyesi`
iki ayri sinyal olarak gosterilecek

Basari kriteri:
- Kullanici "iyi besin kalitesi ama yuksek islenmis" gibi kombinasyonlari anlayabilmeli

### P1.3 Kozmetik ingredient evidence model

Hedef:
Kozmetik ingredient analizini kurumsal ve tekrar kullanilabilir veri modeline tasimak.

Yeni alanlar:
- `evidenceLevel`
- `sourceAuthority`
- `sourceLinks`
- `riskCategory`
- `regulatoryStatus`
- `lastReviewedAt`

Basari kriteri:
- Ingredient kartlari bilimsel ve duzenleyici seviyede genisleyebilmeli

### P1.4 Kaynaklar ekranı

Hedef:
Guven duygusunu artirmak ve hukuki acikligi saglamak.

Teslimatlar:
- ayarlarda veya detail ekraninda `Kaynaklar ve Metodoloji`
- gıda kaynak kategorileri
- kozmetik kaynak kategorileri
- resmi kurumlar / akademik yayinlar / veri tabanlari listesi

Basari kriteri:
- Kullanici ve denetleyici taraf icin seffaf kaynak sunumu olur

### P1.5 Skor versiyonlama

Hedef:
Skor algoritmasi degistiginde eski sonuclarin neden farkli oldugunu aciklayabilmek.

Teslimatlar:
- `scoringVersion`
- `cosmeticMethodologyVersion`
- `foodMethodologyVersion`

Basari kriteri:
- Sonradan metodoloji update edilirse izlenebilirlik bozulmaz

## P2 Backlog

### P2.1 Kaynak bazli otomatik guncelleme pipeline'i

Hedef:
Bilimsel ve duzenleyici kaynak guncellemelerini zamanla daha sistematik izlemek.

Teslimatlar:
- ECHA / SCCS / ANSES / WHO / PubMed tarama backlog'u
- manuel moderation paneli veya veri refresh queue

### P2.2 Alternatif onerileri

Hedef:
Kotü skorlu urunlerde daha iyi alternatif sunmak.

Teslimatlar:
- benzer kategori
- daha iyi skor
- daha dusuk risk / daha dusuk islenme

### P2.3 Kullaniciya ozel aciklama dili

Hedef:
Uzman ve sade mod arasında gecis.

Teslimatlar:
- `Kisa ozet`
- `Detayli bilimsel aciklama`

## UI / UX Changes

### Detail Screen
- genel skor hero
- altinda 3 mini kart:
  - besinsel kalite
  - islenme seviyesi
  - katkı riski
- kozmetikte:
  - ingredient risk summary
  - kaynak etiketi
- `Bu puan nasil olustu?`
- `Bilimsel dayanak`
- `Kaynaklar`

### Settings
- `Metodoloji ve kaynaklar`
- `Skor sistemi hakkinda`
- `Ihtiyat ilkesi ve sinirlar`

### Missing Product
- veri yetersizligi oldugunda topluluk katkisina baglanan daha akilli ekran

## Data Model Changes

### Food
- `nutritionScore`
- `processingScore`
- `additiveRiskScore`
- `nutritionExplanation`
- `processingExplanation`
- `additiveExplanation`
- `confidenceLevel`
- `sourceLinks`
- `methodologyVersion`

### Cosmetic
- `ingredientRiskSummary`
- `ingredientEvidence[]`
- `regulatoryFlags[]`
- `sourceAuthority[]`
- `riskRationale`
- `confidenceLevel`
- `methodologyVersion`

## Legal / Trust Layer

Zorunlu urun dili:
- bu uygulama tıbbi tani araci degildir
- analiz, mevcut veri ve bilimsel kaynaklara dayali bilgi amaclidir
- veri eksik ya da sinirli olabilir
- ihtiyat ilkesi kullanilan alanlarda bu acikca belirtilmelidir

Yeni ekran veya metin ihtiyaci:
- `Analiz sinirlari`
- `Bilimsel kaynak yaklasimi`
- `Veri eksikligi notu`

## QA Acceptance Criteria

Bir scientific scoring ozelligi ancak su kosullarda tamam sayilir:
- detay ekrani puani ve alt boyutlari tutarli gostermeli
- veri eksikse sahte kesinlik vermemeli
- kaynak etiketi gorunmeli
- locale degisince metinler bozulmamali
- eski urun kayitlari yeni veri modeliyle uyumlu fallback gostermeli

## Ownership

### Ar-Ge
- veri modeli
- scoring engine
- detail ekran entegrasyonu

### UI/UX
- explainability tasarimi
- bottom sheet
- kaynak sunumu

### QA
- edge case testleri
- locale / stale data / missing data testleri

### Is Analizi
- kaynak hiyerarsisi
- metodoloji dokumani
- rakip ve farklandirma analizi

### Müşteri Başarısı
- kullanici diliyle SSS
- "puan neden boyle" destek script'leri

## Recommended Execution Order

1. P0.5 Eksik veri seffafligi
2. P0.2 Gida 3 katmanli skor
3. P0.3 Kozmetik metodoloji karti
4. P0.4 `Bu puan nasil olustu?`
5. P1.4 Kaynaklar ekrani
6. P1.3 Kozmetik evidence modeli
7. P1.1 Nutri-Score benzeri scoring engine
8. P1.2 NOVA ayrisimi
9. P1.5 Skor versiyonlama

## Product Statement

BarkodAnaliz'in hedefi, sadece "iyi / kotu" diyen bir uygulama olmak degil; kullaniciya bir urunun neden boyle puanlandigini, hangi veriye dayandigini ve hangi alanlarda belirsizlik oldugunu acikca gosteren guvenilir bir analiz urunu olmaktir.

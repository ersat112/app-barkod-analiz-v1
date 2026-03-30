# market_gelsin API Contract

Bu dokuman, `market_gelsin` veri toplama hattindan BarkodAnaliz'e gelecek fiyat ve bulunabilirlik verisinin sozlesmesini tanimlar.

Amac:

- `market_gelsin` veri toplarken hangi alanlarin zorunlu oldugunu netlestirmek
- API hazir oldugunda BarkodAnaliz'in minimum degisiklikle entegre olabilmesini saglamak
- fiyat verisini, urun saglik skoru ile ayni veri tabanina kalici olarak gommeden birlikte kullanmak

## Temel Mimari Karar

Onerilen model:

1. `market_gelsin` fiyat ve bulunabilirlik verisinin sahibi olsun
2. BarkodAnaliz urun, metodoloji, risk ve alternatif mantiginin sahibi olsun
3. Iki sistem API uzerinden baglansin
4. Nihai oneriler BarkodAnaliz tarafinda uretlilsin

Bu tasarim sayesinde:

- veri kaynaklari ayrisir
- lisans ve kaynak yonetimi daha temiz kalir
- fiyat verisi ile OFF / OBF verisi gereksiz yere tek bir master veritabaninda birlesmez

## Veri Katmanlari

`market_gelsin` tarafinda 3 katman onerilir:

### 1. Raw Crawl Layer

Ham tarama verisi.

Alanlar:

- `crawl_job_id`
- `source_name`
- `source_url`
- `captured_at`
- `raw_payload`
- `parse_status`
- `parse_notes`

### 2. Normalized Price Layer

Urun ve fiyatin temizlenmis, esitlenmis hali.

Alanlar:

- `barcode`
- `normalized_product_name`
- `brand`
- `normalized_category`
- `pack_size`
- `pack_unit`
- `market_name`
- `market_type`
- `city_code`
- `city_name`
- `district_name`
- `price`
- `currency`
- `unit_price`
- `unit_price_unit`
- `in_stock`
- `captured_at`
- `source_url`
- `source_confidence`
- `last_changed_at`

### 3. Analytics Layer

API'nin hizli donecegi ozet ve trend katmani.

Alanlar:

- `lowest_price`
- `highest_price`
- `median_price`
- `price_change_7d`
- `price_change_30d`
- `availability_ratio`
- `last_seen_at`
- `markets_seen_count`

## Zorunlu Anahtarlar

BarkodAnaliz entegrasyonu icin asagidaki alanlar zorunludur:

- `barcode`
- `market_name`
- `city_name`
- `price`
- `currency`
- `in_stock`
- `captured_at`
- `source_url`

Yuksek degerli ama ikincil alanlar:

- `unit_price`
- `normalized_category`
- `brand`
- `source_confidence`
- `price_change_7d`
- `price_change_30d`

## Onerilen Endpointler

## 1. Barkoda Gore Fiyatlar

`GET /v1/products/{barcode}/offers`

Query:

- `city_code`
- `district`
- `limit`
- `include_out_of_stock=true|false`

Amac:

- belirli barkod icin market bazli anlik / en son fiyat listesini donmek

Ornek response:

```json
{
  "barcode": "8000500023976",
  "fetched_at": "2026-04-02T09:15:00Z",
  "city": {
    "code": "34",
    "name": "Istanbul"
  },
  "offers": [
    {
      "market_name": "Migros",
      "market_type": "national_chain",
      "price": 89.95,
      "currency": "TRY",
      "unit_price": 179.9,
      "unit_price_unit": "kg",
      "in_stock": true,
      "captured_at": "2026-04-02T05:12:00Z",
      "source_url": "https://example.com/product/8000500023976",
      "source_confidence": 0.98
    }
  ]
}
```

## 2. Fiyat Gecmisi

`GET /v1/products/{barcode}/price-history`

Query:

- `city_code`
- `market_name`
- `days=7|30|90`

Amac:

- fiyat degisimini ve trendini gostermek

Ornek response:

```json
{
  "barcode": "8000500023976",
  "market_name": "Migros",
  "days": 30,
  "history": [
    {
      "captured_at": "2026-03-03T09:00:00Z",
      "price": 82.5,
      "currency": "TRY",
      "in_stock": true
    },
    {
      "captured_at": "2026-03-31T09:00:00Z",
      "price": 89.95,
      "currency": "TRY",
      "in_stock": true
    }
  ]
}
```

## 3. Sehre Gore Uygun Alternatif Fiyatlari

`POST /v1/pricing/alternatives`

Request body:

```json
{
  "city_code": "34",
  "barcode": "8000500023976",
  "candidate_barcodes": [
    "8690504121541",
    "1234567890123"
  ]
}
```

Amac:

- BarkodAnaliz tarafinda zaten secilmis alternatif barkodlarin fiyat ve bulunabilirlik ozetini tek istekte donmek

Neden gerekli:

- oneriyi BarkodAnaliz sececek
- fiyat ve market uygunlugunu `market_gelsin` saglayacak

## 4. Kategori Arama

`GET /v1/search/products`

Query:

- `q`
- `city_code`
- `category`
- `brand`
- `limit`

Amac:

- barkodsuz veya eslesmesi zayif urunlerde isim bazli fiyat aramasi yapmak

## Onerilen Cevap Standartlari

Tum endpointler su ortak alanlari dondurmelidir:

- `fetched_at`
- `request_id`
- `data_freshness`
- `partial`
- `warnings`

`data_freshness` ornegi:

```json
{
  "mode": "weekly_crawl",
  "last_full_refresh_at": "2026-03-30T02:00:00Z",
  "last_hot_refresh_at": "2026-04-01T08:10:00Z"
}
```

## Haftalik Guncelleme Ve Degisim Takibi

Onerilen isleyis:

1. Tum marketler icin haftalik tam tarama
2. Cok aranan barkodlar icin ekstra ara tarama
3. Yeni veri once raw layer'a yazilsin
4. Parse / normalize sonrasi normalized layer'a yazilsin
5. Fiyat degisimi varsa analytics layer guncellensin

Takip edilmesi gereken degisim sinyalleri:

- fiyat artti
- fiyat dustu
- stoktan kalkti
- yeniden stokta
- urun URL'i degisti
- barkod eslesmesi supheli

## BarkodAnaliz Tarafinda Oneri Algoritmasi

BarkodAnaliz fiyat verisini son karar asamasinda kullanmali.

Onerilen karar modeli:

### 1. Saglik Once

Alternatif seciminde ilk filtre:

- daha iyi skor
- kullanici tercihine uyum
- ayni veya yakin kategori

### 2. Sonra Fiyat

Kalan adaylar icin:

- en ucuz fiyat
- birim fiyat
- il bazli bulunabilirlik
- son veri tazeligi

### 3. Son Kullaniciya Gosterilecek Kartlar

- `Daha saglikli alternatif`
- `Daha uygun fiyatli alternatif`
- `Fiyat / kalite dengesi en iyi alternatif`

## Onerilen BarkodAnaliz Skorlama Formulu

Ilk surum icin basit model:

```text
final_opportunity_score =
  (health_delta * 0.45) +
  (preference_match * 0.20) +
  (price_advantage * 0.20) +
  (availability_score * 0.10) +
  (freshness_score * 0.05)
```

Aciklama:

- `health_delta`: mevcut urune gore skor farki
- `preference_match`: vegan, glutensiz vb. kullanici tercihleriyle uyum
- `price_advantage`: mevcut urune gore fiyat avantaji
- `availability_score`: kullanicinin ilinde gorulme ve stok durumu
- `freshness_score`: son crawl zamani

## Onemli Uyari

`market_gelsin` API, fiyat ve bulunabilirlik saglayici olmali; nihai "hangi urunu onerelim?" mantigi BarkodAnaliz'de kalmali.

Bu ayrim cok degerli:

- fiyat sistemi sade kalir
- saglik metodolojisi BarkodAnaliz'de kalir
- ileride farkli fiyat kaynaklari da ayni arayuze takilabilir

## BarkodAnaliz Tarafinda Sonraki Uygulama Adimi

API hazir oldugunda ilk entegrasyon su sirayla yapilmali:

1. `market_gelsin` client service
2. alternatif barkodlar icin toplu fiyat sorgusu
3. detail ekranda `Bu ilde fiyatlar` modulu
4. alternatif kartlarina `en dusuk fiyat` ve `market sayisi` rozeti
5. sonra `fiyat / kalite dengesi` siralamasi

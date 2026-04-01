# market_gelsin API Contract

Bu dokuman, `market_gelsin` ile BarkodAnaliz arasindaki fiyat ve bulunabilirlik entegrasyonunun V1 sozlesmesini tanimlar.

Amac:

- BarkodAnaliz istemcisinin hangi API contract'ina gore hazirlanacagini sabitlemek
- fiyat, kapsama ve veri tazeligi alanlarini daha ilk gunden dogru modele oturtmak
- gelecekteki Firebase mirror fazini V1 blokaji yapmadan simdiden uyumlu tasarlamak

## Nihai Mimari Karar

Bu contract, `/Users/ersat/Desktop/Market_Gelsin/BARKOD_ANALIZ_MIMARI_KARAR_NOTU.md` ile hizalidir.

Temel roller:

1. Collector kaynak sistemdir
   - ham crawl, parse ve normalization bugun compact SQLite collector DB tarafinda uretilir
   - bu katman mobil istemciye acilmaz

2. Supabase read-model / servis veritabanidir
   - BarkodAnaliz'in okudugu fiyat katmani Supabase read-model uzerinden servis edilir
   - gecis modeli: `SQLite collector -> Supabase read-model`

3. Firebase yalnizca hafif turetilmis mirror katmanidir
   - bugun aktif kisim scan/signal aynasidir
   - fiyat snapshot / trend aynasi gelecek fazdir

4. BarkodAnaliz V1 entegrasyonu API-first olmalidir
   - ilk surumde fiyat verisi dogrudan HTTP API contract'i uzerinden okunur
   - Firebase pricing mirror gelirse yalnizca hizlandirici cache / shortcut rolu oynar

## BarkodAnaliz Tarafinda Korunmasi Gereken Prensipler

- fiyat verisinin sahibi `market_gelsin` olmaya devam eder
- saglik skoru, tercih uyumu ve nihai urun onerme mantiginin sahibi BarkodAnaliz'dir
- ham crawl verisi mobil tarafa tasinmaz
- fiyat gecmisi append-only mantiginda korunur
- `price_source_type` UI ve karar motorunda kaybolmaz

## V1 Kapsami

### Ulusal market cekirdegi

- `cepte_sok`
- `a101_kapida`
- `bim_market`
- `migros_sanal_market`
- `tarim_kredi_koop_market`
- `bizim_toptan_online`
- `carrefoursa_online_market`

### Buyuksehir yerel dalga

- `30` buyuksehir belediyeli il
- yerel kapsama `city_controlled_flow_plan` uzerinden yonetilir

### Kozmetik cekirdegi

- `eveshop_online`
- `tshop_online`
- `flormar_online`
- `gratis_online`
- `rossmann_online`
- `kozmela_online`

## Ana Endpointler

### 1. Barkoda Gore Fiyatlar

`GET /v1/products/{barcode}/offers`

Query:

- `city_code`
- `district`
- `limit`
- `include_out_of_stock=true|false`

Amac:

- belirli barkod icin market bazli guncel fiyat / bulunabilirlik listesini donmek

Ornek response:

```json
{
  "barcode": "8000500023976",
  "fetched_at": "2026-04-02T09:15:00Z",
  "request_id": "req_01hrk1m7m3g8",
  "partial": false,
  "warnings": [],
  "data_freshness": {
    "mode": "mixed",
    "last_full_refresh_at": "2026-03-30T02:00:00Z",
    "last_hot_refresh_at": "2026-04-01T08:10:00Z"
  },
  "city": {
    "code": "34",
    "name": "Istanbul"
  },
  "offers": [
    {
      "market_key": "migros_sanal_market",
      "market_name": "Migros",
      "market_type": "national_chain",
      "coverage_scope": "national",
      "pricing_scope": "national_reference",
      "price_source_type": "national_reference_price",
      "price": 89.95,
      "currency": "TRY",
      "unit_price": 179.9,
      "unit_price_unit": "kg",
      "in_stock": true,
      "image_url": "https://cdn.example.com/product/8000500023976.jpg",
      "captured_at": "2026-04-02T05:12:00Z",
      "source_url": "https://example.com/product/8000500023976",
      "source_confidence": 0.98
    }
  ]
}
```

### 2. Fiyat Gecmisi

`GET /v1/products/{barcode}/price-history`

Query:

- `city_code`
- `market_name`
- `days=7|30|90`

Amac:

- fiyat degisimini ve trendini gostermek

### 3. Fiyatlanmis Alternatifler

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

- BarkodAnaliz tarafinda secilmis alternatif barkodlarin fiyat ve bulunabilirlik ozetini tek istekte donmek

### 4. Urun Arama

`GET /v1/search/products`

Query:

- `q`
- `city_code`
- `category`
- `brand`
- `limit`

Amac:

- barkodsuz veya eslesmesi zayif urunlerde isim bazli fiyat aramasi yapmak

## Destek Endpointleri

- `GET /api/v1/status`
- `GET /api/v1/program/coverage`
- `GET /api/v1/integrations/status`
- `POST /api/v1/barcode/scans`
- `POST /api/v1/barcode/scans/batch`

Bu destek endpointleri su isler icin gerekir:

- entegrasyon sagligi
- kapsama takibi
- scan event flush / retry
- hot refresh sinyali besleme

## Offer Payload'inda Zorunlu Kabul Edilen Alanlar

BarkodAnaliz UI ve karar motoru icin asagidaki alanlar korunmalidir:

- `market_key`
- `market_name`
- `market_type`
- `coverage_scope`
- `pricing_scope`
- `price_source_type`
- `price`
- `currency`
- `unit_price`
- `unit_price_unit`
- `in_stock`
- `image_url`
- `captured_at`
- `source_url`
- `source_confidence`

## Kritik Semantik Alan: `price_source_type`

Bu alan BarkodAnaliz tarafinda kaybedilmemelidir.

- `national_reference_price`
  - ulusal zincir veya ulusal kozmetik zinciri referans fiyati

- `local_market_price`
  - kullanicinin ilindeki yerel market fiyati

Bu iki veri tipi ayni kartta gosterilebilir; fakat ayni veri turu gibi puanlanmamali veya tek ortalama gibi eritilmemelidir.

Onerilen UI yorumu:

- `Ulusal referans fiyat`
- `Bulundugun ilde yerel fiyat`

Onerilen karar motoru yorumu:

- ayni urun icin yerel fiyat varsa kullaniciya once o gosterilsin
- yalnizca ulusal referans varsa bunu fallback / referans olarak goster

## Ortak Response Standartlari

Tum endpointler asagidaki ortak alanlari dondurmelidir:

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

## Barkod Scan Event Contract'i

Scan eventleri hot refresh ve populer barkod sinyali icin gereklidir.

### Tekil event

`POST /api/v1/barcode/scans`

Ornek body:

```json
{
  "barcode": "8000500023976",
  "city_code": "34",
  "district_name": "Kadikoy",
  "platform": "android",
  "scanned_at": "2026-04-02T09:15:00Z",
  "app_version": "1.2.0",
  "request_id": "scan_01hrk1n4g8fk"
}
```

### Batch event

`POST /api/v1/barcode/scans/batch`

Amac:

- offline queue flush
- background retry
- toplu sync

## Firebase Mirror Durumu

Bugun aktif scan/signal aynasi:

- `market_gelsin_barcode_scans/events/items`
- `market_gelsin_barcode_scans/daily_signals/items`

Gelecek pricing mirror koleksiyonlari:

- `pricing_snapshots`
- `pricing_trends`
- `pricing_alternatives`

Ancak bunlar V1 cikis blokaji degildir.

## BarkodAnaliz Icin Uygulama Kurallari

1. istemci entegrasyonu API-first yazilmali
2. Supabase tablolarina mobil taraftan dogrudan sorgu yazilmamali
3. `price_source_type` ayrimi UI ve ranking tarafinda korunmali
4. Firebase pricing mirror yokmus gibi de calisabilmeli
5. scan event flush / retry mekanizmasi `barcode/scans` endpointlerine gore hazirlanmali

## Kisa Ozet

- collector operasyonel kaynak sistemdir
- Supabase BarkodAnaliz icin read-model / servis veritabanidir
- Firebase yalnizca hafif mirror katmanidir
- V1 entegrasyon modeli API-first'tur
- BarkodAnaliz, daha saglikli oneriyi secmeye devam eder; `market_gelsin` fiyat ve bulunabilirlik saglar

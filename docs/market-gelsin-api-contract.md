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
- `lat`
- `lng`
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
  "district": "Kadikoy",
  "request_location": {
    "latitude": 40.987,
    "longitude": 29.028
  },
  "offers": [
    {
      "market_key": "migros_sanal_market",
      "market_name": "Migros",
      "market_type": "national_chain",
      "market_logo_url": "https://www.google.com/s2/favicons?domain_url=https%3A%2F%2Fwww.migros.com.tr&sz=128",
      "coverage_scope": "national",
      "pricing_scope": "national_reference",
      "price_source_type": "national_reference_price",
      "branch_id": "migros_sanal_market:34",
      "branch_name": "Migros Istanbul / Kadikoy",
      "latitude": null,
      "longitude": null,
      "distance_meters": null,
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

### 2. Runtime Resolve

`GET /v1/products/{barcode}/resolve`

Query:

- `city_code`
- `district`
- `lat`
- `lng`
- `limit`
- `include_out_of_stock=true|false`

Amac:

- exact barkod market verisinde bulunamiyorsa barkodu once urun kimligine cozmek
- urun kimligini isim + marka + boyut sinyali ile market tekliflerine map etmek

Calisma sirası:

1. once local canonical / barkod tablolarina bakilir
2. yoksa Supabase `mg_openfacts_stage` kullanilir
3. hala yoksa canli Open Food Facts / Open Beauty Facts fallback'i denenir
4. son adimda market teklifleri isim bazli resolver ile eslestirilir

Top-level alanlar:

- `match_mode`
  - `exact_barcode`
  - `catalog_name_match`
  - `identity_not_found`
- `resolution`
- `results`

`resolution` icinde beklenen alanlar:

- `source`
- `project`
- `product_name`
- `brand`
- `size_value`
- `size_unit`
- `category`
- `query_tokens`

`results[*]` icinde ek kalite alanlari:

- `catalog_match_confidence`
- `catalog_match_reasons`

Bu endpoint BarkodAnaliz tarafinda exact barkod sonucu gelmediginde fallback olarak kullanilmalidir.

Ornek:

```bash
curl -s "http://127.0.0.1:8040/v1/products/0076223000264/resolve?city_code=34&district=Kadikoy&lat=40.987&lng=29.028&limit=5"
```

Ornek response iskeleti:

```json
{
  "barcode": "0076223000264",
  "match_mode": "catalog_name_match",
  "resolution": {
    "source": "supabase_openfacts_stage",
    "project": "off",
    "product_name": "TOBLERONE",
    "brand": "Mondelez",
    "size_value": null,
    "size_unit": null,
    "category": null,
    "query_tokens": ["mondelez", "toblerone"]
  },
  "results": [
    {
      "barcode": "8690000000000",
      "normalized_product_name": "toblerone sutlu cikolata",
      "catalog_match_confidence": 0.82,
      "catalog_match_reasons": ["name", "brand"],
      "offers": []
    }
  ]
}
```

### 3. Fiyat Gecmisi

`GET /v1/products/{barcode}/price-history`

Query:

- `city_code`
- `market_name`
- `days=7|30|90`

Amac:

- fiyat degisimini ve trendini gostermek

### 4. Fiyatlanmis Alternatifler

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

Top-level sonuc anahtari:

- `entries`

### 5. Urun Arama

`GET /v1/search/products`

Query:

- `q`
- `city_code`
- `category`
- `brand`
- `limit`

Amac:

- barkodsuz veya eslesmesi zayif urunlerde isim bazli fiyat aramasi yapmak

Top-level sonuc anahtari:

- `results`

Her sonuc icinde beklenen kalite alanlari:

- `match_confidence`
- `normalized_product_name`
- `normalized_category`
- `pack_size`
- `pack_unit`

### 6. Barkod Bazli Sepet Karsilastirma

`POST /api/v1/basket/compare`

Request body:

```json
{
  "city_code": "34",
  "district": "Kadikoy",
  "lat": 40.987,
  "lng": 29.028,
  "items": [
    {
      "barcode": "8000500023976",
      "quantity": 1
    },
    {
      "barcode": "8690504121541",
      "quantity": 2
    }
  ]
}
```

Response ana alanlari:

- `mixed_cheapest_total`
- `best_single_market_total`
- `nearest_market_total`
- `market_totals`
- `missing_items`

`market_totals` satirinda beklenen alanlar:

- `market_key`
- `market_name`
- `market_logo_url`
- `distance_meters`
- `branch_id`
- `branch_name`
- `basket_total`
- `available_item_count`
- `missing_item_count`

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
- `market_logo_url`
- `coverage_scope`
- `pricing_scope`
- `price_source_type`
- `branch_id`
- `branch_name`
- `latitude`
- `longitude`
- `distance_meters`
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
  "mode": "weekly_full_plus_hot_scan",
  "last_full_refresh_at": "2026-03-30T02:00:00Z",
  "last_hot_refresh_at": "2026-04-01T08:10:00Z",
  "full_refresh_hours": 168,
  "hot_refresh_hours": 48,
  "history_mode": "append_only_offer_snapshots"
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

Not:

- `event_id` veya `request_id` duplicate korumasi icin kullanilabilir
- token tanimliysa ingest uclari `Authorization: Bearer <token>` veya `X-API-Key` ister

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
2. scan akisinda once `GET /v1/products/{barcode}/offers` cagrilmali
3. `offers` bos donerse veya yeterli sonuc uretmezse `GET /v1/products/{barcode}/resolve` fallback'i cagrilmali
4. `search/products` otomatik scan akisi icin degil, manuel arama / duzeltme akisi icin kullanilmali
5. Supabase tablolarina mobil taraftan dogrudan sorgu yazilmamali
6. `price_source_type` ayrimi UI ve ranking tarafinda korunmali
7. `catalog_match_confidence` dusukse istemci urunu otomatik secmek yerine kullanici onayi istemeli
8. Firebase pricing mirror yokmus gibi de calisabilmeli
9. scan event flush / retry mekanizmasi `barcode/scans` endpointlerine gore hazirlanmali

## Barkod Scan Icın Onerilen Istemci Akisi

1. Barkod okut.
2. `GET /v1/products/{barcode}/offers`
3. Sonuc varsa fiyat kartlarini goster.
4. Sonuc bos ise `GET /v1/products/{barcode}/resolve`
5. `resolve.results[0].catalog_match_confidence` yeterince yuksekse urun detayina gec.
6. Skor dusukse kullaniciya "en yakin eslesmeler" listesi goster.
7. Her scan sonunda `POST /api/v1/barcode/scans` veya batch flush kullan.

## Kisa Ozet

- collector operasyonel kaynak sistemdir
- Supabase BarkodAnaliz icin read-model / servis veritabanidir
- Firebase yalnizca hafif mirror katmanidir
- V1 entegrasyon modeli API-first'tur
- BarkodAnaliz, daha saglikli oneriyi secmeye devam eder; `market_gelsin` fiyat ve bulunabilirlik saglar

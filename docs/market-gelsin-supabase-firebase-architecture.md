# market_gelsin Read-Model + Mirror Architecture

Bu dokuman, `market_gelsin` ile BarkodAnaliz arasindaki nihai veri rollerini tanimlar.

Amac:

- collector, Supabase ve Firebase rollerini karistirmadan sabitlemek
- V1 icin BarkodAnaliz'in hangi okuma modeline gore yazilacagini netlestirmek
- ileri faz Firebase pricing mirror'u simdiden uyumlu ama opsiyonel tasarlamak

## Nihai Rol Dagilimi

### 1. Collector kaynak sistemdir

Bugun operasyonel kaynak sistem `market_gelsin` collector / scraper hattindaki compact SQLite DB'dir.

Bu katman:

- ham crawl
- parse
- normalization
- adapter operasyonlari

icin kullanilir.

Mobil istemci bu katmani gormez.

### 2. Supabase BarkodAnaliz icin read-model / servis veritabanidir

Supabase'in rolu:

- BarkodAnaliz'e servis edilen fiyat verisini tutmak
- read-model ve analytics katmanini tasimak
- API / edge / backend tarafinin okudugu temiz fiyat modelini saglamak

Onemli ayrim:

- Supabase bugun ham operasyonel source of truth degildir
- gecis modeli `SQLite collector -> Supabase read-model` seklindedir

### 3. Firebase yalnizca hafif turetilmis mirror katmanidir

Firebase fiyat verisinin ana kaynagi degildir.

Bugun aktif katman:

- `market_gelsin_barcode_scans/events/items`
- `market_gelsin_barcode_scans/daily_signals/items`

Gelecek faz pricing mirror:

- `pricing_snapshots`
- `pricing_trends`
- `pricing_alternatives`

Bu pricing mirror V1 blokaji degildir.

## BarkodAnaliz Icin V1 Okuma Modeli

V1'de BarkodAnaliz istemcisi:

1. HTTP API contract'ina baglanir
2. fiyat verisini API uzerinden okur
3. scan eventlerini API'ye yollar
4. Firebase pricing mirror yoksa da tam calisir

Yani V1 mantigi:

- `API-first`
- `Firebase-optional`

Gelecek fazda izin verilen model:

- `Firebase pricing mirror -> API fallback`

Ama bu model yalnizca pricing mirror aktif oldugunda devreye girmelidir.

## Supabase Read-Model Katmanlari

Supabase tarafinda onerilen `mg_*` yapi, collector DB'nin birebir operasyonel kopyasi degil; BarkodAnaliz'e servis etmek icin duzenlenmis read-model katmanidir.

### Read-model tablolar

- `mg_crawl_runs`
- `mg_raw_products`
- `mg_products`
- `mg_markets`
- `mg_market_offers`
- `mg_price_history`

### Ozet / view katmani

- `mg_product_city_summary`
- `mg_product_best_offers`
- `mg_product_price_trends`

Bu `mg_*` isimleri tablo, view veya materialized read-model olarak kurulabilir.

## Collector -> Supabase Eslestirmesi

- `scrape_runs` -> `mg_crawl_runs`
- `raw_products` -> `mg_raw_products`
- `canonical_products` + `canonical_product_barcodes` -> `mg_products`
- `source_markets` + `cities` + coverage bilgileri -> `mg_markets`
- `current_offers` / `effective_offers` -> `mg_market_offers`
- `offers` -> `mg_price_history`

## API Katmani Varsayimi

BarkodAnaliz mobil uygulamasi Supabase'e dogrudan sorgu atmamalidir.

Varsayilan erisim modeli:

- collector DB -> sync / projection -> Supabase read-model
- backend / edge / API -> Supabase read-model
- BarkodAnaliz mobile -> HTTP API

Ana endpointler:

- `GET /v1/products/{barcode}/offers`
- `GET /v1/products/{barcode}/price-history`
- `POST /v1/pricing/alternatives`
- `GET /v1/search/products`

Destek endpointleri:

- `GET /api/v1/status`
- `GET /api/v1/program/coverage`
- `GET /api/v1/integrations/status`
- `POST /api/v1/barcode/scans`
- `POST /api/v1/barcode/scans/batch`

## Kritik Alanlar

Offer payload'inda BarkodAnaliz'in dikkate almasi gereken alanlar:

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

Ozellikle `price_source_type` ayrimi korunmalidir:

- `national_reference_price`
- `local_market_price`

Bu alan, ayni urunun ulusal referans fiyati ile kullanicinin ilindeki yerel market fiyatini karistirmamayi saglar.

## Supabase Read-Model Tasarim Notlari

Supabase / Postgres tarafinda uygulanmasi gereken pratikler:

1. identifier'lar lowercase olsun
2. yabanci anahtar alanlarina index koyulsun
3. `mg_price_history` append-only olsun
4. `mg_market_offers` upsert mantigiyla guncellensin
5. agir sorgular summary / view / materialized view katmanina tasinsin
6. mobil taraf history tablosuna dogrudan gitmesin
7. coverage, pricing ve price source semantik alanlari tablo seviyesinde saklansin

## Firebase Mirror Karari

### Bugun aktif olanlar

- scan event aynasi
- daily signal aynasi

### Gelecekte eklenebilecek pricing mirror

#### `pricing_snapshots`

- barkod + sehir bazli en guncel fiyat ozeti

#### `pricing_trends`

- 7/30 gun fiyat degisimi ve bulunabilirlik ozeti

#### `pricing_alternatives`

- populer barkodlar icin onceden hesaplanmis alternatif fiyat paketleri

Ancak bunlar V1 cikis blokaji degildir.

## Sync Akisi

### V1

1. BarkodAnaliz scan eventlerini API'ye yollar
2. API eventleri collector DB'ye yazar
3. collector pipeline yeni sinyalleri degerlendirir
4. veri Supabase read-model'e aynalanir
5. API okuma cevaplarini Supabase read-model uzerinden verir

### Gelecek faz

1. Supabase summary / trend verisi hesaplanir
2. secili pricing belgeleri Firebase'e yazilir
3. mobil taraf hizli cache olarak bunu okuyabilir

## BarkodAnaliz Tarafta Uygulanacak Kural Seti

1. istemci entegrasyonu HTTP API contract'ina gore yazilmali
2. Firebase pricing mirror olmasa da ekranlar calismali
3. `price_source_type` ayrimi kart ve ranking katmaninda korunmali
4. scan event flush / retry mekanizmasi `barcode/scans` endpointlerine gore hazirlanmali
5. Supabase tablolarina dogrudan mobil sorgu yazilacagi varsayilmamali

## Fazlama

### Faz 1

- HTTP API contract entegrasyonu
- Supabase `lean_current` migration / read-model
- ulusal marketler + buyuksehir yerel marketler + aktif kozmetik kapsami
- `image_url`, fiyat gecmisi ve fiyat tipi ayrimi

### Faz 2

- `mg_product_city_summary`
- `mg_product_best_offers`
- `mg_product_price_trends`
- Firebase `pricing_snapshots` / `pricing_trends`

### Faz 3

- populer barkodlar icin precomputed `pricing_alternatives`
- district / mahalle ayrimi
- daha guclu yerel market kapsami

## Kisa Ozet

- collector kaynak sistemdir
- Supabase BarkodAnaliz icin ana read-model olur
- Firebase yalnizca hafif mirror olur
- V1 entegrasyon modeli API-first'tur
- BarkodAnaliz bu plana gore hazirlanmalidir

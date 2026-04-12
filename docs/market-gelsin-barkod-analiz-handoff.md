# Barkod Analiz Handoff

Tarih: 2026-04-08

Bu dosya, Barkod Analiz ekibinin `market_gelsin` fiyat katmanina hizli sekilde entegre olmasi icin hazirlanmis kisa teslim notudur.

Not:

- guncel hedef lokal HTTP API degil, Supabase RPC yuzeyidir
- ayni is mantigi `rpc(...)` cagrilari olarak Supabase'e tasiniyor
- asagidaki HTTP contract, RPC fonksiyon isimleriyle birebir korunacaktir
- 2026-04-08 itibariyla canli public Supabase RPC smoke testleri basarili gecmistir
- `mg_rpc_record_barcode_scan` artik public RPC uzerinden yazabilmektedir
- `hot_refresh_rebuilt` varsayilan olarak `false` doner; mobil istemci scan yazimini hizli tutmak icin ek rebuild tetiklemez

## 1. Hedef

Amac:

- barkod okutuldugunda kullaniciya market bazli fiyat gostermek
- exact barkod bulunamazsa runtime resolve ile urun kimligini esleyip yine fiyat gosterebilmek
- scan eventlerini geri yollayip sistemin "sicak urun" ogrenmesini saglamak

## 1.1 Market_Gelsin Tarafinda Tamamlanan Isler

Bu handoff ile birlikte `market_gelsin` tarafinda tamamlanan ana backend isleri:

- SQLite collector verisi canli Supabase'e full reload ile tasindi
- Supabase read-model katmani kuruldu ve canliya alindi
- public RPC kontrati `offers`, `resolve`, `price_history`, `search`, `record_scan`, `health` icin aktif hale getirildi
- yavas RPC'ler agir ham tablolar yerine materialized read-model katmanina tasindi
- `mg_rpc_product_price_history` lookup plani optimize edildi
- `mg_rpc_record_barcode_scan` icin `digest()` / `pgcrypto` kaynakli hata giderildi
- `mg_rpc_record_barcode_scan` public RPC uzerinden calisir hale getirildi
- `record_scan` icinde senkron sicak refresh rebuild varsayilani kapatildi; hizli yazim yolu korunuyor
- public Supabase RPC smoke testleri publishable key ile tekrar tekrar dogrulandi

Canli veri durumu:

- `current_offers`: `1,044,576`
- `mg_product_city_summary`: `10,368`
- `mg_openfacts_stage`: `1,304,875`
- canli veritabani boyutu: prune sonrasi belirgin sekilde kuculdu; aktif 6 market kapsami tasiniyor

Canli read-model katmani:

- `mg_products`
- `mg_market_offers`
- `mg_price_history`
- `mg_product_city_summary`
- `mg_product_best_offers`
- `mg_product_price_trends`

Bu isler sayesinde Barkod Analiz ekibi artik lokal API beklemeden dogrudan canli Supabase RPC uzerinden entegrasyon yapabilir.

## 2. Zorunlu Cagri Sirasi

Mobil istemci barkod okutunca su sirayi kullanmali:

1. `rpc('mg_rpc_product_offers')`
2. sonuc bossa veya exact barkod yoksa `rpc('mg_rpc_product_resolve')`
3. `resolve` de guclu sonuc yoksa kullaniciya manuel arama ac ve `rpc('mg_rpc_search_products')`
4. tarama olayini her durumda `rpc('mg_rpc_record_barcode_scan')` ile gonder

Not:

- `offers` exact barkod fiyat okumasi icindir
- `resolve` fallback urun esleme icindir
- `search/products` barkod fallback'i degil, manuel arama icindir

## 3. Base URL

Canli Supabase proje URL:

- `https://bqljlyhpkvbeeawedwbm.supabase.co`

Supabase REST taban yolu:

- `https://bqljlyhpkvbeeawedwbm.supabase.co/rest/v1/`

Supabase RPC taban yolu:

- `https://bqljlyhpkvbeeawedwbm.supabase.co/rest/v1/rpc/`

Not:

- `rest/v1` cagrilari `apikey` ister
- hedef model `rpc` fonksiyonlaridir
- istemci tarafinda Supabase SDK `rpc(...)` tercih edilmelidir
- REST ile cagri yapilacaksa `apikey` ve `Authorization: Bearer <publishable-key>` basliklari gerekir
- mobil kod artik tercihen `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` bekler
- backward-compatible olarak `EXPO_PUBLIC_SUPABASE_ANON_KEY` da calisir
- Firebase runtime dokumani kullaniliyorsa `apiKey`, `publishableKey`, `publicKey` veya backward-compatible `anonKey` alanlari kabul edilir
- lokal `127.0.0.1:8040` artik hedef entegrasyon modeli degildir
- `district`, `lat`, `lng` alanlari contract'ta korunmustur; ancak su an server-side filtre olarak uygulanmaz, gerekli olursa `warnings` icinde bilgi donebilir

## 4. Endpoint Ozetleri

### 4.1 Exact Fiyat

`rpc('mg_rpc_product_offers')`

Kullanim:

- barkod bizim market verisinde dogrudan varsa market bazli fiyatlari doner

Query:

- `city_code`
- `district`
- `lat`
- `lng`
- `limit`
- `include_out_of_stock=true|false`

Istemcinin kullanacagi ana alanlar:

- `barcode`
- `offers`
- `offers[*].market_key`
- `offers[*].market_name`
- `offers[*].price`
- `offers[*].currency`
- `offers[*].in_stock`
- `offers[*].image_url`
- `offers[*].captured_at`
- `offers[*].price_source_type`
- `data_freshness`
- `warnings`

Tarih kullanim notu:

- fiyat kartinda gosterilecek ana tarih `offers[*].captured_at`
- ekran ustu genel tazelik bilgisi icin `data_freshness.last_seen_at`
- istemci isterse `data_freshness.generated_at` alanini da debug / support amacli loglayabilir

### 4.2 Runtime Resolve

`rpc('mg_rpc_product_resolve')`

Kullanim:

- exact barkod sonucu yoksa barkodu urun kimligine cozup market teklifleri ile esler

Kaynak sirasi:

1. Supabase canonical tablolar
2. Supabase `mg_openfacts_stage`
3. isim + marka + boyut sinyali ile market teklif esleme

Istemcinin kullanacagi ana alanlar:

- `match_mode`
- `resolution`
- `resolution.source`
- `resolution.product_name`
- `resolution.brand`
- `resolution.query_tokens`
- `results`
- `results[*].catalog_match_confidence`
- `results[*].catalog_match_reasons`
- `results[*].offers`

`match_mode` degerleri:

- `exact_barcode`
- `catalog_name_match`
- `identity_not_found`

### 4.3 Manuel Arama

`rpc('mg_rpc_search_products')`

Kullanim:

- kullanici barkoddan sonuc alamazsa veya urunu elle secmek isterse

### 4.4 Fiyat Gecmisi

`rpc('mg_rpc_product_price_history')`

Kullanim:

- fiyat detay ekraninda son 7 / 30 / 90 gunluk degisimleri gostermek icin
- exact barkod akisi veya resolve sonucu secilen aday barkod uzerinden cagrilmalidir

Istemcinin kullanacagi ana alanlar:

- `barcode`
- `days`
- `entries`
- `entries[*].market_name`
- `entries[*].price`
- `entries[*].captured_at`
- `entries[*].change_type`

Tarih kullanim notu:

- fiyat gecmisi cizgisi `entries[*].captured_at` uzerinden kurulmalidir
- son gorulme / veri tazeligi ozetinde yine `data_freshness.last_seen_at` baz alinmalidir

### 4.5 Scan Telemetry

`rpc('mg_rpc_record_barcode_scan')`

Kullanim:

- okutulan barkodlari sisteme geri yollayip oncelikli refresh kuyru gucune veri saglar

Ornek govde:

```json
{
  "p_barcode": "8690000000001",
  "p_city_code": 34,
  "p_scanned_at": "2026-04-01T10:15:00Z",
  "p_scan_count": 1,
  "p_device_id": "android-01",
  "p_session_id": "session-abc"
}
```

Not:

- public RPC uzerinden `anon` / `authenticated` erisimi aciktir
- mobil istemci ek olarak `p_rebuild_hot_refresh=true` gondermemelidir
- beklenti, scan yaziminin hizli tamamlanmasi ve backend tarafinin refresh isini ayrik yurutmesidir

## 5. Onerilen UI Karar Kurallari

Istemci tarafta onerilen karar akisi:

1. `offers.offers.length > 0` ise direkt fiyat listesi goster
2. `resolve.match_mode = exact_barcode` ise direkt sonuc detayina gir
3. `resolve.match_mode = catalog_name_match` ise ilk sonucun gucune bak
4. ilk sonucun `catalog_match_confidence >= 0.75` ise sonucu otomatik ac
5. skor `0.55 - 0.74` araligindaysa "eslesen urun bu olabilir" onayi ile goster
6. skor `< 0.55` veya `identity_not_found` ise manuel arama akisini ac

Not:

- bu skor esikleri istemci tavsiyesidir; sunucu tarafinda zorunlu kural degildir

## 6. Ornek Cagrilar

### 6.1 Exact Fiyat

```bash
curl -s "https://bqljlyhpkvbeeawedwbm.supabase.co/rest/v1/rpc/mg_rpc_product_offers" \
  -H "apikey: <publishable-key>" \
  -H "Authorization: Bearer <publishable-key>" \
  -H "Content-Type: application/json" \
  -d '{"p_barcode":"8692971413075","p_city_code":"34","p_limit":5,"p_include_out_of_stock":false}'
```

### 6.2 Runtime Resolve

```bash
curl -s "https://bqljlyhpkvbeeawedwbm.supabase.co/rest/v1/rpc/mg_rpc_product_resolve" \
  -H "apikey: <publishable-key>" \
  -H "Authorization: Bearer <publishable-key>" \
  -H "Content-Type: application/json" \
  -d '{"p_barcode":"8692971413075","p_city_code":"34","p_limit":5,"p_include_out_of_stock":false}'
```

### 6.3 Fiyat Gecmisi

```bash
curl -s "https://bqljlyhpkvbeeawedwbm.supabase.co/rest/v1/rpc/mg_rpc_product_price_history" \
  -H "apikey: <publishable-key>" \
  -H "Authorization: Bearer <publishable-key>" \
  -H "Content-Type: application/json" \
  -d '{"p_barcode":"8690527010839","p_days":30}'
```

### 6.4 Manuel Arama

```bash
curl -s "https://bqljlyhpkvbeeawedwbm.supabase.co/rest/v1/rpc/mg_rpc_search_products" \
  -H "apikey: <publishable-key>" \
  -H "Authorization: Bearer <publishable-key>" \
  -H "Content-Type: application/json" \
  -d '{"p_q":"sut","p_city_code":"34","p_limit":10}'
```

### 6.5 Scan Telemetry

```bash
curl -s "https://bqljlyhpkvbeeawedwbm.supabase.co/rest/v1/rpc/mg_rpc_record_barcode_scan" \
  -H "apikey: <publishable-key>" \
  -H "Authorization: Bearer <publishable-key>" \
  -H "Content-Type: application/json" \
  -d '{"p_barcode":"8692971413075","p_city_code":34,"p_scan_count":1,"p_source_app":"barkod_analiz","p_device_id":"android-01","p_session_id":"session-abc"}'
```

## 7. Kisa Response Beklentisi

`offers` basariliysa:

- ekran icin esas veri `offers[*]` icindedir

`resolve` basariliysa:

- ekran karari icin esas veri `match_mode`
- urun kimligi icin esas veri `resolution`
- market adaylari icin esas veri `results[*]`

Beklenen tipik fallback akisi:

1. OFF barkoddan urun adini verir
2. `market_gelsin` bu adi kendi market tekliflerine map eder
3. en iyi eslesen adaylar `results` icinde doner
4. adayin altindaki `offers` listesi UI'da kullanilir

## 8. Kabul Kriterleri

Entegrasyon tamamlandi sayilmasi icin:

- barkod okutunca once `offers`, sonra gerekirse `resolve` cagriliyor olmali
- exact barkod bulunan urunde fiyat listesi acilmali
- exact barkod bulunmayan ama `resolve` ile eslesen urunde fallback ekran acilmali
- hic sonuc bulunamazsa manuel arama akisi acilmali
- her scan olayi telemetry endpoint'ine yazilmali
- hata durumunda istemci sessizce cokmeden kullaniciya "fiyat bulunamadi" veya "manuel arama deneyin" mesaji gostermeli

### 8.1 Canli Smoke Test Sonucu

2026-04-08 canli public RPC olcumu:

- `mg_rpc_health`: `200`, yaklasik `0.24s`
- `mg_rpc_product_offers`: `200`, yaklasik `0.56s`
- `mg_rpc_product_resolve`: `200`, yaklasik `0.27s`
- `mg_rpc_product_price_history`: `200`, yaklasik `0.27s`
- `mg_rpc_search_products`: `200`, yaklasik `0.45s`
- `mg_rpc_record_barcode_scan`: `200`, yaklasik `0.19s`

Not:

- bu olcumler public Supabase RPC yuzeyinde `publishable key` ile alinmistir
- `record_scan` cevabinda `hot_refresh_rebuilt: false` beklenen davranistir

### 8.2 Bilerek Boyle Birakilan Davranislar

- `district`, `lat`, `lng` parametreleri contract'ta korunur; su an filtreleyici olarak uygulanmaz
- `record_scan` yazimi hizli kalsin diye `p_rebuild_hot_refresh` varsayilani `false` tutulur
- sicak urun rebuild'i istemci cagrisi uzerinden degil, backend tarafinda ayrik is olarak dusunulmelidir

### 8.3 Bilinen Acik Konu

- veri kapsama ve canonical esleme derinligi butun barkodlarda ayni seviyede degildir
- asagidaki "Veri Kapsamasi Handoff" bolumu entegrasyon blokaji degil, kapsama genisletme backlog'u olarak okunmalidir

## 9. Bu Dokumani Destekleyen Kaynaklar

Detayli contract:

- [market-gelsin-api-contract.md](/Users/ersat/Desktop/app-barkod-analiz-v1/docs/market-gelsin-api-contract.md)

Sunucu entegrasyon notlari:

- [BARKOD_ANALIZ_ENTEGRASYONU.md](/Users/ersat/Desktop/Market_Gelsin/BARKOD_ANALIZ_ENTEGRASYONU.md)

Esleme mantigi:

- [CIMRI_BENZERI_ESLEME_STRATEJISI.md](/Users/ersat/Desktop/Market_Gelsin/CIMRI_BENZERI_ESLEME_STRATEJISI.md)

## 10. Veri Kapsamasi Handoff

Bu bolum, Barkod Analiz istemcisi canli Supabase RPC'ye baglandiktan sonra gorulen veri kapsama eksiklerini `market_gelsin` ekibine net aksiyon listesi olarak iletmek icin eklenmistir.

### 10.1 Teyit Edilen Ornek Vaka

Test barkodu:

- `8690635030361`

Canli RPC bulgusu:

- `mg_rpc_product_offers` cagrisi ham olarak `5` satir donuyor
- ama bunlarin tamami ayni market / ayni sube:
  - `market_key = getir_buyuk`
  - `branch_id = getir_buyuk:35`
  - `branch_name = GetirBuyuk Izmir`
- yani tekil market / sube sayisi fiilen `1`
- diger zincirlerde ayni urun icin teklif gorunmuyor

Sonuc:

- Barkod Analiz istemcisi su an yanlis davranmiyor
- read-model'de bu barkod icin cok-market kapsama yok
- ayrica ayni markette mukerrer satirlar var

### 10.2 Urun Etkisi

Mobil urun akisi artik su sekilde calisir:

1. barkod okutulur
2. exact `offers` cekilir
3. gerekirse isim + marka fallback aramasi denenir
4. scanner ilk sonuc yuzeyinde lokasyona gore en uygun market ozeti gosterilir
5. detail ekraninda ayni fiyat katmani devam eder
6. kullanici isterse `Fiyat` sekmesine gecip tam karsilastirma gorur

Bu akisin guclu calismasi icin backend'de:

- exact barkod teklifler
- barkodsuz ama ayni urune ait isim + paket eslesmeleri
- benzersiz market / sube sayilari

dogru uretilmelidir.

### 10.3 P0 Zorunlu Isler

#### A. Barkodsuz Marketleri Canonical Urune Baglama

Su marketlerde barkod her zaman yok:

- Migros
- A101
- SOK
- Tarim Kredi
- CarrefourSA

Bu durumda su alanlarla canonical esleme kurulmasi gerekir:

- `brand_normalized`
- `product_name_normalized`
- `pack_size`
- `pack_unit`
- `variant_signature`

Onerilen ciktilar:

- `canonical_product_id`
- `match_type`
- `match_confidence`

`match_type` icin onerilen degerler:

- `barcode_exact`
- `name_pack_match`
- `brand_name_match`

#### B. Teklifleri Bir Urun Altinda Birleştirme

Ayni urune ait teklifler tek yerde toplanmali:

- barkod varsa once barkod ana kimlik olsun
- barkodsuz teklifler guclu eslesme ile ayni `canonical_product_id` altina baglansin

Beklenen sonuc:

- Barkod Analiz ayni urun icin `Getir + Migros + CarrefourSA + ...` tekliflerini ayni kartta gorebilmeli

#### C. Mukerrer Teklif Temizligi

Ayni market / ayni sube / ayni urun icin birden fazla aktif satir varsa dedupe gereklidir.

Onerilen dedupe anahtari:

- `canonical_product_id`
- `market_key`
- `branch_id`
- `city_code`

ve en yeni / en guvenilir teklif tutulmali.

### 10.4 P1 Sayisal Dogruluk

Response alanlari gercek benzersiz market mantigina gore uretilmeli:

- `market_count` = benzersiz market sayisi
- `in_stock_market_count` = stoktaki benzersiz market sayisi

Satir sayisi market sayisi olarak donmemeli.

Mumkunse su alanlar da response'a eklenmeli:

- `unique_market_count`
- `unique_branch_count`
- `match_type`
- `match_confidence`

### 10.5 Barkod Analiz Tarafinda Beklenen Davranis

Backend bu isi tamamladiginda Barkod Analiz istemcisi su faydalari otomatik kazanir:

- scanner ilk ekranda lokasyona gore daha dogru market ozeti
- detail ekraninda daha genis market tablosu
- `Fiyat` sekmesinde ayni urun icin daha fazla zincir
- sepet karsilastirmada tek market / karisik market toplami daha dogru sonuc

Ek not:

- istemci artik barkod yoksa isim + marka fallback deniyor
- yani mobil tarafta gerekli hazirlik yapildi
- kalan ana ihtiyac veri kapsamasinin genislemesi

### 10.6 Kabul Kriteri

Asagidaki kosullar saglandiginda bu handoff kapanmis sayilabilir:

- `8690635030361` ve benzer test urunlerinde tekil market sayisi gercek durumu yansitir
- barkodsuz zincir teklifleri canonical urune baglanir
- ayni markette mukerrer satir kalmaz
- `offers` response'unda Barkod Analiz en azindan:
  - exact barkod sonucu olan marketleri
  - isim + paket eslesmesiyle bulunan marketleri
  ayni urun altinda gorebilir

### 10.7 Oncelikli Test Urunleri

- `8690635030361`
- `tat domates salcasi`
- `tat domates salcasi 360g`
- `tat salca 830g domates salcasi`

## 11. Reyon Taxonomy Durumu

Tarih: `2026-04-11`

Market reyonu/category taxonomy agaci Barkod Analiz istemcisine baglandi. Istemci artik su akisi kullaniyor:

- kok reyonlar: `mg_rpc_list_categories(null, null, 1, null, false, true)`
- alt reyonlar: `mg_rpc_list_categories(cityCode, selectedCategoryId, 1, null, false, true)`
- kategori secimi sonrasi urun arama: `mg_rpc_search_products(q, cityCode, limit, selectedCategoryId)`

### 11.1 Canli Bulgular

Guncel contract ile kategori agaci ucu canli testte dogrulandi:

- `mg_rpc_list_categories(null, null, 1, null, false, true)` -> `200`
- `mg_rpc_list_categories("34", "mgcat:91cf827101757686", 1, null, false, true)` -> `200`

Donen response:

- `nodes[]`
- `parent_category_id`
- `taxonomy_leaf`
- `taxonomy_path`
- `normalized_category_id`
- `children_count`
- `sort_order`

Onemli not:

- `p_include_counts=false` yolu ilk acilis icin calisiyor ve hizli
- count alanlari bu modda `null` donebilir; bu beklenen durum
- onceki timeout davranisi `include_counts=true` ile baglantiliydi

Istemci bu nedenle ilk acilista ve alt reyon acisinda `include_counts=false` kullaniyor.

### 11.2 Barkod Analiz Tarafinda Yapilan Koruma

Istemci tarafinda su korumalar eklendi:

- kategori kok yukleme timeout'u 4500 ms yerine 12000 ms yapildi
- kok reyon yuklemesi city filtresiz hale getirildi
- taxonomy ucu gecici olarak cevap vermezse, arama sonucu geldigi anda kategori filtresi search sonuclarindan turetilebiliyor

Yani uygulama tarafi hem yeni contract ile canli taxonomy kullaniyor hem de gecici aksaklikta fallback davranisa sahip.

### 11.3 Market Gelsin Tarafinda Beklenen Duzeltme

Asagidaki maddelerle endpoint kapanmis sayilabilir:

- `mg_rpc_list_categories` `include_counts=true` modunda da stabil ve kabul edilebilir surede donebilmeli
- depth `1` icin kok kategori listesi 2-3 saniye bandinda donebilmeli
- `parent_category_id` ve `sort_order` tutarli olmali
- `include_counts = true` ve `false` modlari farkli performans profiliyle net ayrismali
- gerekiyorsa counts hesabi async/materialized katmana alinmali

### 11.4 Etki

Bu duzeltme gelince Barkod Analiz tarafinda:

- `Fiyat` ekraninda market reyonu agaci acilis aninda dolacak
- alt reyonlar lazy-load ile acilacak
- kategori secimiyle urun arama daha hizli ve daha yonlendirilmis calisacak

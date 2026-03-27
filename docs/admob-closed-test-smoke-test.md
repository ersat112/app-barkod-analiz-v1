# AdMob Closed Test Smoke Test

Bu not, production benzeri Android build kapali test kanalina yüklendikten sonra reklam davranisini dogrulamak icin kullanilir.

## On Kosullar

1. Uygulama Play test kanalindan yuklenmis olmali.
2. Build Expo Go degil, native release/test build olmali.
3. AdMob uygulama id ve unit id'leri native metadata icinde dogru olmali.
4. Tester cihazda Google Play Store etkin olmali.

## Banner Kontrolu

1. Ana sayfayi ac.
2. Hero alani ile dashboard kartlari arasindaki banner yuzeyini kontrol et.
3. Beklenen sonuc:
   - banner alani layout bozmayacak sekilde gorunur
   - bazen ilk acilista gec yuklenebilir
4. Reklam gelmezse:
   - uygulamayi kapat / ac
   - farkli bir sayfaya gecip geri don

## Rewarded / Full Screen Kontrolu

1. Ucretsiz kullanicida gunluk tarama limitini asan akisi dene.
2. Barkod sonucu ekraninda full screen reklam tetikleniyor mu bak.
3. Beklenen sonuc:
   - reklam acilir
   - kapaninca detail akisi bozulmaz
   - reward / close loglari gelir

## App Open Kontrolu

1. Uygulamayi tamamen kapat.
2. Yeniden ac.
3. Beklenen sonuc:
   - ilk acilista app-open uygun doluluk varsa gorunebilir
   - gorunmese bile acilis akisi bozulmamali

## Kabul Kriterleri

1. Banner en az bir test cihazda servis almali.
2. Rewarded / full screen akisi uygulamayi kilitlememeli.
3. App-open reklam acilmadiginda bile cold start bozulmamali.
4. Test build loglarinda surekli crash ya da initialization hatasi olmamali.

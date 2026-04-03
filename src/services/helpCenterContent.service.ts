export type HelpArticleKey =
  | 'appBasics'
  | 'nutriScore'
  | 'sensitivities'
  | 'database';

export type HelpArticleSection = {
  key: string;
  title: string;
  body: string;
};

export type HelpArticle = {
  key: HelpArticleKey;
  title: string;
  subtitle: string;
  sections: HelpArticleSection[];
};

type TranslateFn = (key: string, fallback: string) => string;

export const buildHelpArticle = (
  articleKey: HelpArticleKey,
  tt: TranslateFn
): HelpArticle => {
  switch (articleKey) {
    case 'nutriScore':
      return {
        key: 'nutriScore',
        title: tt('help_article_nutri_score_title', 'Nutri-Score ve Besin Dengesi'),
        subtitle: tt(
          'help_article_nutri_score_subtitle',
          'Nutri-Score, zorunlu besin tablosunun yerine geçmez; onu tamamlayan ön yüz etiketidir.'
        ),
        sections: [
          {
            key: 'what',
            title: tt('help_article_nutri_score_what', 'Nutri-Score nedir?'),
            body: tt(
              'help_article_nutri_score_what_body',
              'Resmi Nutri-Score sistemi, ürünleri A ile E arasında ve beş renkli bir ölçekle özetler. Amaç, kullanıcıya 100 g veya 100 mL bazında daha hızlı bir beslenme okuması sunmaktır.'
            ),
          },
          {
            key: 'signals',
            title: tt('help_article_nutri_score_signals', 'Hangi sinyaller kullanılır?'),
            body: tt(
              'help_article_nutri_score_signals_body',
              'Sınırlandırılması gereken enerji, doymuş yağ, şeker ve tuz gibi alanlarla; teşvik edilen lif, protein ve meyve-sebze-baklagil oranı birlikte değerlendirilir. BarkodAnaliz, bu resmi yaklaşımı ürünün besin dengesi ekranında daha okunur hale getirir.'
            ),
          },
          {
            key: 'text-limit',
            title: tt('help_article_nutri_score_limits', 'Metin okuma modunda sınır'),
            body: tt(
              'help_article_nutri_score_limits_body',
              'Sadece içindekiler metni okutulursa resmi Nutri-Score eşdeğeri üretilemez. Gıda için hem içindekiler hem de besin değerleri tablosu okunmalıdır; aksi halde sonuç yalnızca içerik sinyali olarak değerlendirilir.'
            ),
          },
        ],
      };
    case 'sensitivities':
      return {
        key: 'sensitivities',
        title: tt('help_article_sensitivities_title', 'Hassas Maddeler ve Aile Profili'),
        subtitle: tt(
          'help_article_sensitivities_subtitle',
          'Alerjenler, izlenen katkılar ve sağlık odakları ürün skorundan ayrı bir kişisel uygunluk katmanı üretir.'
        ),
        sections: [
          {
            key: 'profile',
            title: tt('help_article_sensitivities_profile', 'Aile profili ne yapar?'),
            body: tt(
              'help_article_sensitivities_profile_body',
              'Aile ve Sağlık Profili; gluten, süt, yumurta, fıstık, balık ve benzeri hassas maddeleri izleyerek detay ekranında ek uyarılar oluşturur. Bu yapı sağlık skorunu değiştirmez, yalnızca kişisel risk görünürlüğünü artırır.'
            ),
          },
          {
            key: 'additives',
            title: tt('help_article_sensitivities_additives', 'Katkı takibi nasıl çalışır?'),
            body: tt(
              'help_article_sensitivities_additives_body',
              'Kullanıcı belirli katkı kodlarını izleme listesine ekleyebilir. Üründe bu kodlardan biri bulunduğunda aile profiline özel uyarı kartı görünür.'
            ),
          },
          {
            key: 'limits',
            title: tt('help_article_sensitivities_limits', 'Bu alanın sınırı nedir?'),
            body: tt(
              'help_article_sensitivities_limits_body',
              'Alerji, intolerans veya tıbbi kısıtlar için son doğrulama her zaman ambalaj, resmi prospektüs ve gerekirse sağlık profesyoneli yönlendirmesiyle yapılmalıdır.'
            ),
          },
        ],
      };
    case 'database':
      return {
        key: 'database',
        title: tt('help_article_database_title', 'Veritabanı ve Kaynaklar'),
        subtitle: tt(
          'help_article_database_subtitle',
          'BarkodAnaliz, tek bir kaynağa bağlı kalmadan resmi kayıtlar ve açık verilerle çalışan hibrit bir okuma katmanı kullanır.'
        ),
        sections: [
          {
            key: 'food-beauty',
            title: tt('help_article_database_consumer', 'Gıda ve kozmetik kaynakları'),
            body: tt(
              'help_article_database_consumer_body',
              'Gıda tarafında Open Food Facts, kozmetikte Open Beauty Facts ve uygulama içi içerik sinyalleri birlikte kullanılır. Güçlü ürün eşleşmesi varsa yapısal veri, eşleşme yoksa içerik sinyali mantığı devreye girer.'
            ),
          },
          {
            key: 'medicine',
            title: tt('help_article_database_medicine', 'İlaç kaynakları'),
            body: tt(
              'help_article_database_medicine_body',
              'İlaç ekranlarında topluluk verisi yerine resmi TITCK kayıtları, prospektüs ve KÜB belgeleri önceliklidir. Bu nedenle ilaç yüzeyi diğer kategorilere göre daha resmi bir veri zincirine dayanır.'
            ),
          },
          {
            key: 'pricing',
            title: tt('help_article_database_pricing', 'Fiyat kaynakları'),
            body: tt(
              'help_article_database_pricing_body',
              'Market fiyatları market_gelsin API katmanından alınır. Fiyat servisi bağlı değilse uygulama bunu gizlemez; fiyat ekranında ve ayarlardaki tanılama alanında açık durum mesajı gösterir.'
            ),
          },
        ],
      };
    case 'appBasics':
    default:
      return {
        key: 'appBasics',
        title: tt('help_article_basics_title', 'BarkodAnaliz Nasıl Çalışır?'),
        subtitle: tt(
          'help_article_basics_subtitle',
          'Tarama, skor, fiyat ve kişisel uygunluk yüzeyleri aynı ürün kartında birleşir.'
        ),
        sections: [
          {
            key: 'scan',
            title: tt('help_article_basics_scan', 'Tarama modları'),
            body: tt(
              'help_article_basics_scan_body',
              'Tek kamera ekranında gıda, kozmetik, ilaç ve metin modları bulunur. Kullanıcı modu seçer; barkod okutma veya OCR okuma aynı yüzey üzerinde devam eder.'
            ),
          },
          {
            key: 'score',
            title: tt('help_article_basics_score', 'Skor nasıl sunulur?'),
            body: tt(
              'help_article_basics_score_body',
              'Ürün ekranında önce toplam skor, ardından negatifler/pozitifler, besin dengesi, aile uyarıları ve gerekiyorsa fiyat karşılaştırması gösterilir. Amaç tek bakışta karar verebilmektir.'
            ),
          },
          {
            key: 'price',
            title: tt('help_article_basics_price', 'Fiyat katmanı'),
            body: tt(
              'help_article_basics_price_body',
              'Fiyat kartları market bazında tablo mantığıyla gösterilir. Kullanıcı markete dokunarak fiyat, birim fiyat, stok, mesafe ve kaynak bağlantısını açabilir.'
            ),
          },
          {
            key: 'history',
            title: tt('help_article_basics_history', 'Geçmiş ve kayıtlar'),
            body: tt(
              'help_article_basics_history_body',
              'Son taramalar sade liste halinde tutulur. Premium yüzeylerde favoriler, ilaç/prospektüs kayıtları ve daha gelişmiş geçmiş araçları açılır.'
            ),
          },
        ],
      };
  }
};

export type HelpArticleKey =
  | 'appBasics'
  | 'nutriScore'
  | 'riskUpdates'
  | 'scientificSources'
  | 'sensitivities'
  | 'database'
  | 'googleSignIn'
  | 'adsAndPremium';

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
          'BarkodAnaliz gıdada resmi Nutri-Score alanlarını önceliklendirir; veri eksikse besin tablosundan yerel bir besin dengesi tabanı türetir.'
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
              'Sınırlandırılması gereken enerji, doymuş yağ, şeker ve tuz gibi alanlarla; teşvik edilen lif, protein ve meyve-sebze-baklagil oranı birlikte değerlendirilir. BarkodAnaliz bu sinyalleri önce resmi kaynak skorunda arar, sonra eksikse yerel besin tablosu türetmesiyle tamamlar.'
            ),
          },
          {
            key: 'current-model',
            title: tt('help_article_nutri_score_current_model', 'Bizde şu an nasıl çalışıyor?'),
            body: tt(
              'help_article_nutri_score_current_model_body',
              'Uygulama önce Open Food Facts tarafından verilen sayısal puanı veya A-E derecesini 0-100 aralığına normalize eder. Bu veri yoksa enerji, doymuş yağ, şeker, tuz, protein, lif ve meyve-sebze sinyallerinden hibrit bir besin dengesi skoru üretir. Son aşamada katkı sinyali ve NOVA işlenme seviyesi toplam skora kontrollü biçimde eklenir.'
            ),
          },
          {
            key: 'exactness',
            title: tt('help_article_nutri_score_exactness', 'Resmi Nutri-Score’u birebir uygulayabilir miyiz?'),
            body: tt(
              'help_article_nutri_score_exactness_body',
              'Evet, ama bunu toplam ürün skorundan ayrı bir resmi alt sinyal olarak tutmak daha doğrudur. Tam birebir uygulama için içecek, yağ, peynir ve özel kategori istisnalarının da resmi puanlama formülüyle ele alınması gerekir. Şu an BarkodAnaliz yaklaşımı resmi sinyali önceliklendiren hibrit bir modeldir.'
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
    case 'riskUpdates':
      return {
        key: 'riskUpdates',
        title: tt('help_article_risk_updates_title', 'Risk Seviyesi Güncellemeleri'),
        subtitle: tt(
          'help_article_risk_updates_subtitle',
          'Risk verisinin zaman içinde değişmesi normaldir; önemli olan bunun sürümlü ve kaynaklı biçimde yönetilmesidir.'
        ),
        sections: [
          {
            key: 'food-additives',
            title: tt('help_article_risk_updates_food', 'Katkı maddelerinde bugün ne yapabiliriz?'),
            body: tt(
              'help_article_risk_updates_food_body',
              'Gıda tarafında bu yapı hemen uygulanabilir; çünkü uygulamada zaten katkı kataloğu bulunuyor. Doğru yaklaşım, her katkı için güncel risk seviyesi, son gözden geçirme tarihi, kaynak kurum etiketleri ve varsa önceki risk seviyesini birlikte saklamaktır.'
            ),
          },
          {
            key: 'beauty',
            title: tt('help_article_risk_updates_beauty', 'Kozmetikte sınırımız ne?'),
            body: tt(
              'help_article_risk_updates_beauty_body',
              'Kozmetikte artık ayrı bir içerik risk kayıt defteri kullanılmaya başlandı. BarkodAnaliz; Open Beauty Facts kaydı, içerik metni ve yerel kozmetik risk sözlüğünü birlikte okuyarak ilk sürüm bir risk motoru üretir. Ancak kapsam henüz tüm INCI evrenini karşılamaz; bu yüzden sistem sürümlü olarak genişletilmelidir.'
            ),
          },
          {
            key: 'policy',
            title: tt('help_article_risk_updates_policy', 'Nasıl yayınlamalıyız?'),
            body: tt(
              'help_article_risk_updates_policy_body',
              'En güvenli yaklaşım; değişiklik özeti, tarih, etkilenen bileşen, eski seviye, yeni seviye ve kısa bilimsel gerekçeyi birlikte göstermektir. Kullanıcıya yalnız sonucu değil, değişikliğin hangi kurumsal veya bilimsel dayanakla geldiğini de açıklamak gerekir.'
            ),
          },
        ],
      };
    case 'scientificSources':
      return {
        key: 'scientificSources',
        title: tt('help_article_scientific_sources_title', 'Bilimsel Kaynaklar'),
        subtitle: tt(
          'help_article_scientific_sources_subtitle',
          'Kaynak listesini göstermek doğru; ancak başka bir uygulamanın metnini kopyalamadan, kendi yorum sınırlarımızla sunmalıyız.'
        ),
        sections: [
          {
            key: 'institutions',
            title: tt('help_article_scientific_sources_institutions', 'Hangi kurumları göstermeliyiz?'),
            body: tt(
              'help_article_scientific_sources_institutions_body',
              'Gıda için WHO, IARC, EFSA, ANSES ve Open Food Facts; kozmetik için SCCS, ECHA, US EPA, AICIS ve Open Beauty Facts; ilaç için ise TITCK gibi resmi ve yarı-resmi kurumlar ayrı ayrı listelenebilir.'
            ),
          },
          {
            key: 'style',
            title: tt('help_article_scientific_sources_style', 'Nasıl listelemeliyiz?'),
            body: tt(
              'help_article_scientific_sources_style_body',
              'En doğru biçim; kurum adı, neyi desteklediği ve gerekiyorsa resmi bağlantısını göstermektir. Böylece kullanıcı veri zincirini görür, ama BarkodAnaliz kendi editoryal bağımsızlığını da korur.'
            ),
          },
          {
            key: 'copyright',
            title: tt('help_article_scientific_sources_copyright', 'Aynen kopyalayalım mı?'),
            body: tt(
              'help_article_scientific_sources_copyright_body',
              'Hayır. Bilimsel kaynak kurumlarını ve resmi bağlantıları açıkça listeleyebiliriz; fakat başka bir ürünün yardım merkezi anlatımını veya editoryal metinlerini birebir kopyalamak yerine kendi metodolojimizi ve sınırlarımızı anlatmalıyız.'
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
              'Market fiyatları market_gelsin API katmanından alınır. Fiyatlar geçici olarak yüklenemezse uygulama bunu kısa bir bilgi mesajıyla açıkça belirtir.'
            ),
          },
        ],
      };
    case 'googleSignIn':
      return {
        key: 'googleSignIn',
        title: tt('help_article_google_title', 'Google ile Giriş'),
        subtitle: tt(
          'help_article_google_subtitle',
          'Google oturumu, Firebase kimlik doğrulamasıyla güvenli şekilde tamamlanır.'
        ),
        sections: [
          {
            key: 'how',
            title: tt('help_article_google_how', 'Nasıl çalışır?'),
            body: tt(
              'help_article_google_how_body',
              'Google ile giriş akışı, cihazdaki Google kimlik doğrulamasını Firebase hesabına bağlar. Başarılı olduğunda kullanıcı profili ve izinli hesap verileri uygulamaya senkronlanır.'
            ),
          },
          {
            key: 'email',
            title: tt('help_article_google_email', 'E-posta doğrulaması gerekir mi?'),
            body: tt(
              'help_article_google_email_body',
              'Google ile girişte hesap, sağlayıcı tarafından doğrulanmış kabul edilir. E-posta ve şifre ile kayıt olan kullanıcılar için ayrıca doğrulama e-postası istenir.'
            ),
          },
          {
            key: 'errors',
            title: tt('help_article_google_errors', 'Ne zaman başarısız olabilir?'),
            body: tt(
              'help_article_google_errors_body',
              'Play Services eksikse, Google hesabı iptal edilirse veya ağ bağlantısı yoksa giriş tamamlanmayabilir. Bu durumda uygulama güvenli şekilde standart giriş ekranında kalır.'
            ),
          },
        ],
      };
    case 'adsAndPremium':
      return {
        key: 'adsAndPremium',
        title: tt('help_article_ads_title', 'Reklamlar ve Premium'),
        subtitle: tt(
          'help_article_ads_subtitle',
          'Ücretsiz model reklam desteklidir; premium ise reklamsız ve daha güçlü araçlar açar.'
        ),
        sections: [
          {
            key: 'ad-types',
            title: tt('help_article_ads_types', 'Hangi reklamlar gösterilir?'),
            body: tt(
              'help_article_ads_types_body',
              'Uygulamada banner, geçiş, ödüllü reklam ve uygulama açılış reklamı yüzeyleri bulunur. Reklamlar özellikle tarama ve ücretsiz kullanım akışını desteklemek için kullanılır.'
            ),
          },
          {
            key: 'reward',
            title: tt('help_article_ads_reward', 'Ödüllü reklam neden var?'),
            body: tt(
              'help_article_ads_reward_body',
              'Günlük ücretsiz tarama hakkı dolduğunda kullanıcı isterse ödüllü reklam izleyip ek hak kazanabilir. Bu akış zorunlu değil; premium kullanıcılar reklamsız devam eder.'
            ),
          },
          {
            key: 'premium',
            title: tt('help_article_ads_premium', 'Premium neyi değiştirir?'),
            body: tt(
              'help_article_ads_premium_body',
              'Premium; reklamsız kullanım, daha geniş fiyat ve sepet araçları, gelişmiş geçmiş ve akıllı alışveriş yüzeyleri açar. Skor mantığı premium veya reklam durumuna göre değişmez.'
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

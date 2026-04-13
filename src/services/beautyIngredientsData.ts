import { SCIENTIFIC_SOURCE_RECORDS } from './scientificSourcesData';

export type BeautyIngredientRisk = 'Düşük' | 'Orta' | 'Yüksek';

export type BeautyIngredientRiskHistoryEntry = {
  date: string;
  previousRisk?: BeautyIngredientRisk;
  nextRisk: BeautyIngredientRisk;
  note: string;
};

export type BeautyIngredientInfo = {
  key: string;
  inciName: string;
  risk: BeautyIngredientRisk;
  category: string;
  summary: string;
  impact: string;
  aliases?: string[];
  sourceKeys?: string[];
  riskHistory?: BeautyIngredientRiskHistoryEntry[];
};

const normalizeText = (value: string): string =>
  String(value || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[^\p{L}\p{N}+]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const BEAUTY_INGREDIENTS_DATA: Record<string, BeautyIngredientInfo> = {
  FRAGRANCE: {
    key: 'FRAGRANCE',
    inciName: 'Parfum',
    risk: 'Orta',
    category: 'Koku karışımı',
    summary:
      'Tek tek açıklanmayan koku karışımlarında alerjen veya hassaslaştırıcı bileşenler bulunabilir.',
    impact:
      'Parfüm karışımları hassas ciltlerde reaksiyon riskini artırabilir; ayrıntılı içerik şeffaflığı her zaman yüksek değildir.',
    aliases: ['PARFUM', 'FRAGRANCE', 'AROMA'],
    sourceKeys: ['sccs', 'echa', 'obf'],
  },
  PHENOXYETHANOL: {
    key: 'PHENOXYETHANOL',
    inciName: 'Phenoxyethanol',
    risk: 'Orta',
    category: 'Koruyucu',
    summary: 'Kozmetikte yaygın koruyucu olarak kullanılır.',
    impact:
      'Düşük dozlarda yaygın kullanılsa da hassas cilt ve göz çevresi ürünlerinde dikkatle değerlendirilir.',
    aliases: ['PHENOXYETHANOL'],
    sourceKeys: ['sccs', 'echa'],
  },
  ALCOHOL_DENAT: {
    key: 'ALCOHOL_DENAT',
    inciName: 'Alcohol Denat.',
    risk: 'Orta',
    category: 'Çözücü',
    summary: 'Bazı formüllerde taşıyıcı ve hızlı kurutucu çözücü olarak kullanılır.',
    impact:
      'Hassas ciltlerde kurutma ve bariyer zayıflatma ihtimali nedeniyle dikkat işareti taşıyabilir.',
    aliases: ['ALCOHOL DENAT', 'DENATURED ALCOHOL', 'ALCOHOL'],
    sourceKeys: ['obf'],
  },
  BENZYL_ALCOHOL: {
    key: 'BENZYL_ALCOHOL',
    inciName: 'Benzyl Alcohol',
    risk: 'Orta',
    category: 'Koruyucu / koku bileşeni',
    summary: 'Koruyucu ve parfüm bileşeni olarak birden fazla rolde kullanılabilir.',
    impact:
      'Hassas kullanıcılar için iritasyon veya alerjen uyarısı gerektirebilir.',
    aliases: ['BENZYL ALCOHOL'],
    sourceKeys: ['sccs', 'echa'],
  },
  TITANIUM_DIOXIDE_NANO: {
    key: 'TITANIUM_DIOXIDE_NANO',
    inciName: 'Titanium Dioxide [nano]',
    risk: 'Orta',
    category: 'UV filtresi / renklendirici',
    summary:
      'Nano formdaki titanyum dioksit için kullanım şekline göre daha ihtiyatlı yorum gerekir.',
    impact:
      'Özellikle sprey ve ağız çevresi kullanımında inhalasyon veya yutma bağlamı daha dikkatli değerlendirilir.',
    aliases: ['TITANIUM DIOXIDE [NANO]', 'CI 77891 [NANO]', 'TITANIUM DIOXIDE NANO'],
    sourceKeys: ['sccs', 'echa'],
    riskHistory: [
      {
        date: '2024-02',
        previousRisk: 'Düşük',
        nextRisk: 'Orta',
        note: 'Nano form ve kullanım bağlamı için ihtiyat düzeyi artırıldı.',
      },
    ],
  },
  TITANIUM_DIOXIDE: {
    key: 'TITANIUM_DIOXIDE',
    inciName: 'Titanium Dioxide',
    risk: 'Düşük',
    category: 'UV filtresi / renklendirici',
    summary:
      'Nano olmayan form, ürün kategorisine göre daha düşük risk sinyaliyle değerlendirilir.',
    impact:
      'Sprey, inhalasyon veya yutma ihtimali olan ürünlerde bağlam yeniden değerlendirilmelidir.',
    aliases: ['TITANIUM DIOXIDE', 'CI 77891'],
    sourceKeys: ['sccs', 'echa'],
  },
  OXYBENZONE: {
    key: 'OXYBENZONE',
    inciName: 'Benzophenone-3',
    risk: 'Orta',
    category: 'UV filtresi',
    summary:
      'Bazı kullanıcılar tarafından kaçınılan tartışmalı güneş filtresi bileşenlerinden biridir.',
    impact:
      'Hassasiyet ve endokrin etki tartışmaları nedeniyle ihtiyatlı kullanıcı özetlerinde dikkat işareti taşır.',
    aliases: ['BENZOPHENONE-3', 'OXYBENZONE'],
    sourceKeys: ['sccs', 'echa', 'us-epa'],
  },
  OCTOCRYLENE: {
    key: 'OCTOCRYLENE',
    inciName: 'Octocrylene',
    risk: 'Orta',
    category: 'UV filtresi',
    summary: 'Güneş koruma ürünlerinde yaygın kullanılan filtrelerden biridir.',
    impact:
      'Hassas ciltlerde ve belirli UV filtre kombinasyonlarında daha dikkatli değerlendirilir.',
    aliases: ['OCTOCRYLENE'],
    sourceKeys: ['sccs', 'echa'],
    riskHistory: [
      {
        date: '2026-04',
        previousRisk: 'Düşük',
        nextRisk: 'Orta',
        note: 'UV filtre tartışmaları nedeniyle ihtiyat seviyesi yükseltildi.',
      },
    ],
  },
  HOMOSALATE: {
    key: 'HOMOSALATE',
    inciName: 'Homosalate',
    risk: 'Orta',
    category: 'UV filtresi',
    summary: 'Güneş koruyucu formüllerde kullanılan kimyasal filtrelerden biridir.',
    impact:
      'Bazı hassasiyet ve maruziyet tartışmaları nedeniyle orta riskli işaretlenir.',
    aliases: ['HOMOSALATE'],
    sourceKeys: ['sccs', 'echa'],
  },
  ETHYLHEXYL_METHOXYCINNAMATE: {
    key: 'ETHYLHEXYL_METHOXYCINNAMATE',
    inciName: 'Ethylhexyl Methoxycinnamate',
    risk: 'Orta',
    category: 'UV filtresi',
    summary: 'Güneş koruma ürünlerinde yaygın görülen filtrelerden biridir.',
    impact:
      'UV filtre tartışmaları ve hassasiyet sinyalleri nedeniyle ihtiyatlı yorum alır.',
    aliases: ['ETHYLHEXYL METHOXYCINNAMATE', 'OCTINOXATE'],
    sourceKeys: ['sccs', 'echa'],
  },
  SODIUM_LAURYL_SULFATE: {
    key: 'SODIUM_LAURYL_SULFATE',
    inciName: 'Sodium Lauryl Sulfate',
    risk: 'Orta',
    category: 'Yüzey aktif',
    summary:
      'Temizleme gücü yüksek, fakat tahriş potansiyeli daha belirgin bir yüzey aktif maddedir.',
    impact:
      'Özellikle hassas cilt ve sık kullanım senaryolarında kurutma veya iritasyon riskiyle anılır.',
    aliases: ['SODIUM LAURYL SULFATE', 'SLS'],
    sourceKeys: ['sccs', 'echa'],
  },
  SODIUM_LAURETH_SULFATE: {
    key: 'SODIUM_LAURETH_SULFATE',
    inciName: 'Sodium Laureth Sulfate',
    risk: 'Orta',
    category: 'Yüzey aktif',
    summary: 'SLS kadar sert olmasa da hassas ciltlerde dikkat gerektirebilir.',
    impact:
      'Temizleyici ve köpürtücü yapısı nedeniyle sık kullanımda kuruluk veya iritasyon hissi yaratabilir.',
    aliases: ['SODIUM LAURETH SULFATE', 'SLES'],
    sourceKeys: ['sccs', 'echa'],
  },
  COCAMIDOPROPYL_BETAINE: {
    key: 'COCAMIDOPROPYL_BETAINE',
    inciName: 'Cocamidopropyl Betaine',
    risk: 'Orta',
    category: 'Yüzey aktif',
    summary: 'Şampuan ve temizleyicilerde köpürtücü olarak sık kullanılır.',
    impact:
      'Genel kabul gören bir içerik olsa da hassas kullanıcılar için iritasyon sinyali oluşturabilir.',
    aliases: ['COCAMIDOPROPYL BETAINE'],
    sourceKeys: ['sccs', 'obf'],
  },
  TRICLOSAN: {
    key: 'TRICLOSAN',
    inciName: 'Triclosan',
    risk: 'Yüksek',
    category: 'Antimikrobiyal',
    summary:
      'Yüksek tartışma düzeyi nedeniyle ihtiyatlı modellerde sert cezalandırılan bileşenlerden biridir.',
    impact:
      'Düzenleyici ve bilimsel tartışma düzeyi yüksek olduğu için yüksek risk sinyaliyle değerlendirilir.',
    aliases: ['TRICLOSAN'],
    sourceKeys: ['echa', 'us-epa', 'fda'],
  },
  METHYLISOTHIAZOLINONE: {
    key: 'METHYLISOTHIAZOLINONE',
    inciName: 'Methylisothiazolinone',
    risk: 'Yüksek',
    category: 'Koruyucu',
    summary:
      'Kuvvetli alerjen duyarlılığı nedeniyle birçok ihtiyatlı modelde yüksek risk işareti taşır.',
    impact:
      'Özellikle durulanmayan ürünlerde alerjik reaksiyon riski nedeniyle öne çıkan koruyuculardandır.',
    aliases: ['METHYLISOTHIAZOLINONE', 'MIT'],
    sourceKeys: ['sccs', 'echa'],
  },
  METHYLCHLOROISOTHIAZOLINONE: {
    key: 'METHYLCHLOROISOTHIAZOLINONE',
    inciName: 'Methylchloroisothiazolinone',
    risk: 'Yüksek',
    category: 'Koruyucu',
    summary:
      'Duyarlılık ve iritasyon tartışmaları nedeniyle yüksek risk grubunda ele alınır.',
    impact:
      'Alerjik kontakt dermatit bağlamında en sık dikkat edilen koruyuculardan biridir.',
    aliases: ['METHYLCHLOROISOTHIAZOLINONE', 'MCI'],
    sourceKeys: ['sccs', 'echa'],
  },
  BHA: {
    key: 'BHA',
    inciName: 'BHA',
    risk: 'Yüksek',
    category: 'Antioksidan',
    summary: 'Uzun süredir tartışmalı antioksidan bileşenlerden biridir.',
    impact:
      'İhtiyatlı kozmetik modellerinde yüksek tartışma düzeyi nedeniyle ağır cezalandırılır.',
    aliases: ['BHA', 'BUTYLATED HYDROXYANISOLE'],
    sourceKeys: ['iarc', 'echa', 'fda'],
  },
  BHT: {
    key: 'BHT',
    inciName: 'BHT',
    risk: 'Orta',
    category: 'Antioksidan',
    summary:
      'Koruyucu antioksidan olarak kullanılır, ancak hassasiyet ve uzun dönem etkiler açısından tartışmalıdır.',
    impact:
      'Tam yasaklı olmasa da ihtiyatlı kullanıcılar için dikkat işareti taşır.',
    aliases: ['BHT', 'BUTYLATED HYDROXYTOLUENE'],
    sourceKeys: ['echa', 'fda'],
  },
  PEG_40_HYDROGENATED_CASTOR_OIL: {
    key: 'PEG_40_HYDROGENATED_CASTOR_OIL',
    inciName: 'PEG-40 Hydrogenated Castor Oil',
    risk: 'Orta',
    category: 'Çözücü / emülgatör',
    summary: 'PEG türevleri arasında en sık karşılaşılan bileşenlerden biridir.',
    impact:
      'Saflık ve üretim kalıntıları bağlamında ihtiyatlı modellerde orta riskli olarak tutulabilir.',
    aliases: ['PEG-40 HYDROGENATED CASTOR OIL'],
    sourceKeys: ['echa', 'obf'],
  },
  PROPYLPARABEN: {
    key: 'PROPYLPARABEN',
    inciName: 'Propylparaben',
    risk: 'Orta',
    category: 'Koruyucu',
    summary: 'Paraben ailesinin tartışmalı üyelerindendir.',
    impact:
      'Koruyucu olarak yaygın kullanılsa da ihtiyatlı modellerde orta riskli olarak işaretlenir.',
    aliases: ['PROPYLPARABEN'],
    sourceKeys: ['sccs', 'echa'],
  },
  BUTYLPARABEN: {
    key: 'BUTYLPARABEN',
    inciName: 'Butylparaben',
    risk: 'Yüksek',
    category: 'Koruyucu',
    summary: 'Paraben ailesinde daha sert uyarı verilen maddelerden biridir.',
    impact:
      'Yüksek tartışma düzeyi nedeniyle ihtiyatlı yorumlarda kırmızı risk sınıfına çekilir.',
    aliases: ['BUTYLPARABEN'],
    sourceKeys: ['sccs', 'echa'],
  },
  ETHYLPARABEN: {
    key: 'ETHYLPARABEN',
    inciName: 'Ethylparaben',
    risk: 'Orta',
    category: 'Koruyucu',
    summary: 'Paraben grubunda yer alan koruyuculardan biridir.',
    impact:
      'Paraben hassasiyeti olan kullanıcılar için dikkat sinyali üretir.',
    aliases: ['ETHYLPARABEN'],
    sourceKeys: ['sccs', 'echa'],
  },
  METHYLPARABEN: {
    key: 'METHYLPARABEN',
    inciName: 'Methylparaben',
    risk: 'Orta',
    category: 'Koruyucu',
    summary: 'Klasik koruyucu bileşenlerden biridir.',
    impact:
      'Tek başına en sert sınıfta olmayabilir, ancak ihtiyatlı modellerde orta riskli tutulur.',
    aliases: ['METHYLPARABEN'],
    sourceKeys: ['sccs', 'echa'],
  },
  LILIAL: {
    key: 'LILIAL',
    inciName: 'Butylphenyl Methylpropional',
    risk: 'Yüksek',
    category: 'Parfüm bileşeni',
    summary: 'Düzenleyici geçmişi nedeniyle yüksek riskli sinyal olarak işaretlenir.',
    impact:
      'Tartışmalı güvenlik geçmişi nedeniyle hassas yorum motorlarında en sert cezayı alan içeriklerden biridir.',
    aliases: ['BUTYLPHENYL METHYLPROPIONAL', 'LILIAL'],
    sourceKeys: ['echa', 'sccs'],
    riskHistory: [
      {
        date: '2026-04',
        previousRisk: 'Orta',
        nextRisk: 'Yüksek',
        note: 'Düzenleyici tartışma ve güvenlik hassasiyeti nedeniyle kırmızı seviyeye çekildi.',
      },
    ],
  },
  LIMONENE: {
    key: 'LIMONENE',
    inciName: 'Limonene',
    risk: 'Düşük',
    category: 'Koku bileşeni',
    summary: 'Uçucu yağ ve koku bileşeni olarak yaygındır.',
    impact:
      'Hassas kullanıcılar için alerjen uyarısı taşıyabilir, ancak genel risk seviyesi düşüktür.',
    aliases: ['LIMONENE'],
    sourceKeys: ['sccs', 'echa'],
  },
  LINALOOL: {
    key: 'LINALOOL',
    inciName: 'Linalool',
    risk: 'Düşük',
    category: 'Koku bileşeni',
    summary: 'Parfüm ve bitkisel yağlarda sık görülen bileşendir.',
    impact:
      'Okside olmuş formlarda hassasiyet oluşturabilse de temel risk seviyesi düşüktür.',
    aliases: ['LINALOOL'],
    sourceKeys: ['sccs', 'echa'],
  },
  CITRONELLOL: {
    key: 'CITRONELLOL',
    inciName: 'Citronellol',
    risk: 'Düşük',
    category: 'Koku bileşeni',
    summary: 'Koku alerjeni etiketlerinde sık görülen parfüm bileşenidir.',
    impact:
      'Hassas kullanıcı için uyarı gerektirebilir, ancak temel risk seviyesi düşüktür.',
    aliases: ['CITRONELLOL'],
    sourceKeys: ['sccs', 'echa'],
  },
  GERANIOL: {
    key: 'GERANIOL',
    inciName: 'Geraniol',
    risk: 'Düşük',
    category: 'Koku bileşeni',
    summary: 'Esansiyel yağlarda ve parfüm karışımlarında görülebilir.',
    impact:
      'Alerjen etiketi gerektirebilir, ancak genel risk seviyesi düşüktür.',
    aliases: ['GERANIOL'],
    sourceKeys: ['sccs', 'echa'],
  },
  HEXYL_CINNAMAL: {
    key: 'HEXYL_CINNAMAL',
    inciName: 'Hexyl Cinnamal',
    risk: 'Düşük',
    category: 'Koku bileşeni',
    summary: 'Yaygın bir parfüm alerjeni olarak etiketlerde görülebilir.',
    impact:
      'Hassas bünyeler için uyarı gerektirebilir, ancak tek başına yüksek risk grubunda değerlendirilmez.',
    aliases: ['HEXYL CINNAMAL'],
    sourceKeys: ['sccs', 'echa'],
  },
  SALICYLIC_ACID: {
    key: 'SALICYLIC_ACID',
    inciName: 'Salicylic Acid',
    risk: 'Orta',
    category: 'Aktif bakım bileşeni',
    summary: 'Akne ve peeling ürünlerinde sık kullanılan aktif içeriktir.',
    impact:
      'Doz, kullanım sıklığı ve kullanıcı profiline göre hassasiyet uyarısı gerektirebilir.',
    aliases: ['SALICYLIC ACID'],
    sourceKeys: ['sccs', 'obf'],
  },
  SODIUM_BENZOATE: {
    key: 'SODIUM_BENZOATE',
    inciName: 'Sodium Benzoate',
    risk: 'Düşük',
    category: 'Koruyucu',
    summary: 'Kozmetik ve kişisel bakım ürünlerinde yaygın kullanılan koruyuculardandır.',
    impact:
      'Genel kullanımda düşük riskli görünür; yine de hassas cilt bağlamında dikkat edilebilir.',
    aliases: ['SODIUM BENZOATE'],
    sourceKeys: ['sccs', 'obf'],
  },
  POTASSIUM_SORBATE: {
    key: 'POTASSIUM_SORBATE',
    inciName: 'Potassium Sorbate',
    risk: 'Düşük',
    category: 'Koruyucu',
    summary: 'Sık kullanılan düşük profilli koruyuculardan biridir.',
    impact:
      'Yerel risk motorunda düşük riskli koruyucu olarak sınıflanır.',
    aliases: ['POTASSIUM SORBATE'],
    sourceKeys: ['sccs', 'obf'],
  },
  NIACINAMIDE: {
    key: 'NIACINAMIDE',
    inciName: 'Niacinamide',
    risk: 'Düşük',
    category: 'Aktif bakım bileşeni',
    summary: 'Cilt bakımında sık kullanılan ve genel kabul gören aktiflerden biridir.',
    impact:
      'Yerel risk sözlüğünde belirgin bir yüksek risk sinyali taşımaz.',
    aliases: ['NIACINAMIDE', 'NICOTINAMIDE'],
    sourceKeys: ['obf'],
  },
  PANTHENOL: {
    key: 'PANTHENOL',
    inciName: 'Panthenol',
    risk: 'Düşük',
    category: 'Nemlendirici / yatıştırıcı',
    summary: 'Yatıştırıcı ve nemlendirici ürünlerde sık görülür.',
    impact: 'Genel olarak düşük riskli içerik grubunda değerlendirilir.',
    aliases: ['PANTHENOL', 'PROVITAMIN B5'],
    sourceKeys: ['obf'],
  },
  GLYCERIN: {
    key: 'GLYCERIN',
    inciName: 'Glycerin',
    risk: 'Düşük',
    category: 'Nem tutucu',
    summary: 'Kozmetik formüllerde çok yaygın kullanılan temel nem tutuculardandır.',
    impact:
      'Yerel risk motorunda düşük riskli ve genel kabul gören baz içeriklerden biri olarak ele alınır.',
    aliases: ['GLYCERIN', 'GLYCEROL'],
    sourceKeys: ['obf'],
  },
  DIMETHICONE: {
    key: 'DIMETHICONE',
    inciName: 'Dimethicone',
    risk: 'Düşük',
    category: 'Silikon',
    summary: 'Doku iyileştirici ve kaplayıcı silikon ailesindendir.',
    impact:
      'Çevresel tartışmalar farklı başlıkta sürse de sağlık risk sinyali yerel motorda düşüktür.',
    aliases: ['DIMETHICONE'],
    sourceKeys: ['echa', 'obf'],
  },
  CYCLOPENTASILOXANE: {
    key: 'CYCLOPENTASILOXANE',
    inciName: 'Cyclopentasiloxane',
    risk: 'Orta',
    category: 'Silikon',
    summary: 'Uçucu silikon ailesinde yaygın görülen formül yardımcılarından biridir.',
    impact:
      'Sağlık ve çevresel ihtiyat birlikte düşünüldüğünde orta riskli sinyal taşır.',
    aliases: ['CYCLOPENTASILOXANE', 'D5'],
    sourceKeys: ['echa'],
  },
  CETRIMONIUM_CHLORIDE: {
    key: 'CETRIMONIUM_CHLORIDE',
    inciName: 'Cetrimonium Chloride',
    risk: 'Orta',
    category: 'Saç bakım ajanı',
    summary: 'Saç bakım ürünlerinde çözücü ve kondisyoner ajan olarak sık görülür.',
    impact:
      'Hassasiyet ve göz çevresi kullanımında daha dikkatli yorum gerektirebilir.',
    aliases: ['CETRIMONIUM CHLORIDE'],
    sourceKeys: ['sccs', 'obf'],
  },
  DISODIUM_EDTA: {
    key: 'DISODIUM_EDTA',
    inciName: 'Disodium EDTA',
    risk: 'Düşük',
    category: 'Şelatlayıcı',
    summary: 'Formül stabilitesi için sık kullanılan yardımcı bileşendir.',
    impact:
      'Yerel risk motorunda belirgin sağlık riski taşımayan yardımcı içeriklerden biri olarak tutulur.',
    aliases: ['DISODIUM EDTA', 'EDTA'],
    sourceKeys: ['obf'],
  },
  RETINYL_PALMITATE: {
    key: 'RETINYL_PALMITATE',
    inciName: 'Retinyl Palmitate',
    risk: 'Orta',
    category: 'Retinoid türevi',
    summary: 'Bakım ürünlerinde kullanılan A vitamini türevlerinden biridir.',
    impact:
      'Hassas ciltte tahriş oluşturabilir; kullanım sıklığı ve güneş maruziyeti bağlamı önem taşır.',
    aliases: ['RETINYL PALMITATE', 'VITAMIN A PALMITATE'],
    sourceKeys: ['sccs', 'obf'],
  },
  TRIETHANOLAMINE: {
    key: 'TRIETHANOLAMINE',
    inciName: 'Triethanolamine',
    risk: 'Orta',
    category: 'pH düzenleyici',
    summary: 'Formül stabilitesi ve pH ayarı için kullanılan yardımcı bileşendir.',
    impact:
      'Hassas cilt veya göz çevresi kullanımlarında dikkat gerektirebilir.',
    aliases: ['TRIETHANOLAMINE', 'TEA'],
    sourceKeys: ['echa', 'obf'],
  },
  RESORCINOL: {
    key: 'RESORCINOL',
    inciName: 'Resorcinol',
    risk: 'Yüksek',
    category: 'Aktif / boya bileşeni',
    summary: 'Özellikle saç boyası ve bazı aktif bakım formüllerinde tartışmalı içeriklerden biridir.',
    impact:
      'Hassasiyet ve maruziyet tartışmaları nedeniyle ihtiyatlı modellerde yüksek riskli tutulur.',
    aliases: ['RESORCINOL'],
    sourceKeys: ['sccs', 'echa'],
  },
  DMDM_HYDANTOIN: {
    key: 'DMDM_HYDANTOIN',
    inciName: 'DMDM Hydantoin',
    risk: 'Yüksek',
    category: 'Koruyucu',
    summary:
      'Formaldehit salıcı koruyucu grubunda yer alan ve ihtiyatlı modellerde sert işaretlenen bileşenlerden biridir.',
    impact:
      'Kontakt hassasiyet ve formaldehit ilişkili tartışmalar nedeniyle yüksek risk sinyali taşır.',
    aliases: ['DMDM HYDANTOIN'],
    sourceKeys: ['sccs', 'echa'],
    riskHistory: [
      {
        date: '2026-04',
        previousRisk: 'Orta',
        nextRisk: 'Yüksek',
        note: 'Formaldehit salıcı koruyucular için ihtiyat seviyesi yükseltildi.',
      },
    ],
  },
  IMIDAZOLIDINYL_UREA: {
    key: 'IMIDAZOLIDINYL_UREA',
    inciName: 'Imidazolidinyl Urea',
    risk: 'Yüksek',
    category: 'Koruyucu',
    summary:
      'Formaldehit salıcı koruyucular arasında hassasiyet sinyali nedeniyle sert yorumlanan içeriklerden biridir.',
    impact:
      'Alerji ve iritasyon geçmişi nedeniyle yüksek riskli koruyucu sınıfında değerlendirilir.',
    aliases: ['IMIDAZOLIDINYL UREA'],
    sourceKeys: ['sccs', 'echa'],
  },
  DIAZOLIDINYL_UREA: {
    key: 'DIAZOLIDINYL_UREA',
    inciName: 'Diazolidinyl Urea',
    risk: 'Yüksek',
    category: 'Koruyucu',
    summary: 'Formaldehit salıcı koruyucu ailesinde yer alır.',
    impact:
      'Duyarlılık ve formaldehit ilişkili ihtiyat nedeniyle yüksek riskli işaretlenir.',
    aliases: ['DIAZOLIDINYL UREA'],
    sourceKeys: ['sccs', 'echa'],
  },
  QUATERNIUM_15: {
    key: 'QUATERNIUM_15',
    inciName: 'Quaternium-15',
    risk: 'Yüksek',
    category: 'Koruyucu',
    summary:
      'Formaldehit salıcı koruyucular arasında en dikkat çeken içeriklerden biridir.',
    impact:
      'Hassasiyet tartışmaları nedeniyle kırmızı risk seviyesinde tutulur.',
    aliases: ['QUATERNIUM-15', 'QUATERNIUM 15'],
    sourceKeys: ['sccs', 'echa'],
  },
  CHLORPHENESIN: {
    key: 'CHLORPHENESIN',
    inciName: 'Chlorphenesin',
    risk: 'Orta',
    category: 'Koruyucu',
    summary: 'Kozmetiklerde görülen koruyucu sistem bileşenlerinden biridir.',
    impact:
      'Tam yasaklı değildir ancak hassas kullanıcılar için orta risk sinyali oluşturabilir.',
    aliases: ['CHLORPHENESIN'],
    sourceKeys: ['sccs', 'echa'],
  },
  PROPYLENE_GLYCOL: {
    key: 'PROPYLENE_GLYCOL',
    inciName: 'Propylene Glycol',
    risk: 'Düşük',
    category: 'Nem tutucu / çözücü',
    summary: 'Çok yaygın taşıyıcı ve nem tutucu yardımcı bileşendir.',
    impact:
      'Genel modelde düşük risklidir; hassas ciltte iritasyon potansiyeli ayrıca düşünülebilir.',
    aliases: ['PROPYLENE GLYCOL'],
    sourceKeys: ['obf'],
  },
  BENZYL_SALICYLATE: {
    key: 'BENZYL_SALICYLATE',
    inciName: 'Benzyl Salicylate',
    risk: 'Düşük',
    category: 'Koku bileşeni',
    summary: 'Parfüm alerjeni etiketlerinde sık karşılaşılan bir koku bileşenidir.',
    impact:
      'Hassas kullanıcılar için uyarı gerektirebilir, ancak temel risk düzeyi düşüktür.',
    aliases: ['BENZYL SALICYLATE'],
    sourceKeys: ['sccs', 'echa'],
  },
  CITRAL: {
    key: 'CITRAL',
    inciName: 'Citral',
    risk: 'Düşük',
    category: 'Koku bileşeni',
    summary: 'Narenciye profilli parfüm karışımlarında sık görülen alerjenlerden biridir.',
    impact:
      'Koku hassasiyeti olan kullanıcılar için uyarı sinyali üretir.',
    aliases: ['CITRAL'],
    sourceKeys: ['sccs', 'echa'],
  },
  EUGENOL: {
    key: 'EUGENOL',
    inciName: 'Eugenol',
    risk: 'Düşük',
    category: 'Koku bileşeni',
    summary: 'Baharatımsı koku profillerinde sık karşılaşılan alerjenlerden biridir.',
    impact:
      'Parfüm hassasiyeti olan kullanıcılar için düşük düzeyli uyarı taşır.',
    aliases: ['EUGENOL'],
    sourceKeys: ['sccs', 'echa'],
  },
  COUMARIN: {
    key: 'COUMARIN',
    inciName: 'Coumarin',
    risk: 'Düşük',
    category: 'Koku bileşeni',
    summary: 'Parfüm alerjeni etiketlerinde sık görülen klasik bileşenlerden biridir.',
    impact:
      'Alerjen etiketi gerektirebilir; temel risk sinyali düşüktür.',
    aliases: ['COUMARIN'],
    sourceKeys: ['sccs', 'echa'],
  },
  ALPHA_ISOMETHYL_IONONE: {
    key: 'ALPHA_ISOMETHYL_IONONE',
    inciName: 'Alpha-Isomethyl Ionone',
    risk: 'Düşük',
    category: 'Koku bileşeni',
    summary: 'Parfüm alerjeni olarak etiketlenebilen yaygın koku bileşenlerinden biridir.',
    impact:
      'Hassas kullanıcı için uyarı gerektirebilir; genel risk düzeyi düşüktür.',
    aliases: ['ALPHA-ISOMETHYL IONONE', 'ALPHA ISOMETHYL IONONE'],
    sourceKeys: ['sccs', 'echa'],
  },
  AVOBENZONE: {
    key: 'AVOBENZONE',
    inciName: 'Butyl Methoxydibenzoylmethane',
    risk: 'Düşük',
    category: 'UV filtresi',
    summary: 'Güneş koruyucularda UVA koruması için yaygın kullanılan filtrelerden biridir.',
    impact:
      'Bazı hassasiyet tartışmaları olsa da yerel risk motorunda temel seviyesi düşüktür.',
    aliases: ['BUTYL METHOXYDIBENZOYLMETHANE', 'AVOBENZONE'],
    sourceKeys: ['sccs', 'echa'],
  },
  ZINC_OXIDE: {
    key: 'ZINC_OXIDE',
    inciName: 'Zinc Oxide',
    risk: 'Düşük',
    category: 'UV filtresi / mineral pigment',
    summary: 'Mineral güneş koruyucularda yaygın kullanılan içeriklerden biridir.',
    impact:
      'Nano form ayrı değerlendirilmelidir; temel form için risk sinyali düşüktür.',
    aliases: ['ZINC OXIDE'],
    sourceKeys: ['sccs', 'echa'],
  },
  TOLUENE: {
    key: 'TOLUENE',
    inciName: 'Toluene',
    risk: 'Yüksek',
    category: 'Çözücü',
    summary:
      'Özellikle bazı tırnak ürünlerinde görülebilen ve ihtiyatlı modellerde sert işaretlenen çözücülerdendir.',
    impact:
      'Maruziyet tartışmaları nedeniyle yüksek risk seviyesinde değerlendirilir.',
    aliases: ['TOLUENE'],
    sourceKeys: ['echa', 'us-epa'],
  },
};

const INDEX = Object.values(BEAUTY_INGREDIENTS_DATA).flatMap((item) => {
  const variants = [item.inciName, ...(item.aliases ?? [])].map(normalizeText);
  return variants.map((variant) => ({ variant, item }));
});

export const splitBeautyIngredientsText = (text?: string): string[] =>
  String(text || '')
    .split(/[,;•\n]/g)
    .map((item) => item.trim())
    .filter(Boolean);

export const findBeautyIngredientByName = (
  ingredientName?: string
): BeautyIngredientInfo | undefined => {
  const normalized = normalizeText(String(ingredientName || ''));

  if (!normalized) {
    return undefined;
  }

  const exact = INDEX.find(({ variant }) => normalized === variant)?.item;

  if (exact) {
    return exact;
  }

  return INDEX.find(({ variant }) => {
    if (variant.length < 4) {
      return false;
    }

    return normalized.includes(variant) || variant.includes(normalized);
  })?.item;
};

export const searchBeautyIngredientRisksInText = (
  text?: string
): BeautyIngredientInfo[] => {
  const ingredients = splitBeautyIngredientsText(text);
  const found = new Map<string, BeautyIngredientInfo>();

  ingredients.forEach((ingredient) => {
    const match = findBeautyIngredientByName(ingredient);
    if (match) {
      found.set(match.key, match);
    }
  });

  return Array.from(found.values());
};

export const getScientificSourceUrlsForKeys = (keys?: string[]): string[] => {
  if (!Array.isArray(keys) || keys.length === 0) {
    return [];
  }

  return keys
    .map((key) => SCIENTIFIC_SOURCE_RECORDS.find((entry) => entry.key === key)?.url)
    .filter((value): value is string => Boolean(value));
};

export const getScientificSourceTitlesForKeys = (keys?: string[]): string[] => {
  if (!Array.isArray(keys) || keys.length === 0) {
    return [];
  }

  return keys
    .map((key) => SCIENTIFIC_SOURCE_RECORDS.find((entry) => entry.key === key)?.title)
    .filter((value): value is string => Boolean(value));
};

export const BEAUTY_INGREDIENT_RISK_UPDATES = Object.freeze(
  Object.values(BEAUTY_INGREDIENTS_DATA)
    .flatMap((item) =>
      (item.riskHistory ?? []).map((entry) => ({
        ingredient: item.inciName,
        ...entry,
      }))
    )
    .sort((left, right) => right.date.localeCompare(left.date))
);

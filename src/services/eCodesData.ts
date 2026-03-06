/**
 * ErEnesAl® v1 - Global Katkı Maddesi Kütüphanesi
 * Bu veri seti, gıda katkı maddelerini bilimsel risk gruplarına ayırır.
 */

export interface ECodeInfo {
  code: string;
  name: string;
  risk: 'Düşük' | 'Orta' | 'Yüksek';
  category: string;
  description: string;
  impact: string;
}

export const E_CODES_DATA: Record<string, ECodeInfo> = {
  // --- RENKLENDİRİCİLER ---
  "E102": { 
    code: "E102", name: "Tartrazin", risk: "Yüksek", category: "Renklendirici",
    description: "Yapay sarı gıda boyası.",
    impact: "Astım, kurdeşen ve çocuklarda hiperaktivite ile ilişkilendirilmiştir." 
  },
  "E129": { 
    code: "E129", name: "Allura Red", risk: "Yüksek", category: "Renklendirici",
    description: "Yapay kırmızı boya.",
    impact: "Bazı ülkelerde yasaklanmıştır; dikkat eksikliğine yol açabilir." 
  },
  
  // --- KORUYUCULAR ---
  "E211": { 
    code: "E211", name: "Sodyum Benzoat", risk: "Yüksek", category: "Koruyucu",
    description: "Küf ve bakteri önleyici.",
    impact: "DNA hasarı riski ve çocuklarda davranış bozuklukları rapor edilmiştir." 
  },
  "E250": { 
    code: "E250", name: "Sodyum Nitrit", risk: "Yüksek", category: "Koruyucu",
    description: "İşlenmiş etlerde (sucuk, salam) kullanılır.",
    impact: "Kanserojen nitrosaminlerin oluşumuna neden olabilir." 
  },

  // --- LEZZET ARTIRICILAR ---
  "E621": { 
    code: "E621", name: "Monosodyum Glutamat (MSG)", risk: "Orta", category: "Lezzet Artırıcı",
    description: "Halk arasında 'Çin Tuzu' olarak bilinir.",
    impact: "Aşırı tüketimi nörotoksisite ve metabolik sendrom riski taşır." 
  },

  // --- TATLANDIRICILAR ---
  "E950": { 
    code: "E950", name: "Asesülfam K", risk: "Orta", category: "Tatlandırıcı",
    description: "Yapay tatlandırıcı.",
    impact: "Tiroid fonksiyonları üzerinde olumsuz etkileri tartışılmaktadır." 
  },
  "E951": { 
    code: "E951", name: "Aspartam", risk: "Yüksek", category: "Tatlandırıcı",
    description: "Yapay şeker ikamesi.",
    impact: "Fenilalanin içerir; nörolojik yan etkiler üzerine birçok araştırma vardır." 
  },

  // --- GÜVENLİ / DÜŞÜK RİSKLİLER ---
  "E300": { 
    code: "E300", name: "Askorbik Asit", risk: "Düşük", category: "Antioksidan",
    description: "C Vitaminidir.",
    impact: "Genellikle güvenlidir ve bağışıklığı destekler." 
  },
  "E322": { 
    code: "E322", name: "Lecithin", risk: "Düşük", category: "Emülgatör",
    description: "Doğal bir yağ asididir.",
    impact: "Soya veya yumurtadan elde edilir; alerjen uyarısı dışında güvenlidir." 
  },
  "E440": { 
    code: "E440", name: "Pektin", risk: "Düşük", category: "Kıvam Artırıcı",
    description: "Meyve liflerinden elde edilir.",
    impact: "Sindirim dostu doğal bir lif kaynağıdır." 
  }
};
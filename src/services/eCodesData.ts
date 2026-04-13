/**
 * ErEnesAl® v1 - Global Katkı Maddesi Kütüphanesi
 *
 * Not:
 * Bu veri kümesi uygulama içi risk analizine yardımcı olur.
 * Tıbbi teşhis yerine geçmez.
 */

export type ECodeRisk = 'Düşük' | 'Orta' | 'Yüksek';

export type ECodeRiskHistoryEntry = {
  date: string;
  previousRisk?: ECodeRisk;
  nextRisk: ECodeRisk;
  note: string;
};

export interface ECodeInfo {
  code: string;
  name: string;
  risk: ECodeRisk;
  category: string;
  description: string;
  impact: string;
  aliases?: string[];
  sourceKeys?: string[];
  riskHistory?: ECodeRiskHistoryEntry[];
}

export const E_CODES_DATA: Record<string, ECodeInfo> = {
  // --- RENKLENDİRİCİLER ---
  E102: {
    code: 'E102',
    name: 'Tartrazin',
    risk: 'Yüksek',
    category: 'Renklendirici',
    description: 'Yapay sarı gıda boyası.',
    impact: 'Astım, kurdeşen ve çocuklarda hiperaktivite ile ilişkilendirilmiştir.',
    aliases: ['Tartrazine'],
    sourceKeys: ['efsa', 'iarc', 'who'],
    riskHistory: [
      {
        date: '2026-04',
        previousRisk: 'Orta',
        nextRisk: 'Yüksek',
        note: 'Hassas çocuk grupları ve davranışsal etki sinyalleri nedeniyle ihtiyat düzeyi yükseltildi.',
      },
    ],
  },
  E129: {
    code: 'E129',
    name: 'Allura Red',
    risk: 'Yüksek',
    category: 'Renklendirici',
    description: 'Yapay kırmızı boya.',
    impact: 'Bazı ülkelerde yasaklanmıştır; dikkat eksikliğine yol açabilir.',
    aliases: ['Allura Red AC'],
    sourceKeys: ['efsa', 'who'],
  },

  // --- KORUYUCULAR ---
  E211: {
    code: 'E211',
    name: 'Sodyum Benzoat',
    risk: 'Yüksek',
    category: 'Koruyucu',
    description: 'Küf ve bakteri önleyici.',
    impact: 'DNA hasarı riski ve çocuklarda davranış bozuklukları rapor edilmiştir.',
    aliases: ['Sodium Benzoate'],
    sourceKeys: ['efsa', 'anses', 'who'],
    riskHistory: [
      {
        date: '2026-04',
        previousRisk: 'Orta',
        nextRisk: 'Yüksek',
        note: 'Kümülatif maruziyet ve hassas kullanıcı profilleri için daha ihtiyatlı sınıflamaya alındı.',
      },
    ],
  },
  E250: {
    code: 'E250',
    name: 'Sodyum Nitrit',
    risk: 'Yüksek',
    category: 'Koruyucu',
    description: 'İşlenmiş etlerde (sucuk, salam) kullanılır.',
    impact: 'Kanserojen nitrosaminlerin oluşumuna neden olabilir.',
    aliases: ['Sodium Nitrite'],
    sourceKeys: ['iarc', 'efsa', 'who'],
  },

  // --- LEZZET ARTIRICILAR ---
  E621: {
    code: 'E621',
    name: 'Monosodyum Glutamat (MSG)',
    risk: 'Orta',
    category: 'Lezzet Artırıcı',
    description: "Halk arasında 'Çin Tuzu' olarak bilinir.",
    impact: 'Aşırı tüketimi nörotoksisite ve metabolik sendrom riski taşır.',
    aliases: ['MSG', 'Monosodium Glutamate', 'Monosodyum Glutamat'],
    sourceKeys: ['efsa', 'fda'],
  },

  // --- TATLANDIRICILAR ---
  E950: {
    code: 'E950',
    name: 'Asesülfam K',
    risk: 'Orta',
    category: 'Tatlandırıcı',
    description: 'Yapay tatlandırıcı.',
    impact: 'Tiroid fonksiyonları üzerinde olumsuz etkileri tartışılmaktadır.',
    aliases: ['Acesulfame K', 'Acesulfame Potassium'],
    sourceKeys: ['efsa', 'fda'],
  },
  E951: {
    code: 'E951',
    name: 'Aspartam',
    risk: 'Yüksek',
    category: 'Tatlandırıcı',
    description: 'Yapay şeker ikamesi.',
    impact: 'Fenilalanin içerir; nörolojik yan etkiler üzerine birçok araştırma vardır.',
    aliases: ['Aspartame'],
    sourceKeys: ['iarc', 'efsa', 'who'],
    riskHistory: [
      {
        date: '2026-04',
        previousRisk: 'Orta',
        nextRisk: 'Yüksek',
        note: 'Güncel ihtiyat politikamızda tartışmalı tatlandırıcılar daha sert cezalandırılıyor.',
      },
    ],
  },
  E171: {
    code: 'E171',
    name: 'Titanyum Dioksit',
    risk: 'Yüksek',
    category: 'Renklendirici',
    description: 'Beyaz renklendirici olarak kullanılır.',
    impact: 'Yutma ve uzun dönem güvenlik tartışmaları nedeniyle ihtiyatlı modellerde sert cezalandırılır.',
    aliases: ['Titanium Dioxide', 'CI 77891'],
    sourceKeys: ['efsa', 'echa'],
    riskHistory: [
      {
        date: '2026-04',
        previousRisk: 'Orta',
        nextRisk: 'Yüksek',
        note: 'Yutma bağlamında belirsizlikler nedeniyle kırmızı ihtiyat sınıfına çekildi.',
      },
    ],
  },

  // --- DÜŞÜK RİSKLİLER ---
  E300: {
    code: 'E300',
    name: 'Askorbik Asit',
    risk: 'Düşük',
    category: 'Antioksidan',
    description: 'C vitaminidir.',
    impact: 'Genellikle güvenlidir ve bağışıklığı destekler.',
    aliases: ['Ascorbic Acid', 'Vitamin C'],
    sourceKeys: ['efsa', 'who'],
  },
  E322: {
    code: 'E322',
    name: 'Lecithin',
    risk: 'Düşük',
    category: 'Emülgatör',
    description: 'Doğal bir yağ asididir.',
    impact: 'Soya veya yumurtadan elde edilir; alerjen uyarısı dışında güvenlidir.',
    aliases: ['Lesitin', 'Lecithin'],
    sourceKeys: ['efsa'],
  },
  E440: {
    code: 'E440',
    name: 'Pektin',
    risk: 'Düşük',
    category: 'Kıvam Artırıcı',
    description: 'Meyve liflerinden elde edilir.',
    impact: 'Sindirim dostu doğal bir lif kaynağıdır.',
    aliases: ['Pectin'],
    sourceKeys: ['efsa'],
  },
};

const normalizeCode = (value: string): string =>
  String(value || '')
    .toUpperCase()
    .replace(/[- ]/g, '')
    .trim();

const normalizeName = (value: string): string =>
  String(value || '')
    .toLocaleLowerCase('tr-TR')
    .trim();

export const getECodeByCode = (code: string): ECodeInfo | undefined => {
  return E_CODES_DATA[normalizeCode(code)];
};

export const findECodeByName = (name: string): ECodeInfo | undefined => {
  const query = normalizeName(name);
  if (!query) return undefined;

  return Object.values(E_CODES_DATA).find((item) => {
    const mainName = normalizeName(item.name);
    const aliases = (item.aliases || []).map(normalizeName);
    return mainName === query || aliases.includes(query);
  });
};

export const searchECodesInText = (text?: string): ECodeInfo[] => {
  const normalizedText = String(text || '').toUpperCase();
  const found = new Map<string, ECodeInfo>();

  // Kod bazlı tarama
  const codeRegex = /E[- ]?\d{3,4}[A-Z]?/gi;
  const matches = normalizedText.match(codeRegex) || [];

  matches.forEach((match) => {
    const normalizedCode = normalizeCode(match);
    const item = getECodeByCode(normalizedCode);
    if (item) {
      found.set(item.code, item);
    }
  });

  // İsim bazlı tarama
  Object.values(E_CODES_DATA).forEach((item) => {
    const variants = [item.name, ...(item.aliases || [])]
      .map((entry) => entry.toUpperCase())
      .filter(Boolean);

    const hit = variants.some((variant) => normalizedText.includes(variant));
    if (hit) {
      found.set(item.code, item);
    }
  });

  return Array.from(found.values());
};

export const getECodesByRisk = (risk: ECodeRisk): ECodeInfo[] => {
  return Object.values(E_CODES_DATA).filter((item) => item.risk === risk);
};

export const getECodesByCategory = (category: string): ECodeInfo[] => {
  const query = normalizeName(category);
  return Object.values(E_CODES_DATA).filter(
    (item) => normalizeName(item.category) === query
  );
};

export const ALL_E_CODES = Object.freeze(Object.values(E_CODES_DATA));

export const ADDITIVE_RISK_UPDATES = Object.freeze(
  Object.values(E_CODES_DATA)
    .flatMap((item) =>
      (item.riskHistory ?? []).map((entry) => ({
        code: item.code,
        name: item.name,
        ...entry,
      }))
    )
    .sort((left, right) => right.date.localeCompare(left.date))
);

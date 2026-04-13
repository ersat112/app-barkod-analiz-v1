export type ScientificSourceRecord = {
  key: string;
  title: string;
  scope: string;
  url?: string;
};

export const SCIENTIFIC_SOURCE_RECORDS: ScientificSourceRecord[] = [
  {
    key: 'off',
    title: 'Open Food Facts',
    scope: 'Gıda ürün kaydı, Nutri-Score alanları, içerik ve besin tablosu verisi.',
    url: 'https://world.openfoodfacts.org',
  },
  {
    key: 'obf',
    title: 'Open Beauty Facts',
    scope: 'Kozmetik ürün kaydı, INCI içerik alanları ve ürün meta verisi.',
    url: 'https://world.openbeautyfacts.org',
  },
  {
    key: 'who',
    title: 'WHO',
    scope: 'Ambalaj önü beslenme etiketi ve kamu sağlığı çerçevesi.',
    url: 'https://www.who.int',
  },
  {
    key: 'iarc',
    title: 'IARC',
    scope: 'Kanserojenlik ve halk sağlığı açısından kritik bilimsel değerlendirmeler.',
    url: 'https://www.iarc.who.int',
  },
  {
    key: 'efsa',
    title: 'EFSA',
    scope: 'Gıda katkıları, maruziyet ve güvenlik değerlendirmeleri.',
    url: 'https://www.efsa.europa.eu',
  },
  {
    key: 'anses',
    title: 'ANSES',
    scope: 'Gıda, çevre ve iş sağlığı güvenliği üzerine risk görüşleri.',
    url: 'https://www.anses.fr',
  },
  {
    key: 'sccs',
    title: 'SCCS',
    scope: 'Kozmetik içerikler için Avrupa düzeyinde bilimsel güvenlik görüşleri.',
    url: 'https://health.ec.europa.eu/scientific-committees/scientific-committee-consumer-safety-sccs_en',
  },
  {
    key: 'echa',
    title: 'ECHA',
    scope: 'Kimyasal sınıflandırma, tehlike ve düzenleyici veri kayıtları.',
    url: 'https://echa.europa.eu',
  },
  {
    key: 'fda',
    title: 'FDA',
    scope: 'Gıda ve kozmetik alanlarında ABD düzenleyici görüş ve güvenlik kayıtları.',
    url: 'https://www.fda.gov',
  },
  {
    key: 'us-epa',
    title: 'US EPA',
    scope: 'Kimyasal maruziyet ve çevresel sağlık risk değerlendirmeleri.',
    url: 'https://www.epa.gov',
  },
  {
    key: 'aicis',
    title: 'AICIS',
    scope: 'Avustralya endüstriyel kimyasallar güvenlik ve tanıtım kayıtları.',
    url: 'https://www.industrialchemicals.gov.au',
  },
  {
    key: 'titck',
    title: 'TITCK',
    scope: 'İlaç kayıtları, KÜB ve prospektüs belgeleri için resmi Türkiye kaynağı.',
    url: 'https://www.titck.gov.tr',
  },
];

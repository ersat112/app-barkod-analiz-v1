import type { Product } from '../utils/analysis';

export type MarketDisplayDefinition = {
  key: string;
  name: string;
  aliases?: string[];
};

const GROCERY_NATIONAL_MARKETS: MarketDisplayDefinition[] = [
  {
    key: 'a101_kapida',
    name: 'A101 Kapıda',
    aliases: ['a101', 'a101 kapida', 'a101 kapıda'],
  },
  {
    key: 'bim_market',
    name: 'BİM',
    aliases: ['bim', 'bim market'],
  },
  {
    key: 'carrefoursa_online_market',
    name: 'CarrefourSA',
    aliases: ['carrefoursa', 'carrefour sa', 'carrefoursa online market'],
  },
  {
    key: 'migros_sanal_market',
    name: 'Migros',
    aliases: ['migros', 'migros sanal market'],
  },
  {
    key: 'cepte_sok',
    name: 'ŞOK',
    aliases: ['sok', 'şok', 'cepte sok', 'cepte şok'],
  },
  {
    key: 'tarim_kredi_koop_market',
    name: 'Tarım Kredi',
    aliases: ['tarim kredi', 'tarım kredi', 'tarim kredi koop market'],
  },
  {
    key: 'bizim_toptan_online',
    name: 'Bizim Toptan',
    aliases: ['bizim toptan', 'bizim toptan online market'],
  },
  {
    key: 'getir_buyuk',
    name: 'GetirBüyük',
    aliases: ['getirbuyuk', 'getir büyük', 'getir buyuk'],
  },
];

const BEAUTY_NATIONAL_MARKETS: MarketDisplayDefinition[] = [
  {
    key: 'rossmann_online',
    name: 'Rossmann',
    aliases: ['rossmann', 'rossmann online'],
  },
  {
    key: 'gratis_online',
    name: 'Gratis',
    aliases: ['gratis', 'gratis online'],
  },
  {
    key: 'watsons_online',
    name: 'Watsons',
    aliases: ['watsons', 'watsons online'],
  },
  {
    key: 'eveshop_online',
    name: 'EveShop',
    aliases: ['eveshop', 'eve shop', 'eve'],
  },
  {
    key: 'flormar_online',
    name: 'Flormar',
    aliases: ['flormar', 'flormar online'],
  },
  {
    key: 'tshop_online',
    name: 'T-Shop',
    aliases: ['t-shop', 'tshop', 't shop'],
  },
  {
    key: 'sephora_online',
    name: 'Sephora',
    aliases: ['sephora', 'sephora turkiye online'],
  },
  {
    key: 'yves_rocher_online',
    name: 'Yves Rocher',
    aliases: ['yves rocher', 'yves rocher turkiye online'],
  },
];

export const normalizeMarketDisplayValue = (value?: string | null): string =>
  String(value || '')
    .trim()
    .toLocaleLowerCase('tr')
    .replace(/[ıİ]/g, 'i')
    .replace(/[şŞ]/g, 's')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const getNationalMarketDefinitions = (
  productType?: Product['type']
): MarketDisplayDefinition[] =>
  productType === 'beauty' ? BEAUTY_NATIONAL_MARKETS : GROCERY_NATIONAL_MARKETS;

export const inferMarketDisplayProductType = (marketKeys: (string | null | undefined)[]) => {
  const normalizedBeautyKeys = new Set(
    BEAUTY_NATIONAL_MARKETS.flatMap((item) =>
      [item.key, item.name, ...(item.aliases || [])].map((value) =>
        normalizeMarketDisplayValue(value)
      )
    ).filter(Boolean)
  );

  const hasBeautyKey = marketKeys.some((key) =>
    normalizedBeautyKeys.has(normalizeMarketDisplayValue(key))
  );

  return hasBeautyKey ? ('beauty' as const) : undefined;
};

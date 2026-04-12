import { getNationalMarketDefinitions, normalizeMarketDisplayValue } from './marketDisplay';

const MARKET_BRAND_ACCENTS = [
  '#167A78',
  '#63AE2E',
  '#A855F7',
  '#2563EB',
  '#DC2626',
  '#0F766E',
  '#7C3AED',
] as const;

type MarketBrandDefinition = {
  key: string;
  name: string;
  aliases?: string[];
  domain?: string;
};

const MARKET_BRAND_DEFINITIONS: MarketBrandDefinition[] = [
  ...getNationalMarketDefinitions('food').map((item) => ({
    ...item,
    domain:
      item.key === 'a101_kapida'
        ? 'https://www.a101.com.tr'
        : item.key === 'bim_market'
          ? 'https://www.bim.com.tr'
          : item.key === 'carrefoursa_online_market'
            ? 'https://www.carrefoursa.com'
            : item.key === 'migros_sanal_market'
              ? 'https://www.migros.com.tr'
              : item.key === 'cepte_sok'
                ? 'https://www.sokmarket.com.tr'
                : item.key === 'tarim_kredi_koop_market'
                  ? 'https://www.tarimkredi.com.tr'
                  : item.key === 'bizim_toptan_online'
                    ? 'https://www.bizimtoptan.com.tr'
                    : item.key === 'getir_buyuk'
                      ? 'https://getir.com'
                      : undefined,
  })),
  ...getNationalMarketDefinitions('beauty').map((item) => ({
    ...item,
    domain:
      item.key === 'rossmann_online'
        ? 'https://www.rossmann.com.tr'
        : item.key === 'gratis_online'
          ? 'https://www.gratis.com'
          : item.key === 'watsons_online'
            ? 'https://www.watsons.com.tr'
            : item.key === 'eveshop_online'
              ? 'https://www.eveshop.com.tr'
              : item.key === 'flormar_online'
                ? 'https://www.flormar.com.tr'
                : item.key === 'tshop_online'
                  ? 'https://www.tshop.com.tr'
                  : item.key === 'sephora_online'
                    ? 'https://www.sephora.com.tr'
                    : item.key === 'yves_rocher_online'
                      ? 'https://www.yvesrocher.com.tr'
                      : undefined,
  })),
];

const buildFaviconUrl = (domain: string): string =>
  `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(domain)}&sz=128`;

export const resolveMarketAccent = (marketKey?: string | null, marketName?: string | null): string => {
  const seed = `${marketKey || ''}${marketName || ''}`;
  const total = Array.from(seed).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return MARKET_BRAND_ACCENTS[total % MARKET_BRAND_ACCENTS.length];
};

export const buildMarketMonogram = (marketName?: string | null): string => {
  const parts = String(marketName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) {
    return 'MG';
  }

  return parts
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
};

const resolveMarketDefinition = (
  marketKey?: string | null,
  marketName?: string | null
): MarketBrandDefinition | null => {
  const keyCandidates = [
    normalizeMarketDisplayValue(marketKey),
    normalizeMarketDisplayValue(marketName),
  ].filter(Boolean);

  return (
    MARKET_BRAND_DEFINITIONS.find((definition) => {
      const candidates = [
        normalizeMarketDisplayValue(definition.key),
        normalizeMarketDisplayValue(definition.name),
        ...(definition.aliases || []).map((item) => normalizeMarketDisplayValue(item)),
      ].filter(Boolean);

      return keyCandidates.some((candidate) => candidates.includes(candidate));
    }) || null
  );
};

export const resolveMarketLogoUrl = (
  marketKey?: string | null,
  marketName?: string | null,
  currentLogoUrl?: string | null
): string | null => {
  const definition = resolveMarketDefinition(marketKey, marketName);

  if (definition?.domain) {
    return buildFaviconUrl(definition.domain);
  }

  return currentLogoUrl || null;
};

import type { MarketOffer } from '../types/marketPricing';

type TranslateFn = (key: string, fallback: string) => string;

export const formatMarketPrice = (
  locale: string,
  amount?: number | null,
  currency: string = 'TRY'
): string => {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return '--';
  }

  try {
    return new Intl.NumberFormat(locale || 'tr-TR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};

export const formatMarketDistance = (
  tt: TranslateFn,
  value?: number | null
): string => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return '';
  }

  if (value < 1000) {
    return tt('price_compare_distance_meters', '{{value}} m').replace(
      '{{value}}',
      Math.round(value).toString()
    );
  }

  return tt('price_compare_distance_km', '{{value}} km').replace(
    '{{value}}',
    (value / 1000).toFixed(1)
  );
};

export const pickBestMarketOffer = (offers: MarketOffer[]): MarketOffer | null => {
  if (!offers.length) {
    return null;
  }

  const sorted = [...offers].sort((left, right) => {
    if (left.inStock !== right.inStock) {
      return left.inStock ? -1 : 1;
    }

    if (left.price !== right.price) {
      return left.price - right.price;
    }

    return left.marketName.localeCompare(right.marketName, 'tr');
  });

  return sorted[0] ?? null;
};

export const buildBestMarketOfferSummary = (params: {
  tt: TranslateFn;
  locale: string;
  bestOffer?: MarketOffer | null;
  loading?: boolean;
  error?: string | null;
}): string => {
  if (params.loading) {
    return params.tt('scanner_market_prices_loading', 'Market teklifleri yükleniyor...');
  }

  if (params.error) {
    return params.error;
  }

  if (params.bestOffer) {
    return params
      .tt(
        'scanner_market_prices_summary_best',
        '{{market}} içinde en iyi canlı fiyat {{price}}'
      )
      .replace('{{market}}', params.bestOffer.marketName)
      .replace(
        '{{price}}',
        formatMarketPrice(params.locale, params.bestOffer.price, params.bestOffer.currency)
      );
  }

  return params.tt(
    'scanner_market_prices_summary_empty',
    'Bu ürün için market teklifi bulunursa burada özetlenecek.'
  );
};

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

export const pickBestMarketOffer = (
  offers: MarketOffer[],
  options?: {
    cityCode?: string | null;
  }
): MarketOffer | null => {
  if (!offers.length) {
    return null;
  }

  const sorted = [...offers].sort((left, right) => {
    const leftLocalityScore =
      (left.inStock ? 1000 : 0) +
      (options?.cityCode && left.cityCode === options.cityCode ? 120 : 0) +
      (left.priceSourceType === 'local_market_price' ? 80 : left.priceSourceType === 'national_reference_price' ? 25 : 0) +
      (typeof left.distanceMeters === 'number' && Number.isFinite(left.distanceMeters)
        ? Math.max(0, 60 - Math.min(60, left.distanceMeters / 250))
        : 0);
    const rightLocalityScore =
      (right.inStock ? 1000 : 0) +
      (options?.cityCode && right.cityCode === options.cityCode ? 120 : 0) +
      (right.priceSourceType === 'local_market_price' ? 80 : right.priceSourceType === 'national_reference_price' ? 25 : 0) +
      (typeof right.distanceMeters === 'number' && Number.isFinite(right.distanceMeters)
        ? Math.max(0, 60 - Math.min(60, right.distanceMeters / 250))
        : 0);

    if (leftLocalityScore !== rightLocalityScore) {
      return rightLocalityScore - leftLocalityScore;
    }

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
  locationLabel?: string | null;
}): string => {
  if (params.loading) {
    return params.tt('scanner_market_prices_loading', 'Market teklifleri yükleniyor...');
  }

  if (params.error) {
    return params.error;
  }

  if (params.bestOffer) {
    const template = params.locationLabel
      ? params.tt(
          'scanner_market_prices_summary_best_location',
          '{{location}} için en uygun fiyat {{market}} içinde {{price}}'
        )
      : params.tt(
          'scanner_market_prices_summary_best',
          '{{market}} içinde en iyi canlı fiyat {{price}}'
        );

    return template
      .replace('{{location}}', params.locationLabel || '')
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

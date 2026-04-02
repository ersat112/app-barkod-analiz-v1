import React, { useMemo } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getNationalMarketDefinitions, normalizeMarketDisplayValue } from '../config/marketDisplay';
import type { ThemeColors } from '../context/ThemeContext';
import type { MarketOffer } from '../types/marketPricing';
import type { Product } from '../utils/analysis';

type TranslateFn = (key: string, fallback: string) => string;

type MarketPriceTableCardProps = {
  title: string;
  subtitle?: string | null;
  offers: MarketOffer[];
  productType?: Product['type'];
  locale: string;
  colors: ThemeColors;
  tt: TranslateFn;
  loading?: boolean;
};

type DisplayColumn = {
  id: string;
  marketName: string;
  marketKey?: string | null;
  logoUrl?: string | null;
  offer?: MarketOffer | null;
  scope: 'national' | 'local';
};

const MARKET_BRAND_ACCENTS = [
  '#167A78',
  '#B97719',
  '#A855F7',
  '#2563EB',
  '#DC2626',
  '#0F766E',
  '#7C3AED',
];

const withAlpha = (hex: string, alpha: string): string => {
  if (!hex.startsWith('#')) {
    return hex;
  }

  const normalized = hex.length === 7 ? hex : '#0F172A';
  return `${normalized}${alpha}`;
};

const formatLocalizedPrice = (locale: string, amount?: number | null, currency = 'TRY'): string => {
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

const formatDistanceMeters = (tt: TranslateFn, value?: number | null): string => {
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

const resolveMarketAccent = (marketKey?: string | null, marketName?: string | null): string => {
  const seed = `${marketKey || ''}${marketName || ''}`;
  const total = Array.from(seed).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return MARKET_BRAND_ACCENTS[total % MARKET_BRAND_ACCENTS.length];
};

const buildMarketMonogram = (marketName?: string | null): string => {
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

const MarketBadge: React.FC<{
  marketName?: string | null;
  marketKey?: string | null;
  logoUrl?: string | null;
  size?: number;
}> = ({ marketName, marketKey, logoUrl, size = 36 }) => {
  const accent = resolveMarketAccent(marketKey, marketName);
  const monogram = buildMarketMonogram(marketName);

  if (logoUrl) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={[
          styles.marketLogoImage,
          {
            width: size,
            height: size,
            borderRadius: Math.round(size * 0.3),
          },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.marketMonogramBadge,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.3),
          backgroundColor: withAlpha(accent, '22'),
          borderColor: withAlpha(accent, '66'),
        },
      ]}
    >
      <Text style={[styles.marketMonogramText, { color: accent }]}>{monogram}</Text>
    </View>
  );
};

const pickBestOffer = (offers: MarketOffer[]): MarketOffer | null => {
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

export const MarketPriceTableCard: React.FC<MarketPriceTableCardProps> = ({
  title,
  subtitle,
  offers,
  productType,
  locale,
  colors,
  tt,
  loading = false,
}) => {
  const columns = useMemo<DisplayColumn[]>(() => {
    if (!offers.length) {
      return getNationalMarketDefinitions(productType).map((definition) => ({
        id: `national-${definition.key}`,
        marketName: definition.name,
        marketKey: definition.key,
        logoUrl: null,
        offer: null,
        scope: 'national' as const,
      }));
    }

    const grouped = new Map<
      string,
      {
        marketName: string;
        marketKey?: string | null;
        logoUrl?: string | null;
        offers: MarketOffer[];
      }
    >();

    offers.forEach((offer) => {
      const identity = normalizeMarketDisplayValue(offer.marketKey || offer.marketName);

      if (!identity) {
        return;
      }

      const existing = grouped.get(identity);

      if (!existing) {
        grouped.set(identity, {
          marketName: offer.marketName,
          marketKey: offer.marketKey,
          logoUrl: offer.marketLogoUrl || null,
          offers: [offer],
        });
        return;
      }

      existing.offers.push(offer);

      if (!existing.logoUrl && offer.marketLogoUrl) {
        existing.logoUrl = offer.marketLogoUrl;
      }
    });

    const usedKeys = new Set<string>();
    const nationalColumns = getNationalMarketDefinitions(productType).map((definition) => {
      const candidates = [
        normalizeMarketDisplayValue(definition.key),
        normalizeMarketDisplayValue(definition.name),
        ...(definition.aliases || []).map((item) => normalizeMarketDisplayValue(item)),
      ].filter(Boolean);

      const matchedKey = Array.from(grouped.keys()).find((groupKey) =>
        candidates.includes(groupKey)
      );

      if (matchedKey) {
        usedKeys.add(matchedKey);
      }

      const matched = matchedKey ? grouped.get(matchedKey) : null;

      return {
        id: `national-${definition.key}`,
        marketName: matched?.marketName || definition.name,
        marketKey: matched?.marketKey || definition.key,
        logoUrl: matched?.logoUrl || null,
        offer: matched ? pickBestOffer(matched.offers) : null,
        scope: 'national' as const,
      };
    });

    const localColumns = Array.from(grouped.entries())
      .filter(([groupKey]) => !usedKeys.has(groupKey))
      .map(([groupKey, group]) => ({
        id: `local-${groupKey}`,
        marketName: group.marketName,
        marketKey: group.marketKey,
        logoUrl: group.logoUrl || null,
        offer: pickBestOffer(group.offers),
        scope: 'local' as const,
      }))
      .sort((left, right) => {
        const leftDistance = left.offer?.distanceMeters;
        const rightDistance = right.offer?.distanceMeters;

        if (
          typeof leftDistance === 'number' &&
          typeof rightDistance === 'number' &&
          leftDistance !== rightDistance
        ) {
          return leftDistance - rightDistance;
        }

        return left.marketName.localeCompare(right.marketName, 'tr');
      });

    return [...nationalColumns, ...localColumns];
  }, [offers, productType]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: withAlpha(colors.cardElevated, 'F1'),
          borderColor: withAlpha(colors.border, 'BC'),
          shadowColor: colors.shadow,
        },
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.mutedText }]}>{subtitle}</Text>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.columnsContent}
      >
        {columns.map((column) => {
          const toneColor = column.scope === 'national' ? colors.primary : colors.teal;
          const hasOffer = Boolean(column.offer?.inStock);
          const priceLabel = hasOffer
            ? formatLocalizedPrice(locale, column.offer?.price, column.offer?.currency || 'TRY')
            : loading
              ? tt('market_price_table_loading', 'Yükleniyor...')
              : tt('market_price_table_missing', 'Ürün bulunamadı');
          const distanceLabel =
            column.scope === 'local'
              ? formatDistanceMeters(tt, column.offer?.distanceMeters)
              : '';

          return (
            <View
              key={column.id}
              style={[
                styles.columnCard,
                {
                  backgroundColor: withAlpha(colors.card, 'EE'),
                  borderColor: withAlpha(colors.border, 'B8'),
                },
              ]}
            >
              <View style={styles.columnHeader}>
                <MarketBadge
                  marketKey={column.marketKey}
                  marketName={column.marketName}
                  logoUrl={column.logoUrl}
                />
                <View
                  style={[
                    styles.scopeBadge,
                    { backgroundColor: withAlpha(toneColor, '14') },
                  ]}
                >
                  <Text style={[styles.scopeBadgeText, { color: toneColor }]}>
                    {column.scope === 'national'
                      ? tt('market_price_table_national_badge', 'Ulusal')
                      : tt('market_price_table_local_badge', 'Yakın')}
                  </Text>
                </View>
              </View>

              <Text style={[styles.marketName, { color: colors.text }]} numberOfLines={2}>
                {column.marketName}
              </Text>

              <Text
                style={[
                  styles.priceText,
                  {
                    color: hasOffer ? colors.text : colors.mutedText,
                    opacity: hasOffer ? 1 : 0.9,
                  },
                ]}
                numberOfLines={2}
              >
                {priceLabel}
              </Text>

              {column.offer?.unitPrice && column.offer.unitPriceUnit ? (
                <Text style={[styles.metaText, { color: colors.mutedText }]} numberOfLines={1}>
                  {formatLocalizedPrice(locale, column.offer.unitPrice, column.offer.currency)} /{' '}
                  {column.offer.unitPriceUnit}
                </Text>
              ) : (
                <View style={styles.metaSpacer} />
              )}

              {distanceLabel ? (
                <Text style={[styles.distanceText, { color: colors.teal }]} numberOfLines={1}>
                  {distanceLabel}
                </Text>
              ) : (
                <View style={styles.metaSpacer} />
              )}
            </View>
          );
        })}
      </ScrollView>

      <Text style={[styles.helperText, { color: colors.mutedText }]}>
        {tt(
          'market_price_table_hint',
          'Sağa kaydırarak ulusal ve bulunduğun konumdaki market tekliflerini görebilirsin.'
        )}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    marginBottom: 18,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  columnsContent: {
    gap: 10,
    paddingRight: 4,
  },
  columnCard: {
    width: 132,
    minHeight: 176,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  marketLogoImage: {
    backgroundColor: '#E5E7EB',
  },
  marketMonogramBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  marketMonogramText: {
    fontSize: 12,
    fontWeight: '900',
  },
  scopeBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  scopeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  marketName: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    minHeight: 36,
  },
  priceText: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    minHeight: 44,
  },
  metaText: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 15,
  },
  distanceText: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  helperText: {
    marginTop: 12,
    fontSize: 11,
    lineHeight: 16,
  },
  metaSpacer: {
    height: 16,
    marginTop: 8,
  },
});

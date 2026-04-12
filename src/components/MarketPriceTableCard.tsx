import React, { useMemo } from 'react';
import {
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { getNationalMarketDefinitions, normalizeMarketDisplayValue } from '../config/marketDisplay';
import {
  buildMarketMonogram,
  resolveMarketAccent,
  resolveMarketLogoUrl,
} from '../config/marketBranding';
import type { ThemeColors } from '../context/ThemeContext';
import type { MarketOffer } from '../types/marketPricing';
import type { Product } from '../utils/analysis';
import {
  formatMarketDistance,
  formatMarketPrice,
} from './marketPricingSummary';

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
  compact?: boolean;
  onOfferPress?: (offer: MarketOffer) => void;
};

type DisplayColumn = {
  id: string;
  marketName: string;
  marketKey?: string | null;
  logoUrl?: string | null;
  offer?: MarketOffer | null;
  scope: 'national' | 'local';
};

const withAlpha = (hex: string, alpha: string): string => {
  if (!hex.startsWith('#')) {
    return hex;
  }

  const normalized = hex.length === 7 ? hex : '#0F172A';
  return `${normalized}${alpha}`;
};

const MarketBadge: React.FC<{
  marketName?: string | null;
  marketKey?: string | null;
  logoUrl?: string | null;
  size?: number;
}> = ({ marketName, marketKey, logoUrl, size = 36 }) => {
  const accent = resolveMarketAccent(marketKey, marketName);
  const monogram = buildMarketMonogram(marketName);
  const stableLogoUrl = resolveMarketLogoUrl(marketKey, marketName, logoUrl);

  if (stableLogoUrl) {
    return (
      <Image
        source={{ uri: stableLogoUrl }}
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

const isLocationScopedOffer = (offer?: MarketOffer | null): boolean => {
  if (!offer) {
    return false;
  }

  const coverage = String(offer.coverageScope || '').toLocaleLowerCase('tr');
  const pricing = String(offer.pricingScope || '').toLocaleLowerCase('tr');

  return (
    offer.priceSourceType === 'local_market_price' ||
    coverage.includes('city') ||
    coverage.includes('district') ||
    pricing.includes('city') ||
    pricing.includes('district') ||
    typeof offer.distanceMeters === 'number'
  );
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
  compact = false,
  onOfferPress,
}) => {
  const columns = useMemo<DisplayColumn[]>(() => {
    const shouldUseDefinitionColumns = productType !== 'beauty';

    if (!offers.length) {
      return getNationalMarketDefinitions(productType).map((definition) => ({
        id: `national-${definition.key}`,
        marketName: definition.name,
        marketKey: definition.key,
        logoUrl: resolveMarketLogoUrl(definition.key, definition.name, null),
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
          logoUrl: resolveMarketLogoUrl(
            offer.marketKey,
            offer.marketName,
            offer.marketLogoUrl || null
          ),
          offers: [offer],
        });
        return;
      }

      existing.offers.push(offer);

      const candidateLogoUrl = resolveMarketLogoUrl(
        offer.marketKey,
        offer.marketName,
        offer.marketLogoUrl || null
      );

      if (!existing.logoUrl && candidateLogoUrl) {
        existing.logoUrl = candidateLogoUrl;
      }
    });

    const usedKeys = new Set<string>();
    const actualColumns = Array.from(grouped.entries())
      .map(([groupKey, group]) => ({
        id: `actual-${groupKey}`,
        marketName: group.marketName,
        marketKey: group.marketKey,
        logoUrl: resolveMarketLogoUrl(group.marketKey, group.marketName, group.logoUrl || null),
        offer: pickBestOffer(group.offers),
        scope: 'national' as const,
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

        const leftPrice = left.offer?.price ?? Number.POSITIVE_INFINITY;
        const rightPrice = right.offer?.price ?? Number.POSITIVE_INFINITY;

        if (leftPrice !== rightPrice) {
          return leftPrice - rightPrice;
        }

        return left.marketName.localeCompare(right.marketName, 'tr');
      });

    if (!shouldUseDefinitionColumns) {
      return actualColumns.map((column) => ({
        ...column,
        scope: isLocationScopedOffer(column.offer) ? ('local' as const) : ('national' as const),
      }));
    }

    if (actualColumns.length > 0) {
      return actualColumns.map((column) => ({
        ...column,
        scope: isLocationScopedOffer(column.offer) ? ('local' as const) : ('national' as const),
      }));
    }

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
        logoUrl: resolveMarketLogoUrl(
          matched?.marketKey || definition.key,
          matched?.marketName || definition.name,
          matched?.logoUrl || null
        ),
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
        logoUrl: resolveMarketLogoUrl(group.marketKey, group.marketName, group.logoUrl || null),
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

    const filledNationalColumns = nationalColumns.filter((column) => Boolean(column.offer));
    const emptyNationalColumns = nationalColumns.filter((column) => !column.offer);

    return [...filledNationalColumns, ...localColumns, ...emptyNationalColumns];
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
        nestedScrollEnabled
        showsHorizontalScrollIndicator={columns.length > 1}
        scrollEnabled={columns.length > 1}
        overScrollMode="never"
        contentContainerStyle={styles.columnsContent}
      >
        {columns.map((column) => {
          const toneColor = column.scope === 'national' ? colors.primary : colors.teal;
          const hasOffer = Boolean(column.offer?.inStock);
          const canInteract = Boolean(column.offer && (onOfferPress || column.offer.sourceUrl));
          const priceLabel = hasOffer
            ? formatMarketPrice(locale, column.offer?.price, column.offer?.currency || 'TRY')
            : loading
              ? tt('market_price_table_loading', 'Yükleniyor...')
              : tt('market_price_table_missing', 'Ürün bulunamadı');
          const distanceLabel =
            column.scope === 'local'
              ? formatMarketDistance(tt, column.offer?.distanceMeters)
              : '';

          return (
            <TouchableOpacity
              key={column.id}
              activeOpacity={canInteract ? 0.88 : 1}
              disabled={!canInteract}
              onPress={() => {
                if (column.offer && onOfferPress) {
                  onOfferPress(column.offer);
                } else if (column.offer?.sourceUrl) {
                  void Linking.openURL(column.offer.sourceUrl);
                }
              }}
              style={[
                styles.columnCard,
                compact && styles.columnCardCompact,
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
                <View style={styles.headerBadges}>
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
                  {canInteract ? (
                    <Ionicons
                      name={onOfferPress ? 'chevron-forward-outline' : 'open-outline'}
                      size={14}
                      color={colors.mutedText}
                    />
                  ) : null}
                </View>
              </View>

              <Text
                style={[
                  styles.marketName,
                  compact && styles.marketNameCompact,
                  { color: colors.text },
                ]}
                numberOfLines={2}
              >
                {column.marketName}
              </Text>

              {hasOffer || loading ? (
                <Text
                  style={[
                    styles.priceText,
                    compact && styles.priceTextCompact,
                    {
                      color: hasOffer ? colors.text : colors.mutedText,
                      opacity: hasOffer ? 1 : 0.9,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {priceLabel}
                </Text>
              ) : (
                <View style={styles.unavailableWrap}>
                  <Ionicons
                    name="remove-circle-outline"
                    size={18}
                    color={colors.mutedText}
                  />
                  <Text
                    style={[styles.unavailableText, { color: colors.mutedText }]}
                    numberOfLines={2}
                  >
                    {priceLabel}
                  </Text>
                </View>
              )}

              {column.offer?.unitPrice && column.offer.unitPriceUnit ? (
                <Text style={[styles.metaText, { color: colors.mutedText }]} numberOfLines={1}>
                  {formatMarketPrice(locale, column.offer.unitPrice, column.offer.currency)} /{' '}
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
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {!compact ? (
        <Text style={[styles.helperText, { color: colors.mutedText }]}>
          {tt(
            'market_price_table_hint',
            'Sağa kaydırarak ulusal ve bulunduğun konumdaki market tekliflerini görebilirsin.'
          )}
        </Text>
      ) : null}
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
  columnCardCompact: {
    width: 120,
    minHeight: 160,
    padding: 10,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  marketNameCompact: {
    minHeight: 32,
    fontSize: 12,
    lineHeight: 16,
  },
  priceText: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    minHeight: 44,
  },
  priceTextCompact: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 20,
    minHeight: 38,
  },
  unavailableWrap: {
    marginTop: 10,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  unavailableText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
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

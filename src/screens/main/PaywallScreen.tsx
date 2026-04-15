import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useTheme } from '../../context/ThemeContext';
import { useAppScreenLayout } from '../../components/layout/useAppScreenLayout';
import { AmbientBackdrop } from '../../components/ui/AmbientBackdrop';
import { analyticsService } from '../../services/analytics.service';
import { purchaseService } from '../../services/purchase.service';
import { useMonetizationStatus } from '../../hooks/useMonetizationStatus';
import type {
  PaywallEntrySource,
  PremiumPackagePlanKey,
  PremiumPackageSnapshot,
} from '../../types/monetization';
import { withAlpha } from '../../utils/color';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

const MONTHLY_PRODUCT_ID = 'premium_monthly_39_99_try';
const SIX_MONTH_PRODUCT_ID = 'premium_6month_149_99_try';
const ANNUAL_PRODUCT_ID = 'premium_annual_249_99_try';

function formatTryPrice(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatMonthlyEquivalent(value: number): string {
  return formatTryPrice(value / 12);
}

type PaywallOperationResultState = {
  createdAt: string;
  action: 'purchase' | 'restore';
  status: string;
  providerName: string;
  message: string;
  transactionId: string | null;
  customerId: string | null;
  identityMismatchWarning: string | null;
};

function formatOptionalText(value?: string | null): string {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  return '-';
}

function formatInlineDateTime(value: string): string {
  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleString(undefined, {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

function isSuccessfulOperationStatus(status: string): boolean {
  return status === 'purchased' || status === 'already_active' || status === 'restored';
}

function isWarningOperationStatus(status: string): boolean {
  return status === 'cancelled' || status === 'not_supported' || status === 'no_active_purchase';
}

export const PaywallScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const layout = useAppScreenLayout({
    topInsetExtra: 16,
    topInsetMin: 32,
    contentBottomExtra: 30,
    contentBottomMin: 36,
    horizontalPadding: 24,
  });

  const { loading, policy, entitlement, error, load } = useMonetizationStatus();
  const hasTrackedViewRef = useRef(false);
  const [purchasePending, setPurchasePending] = useState(false);
  const [restorePending, setRestorePending] = useState(false);
  const [premiumPackages, setPremiumPackages] = useState<PremiumPackageSnapshot[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [selectedPackageIdentifier, setSelectedPackageIdentifier] =
    useState<string | null>(null);
  const [lastOperationResult, setLastOperationResult] =
    useState<PaywallOperationResultState | null>(null);

  const tt = useCallback(
    (key: string, fallback: string) => {
      const value = t(key, { defaultValue: fallback });
      return value === key ? fallback : value;
    },
    [t]
  );

  useEffect(() => {
    if (loading || !policy || !entitlement || hasTrackedViewRef.current) {
      return;
    }

    hasTrackedViewRef.current = true;

    void analyticsService.track(
      'monetization_paywall_viewed',
      {
        source: route.params?.source ?? 'unknown',
        annualPlanEnabled: policy.annualPlanEnabled,
        purchaseProviderEnabled: policy.purchaseProviderEnabled,
        annualPriceTry: policy.annualPriceTry,
        entitlementPlan: entitlement.plan,
        isPremium: entitlement.isPremium,
      },
      { flush: false }
    );
  }, [entitlement, loading, policy, route.params?.source]);

  useEffect(() => {
    let isCancelled = false;

    if (loading || !policy?.purchaseProviderEnabled) {
      setPremiumPackages([]);
      setPackagesLoading(false);
      return;
    }

    setPackagesLoading(true);
    setPackagesError(null);

    purchaseService
      .getPremiumPackages()
      .then((packages) => {
        if (isCancelled) {
          return;
        }

        setPremiumPackages(packages);
        setSelectedPackageIdentifier((current) => {
          if (current && packages.some((item) => item.identifier === current)) {
            return current;
          }

          return packages.find((item) => item.planKey === 'annual')?.identifier ?? null;
        });
      })
      .catch((loadError) => {
        if (isCancelled) {
          return;
        }

        setPremiumPackages([]);
        setPackagesError(
          loadError instanceof Error && loadError.message.trim()
            ? loadError.message
            : tt('premium_packages_load_error', 'Premium paketleri yüklenemedi.')
        );
      })
      .finally(() => {
        if (!isCancelled) {
          setPackagesLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [loading, policy?.purchaseProviderEnabled, tt]);

  const sourceLabel = useMemo(() => {
    switch (route.params?.source) {
      case 'scan_limit':
        return tt(
          'scan_limit_reached_title',
          'Günlük ücretsiz tarama limitine ulaştın'
        );
      case 'settings':
        return tt('premium_title', 'BarkodAnaliz Premium');
      default:
        return tt('premium_title', 'BarkodAnaliz Premium');
    }
  }, [route.params?.source, tt]);

  const paywallSource = (route.params?.source ?? 'unknown') as PaywallEntrySource;
  const monthlyPriceTry = policy?.monthlyPriceTry ?? 49.99;
  const annualPriceTry = policy?.annualPriceTry ?? 249.99;
  const fallbackPremiumPackages = useMemo<PremiumPackageSnapshot[]>(
    () => [
      {
        identifier: '$rc_annual',
        productIdentifier: policy?.annualProductId || ANNUAL_PRODUCT_ID,
        planKey: 'annual',
        title: null,
        description: null,
        priceString: formatTryPrice(annualPriceTry),
        price: annualPriceTry,
        currencyCode: 'TRY',
        isLiveProviderPackage: false,
      },
      {
        identifier: '$rc_six_month',
        productIdentifier: SIX_MONTH_PRODUCT_ID,
        planKey: 'six_month',
        title: null,
        description: null,
        priceString: formatTryPrice(149.99),
        price: 149.99,
        currencyCode: 'TRY',
        isLiveProviderPackage: false,
      },
      {
        identifier: '$rc_monthly',
        productIdentifier: policy?.monthlyProductId || MONTHLY_PRODUCT_ID,
        planKey: 'monthly',
        title: null,
        description: null,
        priceString: formatTryPrice(monthlyPriceTry),
        price: monthlyPriceTry,
        currencyCode: 'TRY',
        isLiveProviderPackage: false,
      },
    ],
    [annualPriceTry, monthlyPriceTry, policy?.annualProductId, policy?.monthlyProductId]
  );
  const displayPremiumPackages = premiumPackages.length
    ? premiumPackages
    : fallbackPremiumPackages;
  const selectedPremiumPackage = useMemo(() => {
    return (
      displayPremiumPackages.find(
        (item) => item.identifier === selectedPackageIdentifier
      ) ??
      displayPremiumPackages.find((item) => item.planKey === 'annual') ??
      displayPremiumPackages[0] ??
      null
    );
  }, [displayPremiumPackages, selectedPackageIdentifier]);
  const purchaseReady = Boolean(
    policy?.purchaseProviderEnabled &&
      policy?.annualPlanEnabled &&
      selectedPremiumPackage
  );

  const getPackageTitle = useCallback(
    (planKey: PremiumPackagePlanKey): string => {
      switch (planKey) {
        case 'annual':
          return tt('premium_yearly', 'Yıllık Premium');
        case 'six_month':
          return tt('premium_six_month', '6 Aylık Premium');
        case 'monthly':
          return tt('premium_monthly', 'Aylık Premium');
        default:
          return tt('premium_package', 'Premium Paket');
      }
    },
    [tt]
  );

  const getPackageBadge = useCallback(
    (planKey: PremiumPackagePlanKey): string => {
      switch (planKey) {
        case 'annual':
          return tt('annual_plan_badge', 'En iyi değer');
        case 'six_month':
          return tt('six_month_plan_badge', 'Dengeli');
        case 'monthly':
          return tt('monthly_plan_badge', 'Esnek plan');
        default:
          return tt('premium_access_label', 'Premium erişim');
      }
    },
    [tt]
  );

  const getPackageMeta = useCallback(
    (item: PremiumPackageSnapshot): string => {
      const price = item.price ?? null;

      switch (item.planKey) {
        case 'annual':
          return price
            ? tt(
                'annual_price_equivalent',
                '{{price}} / ay eşitliği ile yıllık kilit fiyat'
              ).replace('{{price}}', formatMonthlyEquivalent(price))
            : tt('annual_plan_meta', 'En avantajlı yıllık Premium erişim.');
        case 'six_month':
          return tt(
            'six_month_plan_meta',
            'Uzun taahhüt istemeyen kullanıcılar için 6 aylık erişim.'
          );
        case 'monthly':
          return tt(
            'monthly_plan_meta',
            'Esnek giriş isteyen kullanıcılar için aylık erişim.'
          );
        default:
          return item.description ?? tt('premium_package_meta', 'Premium erişim paketi.');
      }
    },
    [tt]
  );

  const premiumFeatureCards = useMemo(
    () => [
      {
        key: 'adfree',
        icon: 'sparkles-outline' as const,
        iconColor: colors.primary,
        backgroundColor: withAlpha(colors.primary, '10'),
        title: tt('benefit_adfree_title', 'Reklamsız odak'),
        text: tt(
          'benefit_adfree_text',
          'Tarama, detay ve fiyat karşılaştırma akışları reklamsız kalır.'
        ),
      },
      {
        key: 'markets',
        icon: 'storefront-outline' as const,
        iconColor: colors.teal,
        backgroundColor: withAlpha(colors.teal, '10'),
        title: tt('benefit_markets_title', 'Tüm marketleri gör'),
        text: tt(
          'benefit_markets_text',
          'Gelişmiş market listesi, daha fazla teklif görünürlüğü ve tam kıyas açılır.'
        ),
      },
      {
        key: 'basket',
        icon: 'basket-outline' as const,
        iconColor: colors.text,
        backgroundColor: withAlpha(colors.border, '3E'),
        title: tt('benefit_basket_title', 'Akıllı sepet'),
        text: tt(
          'benefit_basket_text',
          'Sepette en ucuz dağılım, tek market toplamı ve tasarruf farkı daha net görünür.'
        ),
      },
      {
        key: 'alerts',
        icon: 'notifications-outline' as const,
        iconColor: colors.warning,
        backgroundColor: withAlpha(colors.warning, '12'),
        title: tt('benefit_alerts_title', 'Fiyat alarmı'),
        text: tt(
          'benefit_alerts_text',
          'Takip ettiğin ürünlerde fiyat değişimini ve düşüş fırsatlarını kaçırmazsın.'
        ),
      },
      {
        key: 'history',
        icon: 'time-outline' as const,
        iconColor: colors.primary,
        backgroundColor: withAlpha(colors.primary, '10'),
        title: tt('benefit_history_title', 'Tam geçmiş ve favoriler'),
        text: tt(
          'benefit_history_text',
          'Geçmiş taramalar, favoriler, aile listeleri ve ilaç/prospektüs kayıtları korunur.'
        ),
      },
      {
        key: 'filters',
        icon: 'options-outline' as const,
        iconColor: colors.teal,
        backgroundColor: withAlpha(colors.teal, '10'),
        title: tt('benefit_filters_title', 'Gelişmiş filtreler'),
        text: tt(
          'benefit_filters_text',
          'Beslenme tercihleri, market tercihi ve ürün karşılaştırması daha güçlü filtrelerle çalışır.'
        ),
      },
    ],
    [colors.border, colors.primary, colors.teal, colors.text, colors.warning, tt]
  );

  const operationStatusColor = useMemo(() => {
    if (!lastOperationResult) {
      return colors.text;
    }

    if (isSuccessfulOperationStatus(lastOperationResult.status)) {
      return colors.primary;
    }

    if (isWarningOperationStatus(lastOperationResult.status)) {
      return colors.warning;
    }

    return colors.danger;
  }, [colors.danger, colors.primary, colors.text, colors.warning, lastOperationResult]);

  const operationStatusBackground = useMemo(() => {
    if (!lastOperationResult) {
      return withAlpha(colors.border, '33');
    }

    if (isSuccessfulOperationStatus(lastOperationResult.status)) {
      return withAlpha(colors.primary, '12');
    }

    if (isWarningOperationStatus(lastOperationResult.status)) {
      return withAlpha(colors.warning, '14');
    }

    return withAlpha(colors.danger, '14');
  }, [colors.border, colors.danger, colors.primary, colors.warning, lastOperationResult]);

  const handleRestore = useCallback(async () => {
    setRestorePending(true);

    try {
      void analyticsService.track(
        'monetization_restore_tapped',
        {
          source: route.params?.source ?? 'unknown',
        },
        { flush: false }
      );

      const result = await purchaseService.restorePurchases({
        source: paywallSource,
      });
      setLastOperationResult({
        createdAt: new Date().toISOString(),
        action: 'restore',
        status: result.status,
        providerName: result.providerName,
        message: result.message,
        transactionId: result.transactionId,
        customerId: result.customerId,
        identityMismatchWarning: result.identityMismatchWarning,
      });

      if (result.status === 'restored') {
        Alert.alert(tt('restore_success_title', 'Başarılı'), result.message);
      } else if (result.status === 'no_active_purchase') {
        Alert.alert(
          tt('restore_not_found_title', 'Satın alma bulunamadı'),
          result.message
        );
      } else if (result.status === 'not_supported') {
        Alert.alert(
          tt('restore_not_supported_title', 'Henüz aktif değil'),
          result.message
        );
      } else {
        Alert.alert(tt('error_title', 'Hata'), result.message);
      }

      if (result.identityMismatchWarning) {
        Alert.alert(
          tt('provider_identity_mismatch_title', 'Provider kimlik uyumsuzluğu'),
          result.identityMismatchWarning
        );
      }

      await load({ forceRefresh: true });
    } catch (error) {
      Alert.alert(
        tt('error_title', 'Hata'),
        error instanceof Error && error.message.trim()
          ? error.message
          : tt('restore_error', 'Satın alma geri yükleme başarısız oldu.')
      );
      setLastOperationResult({
        createdAt: new Date().toISOString(),
        action: 'restore',
        status: 'error',
        providerName: 'none',
        message:
          error instanceof Error && error.message.trim()
            ? error.message
            : tt('restore_error', 'Satın alma geri yükleme başarısız oldu.'),
        transactionId: null,
        customerId: null,
        identityMismatchWarning: null,
      });
    } finally {
      setRestorePending(false);
    }
  }, [load, paywallSource, route.params?.source, tt]);

  const handlePurchasePress = useCallback(async () => {
    if (!selectedPremiumPackage) {
      Alert.alert(
        tt('purchase_unavailable_title', 'Satın alma entegrasyonu hazır değil'),
        tt('premium_package_missing', 'Satın alınacak Premium paketi seçilemedi.')
      );
      return;
    }

    setPurchasePending(true);

    try {
      void analyticsService.track(
        'monetization_paywall_cta_tapped',
        {
          source: route.params?.source ?? 'unknown',
          packageIdentifier: selectedPremiumPackage.identifier,
          productIdentifier: selectedPremiumPackage.productIdentifier,
          planKey: selectedPremiumPackage.planKey,
          purchaseProviderEnabled: policy?.purchaseProviderEnabled ?? false,
        },
        { flush: false }
      );

      const result = await purchaseService.purchasePremiumPackage({
        source: paywallSource,
        packageIdentifier: selectedPremiumPackage.identifier,
        productIdentifier: selectedPremiumPackage.productIdentifier,
        planKey: selectedPremiumPackage.planKey,
      });
      setLastOperationResult({
        createdAt: new Date().toISOString(),
        action: 'purchase',
        status: result.status,
        providerName: result.providerName,
        message: result.message,
        transactionId: result.transactionId,
        customerId: result.customerId,
        identityMismatchWarning: result.identityMismatchWarning,
      });

      if (result.status === 'purchased' || result.status === 'already_active') {
        Alert.alert(
          tt('purchase_success_title', 'Premium aktif'),
          result.message
        );
      } else if (result.status === 'cancelled') {
        Alert.alert(
          tt('purchase_cancelled_title', 'İşlem iptal edildi'),
          result.message
        );
      } else if (result.status === 'not_supported') {
        Alert.alert(
          tt('purchase_unavailable_title', 'Satın alma entegrasyonu hazır değil'),
          result.message
        );
      } else {
        Alert.alert(tt('error_title', 'Hata'), result.message);
      }

      if (result.identityMismatchWarning) {
        Alert.alert(
          tt('provider_identity_mismatch_title', 'Provider kimlik uyumsuzluğu'),
          result.identityMismatchWarning
        );
      }

      await load({ forceRefresh: true });
    } catch (error) {
      Alert.alert(
        tt('error_title', 'Hata'),
        error instanceof Error && error.message.trim()
          ? error.message
          : tt('purchase_error', 'Premium satın alma işlemi başarısız oldu.')
      );
      setLastOperationResult({
        createdAt: new Date().toISOString(),
        action: 'purchase',
        status: 'error',
        providerName: 'none',
        message:
          error instanceof Error && error.message.trim()
            ? error.message
            : tt('purchase_error', 'Premium satın alma işlemi başarısız oldu.'),
        transactionId: null,
        customerId: null,
        identityMismatchWarning: null,
      });
    } finally {
      setPurchasePending(false);
    }
  }, [
    load,
    paywallSource,
    policy?.purchaseProviderEnabled,
    route.params?.source,
    selectedPremiumPackage,
    tt,
  ]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AmbientBackdrop colors={colors} variant="paywall" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingTop: layout.headerTopPadding,
          paddingBottom: layout.contentBottomPadding,
          paddingHorizontal: layout.horizontalPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={[
            styles.closeButton,
            {
              borderColor: withAlpha(colors.border, 'B8'),
              backgroundColor: withAlpha(colors.cardElevated, 'E8'),
            },
          ]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
          <Text style={[styles.closeButtonText, { color: colors.text }]}>
            {tt('back', 'Geri')}
          </Text>
        </TouchableOpacity>

        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: withAlpha(colors.card, 'F2'),
              borderColor: withAlpha(colors.border, 'B8'),
              shadowColor: colors.shadow,
            },
          ]}
        >
          <View style={styles.heroTopRow}>
            <View
              style={[
                styles.heroBadgePill,
                { backgroundColor: withAlpha(colors.primary, '14') },
              ]}
            >
              <Text style={[styles.heroBadgeText, { color: colors.primary }]}>
                {tt('premium_access_label', 'Premium erisim')}
              </Text>
            </View>

            <View
              style={[
                styles.heroStatePill,
                {
                  backgroundColor: withAlpha(
                    entitlement?.isPremium ? colors.success : colors.teal,
                    '14'
                  ),
                },
              ]}
            >
              <Text
                style={[
                  styles.heroStateText,
                  {
                    color: entitlement?.isPremium ? colors.success : colors.teal,
                  },
                ]}
              >
                {entitlement?.isPremium
                  ? tt('premium_active', 'Premium aktif')
                  : purchaseReady
                    ? tt('ready_label', 'Hazir')
                    : tt('setup_label', 'Kurulum')}
              </Text>
            </View>
          </View>

          <View style={[styles.heroIconWrap, { backgroundColor: withAlpha(colors.primary, '14') }]}>
            <Ionicons name="diamond-outline" size={34} color={colors.primary} />
          </View>

          <Text style={[styles.heroTitle, { color: colors.text }]}>{sourceLabel}</Text>

          <Text style={[styles.heroSubtitle, { color: colors.mutedText }]}>
            {tt(
              'premium_subtitle',
              'Ücretsizde tara, skor gör ve temel fiyat kıyasını kullan. Premium ile reklamsız deneyim, gelişmiş market optimizasyonu ve daha akıllı alışveriş araçları açılır.'
            )}
          </Text>

          <View
            style={[
              styles.freeCoreNotice,
              {
                backgroundColor: withAlpha(colors.cardElevated, 'E6'),
                borderColor: withAlpha(colors.border, 'B8'),
              },
            ]}
          >
            <Text style={[styles.freeCoreTitle, { color: colors.text }]}>
              {tt('free_core_title', 'Ücretsiz çekirdek hep açık')}
            </Text>
            <Text style={[styles.freeCoreText, { color: colors.mutedText }]}>
              {tt(
                'free_core_text',
                'Barkod tara, ürün skorunu gör ve temel fiyat kıyasını reklamlı modelle kullanmaya devam edebilirsin.'
              )}
            </Text>
          </View>

          <View style={styles.valueStrip}>
            <View
              style={[
                styles.valueChip,
                { backgroundColor: withAlpha(colors.primary, '12') },
              ]}
            >
              <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
              <Text style={[styles.valueChipText, { color: colors.text }]}>
                {tt('value_chip_adfree', 'Reklamsiz')}
              </Text>
            </View>
            <View
              style={[
                styles.valueChip,
                { backgroundColor: withAlpha(colors.teal, '12') },
              ]}
            >
              <Ionicons name="storefront-outline" size={16} color={colors.teal} />
              <Text style={[styles.valueChipText, { color: colors.text }]}>
                {tt('value_chip_full_markets', 'Tam market görünümü')}
              </Text>
            </View>
            <View
              style={[
                styles.valueChip,
                { backgroundColor: withAlpha(colors.border, '42') },
              ]}
            >
              <Ionicons name="basket-outline" size={16} color={colors.text} />
              <Text style={[styles.valueChipText, { color: colors.text }]}>
                {tt('value_chip_smart_basket', 'Akıllı sepet')}
              </Text>
            </View>
            <View
              style={[
                styles.valueChip,
                { backgroundColor: withAlpha(colors.warning, '12') },
              ]}
            >
              <Ionicons name="notifications-outline" size={16} color={colors.warning} />
              <Text style={[styles.valueChipText, { color: colors.text }]}>
                {tt('value_chip_alerts', 'Fiyat alarmı')}
              </Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : error ? (
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          ) : (
            <>
              <View
                style={[
                  styles.planCard,
                  {
                    backgroundColor: withAlpha(colors.cardElevated, 'F0'),
                    borderColor: withAlpha(colors.border, 'B0'),
                  },
                ]}
              >
                <View style={styles.planComparisonGrid}>
                  {displayPremiumPackages.map((item) => {
                    const isSelected =
                      selectedPremiumPackage?.identifier === item.identifier;
                    const isRecommended = item.planKey === 'annual';
                    const packagePrice = item.priceString ?? '-';

                    return (
                      <TouchableOpacity
                        key={`${item.identifier}:${item.productIdentifier}`}
                        style={[
                          styles.planOptionCard,
                          isRecommended ? styles.planOptionCardRecommended : null,
                          {
                            backgroundColor: isSelected
                              ? withAlpha(colors.primary, '10')
                              : withAlpha(colors.card, 'D8'),
                            borderColor: isSelected
                              ? withAlpha(colors.primary, '70')
                              : withAlpha(colors.border, 'B8'),
                          },
                        ]}
                        onPress={() => setSelectedPackageIdentifier(item.identifier)}
                        disabled={purchasePending || restorePending}
                        activeOpacity={0.86}
                      >
                        <View style={styles.planOptionTopRow}>
                          <View
                            style={[
                              styles.planOptionBadge,
                              {
                                backgroundColor: withAlpha(
                                  isRecommended ? colors.primary : colors.teal,
                                  '16'
                                ),
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.planOptionBadgeText,
                                {
                                  color: isRecommended
                                    ? colors.primary
                                    : colors.teal,
                                },
                              ]}
                            >
                              {getPackageBadge(item.planKey)}
                            </Text>
                          </View>

                          {isSelected ? (
                            <Ionicons
                              name="checkmark-circle"
                              size={22}
                              color={colors.primary}
                            />
                          ) : null}
                        </View>

                        <Text style={[styles.planOptionTitle, { color: colors.text }]}>
                          {getPackageTitle(item.planKey)}
                        </Text>
                        <Text style={[styles.planOptionPrice, { color: colors.text }]}>
                          {packagePrice}
                        </Text>
                        <Text style={[styles.planOptionMeta, { color: colors.mutedText }]}>
                          {getPackageMeta(item)}
                        </Text>
                        {!item.isLiveProviderPackage ? (
                          <Text style={[styles.planOptionSavings, { color: colors.warning }]}>
                            {tt(
                              'premium_package_fallback_notice',
                              'Mağaza paketi yüklenince fiyat RevenueCat üzerinden doğrulanır.'
                            )}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {packagesLoading ? (
                  <View style={styles.packageLoadRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.packageLoadText, { color: colors.mutedText }]}>
                      {tt('premium_packages_loading', 'Premium paketleri yükleniyor...')}
                    </Text>
                  </View>
                ) : packagesError ? (
                  <Text
                    style={[
                      styles.packageLoadText,
                      { color: colors.warning, marginTop: 12 },
                    ]}
                  >
                    {packagesError}
                  </Text>
                ) : null}

                <View style={styles.planBenefitGrid}>
                  {premiumFeatureCards.map((item) => (
                    <View
                      key={item.key}
                      style={[
                        styles.planBenefitCard,
                        { backgroundColor: item.backgroundColor },
                      ]}
                    >
                      <Ionicons name={item.icon} size={18} color={item.iconColor} />
                      <Text style={[styles.planBenefitTitle, { color: colors.text }]}>
                        {item.title}
                      </Text>
                      <Text style={[styles.planBenefitText, { color: colors.mutedText }]}>
                        {item.text}
                      </Text>
                    </View>
                  ))}
                </View>

                <View
                  style={[
                    styles.readinessCard,
                    {
                      backgroundColor: withAlpha(
                        purchaseReady ? colors.success : colors.warning,
                        '12'
                      ),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.readinessTitle,
                      {
                        color: purchaseReady ? colors.success : colors.warning,
                      },
                    ]}
                  >
                    {purchaseReady
                      ? tt('purchase_surface_ready_title', 'Satın alma yüzeyi hazir')
                      : tt('purchase_surface_setup_title', 'Store konfigurasyonu tamamlaniyor')}
                  </Text>
                  <Text style={[styles.readinessText, { color: colors.mutedText }]}>
                    {purchaseReady
                      ? tt(
                          'purchase_surface_ready_text',
                          'RevenueCat paketleri hazır. Seçtiğin Premium plan doğrudan Google Play satın alma akışını açar.'
                        )
                      : tt(
                          'purchase_surface_setup_text',
                          'Store ve provider yapılandırması tamamlandığında Premium paketleri doğrudan satın alma akışını açacak.'
                        )}
                  </Text>
                </View>

                {entitlement?.isPremium ? (
                  <View
                    style={[
                      styles.activeStateBox,
                      { backgroundColor: withAlpha(colors.success, '12') },
                    ]}
                  >
                    <Text style={[styles.activeStateTitle, { color: colors.success }]}>
                      {tt('premium_active', 'Premium aktif')}
                    </Text>
                    <Text style={[styles.activeStateText, { color: colors.mutedText }]}>
                      {tt(
                        'premium_active_text',
                        'Bu hesapta premium aktif. Reklamlar bastırılır; gelişmiş market optimizasyonu, geçmiş ve filtre özellikleri açılır.'
                      )}
                    </Text>
                  </View>
                ) : null}
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: purchaseReady ? colors.primary : colors.border,
                    opacity: purchasePending ? 0.72 : 1,
                    shadowColor: colors.shadow,
                  },
                ]}
                disabled={!purchaseReady || purchasePending || restorePending}
                onPress={handlePurchasePress}
                activeOpacity={0.9}
              >
                {purchasePending ? (
                  <ActivityIndicator size="small" color={colors.primaryContrast} />
                ) : (
                  <>
                    <Ionicons
                      name="diamond-outline"
                      size={18}
                      color={colors.primaryContrast}
                    />
                    <Text
                      style={[
                        styles.primaryButtonText,
                        { color: colors.primaryContrast },
                      ]}
                    >
                      {purchaseReady
                        ? tt(
                            'buy_selected_premium',
                            '{{plan}} ile Devam Et'
                          ).replace(
                            '{{plan}}',
                            selectedPremiumPackage
                              ? getPackageTitle(selectedPremiumPackage.planKey)
                              : tt('premium_package', 'Premium Paket')
                          )
                        : tt(
                            'purchase_provider_inactive',
                            'Satın alma sağlayıcısı henüz aktif değil'
                          )}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  {
                    borderColor: withAlpha(colors.border, 'B8'),
                    backgroundColor: withAlpha(colors.cardElevated, 'E8'),
                    opacity: restorePending ? 0.72 : 1,
                  },
                ]}
                onPress={handleRestore}
                disabled={purchasePending || restorePending}
                activeOpacity={0.85}
              >
                {restorePending ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <>
                    <Ionicons name="refresh-outline" size={18} color={colors.text} />
                    <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                      {tt('restore_purchase', 'Satın Alımı Geri Yükle')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {lastOperationResult ? (
                <View
                  style={[
                    styles.resultCard,
                    {
                      backgroundColor: operationStatusBackground,
                      borderColor: withAlpha(colors.border, 'B8'),
                    },
                  ]}
                >
                  <Text style={[styles.resultTitle, { color: operationStatusColor }]}>
                    {lastOperationResult.action === 'purchase'
                      ? tt('last_purchase_result', 'Son purchase sonucu')
                      : tt('last_restore_result', 'Son restore sonucu')}
                  </Text>
                  <Text style={[styles.resultMeta, { color: colors.mutedText }]}>
                    {formatInlineDateTime(lastOperationResult.createdAt)} |{' '}
                    {lastOperationResult.status} | {lastOperationResult.providerName}
                  </Text>
                  <Text style={[styles.resultBody, { color: colors.text }]}>
                    {lastOperationResult.message}
                  </Text>
                  <Text style={[styles.resultMeta, { color: colors.mutedText }]}>
                    Customer: {formatOptionalText(lastOperationResult.customerId)} | Tx:{' '}
                    {formatOptionalText(lastOperationResult.transactionId)}
                  </Text>
                  {lastOperationResult.identityMismatchWarning ? (
                    <Text style={[styles.resultWarning, { color: colors.warning }]}>
                      {lastOperationResult.identityMismatchWarning}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.tertiaryButton}
                onPress={() => navigation.goBack()}
                activeOpacity={0.8}
              >
                <Text style={[styles.tertiaryButtonText, { color: colors.mutedText }]}>
                  {tt('continue_free', 'Ücretsiz Devam Et')}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 30,
    padding: 22,
    shadowOpacity: 0.16,
    shadowRadius: 28,
    shadowOffset: {
      width: 0,
      height: 18,
    },
    elevation: 10,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroBadgePill: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroStatePill: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStateText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  heroIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    letterSpacing: -0.9,
  },
  heroSubtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 24,
  },
  freeCoreNotice: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  freeCoreTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  freeCoreText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  valueStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  valueChip: {
    minHeight: 36,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  valueChipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    marginTop: 18,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
  },
  planCard: {
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
  },
  planComparisonGrid: {
    gap: 12,
  },
  planOptionCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    gap: 8,
  },
  planOptionCardRecommended: {
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 4,
  },
  planOptionTopRow: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  planOptionBadge: {
    alignSelf: 'flex-start',
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planOptionBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  planOptionTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  planOptionPrice: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  planOptionMeta: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  planOptionSavings: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  packageLoadRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  packageLoadText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  planHeaderTextWrap: {
    flex: 1,
  },
  planEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  planTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  planMeta: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
  },
  priceSpotlight: {
    minWidth: 118,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceMain: {
    fontSize: 20,
    fontWeight: '900',
  },
  priceSub: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  planBenefitGrid: {
    marginTop: 18,
    gap: 12,
  },
  planBenefitCard: {
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  planBenefitTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  planBenefitText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  readinessCard: {
    marginTop: 16,
    borderRadius: 18,
    padding: 14,
  },
  readinessTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  readinessText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  activeStateBox: {
    marginTop: 18,
    borderRadius: 18,
    padding: 14,
  },
  activeStateTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  activeStateText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: 20,
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    elevation: 8,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  secondaryButton: {
    marginTop: 12,
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  resultCard: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 18,
    padding: 15,
    gap: 6,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  resultMeta: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  resultBody: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
  },
  resultWarning: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  tertiaryButton: {
    marginTop: 12,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tertiaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    opacity: 0.72,
  },
});

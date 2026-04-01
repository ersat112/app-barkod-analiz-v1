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
import type { PaywallEntrySource } from '../../types/monetization';
import { withAlpha } from '../../utils/color';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

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
  const monthlyPlanEnabled = policy?.monthlyPlanEnabled ?? false;
  const monthlyPriceTry = policy?.monthlyPriceTry ?? 49.99;
  const annualPriceTry = policy?.annualPriceTry ?? 39.99;
  const purchaseReady = Boolean(
    policy?.purchaseProviderEnabled && policy?.annualPlanEnabled
  );
  const annualSavingsTry = useMemo(() => {
    const rawValue = monthlyPriceTry * 12 - annualPriceTry;
    return rawValue > 0 ? Math.round(rawValue * 100) / 100 : 0;
  }, [annualPriceTry, monthlyPriceTry]);

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
    setPurchasePending(true);

    try {
      void analyticsService.track(
        'monetization_paywall_cta_tapped',
        {
          source: route.params?.source ?? 'unknown',
          annualProductId: policy?.annualProductId ?? null,
          purchaseProviderEnabled: policy?.purchaseProviderEnabled ?? false,
        },
        { flush: false }
      );

      const result = await purchaseService.purchaseAnnualPlan({
        source: paywallSource,
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
  }, [load, paywallSource, policy?.annualProductId, policy?.purchaseProviderEnabled, route.params?.source, tt]);

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
                  <View
                    style={[
                      styles.planOptionCard,
                      {
                        backgroundColor: withAlpha(colors.card, 'D8'),
                        borderColor: withAlpha(colors.border, 'B8'),
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.planOptionBadge,
                        {
                          backgroundColor: withAlpha(
                            monthlyPlanEnabled ? colors.teal : colors.warning,
                            '14'
                          ),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.planOptionBadgeText,
                          {
                            color: monthlyPlanEnabled ? colors.teal : colors.warning,
                          },
                        ]}
                      >
                        {monthlyPlanEnabled
                          ? tt('monthly_plan_badge', 'Esnek plan')
                          : tt('monthly_plan_coming_soon_badge', 'Yakında')}
                      </Text>
                    </View>

                    <Text style={[styles.planOptionTitle, { color: colors.text }]}>
                      {tt('premium_monthly', 'Aylık Premium')}
                    </Text>
                    <Text style={[styles.planOptionPrice, { color: colors.text }]}>
                      {monthlyPlanEnabled
                        ? formatTryPrice(monthlyPriceTry)
                        : tt('monthly_plan_coming_soon_price', 'Yakında')}
                    </Text>
                    <Text style={[styles.planOptionMeta, { color: colors.mutedText }]}>
                      {monthlyPlanEnabled
                        ? tt(
                            'monthly_plan_meta',
                            'Esnek giriş isteyen kullanıcılar için aylık erişim.'
                          )
                        : tt(
                            'monthly_plan_disabled_meta',
                            'Aylık plan mağaza ürünü aktif olduğunda bu ekrana eklenecek.'
                          )}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.planOptionCard,
                      styles.planOptionCardRecommended,
                      {
                        backgroundColor: withAlpha(colors.primary, '10'),
                        borderColor: withAlpha(colors.primary, '3A'),
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.planOptionBadge,
                        { backgroundColor: withAlpha(colors.primary, '16') },
                      ]}
                    >
                      <Text
                        style={[
                          styles.planOptionBadgeText,
                          { color: colors.primary },
                        ]}
                      >
                        {tt('annual_plan_badge', 'En iyi değer')}
                      </Text>
                    </View>

                    <Text style={[styles.planOptionTitle, { color: colors.text }]}>
                      {tt('premium_yearly', 'Yıllık Premium')}
                    </Text>
                    <Text style={[styles.planOptionPrice, { color: colors.text }]}>
                      {formatTryPrice(annualPriceTry)}
                    </Text>
                    <Text style={[styles.planOptionMeta, { color: colors.mutedText }]}>
                      {tt(
                        'annual_price_equivalent',
                        '{{price}} / ay eşitliği ile yıllık kilit fiyat'
                      ).replace('{{price}}', formatMonthlyEquivalent(annualPriceTry))}
                    </Text>
                    {monthlyPlanEnabled && annualSavingsTry > 0 ? (
                      <Text style={[styles.planOptionSavings, { color: colors.primary }]}>
                        {tt(
                          'annual_plan_savings',
                          'Aylık plana göre {{price}} daha avantajlı'
                        ).replace('{{price}}', formatTryPrice(annualSavingsTry))}
                      </Text>
                    ) : null}
                  </View>
                </View>

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
                          'Yıllık plan şu an aktif satın alma yoludur. Store ve provider doğrulandığında doğrudan satın alma akışı açılır.'
                        )
                      : tt(
                          'purchase_surface_setup_text',
                          'Store ve provider yapılandırması tamamlandığında yıllık plan doğrudan satın alma akışını açacak. Aylık plan ayrı ürün olarak sonra aktive edilebilir.'
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
                        ? tt('buy_yearly_premium', 'Yıllık Premium ile Tasarrufa Başla')
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

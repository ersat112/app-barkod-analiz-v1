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
        return tt('premium_title', 'Premium Yıllık Plan');
      default:
        return tt('premium_title', 'Premium Yıllık Plan');
    }
  }, [route.params?.source, tt]);

  const paywallSource = (route.params?.source ?? 'unknown') as PaywallEntrySource;
  const annualPriceTry = policy?.annualPriceTry ?? 39.99;
  const purchaseReady = Boolean(
    policy?.purchaseProviderEnabled && policy?.annualPlanEnabled
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
              'Premium ile reklamsız kullanım, limitsiz barkod tarama ve daha güvenilir operasyon yüzeyi açılır.'
            )}
          </Text>

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
              <Ionicons name="scan-outline" size={16} color={colors.teal} />
              <Text style={[styles.valueChipText, { color: colors.text }]}>
                {tt('value_chip_unlimited', 'Limitsiz tarama')}
              </Text>
            </View>
            <View
              style={[
                styles.valueChip,
                { backgroundColor: withAlpha(colors.border, '42') },
              ]}
            >
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.text} />
              <Text style={[styles.valueChipText, { color: colors.text }]}>
                {tt('value_chip_restore_ready', 'Restore hazir')}
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
                <View style={styles.planHeader}>
                  <View style={styles.planHeaderTextWrap}>
                    <Text style={[styles.planEyebrow, { color: colors.primary }]}>
                      {tt('annual_plan_label', 'Yillik plan')}
                    </Text>
                    <Text style={[styles.planTitle, { color: colors.text }]}>
                      {tt('premium_yearly', 'Yıllık Premium')}
                    </Text>
                    <Text style={[styles.planMeta, { color: colors.mutedText }]}>
                      {tt(
                        'annual_price_equivalent',
                        '{{price}} / ay esitligi ile yillik kilit fiyat'
                      ).replace('{{price}}', formatMonthlyEquivalent(annualPriceTry))}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.priceSpotlight,
                      { backgroundColor: withAlpha(colors.primary, '14') },
                    ]}
                  >
                    <Text style={[styles.priceMain, { color: colors.text }]}>
                      {formatTryPrice(annualPriceTry)}
                    </Text>
                    <Text style={[styles.priceSub, { color: colors.mutedText }]}>
                      / yil
                    </Text>
                  </View>
                </View>

                <View style={styles.planBenefitGrid}>
                  <View
                    style={[
                      styles.planBenefitCard,
                      { backgroundColor: withAlpha(colors.primary, '10') },
                    ]}
                  >
                    <Ionicons name="radio-outline" size={18} color={colors.primary} />
                    <Text style={[styles.planBenefitTitle, { color: colors.text }]}>
                      {tt('benefit_silent_experience_title', 'Sessiz deneyim')}
                    </Text>
                    <Text style={[styles.planBenefitText, { color: colors.mutedText }]}>
                      {tt(
                        'benefit_silent_experience_text',
                        'Reklamlar bastirilir, odak kaybi azalir.'
                      )}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.planBenefitCard,
                      { backgroundColor: withAlpha(colors.teal, '10') },
                    ]}
                  >
                    <Ionicons name="infinite-outline" size={18} color={colors.teal} />
                    <Text style={[styles.planBenefitTitle, { color: colors.text }]}>
                      {tt('benefit_unlimited_volume_title', 'Sinirsiz hacim')}
                    </Text>
                    <Text style={[styles.planBenefitText, { color: colors.mutedText }]}>
                      {tt(
                        'benefit_unlimited_volume_text',
                        'Gunluk tarama limiti kalkar, akisin bozulmaz.'
                      )}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.planBenefitCard,
                      { backgroundColor: withAlpha(colors.border, '3E') },
                    ]}
                  >
                    <Ionicons name="server-outline" size={18} color={colors.text} />
                    <Text style={[styles.planBenefitTitle, { color: colors.text }]}>
                      {tt('benefit_identity_sync_title', 'Kimlik senkronu')}
                    </Text>
                    <Text style={[styles.planBenefitText, { color: colors.mutedText }]}>
                      {tt(
                        'benefit_identity_sync_text',
                        'Auth ve restore akislarinda entitlement takibi korunur.'
                      )}
                    </Text>
                  </View>
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
                          'Provider acik. Bundle, offering ve cihaz billing katmani dogrulandiginda satin alma sheet acilir.'
                        )
                      : tt(
                          'purchase_surface_setup_text',
                          'Dashboard ve store paketlerini tamamlayinca bu ekran dogrudan satin alma akisini acacak.'
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
                        'Bu hesapta premium entitlement aktif görünüyor. Reklamlar bastırılır ve tarama limiti uygulanmaz.'
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
                        ? tt('buy_yearly_premium', 'Yıllık Premium Satın Al')
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

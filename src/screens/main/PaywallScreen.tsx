import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import type {
  EntitlementSnapshot,
  MonetizationPolicySnapshot,
} from '../../types/monetization';
import { entitlementService } from '../../services/entitlement.service';
import { monetizationPolicyService } from '../../services/monetizationPolicy.service';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

type ScreenState = {
  loading: boolean;
  policy: MonetizationPolicySnapshot | null;
  entitlement: EntitlementSnapshot | null;
  error: string | null;
};

function formatTryPrice(value: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
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

  const [state, setState] = useState<ScreenState>({
    loading: true,
    policy: null,
    entitlement: null,
    error: null,
  });

  const tt = useCallback(
    (key: string, fallback: string) => {
      const value = t(key, { defaultValue: fallback });
      return value === key ? fallback : value;
    },
    [t]
  );

  const load = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));

    try {
      const [policy, entitlement] = await Promise.all([
        monetizationPolicyService.getResolvedPolicy({ allowStale: true }),
        entitlementService.getSnapshot(),
      ]);

      setState({
        loading: false,
        policy,
        entitlement,
        error: null,
      });
    } catch (error) {
      setState({
        loading: false,
        policy: null,
        entitlement: null,
        error:
          error instanceof Error && error.message.trim()
            ? error.message
            : tt('paywall_load_error', 'Premium teklif ekranı yüklenemedi.'),
      });
    }
  }, [tt]);

  useEffect(() => {
    void load();
  }, [load]);

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

  const handleRestore = useCallback(async () => {
    try {
      const result = await entitlementService.restorePurchases();

      if (result.status === 'restored') {
        Alert.alert(
          tt('restore_success_title', 'Başarılı'),
          result.message
        );
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

      await load();
    } catch (error) {
      Alert.alert(
        tt('error_title', 'Hata'),
        error instanceof Error && error.message.trim()
          ? error.message
          : tt('restore_error', 'Satın alma geri yükleme başarısız oldu.')
      );
    }
  }, [load, tt]);

  const handlePurchasePress = useCallback(() => {
    Alert.alert(
      tt('purchase_unavailable_title', 'Satın alma entegrasyonu hazır değil'),
      tt(
        'purchase_unavailable_message',
        'Bu build içinde mağaza satın alma sağlayıcısı henüz aktif değil. Foundation hazır; gerçek satın alma entegrasyonu sonraki pakette bağlanacak.'
      )
    );
  }, [tt]);

  const policy = state.policy;
  const entitlement = state.entitlement;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: layout.headerTopPadding,
        paddingBottom: layout.contentBottomPadding,
        paddingHorizontal: layout.horizontalPadding,
      }}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity
        style={[styles.closeButton, { borderColor: colors.border }]}
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
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={[styles.heroIconWrap, { backgroundColor: `${colors.primary}14` }]}>
          <Ionicons name="diamond-outline" size={34} color={colors.primary} />
        </View>

        <Text style={[styles.heroTitle, { color: colors.text }]}>{sourceLabel}</Text>

        <Text style={[styles.heroSubtitle, { color: colors.text }]}>
          {tt(
            'premium_subtitle',
            'Premium ile reklamsız kullanım ve limitsiz barkod tarama açılır.'
          )}
        </Text>

        {state.loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : state.error ? (
          <Text style={styles.errorText}>{state.error}</Text>
        ) : (
          <>
            <View
              style={[
                styles.planCard,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.planHeader}>
                <View>
                  <Text style={[styles.planTitle, { color: colors.text }]}>
                    {tt('premium_yearly', 'Yıllık Premium')}
                  </Text>
                  <Text style={[styles.planMeta, { color: colors.text }]}>
                    {policy ? formatTryPrice(policy.annualPriceTry) : '39,99 TL'} / yıl
                  </Text>
                </View>

                <View style={[styles.badge, { backgroundColor: `${colors.primary}14` }]}>
                  <Text style={[styles.badgeText, { color: colors.primary }]}>
                    {tt('best_value', 'Yıllık')}
                  </Text>
                </View>
              </View>

              <View style={styles.featureList}>
                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                  <Text style={[styles.featureText, { color: colors.text }]}>
                    {tt('premium_feature_no_ads', 'Reklamsız deneyim')}
                  </Text>
                </View>

                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                  <Text style={[styles.featureText, { color: colors.text }]}>
                    {tt('premium_feature_unlimited_scans', 'Tarama limiti yok')}
                  </Text>
                </View>

                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                  <Text style={[styles.featureText, { color: colors.text }]}>
                    {tt(
                      'premium_feature_foundation_ready',
                      'Entitlement-aware ürün altyapısı aktif'
                    )}
                  </Text>
                </View>
              </View>

              {entitlement?.isPremium ? (
                <View style={[styles.activeStateBox, { backgroundColor: `${colors.primary}12` }]}>
                  <Text style={[styles.activeStateTitle, { color: colors.primary }]}>
                    {tt('premium_active', 'Premium aktif')}
                  </Text>
                  <Text style={[styles.activeStateText, { color: colors.text }]}>
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
                  backgroundColor:
                    policy?.purchaseProviderEnabled && policy?.annualPlanEnabled
                      ? colors.primary
                      : colors.border,
                },
              ]}
              disabled={!policy?.purchaseProviderEnabled || !policy?.annualPlanEnabled}
              onPress={handlePurchasePress}
              activeOpacity={0.9}
            >
              <Text style={styles.primaryButtonText}>
                {policy?.purchaseProviderEnabled
                  ? tt('buy_yearly_premium', 'Yıllık Premium Satın Al')
                  : tt('purchase_provider_inactive', 'Satın alma sağlayıcısı henüz aktif değil')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.secondaryButton,
                {
                  borderColor: colors.border,
                },
              ]}
              onPress={handleRestore}
              activeOpacity={0.85}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                {tt('restore_purchase', 'Satın Alımı Geri Yükle')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tertiaryButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <Text style={[styles.tertiaryButtonText, { color: colors.text }]}>
                {tt('continue_free', 'Ücretsiz Devam Et')}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeButton: {
    alignSelf: 'flex-start',
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 18,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
  },
  heroIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
  },
  heroSubtitle: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.72,
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    marginTop: 18,
    color: '#FF4444',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
  },
  planCard: {
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  planMeta: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '700',
    opacity: 0.72,
  },
  badge: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  featureList: {
    marginTop: 18,
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  activeStateBox: {
    marginTop: 18,
    borderRadius: 16,
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
    opacity: 0.72,
  },
  primaryButton: {
    marginTop: 20,
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  secondaryButton: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
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
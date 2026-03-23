import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { AD_UNIT_ID, GLOBAL_AD_CONFIG } from '../config/admob';
import { useTheme } from '../context/ThemeContext';
import {
  getAdMobModule,
  getAdMobUnavailableReason,
  isAdMobAvailable,
} from '../services/admobRuntime';
import { adService } from '../services/adService';
import { entitlementService } from '../services/entitlement.service';

type AdBannerProps = {
  visible?: boolean;
  size?: 'adaptive' | 'banner';
  placement?: string;
  containerStyle?: StyleProp<ViewStyle>;
  showPlaceholderWhenUnavailable?: boolean;
};

export const AdBanner: React.FC<AdBannerProps> = ({
  visible = true,
  size = 'adaptive',
  placement = 'generic',
  containerStyle,
  showPlaceholderWhenUnavailable = false,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [policyReady, setPolicyReady] = useState(false);
  const [policyAllowsBanner, setPolicyAllowsBanner] = useState(false);
  const [entitlementAllowsAds, setEntitlementAllowsAds] = useState(true);
  const impressionTrackedRef = useRef(false);

  const tt = (key: string, fallback: string) => {
    const value = t(key, { defaultValue: fallback });
    return value === key ? fallback : value;
  };

  const adsModule = useMemo(() => {
    if (
      !visible ||
      !policyAllowsBanner ||
      !entitlementAllowsAds ||
      !isAdMobAvailable()
    ) {
      return null;
    }

    return getAdMobModule();
  }, [entitlementAllowsAds, policyAllowsBanner, visible]);

  useEffect(() => {
    let mounted = true;

    const resolvePolicy = async () => {
      if (!visible) {
        if (mounted) {
          setPolicyReady(true);
          setPolicyAllowsBanner(false);
          setEntitlementAllowsAds(false);
        }
        return;
      }

      try {
        const [policy, entitlement] = await Promise.all([
          adService.getCurrentPolicy(),
          entitlementService.getSnapshot(),
        ]);

        if (!mounted) {
          return;
        }

        const allowAds = !entitlement.isPremium;

        setEntitlementAllowsAds(allowAds);
        setPolicyAllowsBanner(
          allowAds && policy.enabled && policy.bannerEnabled
        );
      } catch (error) {
        console.log('[BannerAd] policy resolve failed:', error);

        if (!mounted) {
          return;
        }

        setEntitlementAllowsAds(false);
        setPolicyAllowsBanner(false);
      } finally {
        if (mounted) {
          setPolicyReady(true);
        }
      }
    };

    void resolvePolicy();

    return () => {
      mounted = false;
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (!isAdMobAvailable()) {
      console.log('[BannerAd] unavailable:', getAdMobUnavailableReason());
      return;
    }

    console.log('[BannerAd] unit id:', AD_UNIT_ID.BANNER);
  }, [visible]);

  if (!visible) {
    return null;
  }

  if (!policyReady) {
    if (!showPlaceholderWhenUnavailable) {
      return null;
    }

    return (
      <View style={[styles.container, containerStyle]}>
        <View
          style={[
            styles.placeholder,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons name="megaphone-outline" size={18} color={colors.primary} />
          <Text style={[styles.placeholderText, { color: colors.text }]}>
            {tt('ad_loading', 'Reklam alanı hazırlanıyor')}
          </Text>
        </View>
      </View>
    );
  }

  if (!policyAllowsBanner) {
    if (!showPlaceholderWhenUnavailable) {
      return null;
    }

    return (
      <View style={[styles.container, containerStyle]}>
        <View
          style={[
            styles.placeholder,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons
            name={entitlementAllowsAds ? 'pause-circle-outline' : 'diamond-outline'}
            size={18}
            color={colors.primary}
          />
          <Text style={[styles.placeholderText, { color: colors.text }]}>
            {entitlementAllowsAds
              ? tt('ad_placeholder_disabled', 'Reklam bu yerleşimde pasif')
              : tt('premium_no_ads', 'Premium planda reklam gösterilmez')}
          </Text>
        </View>
      </View>
    );
  }

  if (!adsModule?.BannerAd || !adsModule?.BannerAdSize) {
    if (!showPlaceholderWhenUnavailable) {
      return null;
    }

    return (
      <View style={[styles.container, containerStyle]}>
        <View
          style={[
            styles.placeholder,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons name="megaphone-outline" size={18} color={colors.primary} />
          <Text style={[styles.placeholderText, { color: colors.text }]}>
            {tt('ad_placeholder', 'Reklam alanı')}
          </Text>
        </View>
      </View>
    );
  }

  const { BannerAd, BannerAdSize } = adsModule;

  const resolvedSize =
    size === 'banner'
      ? BannerAdSize.BANNER
      : BannerAdSize.ANCHORED_ADAPTIVE_BANNER;

  return (
    <View style={[styles.container, containerStyle]}>
      <View
        style={[
          styles.bannerWrap,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <BannerAd
          unitId={AD_UNIT_ID.BANNER}
          size={resolvedSize}
          requestOptions={GLOBAL_AD_CONFIG}
          onAdLoaded={() => {
            console.log('[BannerAd] loaded');

            if (impressionTrackedRef.current) {
              return;
            }

            impressionTrackedRef.current = true;

            void adService.trackBannerImpression(placement, {
              size,
              unitId: AD_UNIT_ID.BANNER,
            });
          }}
          onAdOpened={() => {
            console.log('[BannerAd] opened');
          }}
          onAdClosed={() => {
            console.log('[BannerAd] closed');
          }}
          onAdFailedToLoad={(error: unknown) => {
            console.log('[BannerAd] failed:', error);
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  bannerWrap: {
    minWidth: 320,
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    minWidth: 320,
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderText: {
    fontSize: 13,
    fontWeight: '700',
    opacity: 0.72,
  },
});
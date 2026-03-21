import React, { useEffect, useMemo } from 'react';
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

type AdBannerProps = {
  visible?: boolean;
  size?: 'adaptive' | 'banner';
  containerStyle?: StyleProp<ViewStyle>;
  showPlaceholderWhenUnavailable?: boolean;
};

export const AdBanner: React.FC<AdBannerProps> = ({
  visible = true,
  size = 'adaptive',
  containerStyle,
  showPlaceholderWhenUnavailable = false,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const tt = (key: string, fallback: string) => {
    const value = t(key, { defaultValue: fallback });
    return value === key ? fallback : value;
  };

  const adsModule = useMemo(() => {
    if (!visible || !isAdMobAvailable()) {
      return null;
    }
    return getAdMobModule();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    if (!isAdMobAvailable()) {
      console.log('[BannerAd] unavailable:', getAdMobUnavailableReason());
      return;
    }

    console.log('[BannerAd] unit id:', AD_UNIT_ID.BANNER);
  }, [visible]);

  if (!visible) {
    return null;
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
          }}
          onAdOpened={() => {
            console.log('[BannerAd] opened');
          }}
          onAdClosed={() => {
            console.log('[BannerAd] closed');
          }}
          onAdFailedToLoad={(error: any) => {
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
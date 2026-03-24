import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { ThemeColors } from '../../context/ThemeContext';
import { withAlpha } from '../../utils/color';

type AmbientBackdropProps = {
  colors: ThemeColors;
  variant?: 'home' | 'paywall' | 'settings' | 'auth';
};

export const AmbientBackdrop: React.FC<AmbientBackdropProps> = ({
  colors,
  variant = 'home',
}) => {
  const isPaywall = variant === 'paywall';
  const isAuth = variant === 'auth';
  const isSettings = variant === 'settings';

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={[
          styles.orb,
          styles.topRightOrb,
          {
            backgroundColor: withAlpha(
              colors.primary,
              isPaywall ? '24' : isAuth ? '22' : isSettings ? '1E' : '18'
            ),
          },
        ]}
      />
      <View
        style={[
          styles.orb,
          isPaywall
            ? styles.midLeftOrbPaywall
            : isAuth
              ? styles.midLeftOrbAuth
              : isSettings
                ? styles.midLeftOrbSettings
                : styles.midLeftOrbHome,
          {
            backgroundColor: withAlpha(colors.teal, isPaywall ? '1A' : isAuth ? '18' : '14'),
          },
        ]}
      />
      <View
        style={[
          styles.orb,
          isPaywall
            ? styles.bottomRightOrbPaywall
            : isAuth
              ? styles.bottomRightOrbAuth
              : isSettings
                ? styles.bottomRightOrbSettings
                : styles.bottomRightOrbHome,
          {
            backgroundColor: withAlpha(colors.border, '30'),
          },
        ]}
      />
      <View
        style={[
          styles.gridFrame,
          isAuth ? styles.gridFrameAuth : isSettings ? styles.gridFrameSettings : null,
          {
            borderColor: withAlpha(colors.border, '1F'),
            backgroundColor: withAlpha(colors.backgroundMuted, 'A6'),
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  topRightOrb: {
    width: 280,
    height: 280,
    top: -110,
    right: -90,
  },
  midLeftOrbHome: {
    width: 220,
    height: 220,
    top: 220,
    left: -110,
  },
  midLeftOrbPaywall: {
    width: 240,
    height: 240,
    top: 160,
    left: -120,
  },
  midLeftOrbSettings: {
    width: 220,
    height: 220,
    top: 280,
    left: -105,
  },
  midLeftOrbAuth: {
    width: 230,
    height: 230,
    top: 150,
    left: -110,
  },
  bottomRightOrbHome: {
    width: 180,
    height: 180,
    bottom: 180,
    right: -70,
  },
  bottomRightOrbPaywall: {
    width: 210,
    height: 210,
    bottom: 120,
    right: -80,
  },
  bottomRightOrbSettings: {
    width: 190,
    height: 190,
    bottom: 110,
    right: -72,
  },
  bottomRightOrbAuth: {
    width: 210,
    height: 210,
    bottom: 160,
    right: -82,
  },
  gridFrame: {
    position: 'absolute',
    top: 84,
    left: 18,
    right: 18,
    height: 220,
    borderWidth: 1,
    borderRadius: 32,
  },
  gridFrameSettings: {
    top: 104,
    height: 240,
  },
  gridFrameAuth: {
    top: 72,
    height: 200,
  },
});

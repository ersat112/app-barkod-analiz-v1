import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Animated,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const { width, height } = Dimensions.get('window');

/**
 * ErEnesAl® v1 Açılış Ekranı
 * Bu bileşen, uygulama başlatılırken gerekli kaynakların yüklenmesini bekler
 * ve markayı profesyonel bir animasyonla sunar.
 */
export const SplashScreen: React.FC = () => {
  const { colors } = useTheme();
  // Animasyon Değerleri
  const fadeAnim = useRef(new Animated.Value(0)).current; // Logo görünürlüğü
  const scaleAnim = useRef(new Animated.Value(0.85)).current; // Logo büyüklüğü
  const slideUpAnim = useRef(new Animated.Value(20)).current; // Metin kayma efekti

  useEffect(() => {
    /**
     * 🎭 Paralel Animasyon Dizisi
     * Logo parlayarak (Fade) ve hafifçe büyüyerek (Spring/Scale) sahneye gelir.
     */
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: 1000,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim, slideUpAnim]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* 🛡️ Arka Plan Süslemesi (Opsiyonel - Profesyonel derinlik için) */}
      <View style={[styles.backgroundGlow, { backgroundColor: colors.primary + '05' }]} />

      <View style={styles.centerContent}>
        {/* 🎨 Logo Animasyonu */}
        <Animated.View 
          style={[
            styles.logoWrapper, 
            { 
              opacity: fadeAnim, 
              transform: [{ scale: scaleAnim }],
              borderColor: colors.primary 
            }
          ]}
        >
          <Text style={[styles.logoSymbol, { color: colors.primary }]}>E</Text>
        </Animated.View>

        {/* ✍️ Metin Animasyonu */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideUpAnim }] }}>
          <Text style={[styles.title, { color: colors.primary }]}>Barkod Analiz</Text>
          <View style={[styles.line, { backgroundColor: colors.primary }]} />
          <Text style={[styles.subtitle, { color: colors.text }]}>v1</Text>
        </Animated.View>
      </View>

      {/* 🚀 Alt Bilgi (Footer) */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.text }]}>
          MADE FOR HEALTH WITH INTELLIGENCE
        </Text>
        <Text style={[styles.versionText, { color: colors.text }]}>
          © 2026 ErEnesAl® - All Rights Reserved
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundGlow: {
    position: 'absolute',
    width: width * 1.5,
    height: width * 1.5,
    borderRadius: width,
    top: -height * 0.1,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25,
    backgroundColor: 'rgba(0,0,0,0.1)',
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  logoSymbol: {
    fontSize: 70,
    fontWeight: '900',
    textAlign: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
  },
  line: {
    height: 2,
    width: 60,
    alignSelf: 'center',
    marginVertical: 10,
    borderRadius: 1,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 6,
    textAlign: 'center',
    opacity: 0.7,
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    opacity: 0.4,
    marginBottom: 5,
  },
  versionText: {
    fontSize: 9,
    opacity: 0.3,
    fontWeight: 'bold',
  },
});
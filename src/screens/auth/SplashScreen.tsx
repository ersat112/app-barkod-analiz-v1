import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  ImageBackground,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';

const SPLASH_ART = require('../../../assets/splash-icon.png');

export const SplashScreen: React.FC = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <Animated.View style={[styles.fill, { opacity: fadeAnim }]}>
        <ImageBackground source={SPLASH_ART} style={styles.fill} resizeMode="cover">
          <View style={styles.scrim} />
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="small" color="#FFFFFF" />
          </View>
        </ImageBackground>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1320',
  },
  fill: {
    flex: 1,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 12, 24, 0.18)',
  },
  loaderWrap: {
    position: 'absolute',
    bottom: 56,
    alignSelf: 'center',
  },
});

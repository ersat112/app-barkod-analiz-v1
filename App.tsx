import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from './src/context/AuthContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { initDatabase } from './src/services/db';
import { initializeAdMob, getAdMobRuntimeState } from './src/services/admobRuntime';
import { adService } from './src/services/adService';

const AppContent: React.FC = () => {
  const { isDark } = useTheme();

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        await Promise.resolve(initDatabase());
        console.log('SQLite: Hazır.');
      } catch (error) {
        console.log('SQLite init failed:', error);
      }

      try {
        const initialized = await initializeAdMob();
        console.log('AdMob initialized:', initialized);
        console.log('AdMob runtime state:', getAdMobRuntimeState());
      } catch (error) {
        console.log('AdMob bootstrap failed:', error);
      }

      try {
        const policy = await adService.bootstrap();

        if (mounted) {
          console.log('Ad policy bootstrap:', {
            source: policy.source,
            version: policy.version,
            enabled: policy.enabled,
            interstitialEnabled: policy.interstitialEnabled,
            bannerEnabled: policy.bannerEnabled,
            analyticsEnabled: policy.analyticsEnabled,
          });
        }
      } catch (error) {
        console.log('Ad policy bootstrap failed:', error);
      }

      console.log('APP BOOT OK');
    };

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
    </>
  );
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LanguageProvider>
          <ThemeProvider>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </ThemeProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
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

const AppContent: React.FC = () => {
  const { isDark } = useTheme();

  useEffect(() => {
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

      console.log('APP BOOT OK');
    };

    bootstrap();
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
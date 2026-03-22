import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import {
  ensureAppBootstrap,
  runAuthenticatedAppBootstrap,
} from './src/services/appBootstrap.service';

const AppContent: React.FC = () => {
  const { isDark } = useTheme();
  const { loading, isAuthenticated } = useAuth();

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const snapshot = await ensureAppBootstrap();

      if (mounted) {
        console.log('Local app bootstrap:', snapshot);
      }
    };

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    let mounted = true;

    const bootstrapAuthenticatedSurface = async () => {
      const snapshot = await runAuthenticatedAppBootstrap();

      if (mounted) {
        console.log('Authenticated app bootstrap:', {
          isAuthenticated,
          snapshot,
        });
      }
    };

    void bootstrapAuthenticatedSurface();

    return () => {
      mounted = false;
    };
  }, [isAuthenticated, loading]);

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
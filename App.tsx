import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { auth } from './src/config/firebase';
import { bootstrapOperabilitySurface } from './src/services/operability.service';
import { adService } from './src/services/adService';
import { entitlementService } from './src/services/entitlement.service';
import { syncEngagementNotifications } from './src/services/engagementNotifications.service';
import { syncPurchaseProviderIdentity } from './src/services/purchaseProvider.service';
import { refreshCurrentUserProfile } from './src/services/userProfile.service';

const AppContent: React.FC = () => {
  const { isDark } = useTheme();
  const { loading, isAuthenticated } = useAuth();
  const appOpenAttemptedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      if (auth.currentUser?.uid) {
        void refreshCurrentUserProfile();
      }

      const snapshot = await bootstrapOperabilitySurface();

      if (mounted) {
        console.log('App operability bootstrap:', snapshot);
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

    void syncEngagementNotifications();
  }, [loading]);

  useEffect(() => {
    if (loading) {
      return;
    }

    let mounted = true;

    const bootstrapAuthenticatedSurface = async () => {
      const snapshot = await bootstrapOperabilitySurface({
        forceRefresh: true,
      });

      if (mounted) {
        console.log('Authenticated operability bootstrap:', {
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

  useEffect(() => {
    if (loading || appOpenAttemptedRef.current) {
      return;
    }

    appOpenAttemptedRef.current = true;
    let cancelled = false;

    const tryShowAppOpenAd = async () => {
      try {
        const entitlement = await entitlementService.getSnapshot();

        if (cancelled || entitlement.isPremium) {
          return;
        }

        if (!adService.isAppOpenAdReady()) {
          await adService.prepareAppOpenAd();
          await new Promise((resolve) => setTimeout(resolve, 320));
        }

        if (cancelled) {
          return;
        }

        const shown = await adService.showAppOpenAdOnce();

        if (!shown) {
          await adService.trackInterstitialShowFailure('app_open_not_ready', {
            stage: 'app_open_show_gate',
            screen: 'App',
          });
        }
      } catch (error) {
        console.error('App open ad failed:', error);

        await adService.trackInterstitialShowFailure(error, {
          stage: 'app_open_show',
          screen: 'App',
        });
      }
    };

    void tryShowAppOpenAd();

    return () => {
      cancelled = true;
    };
  }, [loading]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        return;
      }

      void syncPurchaseProviderIdentity(
        isAuthenticated ? (auth.currentUser?.uid ?? null) : null
      );
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated]);

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

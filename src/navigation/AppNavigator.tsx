import React, { useCallback, useMemo, useState } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  createNavigationContainerRef,
  type NavigatorScreenParams,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdBanner } from '../components/AdBanner';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import {
  PERSISTENT_GLOBAL_BANNER_HEIGHT,
  resolvePersistentBottomNavHeight,
  resolvePersistentBottomNavInset,
} from './navigationLayout';

import { SplashScreen } from '../screens/auth/SplashScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';

import { HomeScreen } from '../screens/main/HomeScreen';
import { MedicineScannerScreen, ScannerScreen } from '../screens/main/ScannerScreen';
import { DetailScreen } from '../screens/main/DetailScreen';
import { HistoryScreen } from '../screens/main/HistoryScreen';
import { SettingsScreen } from '../screens/main/SettingsScreen';
import { ECodeCatalogScreen } from '../screens/main/ECodeCatalogScreen';
import { ProfileSettingsScreen } from '../screens/main/ProfileSettingsScreen';
import { MethodologySourcesScreen } from '../screens/main/MethodologySourcesScreen';
import { LegalDocumentScreen } from '../screens/main/LegalDocumentScreen';
import { NutritionPreferencesScreen } from '../screens/main/NutritionPreferencesScreen';
import { MissingProductScreen } from '../screens/main/MissingProductScreen';
import { PaywallScreen } from '../screens/main/PaywallScreen';
import { PriceCompareScreen } from '../screens/main/PriceCompareScreen';
import { FamilyHealthProfileScreen } from '../screens/main/FamilyHealthProfileScreen';
import { RiskInsightDetailScreen } from '../screens/main/RiskInsightDetailScreen';
import { HelpCenterScreen } from '../screens/main/HelpCenterScreen';
import { HelpArticleScreen } from '../screens/main/HelpArticleScreen';
import type { PaywallEntrySource } from '../types/monetization';
import type { Product } from '../utils/analysis';
import type { FamilyAllergenKey } from '../services/familyHealthProfile.service';
import type { HelpArticleKey } from '../services/helpCenterContent.service';

const SCAN_BUTTON_ART = require('../../assets/icon.png');

export type MainTabParamList = {
  Home: undefined;
  History: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Scanner: undefined;
  MedicineScanner: undefined;
  Detail: {
    barcode: string;
    entrySource?: 'scanner' | 'history' | 'home' | 'unknown';
    lookupMode?: 'auto' | 'food' | 'beauty' | 'medicine';
    prefetchedProduct?: Product;
    historyAlreadySaved?: boolean;
  };
  ECodeCatalog: undefined;
  MethodologySources: undefined;
  HelpCenter: undefined;
  HelpArticle: {
    articleKey: HelpArticleKey;
  };
  LegalDocument: {
    documentKey: 'terms' | 'privacy' | 'medical' | 'premium' | 'independence';
  };
  PriceCompare:
    | {
        initialQuery?: string;
      }
    | undefined;
  FamilyHealthProfile: undefined;
  RiskInsightDetail:
    | {
        kind: 'allergen';
        id: FamilyAllergenKey;
      }
    | {
        kind: 'additive';
        id: string;
      };
  NutritionPreferences: undefined;
  ProfileSettings: undefined;
  MissingProduct: { barcode: string };
  Paywall: { source?: PaywallEntrySource } | undefined;
  Login: undefined;
  SignUp: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

const getDeepestRouteName = (state: unknown): string | undefined => {
  if (!state || typeof state !== 'object' || !('routes' in state)) {
    return undefined;
  }

  const navigationState = state as {
    index?: number;
    routes: { name: string; state?: unknown }[];
  };
  const activeRoute =
    navigationState.routes[navigationState.index ?? navigationState.routes.length - 1];

  if (!activeRoute) {
    return undefined;
  }

  if (activeRoute.state) {
    return getDeepestRouteName(activeRoute.state) ?? activeRoute.name;
  }

  return activeRoute.name;
};

const CenterScanTabButton: React.FC<{
  colors: ReturnType<typeof useTheme>['colors'];
  label: string;
  onPress?: () => void;
  bottomOffset: number;
}> = ({ colors, label, onPress, bottomOffset }) => {
  return (
    <View
      pointerEvents="box-none"
      style={[styles.centerScanButtonOverlay, { bottom: bottomOffset }]}
    >
      <TouchableOpacity
        style={styles.centerScanButtonWrap}
        onPress={onPress}
        activeOpacity={0.92}
      >
        <View style={styles.centerScanButton}>
          <Image source={SCAN_BUTTON_ART} style={styles.centerScanArtwork} resizeMode="contain" />
        </View>
        <Text style={[styles.centerScanLabel, { color: colors.primary }]}>{label}</Text>
      </TouchableOpacity>
    </View>
  );
};

const TabBarItem: React.FC<{
  active: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}> = ({ active, colors, iconName, label, onPress }) => {
  return (
    <TouchableOpacity
      style={styles.tabBarItem}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Ionicons
        name={iconName}
        size={20}
        color={active ? colors.primary : colors.border}
      />
      <Text
        style={[
          styles.tabBarItemLabel,
          { color: active ? colors.primary : colors.border },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const PersistentBottomNav: React.FC<{
  activeRouteName: string;
  activeMainTab: keyof MainTabParamList;
  onOpenHome: () => void;
  onOpenHistory: () => void;
  onOpenScanner: () => void;
  onOpenCompare: () => void;
  onOpenSettings: () => void;
}> = ({
  activeRouteName,
  activeMainTab,
  onOpenHome,
  onOpenHistory,
  onOpenScanner,
  onOpenCompare,
  onOpenSettings,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const tt = (key: string, fallback: string) => {
    const value = t(key, { defaultValue: fallback });
    return value === key ? fallback : value;
  };

  const resolvedBottomInset = resolvePersistentBottomNavInset(insets.bottom);
  const tabBarBottomPadding = Math.max(
    resolvedBottomInset,
    Platform.OS === 'ios' ? 18 : 30
  );
  const tabBarTopPadding = Platform.OS === 'ios' ? 8 : 10;
  const tabBarHeight = resolvePersistentBottomNavHeight(insets.bottom);
  const centerButtonBottomOffset = tabBarBottomPadding + 6;
  const activeSection =
    activeRouteName === 'Home' ||
    activeRouteName === 'History' ||
    activeRouteName === 'Settings' ||
    activeRouteName === 'PriceCompare'
      ? activeRouteName
      : activeMainTab;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.customTabBar,
        {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          minHeight: tabBarHeight,
          paddingBottom: tabBarBottomPadding,
          paddingTop: tabBarTopPadding,
        },
      ]}
    >
      <View style={styles.globalBannerWrap}>
        <AdBanner
          placement={`global_${activeRouteName.toLowerCase()}`}
          containerStyle={styles.globalBannerContainer}
        />
      </View>

      <View style={styles.customTabBarGrid}>
        <View style={styles.tabBarSlot}>
          <TabBarItem
            active={activeSection === 'Home'}
            colors={colors}
            iconName={activeSection === 'Home' ? 'home' : 'home-outline'}
            label={tt('home', 'Ana Sayfa')}
            onPress={onOpenHome}
          />
        </View>
        <View style={styles.tabBarSlot}>
          <TabBarItem
            active={activeSection === 'History'}
            colors={colors}
            iconName={activeSection === 'History' ? 'time' : 'time-outline'}
            label={tt('history', 'Geçmiş')}
            onPress={onOpenHistory}
          />
        </View>
        <View style={styles.centerTabSpacer} />
        <View style={styles.tabBarSlot}>
          <TabBarItem
            active={activeSection === 'PriceCompare'}
            colors={colors}
            iconName={activeSection === 'PriceCompare' ? 'pricetags' : 'pricetags-outline'}
            label={tt('price_compare_short_label', 'Fiyat')}
            onPress={onOpenCompare}
          />
        </View>
        <View style={styles.tabBarSlot}>
          <TabBarItem
            active={activeSection === 'Settings'}
            colors={colors}
            iconName={
              activeSection === 'Settings' ? 'settings' : 'settings-outline'
            }
            label={tt('profile', 'Profil')}
            onPress={onOpenSettings}
          />
        </View>
      </View>

      <CenterScanTabButton
        colors={colors}
        label={tt('scan_now', 'Şimdi Tara')}
        onPress={onOpenScanner}
        bottomOffset={centerButtonBottomOffset}
      />
    </View>
  );
};

const MainTabNavigator: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const tt = (key: string, fallback: string) => {
    const value = t(key, { defaultValue: fallback });
    return value === key ? fallback : value;
  };

  return (
    <Tab.Navigator
      id="main-tabs"
      tabBar={() => null}
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: tt('home', 'Ana Sayfa') }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: tt('history', 'Geçmiş') }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: tt('profile', 'Profil') }}
      />
    </Tab.Navigator>
  );
};

const AuthStack = () => (
  <Stack.Group>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen
      name="SignUp"
      component={SignUpScreen}
      options={{ animation: 'slide_from_right' }}
    />
  </Stack.Group>
);

const AppStack = () => (
  <Stack.Group>
    <Stack.Screen name="Main" component={MainTabNavigator} />
    <Stack.Screen
      name="Scanner"
      component={ScannerScreen}
      options={{ animation: 'slide_from_bottom' }}
    />
    <Stack.Screen
      name="MedicineScanner"
      component={MedicineScannerScreen}
      options={{ animation: 'slide_from_bottom' }}
    />
    <Stack.Screen
      name="Detail"
      component={DetailScreen}
      options={{ animation: 'slide_from_right' }}
    />
    <Stack.Screen
      name="ECodeCatalog"
      component={ECodeCatalogScreen}
      options={{ animation: 'slide_from_right' }}
    />
    <Stack.Screen
      name="MethodologySources"
      component={MethodologySourcesScreen}
      options={{ animation: 'slide_from_right' }}
    />
    <Stack.Screen
      name="HelpCenter"
      component={HelpCenterScreen}
      options={{ animation: 'slide_from_right' }}
    />
    <Stack.Screen
      name="HelpArticle"
      component={HelpArticleScreen}
      options={{ animation: 'slide_from_right' }}
    />
    <Stack.Screen
      name="LegalDocument"
      component={LegalDocumentScreen}
      options={{ animation: 'slide_from_right' }}
    />
    <Stack.Screen
      name="PriceCompare"
      component={PriceCompareScreen}
      options={{ animation: 'slide_from_right' }}
    />
    <Stack.Screen
      name="FamilyHealthProfile"
      component={FamilyHealthProfileScreen}
      options={{ animation: 'slide_from_right' }}
    />
    <Stack.Screen
      name="RiskInsightDetail"
      component={RiskInsightDetailScreen}
      options={{ animation: 'slide_from_right' }}
    />
    <Stack.Screen
      name="NutritionPreferences"
      component={NutritionPreferencesScreen}
      options={{ animation: 'slide_from_right' }}
    />
    <Stack.Screen
      name="ProfileSettings"
      component={ProfileSettingsScreen}
      options={{ animation: 'slide_from_right' }}
    />
    <Stack.Screen
      name="MissingProduct"
      component={MissingProductScreen}
      options={{ animation: 'slide_from_right' }}
    />
    <Stack.Screen
      name="Paywall"
      component={PaywallScreen}
      options={{ animation: 'slide_from_bottom' }}
    />
  </Stack.Group>
);

export const AppNavigator: React.FC = () => {
  const { loading, isAuthenticated } = useAuth();
  const { colors, isDark, ready: themeReady } = useTheme();
  const { ready: languageReady } = useLanguage();
  const [activeRouteName, setActiveRouteName] = useState<string>('Home');
  const [activeMainTab, setActiveMainTab] = useState<keyof MainTabParamList>('Home');

  const syncActiveRoute = useCallback(() => {
    const nextRouteName = getDeepestRouteName(navigationRef.getRootState()) ?? 'Home';

    setActiveRouteName(nextRouteName);

    if (
      nextRouteName === 'Home' ||
      nextRouteName === 'History' ||
      nextRouteName === 'Settings'
    ) {
      setActiveMainTab(nextRouteName);
    }
  }, []);

  const navigateToMainTab = useCallback((screen: keyof MainTabParamList) => {
    if (!navigationRef.isReady()) {
      return;
    }

    navigationRef.navigate('Main', { screen });
    setActiveMainTab(screen);
    setActiveRouteName(screen);
  }, []);

  const navigateToStackScreen = useCallback(
    (screen: 'Scanner' | 'MedicineScanner' | 'PriceCompare') => {
      if (!navigationRef.isReady()) {
        return;
      }

      navigationRef.navigate(screen);
      setActiveRouteName(screen);
    },
    []
  );

  const navigationTheme = useMemo<NavigationTheme>(() => {
    const baseTheme = isDark ? DarkTheme : DefaultTheme;

    return {
      ...baseTheme,
      dark: isDark,
      colors: {
        ...baseTheme.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.card,
        text: colors.text,
        border: colors.border,
        notification: colors.primary,
      },
    };
  }, [colors.background, colors.border, colors.card, colors.primary, colors.text, isDark]);

  if (loading || !themeReady || !languageReady) {
    return <SplashScreen />;
  }

  return (
    <View style={styles.appShell}>
      <NavigationContainer
        ref={navigationRef}
        theme={navigationTheme}
        onReady={syncActiveRoute}
        onStateChange={syncActiveRoute}
      >
        <Stack.Navigator
          id="root-stack"
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
          {isAuthenticated ? AppStack() : AuthStack()}
        </Stack.Navigator>
      </NavigationContainer>

      {isAuthenticated ? (
        <PersistentBottomNav
          activeRouteName={activeRouteName}
          activeMainTab={activeMainTab}
          onOpenHome={() => navigateToMainTab('Home')}
          onOpenHistory={() => navigateToMainTab('History')}
          onOpenScanner={() => navigateToStackScreen('Scanner')}
          onOpenCompare={() => navigateToStackScreen('PriceCompare')}
          onOpenSettings={() => navigateToMainTab('Settings')}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
  },
  customTabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingHorizontal: 12,
    zIndex: 30,
  },
  globalBannerWrap: {
    minHeight: PERSISTENT_GLOBAL_BANNER_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 4,
  },
  globalBannerContainer: {
    width: '100%',
    paddingHorizontal: 0,
  },
  customTabBarGrid: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  tabBarSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerTabSpacer: {
    flex: 1,
    minWidth: 70,
  },
  tabBarItem: {
    width: '100%',
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  tabBarItemLabel: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  centerScanButtonWrap: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: 80,
  },
  centerScanButtonOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 3,
  },
  centerScanButton: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerScanArtwork: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  centerScanLabel: {
    marginTop: 3,
    fontSize: 9,
    fontWeight: '900',
  },
});

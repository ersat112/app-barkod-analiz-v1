import React, { useMemo } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

import { SplashScreen } from '../screens/auth/SplashScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';

import { HomeScreen } from '../screens/main/HomeScreen';
import { ScannerScreen } from '../screens/main/ScannerScreen';
import { DetailScreen } from '../screens/main/DetailScreen';
import { HistoryScreen } from '../screens/main/HistoryScreen';
import { SettingsScreen } from '../screens/main/SettingsScreen';
import { MissingProductScreen } from '../screens/main/MissingProductScreen';

export type RootStackParamList = {
  Main: undefined;
  Scanner: undefined;
  Detail: { barcode: string };
  MissingProduct: { barcode: string };
  Login: undefined;
  SignUp: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  History: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const MainTabNavigator: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const tt = (key: string, fallback: string) => {
    const value = t(key, { defaultValue: fallback });
    return value === key ? fallback : value;
  };

  const tabBarBottomPadding = Math.max(
    insets.bottom,
    Platform.OS === 'ios' ? 24 : 12
  );
  const tabBarTopPadding = 10;
  const tabBarHeight = 56 + tabBarBottomPadding + tabBarTopPadding;

  return (
    <Tab.Navigator
      id="main-tabs"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.border,
        sceneStyle: {
          backgroundColor: colors.background,
        },
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          height: tabBarHeight,
          paddingBottom: tabBarBottomPadding,
          paddingTop: tabBarTopPadding,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home-outline';

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'History') {
            iconName = focused ? 'time' : 'time-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: tt('home', 'Ana Sayfa') }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ tabBarLabel: tt('history', 'Geçmiş') }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: tt('settings', 'Ayarlar') }}
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
      name="Detail"
      component={DetailScreen}
      options={{ animation: 'slide_from_right' }}
    />
    <Stack.Screen
      name="MissingProduct"
      component={MissingProductScreen}
      options={{ animation: 'slide_from_right' }}
    />
  </Stack.Group>
);

export const AppNavigator: React.FC = () => {
  const { loading, isAuthenticated } = useAuth();
  const { colors, isDark, ready: themeReady } = useTheme();
  const { ready: languageReady } = useLanguage();

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
    <NavigationContainer theme={navigationTheme}>
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
  );
};

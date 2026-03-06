import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
// 💡 DEĞİŞİKLİK 1: 'stack' yerine çok daha hızlı olan 'native-stack' kullanıyoruz
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

// 🧠 Contexts & Theme
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// 🔐 Auth Screens (Sayfaların export şekline göre parantezleri kaldırdım)
import { SplashScreen } from '../screens/auth/SplashScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';

// 🏠 Main Screens
import { HomeScreen } from '../screens/main/HomeScreen';
import { ScannerScreen } from '../screens/main/ScannerScreen';
import { DetailScreen } from '../screens/main/DetailScreen';
import { HistoryScreen } from '../screens/main/HistoryScreen';
import { SettingsScreen } from '../screens/main/SettingsScreen';

/**
 * 🛠️ Navigation Type Definitions
 */
export type RootStackParamList = {
  Main: undefined;
  Scanner: undefined;
  Detail: { barcode: string };
  Login: undefined;
  SignUp: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  History: undefined;
  Settings: undefined;
};

// 💡 DEĞİŞİKLİK 2: createNativeStackNavigator kullanıyoruz
const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * 📱 Main Tab Navigator (Alt Menü)
 */
const MainTabNavigator = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      id="main-tabs"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.border,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          height: Platform.OS === 'ios' ? 88 : 65,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
          paddingTop: 10,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'History') iconName = focused ? 'time' : 'time-outline';
          else if (route.name === 'Settings') iconName = focused ? 'settings' : 'settings-outline';
          
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: t('home', 'Ana Sayfa') }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ tabBarLabel: t('history', 'Geçmiş') }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: t('settings', 'Ayarlar') }} />
    </Tab.Navigator>
  );
};

/**
 * 🚀 AppNavigator (Merkezi Navigasyon)
 */
export const AppNavigator = () => {
  const { user, loading } = useAuth();
  const { colors, isDark } = useTheme();

  if (loading) return <SplashScreen />;

  const baseTheme = isDark ? DarkTheme : DefaultTheme;

  return (
    <NavigationContainer
      theme={{
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
      }}
    >
      <Stack.Navigator 
        id="root-stack"
        screenOptions={{ 
          headerShown: false,
          // 💡 DEĞİŞİKLİK 3: interpolator yerine native-stack animasyonları
          animation: 'slide_from_right' 
        }}
      >
        {user ? (
          <Stack.Group>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen 
              name="Scanner" 
              component={ScannerScreen} 
              // Scanner ekranı aşağıdan yukarı açılsın
              options={{ animation: 'slide_from_bottom' }} 
            />
            <Stack.Screen name="Detail" component={DetailScreen} />
          </Stack.Group>
        ) : (
          <Stack.Group>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
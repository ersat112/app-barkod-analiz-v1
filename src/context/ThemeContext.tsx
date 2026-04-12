import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'erenesal-theme';

export type ThemeColors = {
  background: string;
  backgroundMuted: string;
  card: string;
  cardElevated: string;
  text: string;
  mutedText: string;
  primary: string;
  primaryContrast: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
  teal: string;
  shadow: string;
};

type ThemeContextValue = {
  isDark: boolean;
  colors: ThemeColors;
  ready: boolean;
  setIsDark: (value: boolean) => void;
  toggleTheme: () => void;
};

const darkColors: ThemeColors = {
  background: '#0E1510',
  backgroundMuted: '#152017',
  card: '#18221B',
  cardElevated: '#1D2A22',
  text: '#F5F7FA',
  mutedText: '#94A1B3',
  primary: '#8BD450',
  primaryContrast: '#10200A',
  border: '#2B3A2F',
  success: '#44C086',
  warning: '#A9CF4B',
  danger: '#E26868',
  teal: '#249B96',
  shadow: '#000000',
};

const lightColors: ThemeColors = {
  background: '#EEF5E7',
  backgroundMuted: '#F7FBF2',
  card: '#FFFFFF',
  cardElevated: '#F7FBF1',
  text: '#17202B',
  mutedText: '#5E6C79',
  primary: '#5DAA2C',
  primaryContrast: '#F7FFF0',
  border: '#D5E0CB',
  success: '#238159',
  warning: '#799A23',
  danger: '#BF4B48',
  teal: '#127A78',
  shadow: '#000000',
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

type ThemeProviderProps = {
  children: ReactNode;
};

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [isDark, setIsDarkState] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(STORAGE_KEY);

        if (!mounted) return;

        if (savedTheme === 'light') {
          setIsDarkState(false);
        } else {
          setIsDarkState(true);
        }
      } catch (error) {
        console.error('Theme load failed:', error);

        if (!mounted) return;
        setIsDarkState(true);
      } finally {
        if (mounted) {
          setReady(true);
        }
      }
    };

    loadTheme();

    return () => {
      mounted = false;
    };
  }, []);

  const persistTheme = useCallback(async (nextIsDark: boolean) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, nextIsDark ? 'dark' : 'light');
    } catch (error) {
      console.error('Theme persist failed:', error);
    }
  }, []);

  const setIsDark = useCallback(
    (value: boolean) => {
      setIsDarkState(value);
      persistTheme(value);
    },
    [persistTheme]
  );

  const toggleTheme = useCallback(() => {
    setIsDarkState((prev) => {
      const next = !prev;
      persistTheme(next);
      return next;
    });
  }, [persistTheme]);

  const colors = useMemo<ThemeColors>(() => {
    return isDark ? darkColors : lightColors;
  }, [isDark]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      isDark,
      colors,
      ready,
      setIsDark,
      toggleTheme,
    }),
    [colors, isDark, ready, setIsDark, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider.');
  }

  return context;
};

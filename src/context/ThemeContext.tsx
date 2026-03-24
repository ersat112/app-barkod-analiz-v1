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
  background: '#0B1016',
  backgroundMuted: '#111823',
  card: '#141C27',
  cardElevated: '#1A2532',
  text: '#F5F7FA',
  mutedText: '#94A1B3',
  primary: '#D8A847',
  primaryContrast: '#120F08',
  border: '#253344',
  success: '#44C086',
  warning: '#E8A249',
  danger: '#E26868',
  teal: '#249B96',
  shadow: '#000000',
};

const lightColors: ThemeColors = {
  background: '#F4F0E8',
  backgroundMuted: '#FFFCF4',
  card: '#FFFFFF',
  cardElevated: '#FFF8EA',
  text: '#17202B',
  mutedText: '#5E6C79',
  primary: '#A7791F',
  primaryContrast: '#FFF8E5',
  border: '#DCCFBA',
  success: '#238159',
  warning: '#B97719',
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

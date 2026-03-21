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

type ThemeColors = {
  background: string;
  card: string;
  text: string;
  primary: string;
  border: string;
};

type ThemeContextValue = {
  isDark: boolean;
  colors: ThemeColors;
  ready: boolean;
  setIsDark: (value: boolean) => void;
  toggleTheme: () => void;
};

const darkColors: ThemeColors = {
  background: '#121212',
  card: '#1E1E1E',
  text: '#FFFFFF',
  primary: '#FFD700',
  border: '#333333',
};

const lightColors: ThemeColors = {
  background: '#F5F5F5',
  card: '#FFFFFF',
  text: '#111111',
  primary: '#D4AF37',
  border: '#DDDDDD',
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
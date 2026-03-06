import React, { createContext, useContext, useState } from 'react';

const ThemeContext = createContext<any>(null);

export const ThemeProvider = ({ children }: any) => {
  const [isDark, setIsDark] = useState(true);

  const theme = {
    isDark,
    setIsDark,
    colors: isDark ? {
      background: '#121212',
      card: '#1E1E1E',
      text: '#FFFFFF',
      primary: '#FFD700',
      border: '#333'
    } : {
      background: '#F5F5F5',
      card: '#FFFFFF',
      text: '#000000',
      primary: '#D4AF37', // Daha yumuşak bir altın sarısı
      border: '#DDD'
    }
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
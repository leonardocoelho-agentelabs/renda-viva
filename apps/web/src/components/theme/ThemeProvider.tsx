'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('renda-viva-theme') as Theme | null;
    const inicial = saved || 'light';
    setTheme(inicial);
    document.documentElement.classList.toggle('dark', inicial === 'dark');
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const novo = theme === 'light' ? 'dark' : 'light';
    setTheme(novo);
    document.documentElement.classList.toggle('dark', novo === 'dark');
    localStorage.setItem('renda-viva-theme', novo);
  };

  if (!mounted) return null;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

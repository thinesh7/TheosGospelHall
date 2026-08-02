import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { nextTheme, THEME_ORDER, THEMES, ThemeColors, ThemeName } from './theme';

const STORAGE_KEY = 'tgh_app_theme';

interface ThemeContextValue {
  theme: ThemeName;
  colors: ThemeColors;
  setTheme: (t: ThemeName) => void;
  cycleTheme: () => void;
  isLoaded: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemeName>(
    systemScheme === 'light' ? 'light' : 'dark'
  );
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(stored => {
      if (stored && THEME_ORDER.includes(stored as ThemeName)) {
        setThemeState(stored as ThemeName);
      } else if (systemScheme === 'light' || systemScheme === 'dark') {
        setThemeState(systemScheme);
      }
      setIsLoaded(true);
    });
  }, []);

  const setTheme = useCallback((t: ThemeName) => {
    setThemeState(t);
    AsyncStorage.setItem(STORAGE_KEY, t).catch(() => {});
  }, []);

  const cycleTheme = useCallback(() => {
    setTheme(nextTheme(theme));
  }, [theme, setTheme]);

  // ThemeProvider wraps the entire app (app/_layout.tsx), and useTheme() is
  // called from nearly every screen — an inline object literal here would
  // get a new identity on every render of ThemeProvider itself (e.g. every
  // time anything in _layout.tsx's own state changes, like the periodic
  // update-check or a notification listener firing), forcing every single
  // consumer to re-render even though theme/colors hadn't actually changed.
  // Memoizing means that only actually happens when theme or isLoaded
  // genuinely change.
  const value = useMemo<ThemeContextValue>(
    () => ({ theme, colors: THEMES[theme], setTheme, cycleTheme, isLoaded }),
    [theme, isLoaded, setTheme, cycleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return ctx;
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
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

  // app.json pins userInterfaceStyle to "light", which fixes the native Android window/
  // activity background used during react-native-screens' Fragment-based push/pop
  // transitions — a layer no JS-level style (e.g. a screen's contentStyle) can reach.
  // This keeps that actual native background in sync with the app's own theme (which is
  // independent of the OS light/dark setting), eliminating the white flash a mismatch
  // causes mid-transition in Dark/Sepia — Light was never visibly affected since its
  // background is already close to the native default.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(THEMES[theme].bg).catch(() => {});
  }, [theme]);

  const setTheme = (t: ThemeName) => {
    setThemeState(t);
    AsyncStorage.setItem(STORAGE_KEY, t).catch(() => {});
  };

  const cycleTheme = () => {
    setTheme(nextTheme(theme));
  };

  return (
    <ThemeContext.Provider value={{ theme, colors: THEMES[theme], setTheme, cycleTheme, isLoaded }}>
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

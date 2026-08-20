import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
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

  // Web only. The app's own themed background only exists on an inner
  // View (rendered by each screen) — the actual <html>/<body> behind it
  // has no background-color of its own, so it defaults to the browser's
  // plain white canvas. That's invisible during a normal in-app navigation
  // (React keeps existing content painted continuously, nothing ever
  // uncovers the bare canvas underneath), but a genuine browser-native
  // navigation — the physical/gesture Back button, not router.back() —
  // has the browser itself, not React, drive the repaint, and can
  // momentarily show that bare white canvas before the app's own themed
  // view repaints over it. Reported as a brief white flash specifically on
  // mobile web, specifically via the device Back button — exactly this
  // gap. Keeping the root document's own background in sync with the
  // current theme here removes the bare canvas entirely, regardless of
  // which navigation path causes the repaint.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const bg = THEMES[theme].bg;
    document.documentElement.style.backgroundColor = bg;
    document.body.style.backgroundColor = bg;
  }, [theme]);

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

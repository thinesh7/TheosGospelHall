import AsyncStorage from '@react-native-async-storage/async-storage';

export const SONGS_THEME_KEY = 'tgh_songs_theme';

export type ThemeName = 'dark' | 'light' | 'sepia';

export interface ThemeColors {
  bg: string;
  text: string;
  titleColor: string;
  sub: string;
  toolbarBg: string;
  cardBg: string;
  searchBg: string;
}

export const THEMES: Record<ThemeName, ThemeColors> = {
  dark: {
    bg: '#121212',
    text: '#eaeaea',
    titleColor: '#ff6b6b',
    sub: '#999',
    toolbarBg: '#1e1e1e',
    cardBg: '#1e1e1e',
    searchBg: '#1e1e1e',
  },
  light: {
    bg: '#ffffff',
    text: '#1c1730',
    titleColor: '#2e1065',
    sub: '#6b6280',
    toolbarBg: '#ffffff',
    cardBg: '#f4f1fa',
    searchBg: '#f4f1fa',
  },
  sepia: {
    bg: '#f4ecd8',
    text: '#3a2e1f',
    titleColor: '#8b4513',
    sub: '#7a6a52',
    toolbarBg: '#ece2cc',
    cardBg: '#ece2cc',
    searchBg: '#ece2cc',
  },
};

export async function getStoredTheme(): Promise<ThemeName> {
  try {
    const stored = await AsyncStorage.getItem(SONGS_THEME_KEY);
    if (stored === 'dark' || stored === 'light' || stored === 'sepia') return stored;
  } catch (e) {}
  return 'dark';
}

export async function setStoredTheme(theme: ThemeName) {
  await AsyncStorage.setItem(SONGS_THEME_KEY, theme);
}

export function nextTheme(current: ThemeName): ThemeName {
  return current === 'dark' ? 'light' : current === 'light' ? 'sepia' : 'dark';
}

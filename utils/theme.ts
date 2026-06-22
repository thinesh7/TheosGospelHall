export type ThemeName = 'dark' | 'light' | 'sepia';

export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceAlt: string;
  headerBg: string;
  text: string;
  subtext: string;
  accent: string;
  divider: string;
  raised: string;
}

export const THEMES: Record<ThemeName, ThemeColors> = {
  dark: {
    bg: '#121212',
    surface: '#1e1e1e',
    surfaceAlt: '#1e1e1e',
    headerBg: '#1e1e1e',
    text: '#eaeaea',
    subtext: '#999999',
    accent: '#ff6b6b',
    divider: '#333333',
    raised: '#2c2c2c',
  },
  light: {
    bg: '#f8f9fa',
    surface: '#ffffff',
    surfaceAlt: '#ffffff',
    headerBg: '#ffffff',
    text: '#1a1a2e',
    subtext: '#666666',
    accent: '#0f3460',
    divider: '#eeeeee',
    raised: '#eef1f5',
  },
  sepia: {
    bg: '#f4ecd8',
    surface: '#ece2cc',
    surfaceAlt: '#ece2cc',
    headerBg: '#ece2cc',
    text: '#3a2e1f',
    subtext: '#7a6a52',
    accent: '#8b4513',
    divider: '#d7ccc8',
    raised: '#e0d3b0',
  },
};

export const THEME_ORDER: ThemeName[] = ['dark', 'light', 'sepia'];

export function nextTheme(current: ThemeName): ThemeName {
  const idx = THEME_ORDER.indexOf(current);
  return THEME_ORDER[(idx + 1) % THEME_ORDER.length];
}

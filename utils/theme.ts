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
    // Soft warm parchment/ivory rather than a strong yellow, with a muted
    // caramel/bronze accent (no blue, no green, no bright orange or gold) —
    // meant to feel like a premium Bible/reading app, comfortable for long
    // sessions.
    bg: '#f7ecd9',
    surface: '#fbf3e6',
    surfaceAlt: '#fbf3e6',
    headerBg: '#fbf3e6',
    text: '#3b2a1a',
    subtext: '#7a6650',
    accent: '#a9713f',
    divider: '#e3d3ba',
    raised: '#f2e2c9',
  },
};

export const THEME_ORDER: ThemeName[] = ['light', 'dark', 'sepia'];

export function nextTheme(current: ThemeName): ThemeName {
  const idx = THEME_ORDER.indexOf(current);
  return THEME_ORDER[(idx + 1) % THEME_ORDER.length];
}

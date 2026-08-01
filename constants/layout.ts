// Shared responsive design tokens. Colors intentionally stay out of this file —
// they live in utils/theme.ts (per-theme, dynamic via useTheme()). These tokens
// are static and platform-agnostic, so components combine both side by side:
//   StyleSheet.create({ card: { padding: spacing.lg, borderRadius: radii.lg } })
//   + inline `{ backgroundColor: colors.surface }` from useTheme().

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  giant: 64,
} as const;

export type SpacingKey = keyof typeof spacing;

export function resolveSpacing(value: SpacingKey | number | undefined): number {
  if (value === undefined) return 0;
  return typeof value === 'number' ? value : spacing[value];
}

export const radii = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export type RadiiKey = keyof typeof radii;

interface TypographyPreset {
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '600' | '700';
}

export const typography = {
  caption: { fontSize: 11, lineHeight: 15, fontWeight: '500' },
  body: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  bodyLg: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  subtitle: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  headline: { fontSize: 26, lineHeight: 32, fontWeight: '700' },
} satisfies Record<string, TypographyPreset>;

export type TypographyKey = keyof typeof typography;

// Lower bound of each band, in logical pixels (matches useWindowDimensions()
// width). Tablet's lower bound sits just under iPad portrait (768) so a 10"
// Android tablet in portrait still qualifies as "tablet" rather than "mobile".
export const BREAKPOINTS = {
  mobile: 0,
  tablet: 700,
  desktop: 1024,
} as const;

// Screen primitive centers content past this width rather than letting it
// stretch edge-to-edge on wide viewports.
export const CONTENT_MAX_WIDTH = 1120;

// Wider cap for grid-of-cards pages (video/media browsing) — these benefit
// from more horizontal room than a text-reading column, so they get their
// own, larger max-width rather than sharing CONTENT_MAX_WIDTH.
export const WIDE_CONTENT_MAX_WIDTH = 1600;

// Narrower cap for long-form reading columns (Bible/song lyrics text) —
// ~60-75 characters per line is the typographic sweet spot for comfortable
// reading, well under CONTENT_MAX_WIDTH which is sized for forms/dashboards.
export const READING_CONTENT_MAX_WIDTH = 720;

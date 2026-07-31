import { useWindowDimensions } from 'react-native';
import { BREAKPOINTS } from '@/constants/layout';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export interface BreakpointInfo {
  width: number;
  height: number;
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean; // exactly the tablet band
  isDesktop: boolean; // exactly the desktop band
  isTabletUp: boolean; // tablet or desktop
  isDesktopUp: boolean; // desktop only (alias kept for readability at call sites)
}

// Deliberately built on useWindowDimensions() (resize/rotation-reactive),
// never Dimensions.get() (frozen at the moment it's called) — the latter is
// the root cause of several screens not reflowing on window resize/rotation.
export function useBreakpoint(): BreakpointInfo {
  const { width, height } = useWindowDimensions();
  const breakpoint: Breakpoint =
    width >= BREAKPOINTS.desktop ? 'desktop' : width >= BREAKPOINTS.tablet ? 'tablet' : 'mobile';

  return {
    width,
    height,
    breakpoint,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
    isTabletUp: breakpoint !== 'mobile',
    isDesktopUp: breakpoint === 'desktop',
  };
}

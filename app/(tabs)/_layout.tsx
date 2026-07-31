import TabShell from '@/components/navigation/TabShell';

// Thin pass-through only. The actual shell (and its native/web platform
// fork) lives in components/navigation/TabShell(.web).tsx — deliberately
// outside app/, since Expo Router does not reliably honor .web.tsx overrides
// for files inside app/ during static export (github.com/expo/expo/issues/37752).
export default function TabLayout() {
  return <TabShell />;
}

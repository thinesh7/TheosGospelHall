import { Stack, usePathname, useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, Slot } from 'expo-router';
import { Sidebar } from '@/components/layout/Sidebar';
import { ADMIN_SIDEBAR_ITEMS, activeSidebarKey } from '@/constants/adminRoutes';
import { auth } from '@/firebaseConfig';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { useTheme } from '@/utils/ThemeContext';

type AuthState = 'loading' | 'authed' | 'anon';

// Replaces components/AdminPanel.tsx's in-memory ViewKey modal-stack with
// real Expo Router routes — desktop web gets real URLs, browser back/
// forward, and refresh-to-same-screen. Auth gating and the responsive shell
// (sidebar on tablet/desktop, native Stack on mobile) both live here; every
// leaf route under app/admin/** is an unmodified admin/*.tsx component
// re-hosted behind a thin wrapper.
export default function AdminLayout() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const { isTabletUp } = useBreakpoint();
  const { colors } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginRoute = pathname === '/admin/login';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => setAuthState(user ? 'authed' : 'anon'));
    return unsubscribe;
  }, []);

  if (authState === 'loading') return null;

  if (isLoginRoute) {
    // Already signed in and landed on /admin/login (e.g. via a stale link) —
    // bounce straight to the dashboard instead of showing the form again.
    if (authState === 'authed') return <Redirect href={'/admin' as never} />;
    return <Slot />;
  }

  if (authState === 'anon') return <Redirect href={'/admin/login' as never} />;

  if (isTabletUp) {
    return (
      <View style={[styles.desktopRow, { backgroundColor: colors.bg }]}>
        <Sidebar
          items={ADMIN_SIDEBAR_ITEMS}
          activeKey={activeSidebarKey(pathname)}
          onSelect={key => {
            const item = ADMIN_SIDEBAR_ITEMS.find(i => i.key === key);
            if (item) router.push(item.href as never);
          }}
        />
        <View style={styles.desktopContent}>
          <Slot />
        </View>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0f3460' },
        headerTintColor: '#fff',
        headerBackTitle: '',
      }}
    />
  );
}

const styles = StyleSheet.create({
  desktopRow: { flex: 1, flexDirection: 'row' },
  desktopContent: { flex: 1 },
});

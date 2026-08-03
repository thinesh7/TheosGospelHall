import { Stack, usePathname, useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { Redirect, Slot } from 'expo-router';
import { Text } from '@/components/AppText';
import { AdminCloseButton } from '@/components/admin/AdminCloseButton';
import { Sidebar } from '@/components/layout/Sidebar';
import { ADMIN_ROUTE_META, ADMIN_SIDEBAR_ITEMS, activeSidebarKey } from '@/constants/adminRoutes';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { auth } from '@/firebaseConfig';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { getAdminEntryBackSteps } from '@/utils/adminEntry';
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
  // isDesktopUp (>=1024), not isTabletUp (>=700) — matches the main app
  // shell's own threshold for showing a persistent Sidebar (see
  // TabShell.web.tsx). At tablet width a 300px-wide admin sidebar (wider
  // than the main app's 260px default — see the Sidebar usage below) left
  // as little as ~400px for content, cramped for admin forms/cards; the
  // mobile Stack (header + back arrow) handles that range instead, same as
  // the rest of the app already does.
  const { isDesktopUp } = useBreakpoint();
  const { colors } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginRoute = pathname === '/admin/login';
  // Platform-specific on purpose — one mechanism did not reliably cover
  // both. Native: the (tabs) screen the user was on before entering Admin
  // is still mounted underneath admin in the root stack (contact.tsx
  // pushes into Admin, never replaces), and router.dismissAll() pops back
  // to that *existing* instance — no extra bookkeeping needed there.
  // (router.replace(<a remembered tab path>) was tried first instead, for
  // both platforms; that reproduced the exact bug just fixed in
  // app/(tabs)/bible.tsx, since every tab path resolves to the same single
  // "(tabs)" Stack.Screen and replace/push mints a *new* instance whose
  // TabShell always starts on Home on native.)
  // Web needed two more attempts to get right: dismissAll()/canDismiss()
  // walk React Navigation's state tree, which gets reconciled against the
  // browser's own history/URL on every navigation — confirmed via direct
  // testing that this does not reliably preserve "admin was pushed on top
  // of an existing (tabs) instance", landing back on Home instead of the
  // entry tab. Replacing to a remembered path (TabShell.web.tsx seeds its
  // active tab from the URL at mount) fixed *which tab* but still minted a
  // brand-new (tabs)/ContactScreen instance rather than reusing the
  // already-mounted one — right tab, but scrolled back to the top instead
  // of wherever the user actually was (e.g. the footer/copyright area the
  // entry gesture lives in). window.history.go(), by contrast, triggers a
  // popstate back to an existing session-history entry rather than
  // constructing a new screen, so it reuses that original instance —
  // scroll position and all — exactly like main's Android app closing a
  // plain <Modal> back to whatever was already there. See
  // utils/adminEntry.ts for how the step count is tracked.
  const handleClose = () => {
    if (Platform.OS === 'web') {
      window.history.go(getAdminEntryBackSteps());
    } else if (router.canDismiss()) {
      router.dismissAll();
    } else {
      router.replace('/');
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => setAuthState(user ? 'authed' : 'anon'));
    return unsubscribe;
  }, []);

  if (authState === 'loading') return null;

  // Shared by both the login route and every authenticated mobile screen —
  // a bare <Slot/> has no Navigator ancestor on native, so an imperative
  // router.replace()/push() issued from deep in the tree (e.g. login.tsx's
  // post-sign-in redirect) has nowhere valid to dispatch to and fails with
  // "REPLACE ... was not handled by any navigator." Routing every mobile
  // screen through one real Stack fixes that.
  const mobileStack = (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0f3460' },
        headerTintColor: '#fff',
        headerBackTitle: '',
        // Leaf admin screens (AdminDashboard, SpecialMeetingsAdmin, etc.)
        // don't set their own root background — they rely on this. Without
        // it, native-stack's web renderer falls back to a plain black card
        // background instead of the app's selected theme.
        contentStyle: { backgroundColor: colors.bg },
        // Exits the whole Admin Panel, distinct from the native back arrow
        // (which only steps back within the admin stack) — shown on every
        // screen since screenOptions applies stack-wide. Hidden on the login
        // route itself, which sets its own headerShown: false.
        headerRight: () => (
          <AdminCloseButton onPress={handleClose} tintColor="#fff" backgroundColor="rgba(255,255,255,0.18)" style={styles.mobileCloseBtn} />
        ),
      }}
    />
  );

  if (isLoginRoute) {
    // Already signed in and landed on /admin/login (e.g. via a stale link) —
    // bounce straight to the dashboard instead of showing the form again.
    if (authState === 'authed') return <Redirect href={'/admin' as never} />;
    // Desktop's web routing works fine with a bare Slot; only mobile needs
    // the Stack ancestor above.
    if (isDesktopUp) return <Slot />;
    return mobileStack;
  }

  if (authState === 'anon') return <Redirect href={'/admin/login' as never} />;

  if (isDesktopUp) {
    const meta = ADMIN_ROUTE_META[pathname] ?? ADMIN_ROUTE_META['/admin'];
    return (
      <View style={[styles.desktopRow, { backgroundColor: colors.bg }]}>
        <Sidebar
          items={ADMIN_SIDEBAR_ITEMS}
          // Wider than the 240 default — admin labels are full descriptive
          // names (e.g. "Discipleship & Academy Registrations") and need the
          // extra room to wrap without ellipsis-truncating.
          width={300}
          activeKey={activeSidebarKey(pathname)}
          onSelect={key => {
            const item = ADMIN_SIDEBAR_ITEMS.find(i => i.key === key);
            if (item) router.push(item.href as never);
          }}
          header={
            <View style={[styles.sidebarHeader, { borderBottomColor: colors.divider }]}>
              <View style={styles.brandRow}>
                <Image source={require('../../assets/images/logo.png')} style={styles.brandLogo} resizeMode="contain" />
                <View style={styles.brandTextCol}>
                  <Text style={[styles.brandTitle, { color: colors.text }]}>Admin Panel</Text>
                  <Text style={[styles.brandSubtitle, { color: colors.subtext }]}>Theos Gospel Hall</Text>
                </View>
              </View>
            </View>
          }
        />
        <View style={styles.desktopContent}>
          {/* Desktop has no Stack.Screen headerTitle (bare Slot below), so
              this is the desktop equivalent of the mobile Stack header's
              two-line title — same ADMIN_ROUTE_META source both use. */}
          <View style={[styles.pageTitleBar, { backgroundColor: colors.surface, borderBottomColor: colors.divider }]}>
            <View style={styles.pageTitleTextCol}>
              <Text style={[styles.pageTitle, { color: colors.text }]}>{meta.title}</Text>
              <Text style={[styles.pageSubtitle, { color: colors.subtext }]}>{meta.subtitle}</Text>
            </View>
            <AdminCloseButton onPress={handleClose} tintColor="#fff" backgroundColor="#0f3460" style={styles.desktopCloseBtn} />
          </View>
          <View style={styles.desktopContentBody}>
            {/* Every leaf admin screen is an unmodified admin/*.tsx component
                (a bare ScrollView with no width cap of its own) — capping and
                centering it here, once, gives the whole section the same
                content-width treatment as the rest of the app (Home, Bible,
                Videos, the registration form all use this exact constant)
                instead of every card/form/table stretching edge-to-edge on a
                wide monitor. */}
            <View style={styles.desktopContentInner}>
              <Slot />
            </View>
          </View>
        </View>
      </View>
    );
  }

  return mobileStack;
}

const styles = StyleSheet.create({
  desktopRow: { flex: 1, flexDirection: 'row' },
  desktopContent: { flex: 1 },
  desktopContentBody: { flex: 1, alignItems: 'center' },
  desktopContentInner: { flex: 1, width: '100%', maxWidth: CONTENT_MAX_WIDTH },
  sidebarHeader: { paddingHorizontal: 20, paddingBottom: 20, marginBottom: 12, borderBottomWidth: 1 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandLogo: { width: 36, height: 36, borderRadius: 8 },
  brandTextCol: { flex: 1 },
  brandTitle: { fontSize: 18, fontWeight: '700' },
  brandSubtitle: { fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  pageTitleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  pageTitleTextCol: { flex: 1 },
  pageTitle: { fontSize: 18, fontWeight: '700' },
  pageSubtitle: { fontSize: 13, marginTop: 2 },
  desktopCloseBtn: { marginLeft: 16 },
  mobileCloseBtn: { marginRight: 8 },
});

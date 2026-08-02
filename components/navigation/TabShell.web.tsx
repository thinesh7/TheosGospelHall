import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/AppText';
import LiveNowPopup from '@/components/LiveNowPopup';
import { Sidebar, SidebarItem } from '@/components/layout/Sidebar';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import BibleScreen from '@/app/(tabs)/bible';
import ContactScreen from '@/app/(tabs)/contact';
import HomeScreen from '@/app/(tabs)/index';
import SongsHubScreen from '@/app/(tabs)/songs-hub';
import VideosScreen from '@/app/(tabs)/videos';
import { checkCurrentlyLive, LiveNowInfo } from '@/utils/liveStatus';
import { useTheme } from '@/utils/ThemeContext';
import { useIsUpdateGateActive } from '@/utils/UpdateGateContext';

// Route each tab corresponds to — index must line up 1:1 with TABS below.
// Unlike the native shell (no URL concept), web needs this so a direct load,
// refresh, or browser back/forward on e.g. /videos lands on the Videos tab
// instead of always falling back to Home.
const TAB_PATHS = ['/', '/videos', '/bible', '/songs-hub', '/contact'];

function pathToTabIndex(pathname: string): number {
  const idx = TAB_PATHS.indexOf(pathname);
  return idx === -1 ? 0 : idx;
}

// sessionStorage rather than a plain module-level variable so it also
// survives a page refresh within the same browser tab (cleared when the tab
// actually closes) — "same session" for a website reads more naturally as
// "until you leave", not "until the next remount". Keyed by videoId (not a
// blanket flag) so a *different* stream going live later — a genuine reason
// to ask again — still shows the popup once for that new video.
const LIVE_DISMISSED_KEY = 'tgh_live_dismissed_video_id';

function wasLiveVideoDismissed(videoId: string): boolean {
  try {
    return window.sessionStorage.getItem(LIVE_DISMISSED_KEY) === videoId;
  } catch {
    return false;
  }
}

function markLiveVideoDismissed(videoId: string) {
  try {
    window.sessionStorage.setItem(LIVE_DISMISSED_KEY, videoId);
  } catch {}
}

// Web variant of the tab shell (see TabShell.tsx for why the fork lives here,
// outside app/, rather than as app/(tabs)/_layout.web.tsx). Drops
// PagerView/expo-screen-orientation (both meaningless on desktop web) and
// instead renders responsive chrome — a persistent Sidebar on desktop, a top-
// adjacent tab bar on mobile/tablet web — around the SAME five screen
// components the native shell uses.
const TABS: (SidebarItem & { screen: () => React.ReactNode })[] = [
  { key: '0', label: 'Home', icon: 'home', screen: () => <HomeScreen /> },
  {
    key: '1',
    label: 'Videos',
    icon: 'play-circle',
    screen: () => null, // rendered specially below (needs autoPlayLive props)
  },
  { key: '2', label: 'Bible', icon: 'book', screen: () => <BibleScreen /> },
  { key: '3', label: 'Songs', icon: 'musical-notes', screen: () => <SongsHubScreen /> },
  { key: '4', label: 'Contact', icon: 'call', screen: () => <ContactScreen /> },
];

export default function TabShell() {
  const { colors } = useTheme();
  const { isDesktopUp } = useBreakpoint();
  const insets = useSafeAreaInsets();
  // Seeded once from the URL a direct load/refresh/browser back-forward
  // landed on — deliberately NOT reactive to expo-router's own pathname
  // after that (see goToTab below for why).
  const initialPathname = usePathname();
  const [activeTab, setActiveTab] = useState(() => pathToTabIndex(initialPathname));
  const [visitedTabs, setVisitedTabs] = useState<Set<number>>(() => new Set([pathToTabIndex(initialPathname)]));

  const [liveNowInfo, setLiveNowInfo] = useState<LiveNowInfo | null>(null);
  const [autoPlayLive, setAutoPlayLive] = useState<{ videoId: string; title: string } | null>(null);
  const isUpdateGateActive = useIsUpdateGateActive();

  // Same live-check gating as the native shell: skip while a mandatory/
  // optional update prompt is blocking the app. Also skips re-showing a
  // stream the user already dismissed this session (see
  // wasLiveVideoDismissed above) — this effect re-runs every time TabShell
  // itself remounts (e.g. the Bible tab's own version/book/chapter
  // navigation still does, via router.push — see TabShell's own remount
  // fix further down for the tab-switch half of this), so without that
  // check the exact same live popup kept reappearing on every one of those
  // internal navigations.
  useEffect(() => {
    if (isUpdateGateActive) return;
    checkCurrentlyLive().then(info => {
      if (!info || wasLiveVideoDismissed(info.videoId)) return;
      setLiveNowInfo(info);
    });
  }, [isUpdateGateActive]);

  useEffect(() => {
    setVisitedTabs(prev => (prev.has(activeTab) ? prev : new Set(prev).add(activeTab)));
  }, [activeTab]);

  // Tab switches update the URL via the raw History API and local state
  // directly, instead of expo-router's router.push(). Every visited tab is
  // meant to stay mounted forever (state preserved, hidden via display:none —
  // see the "lazy-mount-then-keep-mounted" comment below), but router.push()
  // to a sibling route *inside* the (tabs) group — even just a tab switch —
  // makes Expo Router's Stack remount this entire layout (a fresh TabShell
  // instance, `visitedTabs` reset to empty, brand new Home/Bible/etc.
  // instances created from scratch on top of whatever the previous instance
  // already had mounted and never got to unmount cleanly). Each remount adds
  // its own set of intervals/animations/subscriptions that compounds on top
  // of the last, which is exactly the "every click gets slower the more you
  // navigate" degradation this was fixed for — confirmed by instrumenting a
  // production build: clicking between tabs a handful of times left 5+
  // duplicate copies of Home's periodic-shake interval alone still running.
  // Bypassing router.push for same-group navigation avoids that path
  // entirely; window.history covers the URL-bar/shareable-link/refresh
  // requirement (see TAB_PATHS' own comment) just as well.
  const goToTab = (index: number) => {
    if (index === activeTab) return;
    window.history.pushState({ tghTab: index }, '', TAB_PATHS[index]);
    setActiveTab(index);
  };

  // Browser back/forward between tabs bypasses goToTab above, so it needs
  // its own popstate listener to stay in sync. Only acts on states this
  // component itself pushed (the `tghTab` marker) — anything else (e.g.
  // WebBackGuard's own guard entries, or navigation into/out of a sibling
  // Stack.Screen like bible-reader) is left alone.
  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const tabIndex = (e.state as { tghTab?: number } | null)?.tghTab;
      if (tabIndex !== undefined) {
        setActiveTab(tabIndex);
        return;
      }
      const pathTab = pathToTabIndex(window.location.pathname);
      if (TAB_PATHS.includes(window.location.pathname)) setActiveTab(pathTab);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleWatchLiveNow = () => {
    if (!liveNowInfo) return;
    markLiveVideoDismissed(liveNowInfo.videoId);
    setAutoPlayLive({ videoId: liveNowInfo.videoId, title: liveNowInfo.title });
    setLiveNowInfo(null);
    goToTab(1);
  };

  const dismissLiveNow = () => {
    if (liveNowInfo) markLiveVideoDismissed(liveNowInfo.videoId);
    setLiveNowInfo(null);
  };

  // Same lazy-mount-then-keep-mounted pattern as the native pager (and as
  // app/(tabs)/songs-hub.tsx's existing segmented toggle): each visited
  // screen stays mounted (state preserved) and is hidden via `display: none`
  // rather than unmounted on tab switch.
  const content = (
    <View style={styles.content}>
      {TABS.map((tab, index) => (
        <View
          key={tab.key}
          style={[StyleSheet.absoluteFillObject, { display: activeTab === index ? 'flex' : 'none' }]}
        >
          {!visitedTabs.has(index)
            ? null
            : index === 1
              ? (
                <VideosScreen
                  autoPlayLive={autoPlayLive}
                  onAutoPlayLiveConsumed={() => setAutoPlayLive(null)}
                  isActive={activeTab === 1}
                />
              )
              : tab.screen()}
        </View>
      ))}
    </View>
  );

  if (isDesktopUp) {
    return (
      <View style={[styles.desktopRow, { backgroundColor: colors.bg }]}>
        <Sidebar
          items={TABS}
          activeKey={String(activeTab)}
          onSelect={key => goToTab(Number(key))}
          width={260}
          header={
            <View style={[styles.sidebarHeader, { borderBottomColor: colors.divider }]}>
              <View style={styles.brandRow}>
                <Image source={require('../../assets/images/logo.png')} style={styles.brandLogo} resizeMode="contain" />
                <View style={styles.brandTextCol}>
                  <Text style={[styles.brandTitle, { color: colors.text }]}>Theos Gospel Hall</Text>
                  <Text style={[styles.brandSubtitle, { color: colors.subtext }]}>Proclaiming the Word of God</Text>
                </View>
              </View>
            </View>
          }
        />
        <View style={styles.desktopContent}>{content}</View>
        <LiveNowPopup visible={!!liveNowInfo} onWatch={handleWatchLiveNow} onSkip={dismissLiveNow} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {content}
      <View
        style={[
          styles.tabBar,
          { backgroundColor: colors.surface, borderTopColor: colors.divider, paddingBottom: Math.max(insets.bottom, 8) },
        ]}
      >
        {TABS.map((tab, index) => (
          <TouchableOpacity key={tab.key} style={styles.tab} onPress={() => goToTab(index)}>
            <Ionicons name={tab.icon} size={24} color={activeTab === index ? colors.accent : colors.subtext} />
            <Text
              style={[styles.tabLabel, { color: activeTab === index ? colors.accent : colors.subtext }, activeTab === index && styles.tabLabelActive]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <LiveNowPopup visible={!!liveNowInfo} onWatch={handleWatchLiveNow} onSkip={dismissLiveNow} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  desktopRow: { flex: 1, flexDirection: 'row' },
  desktopContent: { flex: 1, position: 'relative' },
  content: { flex: 1, position: 'relative' },
  tabBar: { flexDirection: 'row', borderTopWidth: 1 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  tabLabel: { fontSize: 10, marginTop: 2 },
  tabLabelActive: { fontWeight: 'bold' },
  sidebarHeader: { paddingHorizontal: 20, paddingBottom: 20, marginBottom: 12, borderBottomWidth: 1 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandLogo: { width: 36, height: 36, borderRadius: 8 },
  brandTextCol: { flex: 1 },
  brandTitle: { fontSize: 18, fontWeight: '700' },
  brandSubtitle: { fontSize: 12, marginTop: 4, fontStyle: 'italic' },
});

import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/AppText';
import LiveNowPopup from '@/components/LiveNowPopup';
import AppBrandHeader from '@/components/navigation/AppBrandHeader';
import { Sidebar, SidebarItem } from '@/components/layout/Sidebar';
import { TAB_META, TAB_PATHS, pathToTabIndex } from '@/constants/tabs';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import BibleScreen from '@/app/(tabs)/bible';
import ContactScreen from '@/app/(tabs)/contact';
import HomeScreen from '@/app/(tabs)/index';
import SongsHubScreen from '@/app/(tabs)/songs-hub';
import VideosScreen from '@/app/(tabs)/videos';
import { checkCurrentlyLive, LiveNowInfo } from '@/utils/liveStatus';
import { consumePendingTabSwitch } from '@/utils/bibleWebNav';
import { useTheme } from '@/utils/ThemeContext';
import { useIsUpdateGateActive } from '@/utils/UpdateGateContext';
import { withRouterHistoryId } from '@/utils/webHistory';

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
// screen renderers keyed onto the shared TAB_META (see constants/tabs.ts) —
// index/key order must line up 1:1 with it.
const TAB_SCREENS: (() => React.ReactNode)[] = [
  () => <HomeScreen />,
  () => null, // Videos — rendered specially below (needs autoPlayLive props)
  () => <BibleScreen />,
  () => <SongsHubScreen />,
  () => <ContactScreen />,
];
const TABS: (SidebarItem & { screen: () => React.ReactNode })[] =
  TAB_META.map((tab, i) => ({ ...tab, screen: TAB_SCREENS[i] }));

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
  // Lets onPopState below always read the latest activeTab without needing
  // it in that effect's own dependency array (see that effect's own
  // comment on why it stays mounted for this component's whole lifetime).
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

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
    window.history.pushState(withRouterHistoryId({ tghTab: index }), '', TAB_PATHS[index]);
    setActiveTab(index);
  };

  // Browser back/forward between tabs bypasses goToTab above, so it needs
  // its own popstate listener to stay in sync. Only acts on states this
  // component itself pushed (the `tghTab` marker) — anything else (e.g.
  // WebBackGuard's own guard entries, or navigation into/out of a sibling
  // Stack.Screen like bible-reader) is left alone.
  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      // BibleWebNavChrome (rendered on app/bible-books.tsx and
      // app/bible-chapters.tsx) sets this before calling router.back() one
      // or more times to jump straight to a different tab — those routes
      // are separate Stack screens outside this (tabs) group, so switching
      // tabs from inside them has to land back on *this* already-mounted
      // instance first (reusing it, not remounting — see
      // utils/bibleWebNav.ts) and only then flip activeTab, since there's
      // no other channel to reach this component's own state from there.
      const pendingTab = consumePendingTabSwitch();
      if (pendingTab !== null) {
        // The back() calls landed us on whatever URL the (tabs) instance
        // was originally pushed with (e.g. still '/bible' if that's where
        // Books/Chapters was entered from) — that's stale for the tab
        // we're actually about to show. Without a fix-up, activeTab and the
        // URL disagree: content renders correctly right now, but a refresh
        // (which re-derives activeTab from the URL alone, see
        // pathToTabIndex above) or the browser's own back button snaps back
        // to the stale tab instead of the one the user actually navigated to
        // (confirmed by reproducing it: reload right after using this path
        // silently reverted to the Bible tab).
        //
        // Deferred one tick (setTimeout 0, not called inline here) because
        // expo-router's own popstate listener for this same event — which
        // resyncs the address bar to match its internal router state (still
        // '/bible', since none of this ever went through router.push) —
        // fires after this handler and clobbered an inline replaceState,
        // silently reverting it back to '/bible' before the next repaint
        // (confirmed by instrumenting: the inline write landed, then read
        // back stripped of tghTab moments later). Running after that
        // resync's own microtask/task instead of racing it makes this write
        // the one that sticks. replaceState (not pushState) since we're
        // correcting the entry we already landed on, not adding a new one.
        setTimeout(() => {
          window.history.replaceState(withRouterHistoryId({ tghTab: pendingTab }), '', TAB_PATHS[pendingTab]);
        }, 0);
        setActiveTab(pendingTab);
        return;
      }
      const tabIndex = (e.state as { tghTab?: number } | null)?.tghTab;
      if (tabIndex !== undefined) {
        setActiveTab(tabIndex);
        return;
      }
      // No tghTab on this entry's state at all — not one of our own
      // goToTab pushes (those always stamp one; the check above would have
      // caught it). Every raw pushState this app makes for tab-switching
      // (goToTab above, BibleWebNavChrome's tab-switch handoff above)
      // shares the *same* Expo Router `id` — none of them are genuine
      // router.push() navigations, so Expo Router sees every one of these
      // tab entries as just the one (tabs)-group position. Whenever a real,
      // router-tracked navigation (Bible's Books/Chapters/Reader routes)
      // pushes on top of that position and later pops back to it, Expo
      // Router's own history listener resyncs that shared entry to what
      // *it* thinks the (tabs) group's current route is — which is never
      // any of our tghTab-stamped paths, so it lands on '/' with the tghTab
      // stripped, regardless of which tab was actually showing (confirmed
      // by reproducing it: opening a Bible version and backing out once
      // read the correct tghTab and worked; doing the exact same thing a
      // second time landed on this branch instead, because the first
      // round's resync had already corrupted the shared entry in the
      // background — from here it silently fell back to whatever tab
      // happened to be earlier in browser history, e.g. Home or Videos,
      // not Bible).
      //
      // window.location.pathname is exactly what that resync just
      // overwrote, so it's not trustworthy here either — trusting it is
      // what produced the wrong-tab fallback above. activeTabRef is: it's
      // our own state, and the only two things that ever change it
      // (goToTab, the pendingTab branch above) both stamp their own tghTab
      // when they do — so if we're in this branch at all, activeTab must
      // already be showing whatever's actually still on screen. Re-stamp
      // it (deferred one tick — same reasoning as the pendingTab branch
      // above: writing inline races Expo Router's own resync for this
      // exact popstate and loses) so this entry is self-healing: every
      // subsequent pop back to it, corrupted again or not, keeps landing
      // on the right tab instead of only the first one.
      setTimeout(() => {
        window.history.replaceState(withRouterHistoryId({ tghTab: activeTabRef.current }), '', TAB_PATHS[activeTabRef.current]);
      }, 0);
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
          header={<AppBrandHeader />}
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
});

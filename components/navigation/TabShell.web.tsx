import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
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
  const [activeTab, setActiveTab] = useState(0);
  const [visitedTabs, setVisitedTabs] = useState<Set<number>>(new Set([0]));

  const [liveNowInfo, setLiveNowInfo] = useState<LiveNowInfo | null>(null);
  const [autoPlayLive, setAutoPlayLive] = useState<{ videoId: string; title: string } | null>(null);
  const isUpdateGateActive = useIsUpdateGateActive();

  // Same live-check gating as the native shell: skip while a mandatory/
  // optional update prompt is blocking the app.
  useEffect(() => {
    if (isUpdateGateActive) return;
    checkCurrentlyLive().then(info => { if (info) setLiveNowInfo(info); });
  }, [isUpdateGateActive]);

  const goToTab = (index: number) => {
    setActiveTab(index);
    setVisitedTabs(prev => (prev.has(index) ? prev : new Set(prev).add(index)));
  };

  const handleWatchLiveNow = () => {
    if (!liveNowInfo) return;
    setAutoPlayLive({ videoId: liveNowInfo.videoId, title: liveNowInfo.title });
    setLiveNowInfo(null);
    goToTab(1);
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
              <Text style={[styles.brandTitle, { color: colors.text }]}>Theos Gospel Hall</Text>
              <Text style={[styles.brandSubtitle, { color: colors.subtext }]}>Proclaiming the Word of God</Text>
            </View>
          }
        />
        <View style={styles.desktopContent}>{content}</View>
        <LiveNowPopup visible={!!liveNowInfo} onWatch={handleWatchLiveNow} onSkip={() => setLiveNowInfo(null)} />
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
      <LiveNowPopup visible={!!liveNowInfo} onWatch={handleWatchLiveNow} onSkip={() => setLiveNowInfo(null)} />
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
  brandTitle: { fontSize: 18, fontWeight: '700' },
  brandSubtitle: { fontSize: 12, marginTop: 4, fontStyle: 'italic' },
});

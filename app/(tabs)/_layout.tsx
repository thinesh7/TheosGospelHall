import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../components/AppText';
import LiveNowPopup from '../../components/LiveNowPopup';
import { checkCurrentlyLive, LiveNowInfo } from '../../utils/liveStatus';
import { useTheme } from '../../utils/ThemeContext';
import { useIsUpdateGateActive } from '../../utils/UpdateGateContext';
import { subscribeVideosTabRequest, VideosSubTab } from '../../utils/videoNavigation';
import ContactScreen from './contact';
import HomeScreen from './index';
import ReadingScreen from './reading';
import SongsHubScreen from './songs-hub';
import VideosScreen from './videos';

const TABS = [
  { name: 'Home', icon: 'home' },
  { name: 'Videos', icon: 'play-circle' },
  { name: 'Reading', icon: 'book' },
  { name: 'Songs', icon: 'musical-notes' },
  { name: 'Contact', icon: 'call' },
];

const PORTRAIT_LOCKED_TABS = [2, 3];

export default function TabLayout() {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [visitedTabs, setVisitedTabs] = useState<Set<number>>(new Set([0]));
  const activeTabRef = useRef(0);
  const pagerRef = useRef<PagerView>(null);
  const insets = useSafeAreaInsets();

  const [liveNowInfo, setLiveNowInfo] = useState<LiveNowInfo | null>(null);
  const [autoPlayLive, setAutoPlayLive] = useState<{ videoId: string; title: string } | null>(null);
  const [pendingVideosSubTab, setPendingVideosSubTab] = useState<VideosSubTab | null>(null);
  const isUpdateGateActive = useIsUpdateGateActive();

  // Skip the live-stream check entirely while a mandatory/optional update
  // prompt is blocking the app — otherwise the Live Now popup could appear
  // stacked over (or under) the update screen and its "Watch" button would
  // navigate into the Videos tab out from under a supposedly-blocking
  // update. Re-runs once the gate clears (e.g. the user hits Skip).
  useEffect(() => {
    if (isUpdateGateActive) return;
    checkCurrentlyLive().then(info => { if (info) setLiveNowInfo(info); });
  }, [isUpdateGateActive]);

  const handleWatchLiveNow = () => {
    if (!liveNowInfo) return;
    setAutoPlayLive({ videoId: liveNowInfo.videoId, title: liveNowInfo.title });
    setLiveNowInfo(null);
    goToTab(1);
  };

  useEffect(() => {
    setVisitedTabs(prev => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
    if (PORTRAIT_LOCKED_TABS.includes(activeTab)) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } else {
      ScreenOrientation.unlockAsync();
    }
  }, [activeTab]);

  const goToTab = (index: number) => {
    activeTabRef.current = index;
    setActiveTab(index);
    pagerRef.current?.setPage(index);
  };

  // A "Click Here" tap on a Live/Songs notification (Notification Center is
  // a separate stack route on top of this one) requests a Videos sub-tab
  // here, then this switches the pager to Videos itself.
  useEffect(() => {
    return subscribeVideosTabRequest(tab => {
      setPendingVideosSubTab(tab);
      goToTab(1);
    });
  }, []);

  const tabBarHeight = 60 + Math.max(insets.bottom, 8);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        scrollEnabled={false}
        onPageSelected={(e) => {
          const index = e.nativeEvent.position;
          activeTabRef.current = index;
          setActiveTab(index);
        }}
      >
        <View key="0" style={{ flex: 1, backgroundColor: colors.bg }}>{visitedTabs.has(0) ? <HomeScreen /> : null}</View>
        <View key="1" style={{ flex: 1, backgroundColor: colors.bg }}>
          {visitedTabs.has(1) ? (
            <VideosScreen
              autoPlayLive={autoPlayLive}
              onAutoPlayLiveConsumed={() => setAutoPlayLive(null)}
              isActive={activeTab === 1}
              pendingSubTab={pendingVideosSubTab}
              onPendingSubTabConsumed={() => setPendingVideosSubTab(null)}
            />
          ) : null}
        </View>
        <View key="2" style={{ flex: 1, backgroundColor: colors.bg }}>{visitedTabs.has(2) ? <ReadingScreen /> : null}</View>
        <View key="3" style={{ flex: 1, backgroundColor: colors.bg }}>{visitedTabs.has(3) ? <SongsHubScreen /> : null}</View>
        <View key="4" style={{ flex: 1, backgroundColor: colors.bg }}>{visitedTabs.has(4) ? <ContactScreen /> : null}</View>
      </PagerView>

      <View style={[
        styles.tabBar,
        {
          height: tabBarHeight,
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: colors.surface,
          borderTopColor: colors.divider,
        }
      ]}>
        {TABS.map((tab, index) => (
          <TouchableOpacity
            key={index}
            style={styles.tab}
            onPress={() => goToTab(index)}
          >
            <Ionicons
              name={tab.icon as any}
              size={24}
              color={activeTab === index ? colors.accent : colors.subtext}
            />
            <Text
              style={[styles.tabLabel, { color: activeTab === index ? colors.accent : colors.subtext }, activeTab === index && styles.tabLabelActive]}
              numberOfLines={1}
              maxFontSizeMultiplier={1.2}
            >
              {tab.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <LiveNowPopup
        visible={!!liveNowInfo && !isUpdateGateActive}
        onWatch={handleWatchLiveNow}
        onSkip={() => setLiveNowInfo(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pager: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    elevation: 8,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 10, marginTop: 2 },
  tabLabelActive: { fontWeight: 'bold' },
});

import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LiveNowPopup from '../../components/LiveNowPopup';
import { checkCurrentlyLive, LiveNowInfo } from '../../utils/liveStatus';
import { useTheme } from '../../utils/ThemeContext';
import BibleScreen from './bible';
import ContactScreen from './contact';
import HomeScreen from './index';
import SongsHubScreen from './songs-hub';
import VideosScreen from './videos';

const TABS = [
  { name: 'Home', icon: 'home' },
  { name: 'Videos', icon: 'play-circle' },
  { name: 'Bible', icon: 'book' },
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

  useEffect(() => {
    checkCurrentlyLive().then(info => { if (info) setLiveNowInfo(info); });
  }, []);

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
            <VideosScreen autoPlayLive={autoPlayLive} onAutoPlayLiveConsumed={() => setAutoPlayLive(null)} />
          ) : null}
        </View>
        <View key="2" style={{ flex: 1, backgroundColor: colors.bg }}>{visitedTabs.has(2) ? <BibleScreen /> : null}</View>
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
            <Text style={[styles.tabLabel, { color: activeTab === index ? colors.accent : colors.subtext }, activeTab === index && styles.tabLabelActive]}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <LiveNowPopup
        visible={!!liveNowInfo}
        label={liveNowInfo?.label}
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

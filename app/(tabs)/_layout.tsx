import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import BibleScreen from './bible';
import ContactScreen from './contact';
import HomeScreen from './index';
import SongsScreen from './songs';
import VideosScreen from './videos';

const TABS = [
  { name: 'Home', icon: 'home' },
  { name: 'Videos', icon: 'play-circle' },
  { name: 'Bible', icon: 'book' },
  { name: 'Songs', icon: 'musical-notes' },
  { name: 'Contact', icon: 'call' },
];

export default function TabLayout() {
  const [activeTab, setActiveTab] = useState(0);
  const activeTabRef = useRef(0);
  const pagerRef = useRef<PagerView>(null);

  const goToTab = (index: number) => {
    activeTabRef.current = index;
    setActiveTab(index);
    pagerRef.current?.setPage(index);
  };

  return (
    <View style={styles.container}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={(e) => {
          const index = e.nativeEvent.position;
          activeTabRef.current = index;
          setActiveTab(index);
        }}
      >
        <View key="0"><HomeScreen /></View>
        <View key="1"><VideosScreen /></View>
        <View key="2"><BibleScreen /></View>
        <View key="3"><SongsScreen /></View>
        <View key="4"><ContactScreen /></View>
      </PagerView>

      <View style={styles.tabBar}>
        {TABS.map((tab, index) => (
          <TouchableOpacity
            key={index}
            style={styles.tab}
            onPress={() => goToTab(index)}
          >
            <Ionicons
              name={tab.icon as any}
              size={24}
              color={activeTab === index ? '#0f3460' : '#999'}
            />
            <Text style={[styles.tabLabel, activeTab === index && styles.tabLabelActive]}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pager: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    height: 80,
    paddingBottom: 24,
    elevation: 8,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 10, color: '#999', marginTop: 2 },
  tabLabelActive: { color: '#0f3460', fontWeight: 'bold' },
});
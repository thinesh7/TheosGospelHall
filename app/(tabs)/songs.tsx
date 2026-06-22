import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SongIndexEntry, getSongsIndex, syncSongs } from '../../utils/songsSync';
import { useTheme } from '../../utils/ThemeContext';
import ThemeToggleIcon from '../../components/ThemeToggleIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FAVORITES_KEY = 'tgh_song_favorites';

type Tab = 'numbers' | 'az' | 'favorites';

const stripNumber = (title: string) => title.replace(/^\d+\.\s*/, '');

const tamilCollator = new Intl.Collator('ta');

function FirstTimeSetup({ c }: { c: any }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }).start();

    const animateDot = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -8, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600),
        ])
      );

    Animated.parallel([
      animateDot(dot1, 0),
      animateDot(dot2, 150),
      animateDot(dot3, 300),
    ]).start();
  }, []);

  return (
    <Animated.View style={[setupStyles.container, { opacity: fade }]}>
      <View style={[setupStyles.card, { backgroundColor: c.surface }]}>
        <View style={[setupStyles.iconCircle, { backgroundColor: c.accent + '22' }]}>
          <Ionicons name="musical-notes" size={36} color={c.accent} />
        </View>

        <Text style={[setupStyles.title, { color: c.text }]}>
          Preparing your song collection
        </Text>

        <Text style={[setupStyles.subtitle, { color: c.subtext }]}>
          Please allow a moment while we set things up for you. This only happens once.
        </Text>

        <View style={setupStyles.dotsRow}>
          {[dot1, dot2, dot3].map((dot, i) => (
            <Animated.View
              key={i}
              style={[
                setupStyles.dot,
                { backgroundColor: c.accent, transform: [{ translateY: dot }] },
              ]}
            />
          ))}
        </View>

        <Text style={[setupStyles.note, { color: c.subtext }]}>
          ✦ One-time setup
        </Text>
      </View>
    </Animated.View>
  );
}

const setupStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    elevation: 4,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  note: {
    fontSize: 12,
    letterSpacing: 0.5,
  },
});

export default function SongsScreen({ headerTitle }: { headerTitle?: React.ReactNode } = {}) {
  const router = useRouter();
  const { colors: c, theme, cycleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [activeTab, setActiveTab] = useState<Tab>('numbers');
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [songs, setSongs] = useState<SongIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadInitial();
  }, []);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(FAVORITES_KEY).then(stored => {
        if (stored) setFavorites(JSON.parse(stored));
      });
    }, [])
  );

  const loadInitial = async () => {
    const cached = await getSongsIndex();
    if (cached.length > 0) {
      setSongs(cached);
      setLoading(false);
    }

    AsyncStorage.getItem(FAVORITES_KEY).then(stored => {
      if (stored) setFavorites(JSON.parse(stored));
    });

    setSyncing(true);
    const result = await syncSongs();
    if (result.index.length > 0) {
      setSongs(result.index);
    }
    setLoading(false);
    setSyncing(false);
  };

  const onPullToRefresh = async () => {
    setRefreshing(true);
    const result = await syncSongs();
    if (result.index.length > 0) {
      setSongs(result.index);
    }
    setRefreshing(false);
  };

  const azSongs = useMemo(() => {
    if (activeTab !== 'az') return [];
    return [...songs].sort((a, b) =>
      tamilCollator.compare(stripNumber(a.title), stripNumber(b.title))
    );
  }, [songs, activeTab]);

  const favoriteSongs = useMemo(() => {
    return songs.filter(s => favorites.includes(s.songId));
  }, [songs, favorites]);

  const filteredSongs = useMemo(() => {
    let base = activeTab === 'az' ? azSongs : activeTab === 'favorites' ? favoriteSongs : songs;
    const q = search.trim();
    if (!q) return base;
    const isNumeric = /^\d+$/.test(q);
    if (isNumeric) {
      return base.filter(s => String(s.songNumber).startsWith(q));
    }
    return base.filter(s =>
      s.title.toLowerCase().includes(q.toLowerCase()) ||
      (s.titleEnglish && s.titleEnglish.toLowerCase().includes(q.toLowerCase()))
    );
  }, [search, activeTab, songs, azSongs, favoriteSongs]);

  const selectTab = (tab: Tab) => {
    setActiveTab(tab);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const openSong = (songNumber: number) => {
    router.push({ pathname: '/song-reader', params: { songNumber: String(songNumber) } });
  };

  const SongCard = useCallback(({ item }: { item: SongIndexEntry }) => (
    <TouchableOpacity style={[styles.card, { backgroundColor: c.surface }]} onPress={() => openSong(item.songNumber)}>
      <Text style={[styles.cardText, { color: c.text }]} numberOfLines={3}>
        {item.title}
      </Text>
      {favorites.includes(item.songId) && (
        <Ionicons name="heart" size={16} color="#e74c3c" style={styles.favIcon} />
      )}
    </TouchableOpacity>
  ), [favorites, c]);

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <StatusBar barStyle={theme === 'light' ? 'dark-content' : 'light-content'} />

      <View style={[styles.headerRow, { marginRight: 16 + insets.right }]}>
        {headerTitle ? headerTitle : (
          <Text style={[styles.headerTitle, { color: c.accent }]}>Geethangalum Keerthanaigalum</Text>
        )}
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={cycleTheme} style={styles.themeBtn}>
            <ThemeToggleIcon theme={theme} size={22} color={c.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.searchBar, { backgroundColor: c.surfaceAlt }]}>
        <Ionicons name="search" size={20} color={c.subtext} />
        <TextInput
          style={[styles.searchInput, { color: c.text }]}
          placeholder="Search by song number or title"
          placeholderTextColor={c.subtext}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={20} color={c.subtext} />
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.tabsRow, { backgroundColor: c.surfaceAlt }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'numbers' && { backgroundColor: c.accent }]}
          onPress={() => selectTab('numbers')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'numbers' ? '#fff' : c.accent }]}>
            1 to 720
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'az' && { backgroundColor: c.accent }]}
          onPress={() => selectTab('az')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'az' ? '#fff' : c.accent }]}>
            A to Z
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'favorites' && { backgroundColor: c.accent }]}
          onPress={() => selectTab('favorites')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'favorites' ? '#fff' : c.accent }]}>
            Favorites
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <FirstTimeSetup c={c} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={filteredSongs}
          keyExtractor={item => item.songId}
          renderItem={SongCard}
          contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
          removeClippedSubviews
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onPullToRefresh} colors={[c.accent]} tintColor={c.accent} />
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: c.subtext }]}>
              {activeTab === 'favorites' ? 'No favorites yet' : 'No songs found'}
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 54,
    marginLeft: 16,
    marginBottom: 14,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  themeBtn: { padding: 4 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 2,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16 },
  tabsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
    borderRadius: 30,
    padding: 4,
    elevation: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 26,
  },
  tabText: { fontSize: 14, fontWeight: '600' },
  card: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardText: { fontSize: 16, flex: 1, lineHeight: 24 },
  favIcon: { marginLeft: 8, marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
});

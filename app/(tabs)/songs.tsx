import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SongIndexEntry, getSongsIndex, syncSongs } from '../../utils/songsSync';
import { ThemeName, THEMES, getStoredTheme, setStoredTheme, nextTheme } from '../../utils/songsTheme';

const FAVORITES_KEY = 'tgh_song_favorites';

type Tab = 'numbers' | 'az' | 'favorites';

const stripNumber = (title: string) => title.replace(/^\d+\.\s*/, '');

const tamilCollator = new Intl.Collator('ta');

export default function SongsScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const [activeTab, setActiveTab] = useState<Tab>('numbers');
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [songs, setSongs] = useState<SongIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [theme, setTheme] = useState<ThemeName>('dark');

  useEffect(() => {
    loadInitial();
  }, []);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(FAVORITES_KEY).then(stored => {
        if (stored) setFavorites(JSON.parse(stored));
      });
      getStoredTheme().then(setTheme);
    }, [])
  );

  const loadInitial = async () => {
    const t = await getStoredTheme();
    setTheme(t);

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

  const cycleTheme = async () => {
    const next = nextTheme(theme);
    setTheme(next);
    await setStoredTheme(next);
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

  const c = THEMES[theme];

  const SongCard = useCallback(({ item }: { item: SongIndexEntry }) => (
    <TouchableOpacity style={[styles.card, { backgroundColor: c.cardBg }]} onPress={() => openSong(item.songNumber)}>
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
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />

      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: c.titleColor }]}>Geethangalum Keerthanaigalum</Text>
        <View style={styles.headerActions}>
          {syncing && <ActivityIndicator size="small" color={c.titleColor} />}
          <TouchableOpacity onPress={cycleTheme} style={styles.themeBtn}>
            <Ionicons name="contrast-outline" size={22} color={c.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.searchBar, { backgroundColor: c.searchBg }]}>
        <Ionicons name="search" size={20} color={c.sub} />
        <TextInput
          style={[styles.searchInput, { color: c.text }]}
          placeholder="Search by song number or title"
          placeholderTextColor={c.sub}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={20} color={c.sub} />
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.tabsRow, { backgroundColor: c.searchBg }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'numbers' && { backgroundColor: c.titleColor }]}
          onPress={() => selectTab('numbers')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'numbers' ? '#fff' : c.titleColor }]}>
            1 to 720
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'az' && { backgroundColor: c.titleColor }]}
          onPress={() => selectTab('az')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'az' ? '#fff' : c.titleColor }]}>
            A to Z
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'favorites' && { backgroundColor: c.titleColor }]}
          onPress={() => selectTab('favorites')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'favorites' ? '#fff' : c.titleColor }]}>
            Favorites
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={c.titleColor} style={{ marginTop: 60 }} />
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
          ListEmptyComponent={
            <Text style={[styles.empty, { color: c.sub }]}>
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
    marginHorizontal: 16,
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

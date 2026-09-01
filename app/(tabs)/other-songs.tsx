import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  RefreshControl,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../components/AppText';
import { TextInput } from '../../components/AppTextInput';
import ThemeToggleIcon from '../../components/ThemeToggleIcon';
import { Toast, useToast } from '../../components/Toast';
import { OtherSongIndexEntry, getOtherSongsIndex, syncOtherSongs } from '../../utils/otherSongsSync';
import { useTheme } from '../../utils/ThemeContext';

const FAVORITES_KEY = 'tgh_other_song_favorites';

type Tab = 'numbers' | 'az' | 'favorites';

const stripNumber = (title: string) => title.replace(/^\d+\.\s*/, '');

const tamilCollator = new Intl.Collator('ta');

export default function OtherSongsScreen({ headerTitle }: { headerTitle?: React.ReactNode } = {}) {
  const router = useRouter();
  const { colors: c, theme, cycleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const isLandscape = winWidth > winHeight;
  const flatListRef = useRef<FlatList>(null);
  const [activeTab, setActiveTab] = useState<Tab>('numbers');
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [songs, setSongs] = useState<OtherSongIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { message: toastMessage, opacity: toastOpacity, showToast } = useToast();

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
    const cached = await getOtherSongsIndex();
    if (cached.length > 0) {
      setSongs(cached);
      setLoading(false);
    }

    AsyncStorage.getItem(FAVORITES_KEY).then(stored => {
      if (stored) setFavorites(JSON.parse(stored));
    });

    setSyncing(true);
    const result = await syncOtherSongs();
    if (result.index.length > 0) {
      setSongs(result.index);
    }
    setLoading(false);
    setSyncing(false);
  };

  const onPullToRefresh = async () => {
    setRefreshing(true);
    const result = await syncOtherSongs();
    if (result.index.length > 0) {
      setSongs(result.index);
    }
    setRefreshing(false);
  };

  const visibleSongs = useMemo(() => {
    return songs.filter(s => s.isVisible !== false);
  }, [songs]);

  const azSongs = useMemo(() => {
    if (activeTab !== 'az') return [];
    return [...visibleSongs].sort((a, b) =>
      tamilCollator.compare(stripNumber(a.title), stripNumber(b.title))
    );
  }, [visibleSongs, activeTab]);

  const favoriteSongs = useMemo(() => {
    return visibleSongs.filter(s => favorites.includes(s.songId));
  }, [visibleSongs, favorites]);

  const filteredSongs = useMemo(() => {
    let base = activeTab === 'az' ? azSongs : activeTab === 'favorites' ? favoriteSongs : visibleSongs;
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
  }, [search, activeTab, visibleSongs, azSongs, favoriteSongs]);

  const selectTab = (tab: Tab) => {
    setActiveTab(tab);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const openSong = (songNumber: number) => {
    Keyboard.dismiss();
    setSearch('');
    router.push({ pathname: '/other-song-reader', params: { songNumber: String(songNumber) } });
  };

  const toggleFavorite = useCallback((song: OtherSongIndexEntry) => {
    setFavorites(prev => {
      const isFav = prev.includes(song.songId);
      const updated = isFav ? prev.filter(id => id !== song.songId) : [...prev, song.songId];
      AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated)).catch(() => {});
      showToast(isFav ? 'Removed from Favorites.' : 'Added to Favorites.');
      return updated;
    });
  }, [showToast]);

  const SongCard = useCallback(({ item }: { item: OtherSongIndexEntry }) => {
    const isFav = favorites.includes(item.songId);
    return (
      <TouchableOpacity style={[styles.card, { backgroundColor: c.surface, borderColor: c.divider }]} onPress={() => openSong(item.songNumber)}>
        <View style={[styles.numberBadge, { backgroundColor: c.accent }]}>
          <Text style={styles.numberBadgeText}>{item.songNumber}</Text>
        </View>
        <Text style={[styles.cardText, { color: c.text }]} numberOfLines={3}>
          {stripNumber(item.title)}
        </Text>
        <TouchableOpacity
          onPress={() => toggleFavorite(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.favIconBtn}
        >
          <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={20} color={isFav ? '#e74c3c' : c.subtext} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }, [favorites, c, toggleFavorite]);

  const searchTabsBlock = (
    <View>
      <View style={[styles.searchBar, { backgroundColor: c.surfaceAlt, borderColor: c.divider, marginLeft: 16 + insets.left, marginRight: 16 + insets.right }]}>
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

      <View style={[styles.tabsRow, { backgroundColor: c.surfaceAlt, borderColor: c.divider, marginLeft: 16 + insets.left, marginRight: 16 + insets.right }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'numbers' && styles.tabActive, activeTab === 'numbers' && { backgroundColor: c.accent }]}
          onPress={() => selectTab('numbers')}
        >
          <Ionicons name="list-outline" size={15} color={activeTab === 'numbers' ? '#fff' : c.accent} />
          <Text style={[styles.tabText, { color: activeTab === 'numbers' ? '#fff' : c.accent }]}>
            {visibleSongs.length === 0 ? '0' : `1 to ${visibleSongs.length}`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'az' && styles.tabActive, activeTab === 'az' && { backgroundColor: c.accent }]}
          onPress={() => selectTab('az')}
        >
          <Ionicons name="swap-vertical-outline" size={15} color={activeTab === 'az' ? '#fff' : c.accent} />
          <Text style={[styles.tabText, { color: activeTab === 'az' ? '#fff' : c.accent }]}>
            A to Z
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'favorites' && styles.tabActive, activeTab === 'favorites' && { backgroundColor: c.accent }]}
          onPress={() => selectTab('favorites')}
        >
          <Ionicons name="heart-outline" size={15} color={activeTab === 'favorites' ? '#fff' : c.accent} />
          <Text style={[styles.tabText, { color: activeTab === 'favorites' ? '#fff' : c.accent }]}>
            Favorites
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const titleRow = (
    <View style={[styles.headerRow, { marginTop: insets.top + 12, marginLeft: 16 + insets.left, marginRight: 16 + insets.right }]}>
      {headerTitle ? headerTitle : (
        <Text style={[styles.headerTitle, { color: c.accent }]}>Other Songs</Text>
      )}
      <View style={styles.headerActions}>
        <TouchableOpacity onPress={cycleTheme} style={styles.themeBtn}>
          <ThemeToggleIcon theme={theme} size={22} color={c.text} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Title + search bar + filter tabs together. In landscape this is the
  // FlatList's ListHeaderComponent so it scrolls away with the content; in
  // portrait it's rendered as a fixed sibling above the FlatList instead, so
  // all three stay frozen and never scroll at all.
  const combinedHeader = (
    <View style={{ paddingBottom: 12 }}>
      {titleRow}
      {searchTabsBlock}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <StatusBar barStyle={theme === 'light' ? 'dark-content' : 'light-content'} />

      {!isLandscape && combinedHeader}

      <FlatList
        ref={flatListRef}
        data={filteredSongs}
        keyExtractor={item => item.songId}
        renderItem={SongCard}
        ListHeaderComponent={isLandscape ? combinedHeader : undefined}
        contentContainerStyle={{ paddingBottom: 100, paddingLeft: 12 + insets.left, paddingRight: 12 + insets.right }}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={10}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onPullToRefresh} colors={[c.accent]} tintColor={c.accent} />
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 60 }} />
          ) : (
            <Text style={[styles.empty, { color: c.subtext }]}>
              {activeTab === 'favorites' ? 'No favorites yet' : 'No songs found'}
            </Text>
          )
        }
      />
      <Toast message={toastMessage} opacity={toastOpacity} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // marginTop/marginLeft/marginRight are applied inline with safe-area
    // insets (see JSX) instead of fixed here, since a phone's notch/camera
    // cutout can sit on either the top or a side edge depending on
    // orientation.
    marginBottom: 14,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  themeBtn: { padding: 4 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    // marginLeft/marginRight applied inline with insets — see above.
    borderRadius: 30,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16 },
  tabsRow: {
    flexDirection: 'row',
    // marginLeft/marginRight applied inline with insets — see headerRow above.
    marginTop: 16,
    marginBottom: 4,
    borderRadius: 30,
    borderWidth: 1,
    padding: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 26,
  },
  tabActive: {
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  tabText: { fontSize: 14, fontWeight: '600' },
  card: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  numberBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  numberBadgeText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  cardText: { fontSize: 16, flex: 1, lineHeight: 24 },
  favIconBtn: { marginLeft: 8, padding: 2 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
});

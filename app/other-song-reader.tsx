import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { OtherSongIndexEntry, getOtherSongById, getOtherSongsIndex } from '../utils/otherSongsSync';
import { THEMES, getStoredTheme, nextTheme, setStoredTheme } from '../utils/songsTheme';

const FAVORITES_KEY = 'tgh_other_song_favorites';
const SETTINGS_KEY = 'tgh_other_song_reader_settings';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 28;
const MIN_THICKNESS = 300;
const MAX_THICKNESS = 800;
const THICKNESS_STEP = 100;

type Language = 'tamil' | 'english';
type LyricsMap = Record<string, { tamil: string; english: string }>;

const normalizeFull = (s: string) =>
  s
    .toLowerCase()
    .replace(/^\d+\.\s*/, '')
    .replace(/[.,!?;:'"()،]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const stripDuplicateFirstParagraph = (lyrics: string) => {
  const paragraphs = lyrics
    .split('\n\n')
    .map(p => p.trim())
    .filter(p => p.length > 0);

  if (paragraphs.length < 2) return lyrics;

  const first = normalizeFull(paragraphs[0]);
  const second = normalizeFull(paragraphs[1]);

  if (first.length > 0 && second.startsWith(first)) {
    return paragraphs.slice(1).join('\n\n');
  }

  return lyrics;
};

const capitalizeParagraphs = (text: string) => {
  return text
    .split('\n\n')
    .map(paragraph => {
      const idx = paragraph.search(/[a-zA-Z]/);
      if (idx === -1) return paragraph;
      return paragraph.slice(0, idx) + paragraph[idx].toUpperCase() + paragraph.slice(idx + 1);
    })
    .join('\n\n');
};

export default function OtherSongReaderScreen() {
  const router = useRouter();
  const { songNumber } = useLocalSearchParams<{ songNumber: string }>();
  const flatListRef = useRef<FlatList>(null);
  const lyricsMapRef = useRef<LyricsMap>({});
  const loadingSetRef = useRef<Set<string>>(new Set());

  const [songsIndex, setSongsIndex] = useState<OtherSongIndexEntry[]>([]);
  const [lyricsMap, setLyricsMap] = useState<LyricsMap>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light' | 'sepia'>('dark');
  const [language, setLanguage] = useState<Language>('tamil');
  const [fontSize, setFontSize] = useState(18);
  const [thickness, setThickness] = useState(400);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const fullIndex = await getOtherSongsIndex();
    const index = fullIndex.filter(s => s.isVisible !== false);
    setSongsIndex(index);

    const targetIndex = index.findIndex(s => s.songNumber === Number(songNumber));
    setCurrentIndex(targetIndex >= 0 ? targetIndex : 0);

    const t = await getStoredTheme();
    setTheme(t);

    const favStored = await AsyncStorage.getItem(FAVORITES_KEY);
    if (favStored) setFavorites(JSON.parse(favStored));

    const settingsStored = await AsyncStorage.getItem(SETTINGS_KEY);
    if (settingsStored) {
      const s = JSON.parse(settingsStored);
      setLanguage(s.language || 'tamil');
      setFontSize(s.fontSize || 18);
      setThickness(s.thickness || 400);
    }
    setSettingsLoaded(true);
  };

  useEffect(() => {
    if (!settingsLoaded) return;
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ language, fontSize, thickness }));
  }, [language, fontSize, thickness, settingsLoaded]);

  useEffect(() => {
    if (songsIndex.length > 0 && currentIndex >= 0) {
      flatListRef.current?.scrollToIndex({ index: currentIndex, animated: false });
    }
  }, [songsIndex.length]);

  const ensureLyricsLoaded = async (songId: string) => {
    if (lyricsMapRef.current[songId] || loadingSetRef.current.has(songId)) return;
    loadingSetRef.current.add(songId);
    const song = await getOtherSongById(songId);
    loadingSetRef.current.delete(songId);
    if (song) {
      lyricsMapRef.current = { ...lyricsMapRef.current, [songId]: song.lyrics };
      setLyricsMap(prev => ({ ...prev, [songId]: song.lyrics }));
    }
  };

  useEffect(() => {
    if (songsIndex.length === 0 || currentIndex < 0) return;
    const current = songsIndex[currentIndex];
    const prev = songsIndex[currentIndex - 1];
    const next = songsIndex[currentIndex + 1];
    if (current) ensureLyricsLoaded(current.songId);
    if (prev) ensureLyricsLoaded(prev.songId);
    if (next) ensureLyricsLoaded(next.songId);
  }, [currentIndex, songsIndex]);

  const toggleFavorite = async (songId: string) => {
    const updated = favorites.includes(songId)
      ? favorites.filter(id => id !== songId)
      : [...favorites, songId];
    setFavorites(updated);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
  };

  const shareSong = async (song: OtherSongIndexEntry) => {
    const lyrics = lyricsMap[song.songId];
    const body = lyrics ? (language === 'tamil' ? lyrics.tamil : lyrics.english) : '';
    try {
      await Share.share({
        message: body ? `${song.title}\n\n${body}` : song.title,
      });
    } catch (e) {}
  };

  const cycleTheme = async () => {
    const next = nextTheme(theme);
    setTheme(next);
    await setStoredTheme(next);
  };

  const decreaseFontSize = () => setFontSize(prev => Math.max(MIN_FONT_SIZE, prev - 1));
  const increaseFontSize = () => setFontSize(prev => Math.min(MAX_FONT_SIZE, prev + 1));
  const decreaseThickness = () => setThickness(prev => Math.max(MIN_THICKNESS, prev - THICKNESS_STEP));
  const increaseThickness = () => setThickness(prev => Math.min(MAX_THICKNESS, prev + THICKNESS_STEP));

  const c = THEMES[theme];

  const lyricsPaddingBottom = 190 + (fontSize - MIN_FONT_SIZE) * 7 + (thickness - MIN_THICKNESS) / 6;

  const searchResults = searchQuery.trim()
    ? songsIndex.filter(s => {
        const q = searchQuery.trim().toLowerCase();
        const isNumeric = /^\d+$/.test(q);
        if (isNumeric) return String(s.songNumber).startsWith(q);
        return s.title.toLowerCase().includes(q) || (s.titleEnglish && s.titleEnglish.toLowerCase().includes(q));
      })
    : [];

  const jumpToSong = (index: number) => {
    setCurrentIndex(index);
    flatListRef.current?.scrollToIndex({ index, animated: false });
    setShowSearch(false);
    setSearchQuery('');
  };

  const SongPage = ({ item }: { item: OtherSongIndexEntry }) => {
    const lyrics = lyricsMap[item.songId];

    if (!lyrics) {
      return (
        <View style={[styles.page, { backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color={c.titleColor} />
        </View>
      );
    }

    const rawText = language === 'tamil' ? lyrics.tamil : lyrics.english;
    const deduped = stripDuplicateFirstParagraph(rawText);
    const text = language === 'english' ? capitalizeParagraphs(deduped) : deduped;

    return (
      <View style={[styles.page, { backgroundColor: c.bg }]}>
        <FlatList
          data={[text]}
          keyExtractor={() => item.songId}
          renderItem={() => (
            <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: lyricsPaddingBottom }}>
              <Text style={[styles.title, { color: c.titleColor, fontSize: fontSize + 4, fontWeight: thickness >= 600 ? 'bold' : '600' }]}>
                {item.title}
              </Text>
              <View style={{ height: 24 }} />
              <Text style={[styles.lyrics, { color: c.text, fontSize, lineHeight: fontSize * 1.6, fontWeight: thickness >= 700 ? 'bold' : thickness >= 500 ? '600' : '400' }]}>
                {text}
              </Text>
            </View>
          )}
        />
      </View>
    );
  };

  if (!settingsLoaded || songsIndex.length === 0) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.page, { backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color={c.titleColor} />
        </View>
      </>
    );
  }

  const currentSong = songsIndex[currentIndex];

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.topBar, { backgroundColor: c.toolbarBg }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </TouchableOpacity>
        <View style={styles.topBarActions}>
          <TouchableOpacity onPress={() => setShowSearch(true)} style={styles.iconBtn}>
            <Ionicons name="search" size={22} color={c.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => toggleFavorite(currentSong.songId)} style={styles.iconBtn}>
            <Ionicons
              name={favorites.includes(currentSong.songId) ? 'heart' : 'heart-outline'}
              size={22}
              color={favorites.includes(currentSong.songId) ? '#e74c3c' : c.text}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => shareSong(currentSong)} style={styles.iconBtn}>
            <Ionicons name="share-social-outline" size={22} color={c.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={cycleTheme} style={styles.iconBtn}>
            <Ionicons name="contrast-outline" size={22} color={c.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.iconBtn}>
            <Ionicons name="options-outline" size={22} color={c.text} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={songsIndex}
        keyExtractor={item => item.songId}
        renderItem={SongPage}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={currentIndex}
        getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
        onScrollToIndexFailed={() => {}}
        onMomentumScrollEnd={e => {
          const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentIndex(index);
        }}
      />

      <View style={[styles.bottomBar, { backgroundColor: c.toolbarBg }]}>
        <TouchableOpacity
          disabled={currentIndex === 0}
          onPress={() => flatListRef.current?.scrollToIndex({ index: currentIndex - 1, animated: true })}
          style={styles.navBtn}
        >
          <Ionicons name="chevron-back-circle" size={30} color={currentIndex === 0 ? '#555' : c.titleColor} />
        </TouchableOpacity>
        <Text style={[styles.pageIndicator, { color: c.sub }]}>
          {currentSong.songNumber} / {songsIndex.length}
        </Text>
        <TouchableOpacity
          disabled={currentIndex === songsIndex.length - 1}
          onPress={() => flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true })}
          style={styles.navBtn}
        >
          <Ionicons name="chevron-forward-circle" size={30} color={currentIndex === songsIndex.length - 1 ? '#555' : c.titleColor} />
        </TouchableOpacity>
      </View>

      <Modal visible={showSettings} transparent animationType="slide" onRequestClose={() => setShowSettings(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSettings(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.sheet, { backgroundColor: c.toolbarBg }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.settingRow}>
              <Ionicons name="language-outline" size={20} color={c.text} />
              <Text style={[styles.settingLabel, { color: c.text }]}>Language</Text>
            </View>
            <View style={styles.langToggle}>
              <TouchableOpacity
                style={[styles.langBtn, language === 'tamil' && styles.langBtnActive]}
                onPress={() => setLanguage('tamil')}
              >
                <Text style={[styles.langBtnText, language === 'tamil' && styles.langBtnTextActive]}>Tamil</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.langBtn, language === 'english' && styles.langBtnActive]}
                onPress={() => setLanguage('english')}
              >
                <Text style={[styles.langBtnText, language === 'english' && styles.langBtnTextActive]}>English</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.settingRow}>
              <Ionicons name="text-outline" size={20} color={c.text} />
              <Text style={[styles.settingLabel, { color: c.text }]}>Font Size</Text>
            </View>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={[styles.stepperBtn, { backgroundColor: c.searchBg }, fontSize <= MIN_FONT_SIZE && styles.stepperBtnDisabled]}
                onPress={decreaseFontSize}
                disabled={fontSize <= MIN_FONT_SIZE}
              >
                <Ionicons name="remove" size={20} color={c.text} />
              </TouchableOpacity>
              <Text style={[styles.stepperValue, { color: c.text }]}>{fontSize}</Text>
              <TouchableOpacity
                style={[styles.stepperBtn, { backgroundColor: c.searchBg }, fontSize >= MAX_FONT_SIZE && styles.stepperBtnDisabled]}
                onPress={increaseFontSize}
                disabled={fontSize >= MAX_FONT_SIZE}
              >
                <Ionicons name="add" size={20} color={c.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.settingRow}>
              <Ionicons name="reorder-three-outline" size={20} color={c.text} />
              <Text style={[styles.settingLabel, { color: c.text }]}>Thickness</Text>
            </View>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={[styles.stepperBtn, { backgroundColor: c.searchBg }, thickness <= MIN_THICKNESS && styles.stepperBtnDisabled]}
                onPress={decreaseThickness}
                disabled={thickness <= MIN_THICKNESS}
              >
                <Ionicons name="remove" size={20} color={c.text} />
              </TouchableOpacity>
              <Text style={[styles.stepperValue, { color: c.text }]}>{thickness}</Text>
              <TouchableOpacity
                style={[styles.stepperBtn, { backgroundColor: c.searchBg }, thickness >= MAX_THICKNESS && styles.stepperBtnDisabled]}
                onPress={increaseThickness}
                disabled={thickness >= MAX_THICKNESS}
              >
                <Ionicons name="add" size={20} color={c.text} />
              </TouchableOpacity>
            </View>

            <View style={{ height: 20 }} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showSearch} transparent animationType="slide" onRequestClose={() => setShowSearch(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSearch(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.searchSheet, { backgroundColor: c.toolbarBg }]}>
            <View style={styles.sheetHandle} />

            <View style={[styles.searchInputRow, { backgroundColor: c.searchBg, borderColor: c.titleColor }]}>
              <Ionicons name="search" size={20} color={c.titleColor} />
              <TextInput
                style={[styles.searchInput, { color: c.text }]}
                placeholder="Search by song number or title"
                placeholderTextColor={c.sub}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={[styles.clearBtn, { backgroundColor: c.titleColor }]}>
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={searchResults}
              keyExtractor={item => item.songId}
              style={styles.searchResultsList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const index = songsIndex.findIndex(s => s.songId === item.songId);
                return (
                  <TouchableOpacity
                    style={[styles.searchResultRow, { backgroundColor: c.cardBg }]}
                    onPress={() => jumpToSong(index)}
                  >
                    <View style={[styles.searchResultBadge, { backgroundColor: c.titleColor }]}>
                      <Text style={styles.searchResultBadgeText}>{item.songNumber}</Text>
                    </View>
                    <Text style={[styles.searchResultText, { color: c.text }]} numberOfLines={2}>
                      {item.title}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                searchQuery.trim().length > 0 ? (
                  <View style={styles.searchEmptyWrap}>
                    <Ionicons name="musical-notes-outline" size={32} color={c.sub} />
                    <Text style={[styles.searchEmpty, { color: c.sub }]}>No songs found</Text>
                  </View>
                ) : null
              }
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  page: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  topBarActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 4 },
  title: { fontWeight: 'bold' },
  lyrics: {},
  bottomBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 47,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 30,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  navBtn: { padding: 4 },
  pageIndicator: { fontSize: 14, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#999', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 8 },
  settingLabel: { fontSize: 15, fontWeight: '600' },
  langToggle: { flexDirection: 'row', gap: 10 },
  langBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(150,150,150,0.2)', alignItems: 'center' },
  langBtnActive: { backgroundColor: '#3949ab' },
  langBtnText: { fontWeight: '600', color: '#999' },
  langBtnTextActive: { color: '#fff' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: { opacity: 0.4 },
  stepperValue: { fontSize: 18, fontWeight: '700', minWidth: 50, textAlign: 'center' },
  searchSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, height: '70%' },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 30,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16 },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultsList: { flex: 1 },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  searchResultBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  searchResultText: { fontSize: 15, lineHeight: 22, flex: 1 },
  searchEmptyWrap: { alignItems: 'center', marginTop: 60, gap: 10 },
  searchEmpty: { textAlign: 'center', fontSize: 14 },
});

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Share,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SongIndexEntry, getSongById, getSongsIndex } from '../utils/songsSync';
import { getReaderSettings, ReaderLanguage, saveReaderSettings } from '../utils/songReaderSettings';
import { useTheme } from '../utils/ThemeContext';
import { Text } from '../components/AppText';
import { TextInput } from '../components/AppTextInput';
import ThemeToggleIcon from '../components/ThemeToggleIcon';
import { Toast, useToast } from '../components/Toast';
import { READING_CONTENT_MAX_WIDTH } from '../constants/layout';
import { useBreakpoint } from '../hooks/use-breakpoint';

const FAVORITES_KEY = 'tgh_song_favorites';

const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 28;
const MIN_THICKNESS = 300;
const MAX_THICKNESS = 800;
const THICKNESS_STEP = 100;

type LyricsMap = Record<string, { tamil: string; english: string }>;

const normalizeFull = (s: string) =>
  s
    .toLowerCase()
    .replace(/^\d+\.\s*/, '')
    .replace(/[.,!?;:'"()،\-–—]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const stripDuplicateTitle = (lyrics: string, songTitle: string, songNumber?: number) => {
  const paragraphs = lyrics
    .split('\n\n')
    .map(p => p.trim())
    .filter(p => p.length > 0);

  if (paragraphs.length === 0) return lyrics;

  const normalizedTitle = normalizeFull(songTitle);
  const normalizedFirst = normalizeFull(paragraphs[0]);

  if (
    normalizedTitle.length > 0 &&
    (normalizedFirst === normalizedTitle ||
      normalizedFirst.startsWith(normalizedTitle) ||
      normalizedTitle.startsWith(normalizedFirst))
  ) {
    return paragraphs.slice(1).join('\n\n');
  }

  if (songNumber !== undefined) {
    const firstLines = paragraphs[0].split('\n').filter(l => l.trim());
    if (firstLines.length === 1 && new RegExp(`^${songNumber}[.\\s]`).test(firstLines[0].trim())) {
      return paragraphs.slice(1).join('\n\n');
    }
  }

  if (paragraphs.length >= 2) {
    const normalizedSecond = normalizeFull(paragraphs[1]);
    if (normalizedFirst.length > 0 && normalizedSecond.startsWith(normalizedFirst)) {
      return paragraphs.slice(1).join('\n\n');
    }
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

export default function SongReaderScreen() {
  const router = useRouter();
  const { songNumber } = useLocalSearchParams<{ songNumber: string }>();
  const { colors: c, theme, cycleTheme } = useTheme();
  const { isTabletUp } = useBreakpoint();
  const insets = useSafeAreaInsets();
  const { message: toastMessage, opacity: toastOpacity, showToast } = useToast();
  // Reactive (not Dimensions.get() frozen at module scope) so page sizing
  // and horizontal-paging math stay correct across resize/rotation on any
  // platform, not just whatever the screen happened to be at first mount.
  const { width, height } = useWindowDimensions();
  const flatListRef = useRef<FlatList>(null);
  const lyricsMapRef = useRef<LyricsMap>({});
  const loadingSetRef = useRef<Set<string>>(new Set());

  const [songsIndex, setSongsIndex] = useState<SongIndexEntry[]>([]);
  const [lyricsMap, setLyricsMap] = useState<LyricsMap>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [language, setLanguage] = useState<ReaderLanguage>('tamil');
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
    const index = await getSongsIndex();
    setSongsIndex(index);

    const targetIndex = index.findIndex(s => s.songNumber === Number(songNumber));
    setCurrentIndex(targetIndex >= 0 ? targetIndex : 0);

    const favStored = await AsyncStorage.getItem(FAVORITES_KEY);
    if (favStored) setFavorites(JSON.parse(favStored));

    const settings = await getReaderSettings();
    setLanguage(settings.language);
    setFontSize(settings.fontSize);
    setThickness(settings.thickness);
    setSettingsLoaded(true);
  };

  useEffect(() => {
    if (!settingsLoaded) return;
    saveReaderSettings({ language, fontSize, thickness });
  }, [language, fontSize, thickness, settingsLoaded]);

  useEffect(() => {
    if (songsIndex.length > 0 && currentIndex >= 0) {
      flatListRef.current?.scrollToIndex({ index: currentIndex, animated: false });
    }
  }, [songsIndex.length]);

  const ensureLyricsLoaded = async (songId: string) => {
    if (lyricsMapRef.current[songId] || loadingSetRef.current.has(songId)) return;
    loadingSetRef.current.add(songId);
    const song = await getSongById(songId);
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

  const shareSong = async (song: SongIndexEntry) => {
    const lyrics = lyricsMap[song.songId];
    if (!lyrics) return;
    const rawText = language === 'tamil' ? lyrics.tamil : lyrics.english;
    const deduped = stripDuplicateTitle(rawText, song.title, song.songNumber);
    const body = language === 'english' ? capitalizeParagraphs(deduped) : deduped;
    const rawTitle = language === 'english' && song.titleEnglish ? song.titleEnglish : song.title;
    const strippedTitle = rawTitle.replace(/^\d+\.\s*/, '').trim();
    const title = strippedTitle.charAt(0).toUpperCase() + strippedTitle.slice(1);
    const message = `Geethangalum Keerthanaigalum\n\nSong Number: ${song.songNumber}\n\nTitle: ${title}\n\n${body}`;
    // Share.share() has no web implementation — copy the same text that
    // would have been shared instead, with a toast confirmation.
    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(message);
      showToast('📋 Lyrics copied');
      return;
    }
    try {
      await Share.share({ message });
    } catch (e) {}
  };

  const decreaseFontSize = () => setFontSize(prev => Math.max(MIN_FONT_SIZE, prev - 1));
  const increaseFontSize = () => setFontSize(prev => Math.min(MAX_FONT_SIZE, prev + 1));
  const decreaseThickness = () => setThickness(prev => Math.max(MIN_THICKNESS, prev - THICKNESS_STEP));
  const increaseThickness = () => setThickness(prev => Math.min(MAX_THICKNESS, prev + THICKNESS_STEP));

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

  // Prev/Next buttons scrolled the FlatList but never updated currentIndex
  // themselves — they relied entirely on onMomentumScrollEnd below to
  // report the new position, which never fires on react-native-web
  // (confirmed: RNW's ScrollView only wires up onScroll/onTouchMove/onWheel
  // internally — onMomentumScrollEnd and the rest of the momentum-scroll
  // event family are silently dropped as unrecognized props). On web that
  // left currentIndex — and therefore the page indicator, the Prev/Next
  // disabled state, and lyric preloading for the next song — stuck after
  // the very first press, since every subsequent press still read the same
  // stale currentIndex. Setting it directly here, the same way the Bible
  // reader's chapter Prev/Next already does, makes it work regardless of
  // whether the platform's ScrollView reports momentum-scroll completion.
  const goToIndex = (index: number) => {
    if (index < 0 || index >= songsIndex.length) return;
    setCurrentIndex(index);
    flatListRef.current?.scrollToIndex({ index, animated: true });
  };

  // Manual swipes have the same underlying gap as the buttons above (no
  // onMomentumScrollEnd on web) — unlike the buttons, a swipe has no
  // discrete "go to index N" action to hook currentIndex into directly.
  // onScroll *does* fire on web, but continuously during the drag, not just
  // once it settles — this debounces it into a single currentIndex update
  // ~120ms after scrolling stops, approximating what onMomentumScrollEnd
  // would have reported. Native already gets accurate, immediate
  // onMomentumScrollEnd reporting, so this stays web-only rather than
  // risking any change to already-working native behavior.
  const scrollSettleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScroll = Platform.OS === 'web'
    ? (e: { nativeEvent: { contentOffset: { x: number } } }) => {
        const x = e.nativeEvent.contentOffset.x;
        if (scrollSettleRef.current) clearTimeout(scrollSettleRef.current);
        scrollSettleRef.current = setTimeout(() => {
          const index = Math.round(x / width);
          setCurrentIndex(prev => (prev === index ? prev : index));
        }, 120);
      }
    : undefined;

  const SongPage = ({ item }: { item: SongIndexEntry }) => {
    const lyrics = lyricsMap[item.songId];

    if (!lyrics) {
      return (
        <View style={[styles.page, { width, height, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      );
    }

    const rawText = language === 'tamil' ? lyrics.tamil : lyrics.english;
    const deduped = stripDuplicateTitle(rawText, item.title, item.songNumber);
    const text = language === 'english' ? capitalizeParagraphs(deduped) : deduped;

    return (
      <View style={[styles.page, { width, height, backgroundColor: c.bg }]}>
        <FlatList
          data={[text]}
          keyExtractor={() => item.songId}
          contentContainerStyle={isTabletUp ? styles.lyricsContentDesktop : undefined}
          renderItem={() => (
            <View style={[
              { paddingHorizontal: 20, paddingTop: 10, paddingBottom: lyricsPaddingBottom },
              isTabletUp && styles.lyricsColumnDesktop,
            ]}>
              <Text style={[styles.title, { color: c.accent, fontSize: fontSize + 4, fontWeight: thickness >= 600 ? 'bold' : '600' }]}>
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
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      </>
    );
  }

  const currentSong = songsIndex[currentIndex];

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.topBar, { backgroundColor: c.headerBg, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          {/* Mobile web specifically: an explicit close (X) reads
              unambiguously as "exit Reader Mode," where chevron-back could
              be mistaken for song-to-song navigation given the Prev/Next
              controls elsewhere on this same screen. Native and desktop web
              keep the chevron — same router.back() action either way. */}
          <Ionicons name={Platform.OS === 'web' && !isTabletUp ? 'close' : 'chevron-back'} size={26} color={c.text} />
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
            <Ionicons name={Platform.OS === 'web' ? 'copy-outline' : 'share-social-outline'} size={22} color={c.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={cycleTheme} style={styles.iconBtn}>
            <ThemeToggleIcon theme={theme} size={22} color={c.text} />
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
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        onScrollToIndexFailed={() => {}}
        onMomentumScrollEnd={e => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
        onScroll={onScroll}
        scrollEventThrottle={Platform.OS === 'web' ? 16 : undefined}
      />

      <View style={[styles.bottomBar, { backgroundColor: c.headerBg }]}>
        <TouchableOpacity
          disabled={currentIndex === 0}
          onPress={() => goToIndex(currentIndex - 1)}
          style={styles.navBtn}
        >
          <Ionicons name="chevron-back-circle" size={30} color={currentIndex === 0 ? '#555' : c.accent} />
        </TouchableOpacity>
        <Text style={[styles.pageIndicator, { color: c.subtext }]}>
          {currentSong.songNumber} / {songsIndex.length}
        </Text>
        <TouchableOpacity
          disabled={currentIndex === songsIndex.length - 1}
          onPress={() => goToIndex(currentIndex + 1)}
          style={styles.navBtn}
        >
          <Ionicons name="chevron-forward-circle" size={30} color={currentIndex === songsIndex.length - 1 ? '#555' : c.accent} />
        </TouchableOpacity>
      </View>

      <Modal visible={showSettings} transparent animationType="slide" onRequestClose={() => setShowSettings(false)}>
        <TouchableOpacity style={[styles.modalOverlay, isTabletUp && styles.modalOverlayDesktop]} activeOpacity={1} onPress={() => setShowSettings(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.sheet, { backgroundColor: c.headerBg }, isTabletUp && styles.sheetDesktop]}>
            <View style={styles.sheetHandle} />

            <View style={styles.settingRow}>
              <Ionicons name="language-outline" size={20} color={c.text} />
              <Text style={[styles.settingLabel, { color: c.text }]}>Language</Text>
            </View>
            <View style={styles.langToggle}>
              <TouchableOpacity
                style={[styles.langBtn, language === 'tamil' && { backgroundColor: c.accent }]}
                onPress={() => setLanguage('tamil')}
              >
                <Text style={[styles.langBtnText, language === 'tamil' && styles.langBtnTextActive]}>Tamil</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.langBtn, language === 'english' && { backgroundColor: c.accent }]}
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
                style={[styles.stepperBtn, { backgroundColor: c.raised }, fontSize <= MIN_FONT_SIZE && styles.stepperBtnDisabled]}
                onPress={decreaseFontSize}
                disabled={fontSize <= MIN_FONT_SIZE}
              >
                <Ionicons name="remove" size={20} color={c.text} />
              </TouchableOpacity>
              <Text style={[styles.stepperValue, { color: c.text }]}>{fontSize}</Text>
              <TouchableOpacity
                style={[styles.stepperBtn, { backgroundColor: c.raised }, fontSize >= MAX_FONT_SIZE && styles.stepperBtnDisabled]}
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
                style={[styles.stepperBtn, { backgroundColor: c.raised }, thickness <= MIN_THICKNESS && styles.stepperBtnDisabled]}
                onPress={decreaseThickness}
                disabled={thickness <= MIN_THICKNESS}
              >
                <Ionicons name="remove" size={20} color={c.text} />
              </TouchableOpacity>
              <Text style={[styles.stepperValue, { color: c.text }]}>{thickness}</Text>
              <TouchableOpacity
                style={[styles.stepperBtn, { backgroundColor: c.raised }, thickness >= MAX_THICKNESS && styles.stepperBtnDisabled]}
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
        <TouchableOpacity style={[styles.modalOverlay, isTabletUp && styles.modalOverlayDesktop]} activeOpacity={1} onPress={() => setShowSearch(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.searchSheet, { backgroundColor: c.headerBg }, isTabletUp && styles.searchSheetDesktop]}>
            <View style={styles.sheetHandle} />

            <View style={[styles.searchInputRow, { backgroundColor: c.surfaceAlt, borderColor: c.accent }]}>
              <Ionicons name="search" size={20} color={c.accent} />
              <TextInput
                style={[styles.searchInput, { color: c.text }]}
                placeholder="Search by song number or title"
                placeholderTextColor={c.subtext}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={[styles.clearBtn, { backgroundColor: c.accent }]}>
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
                    style={[styles.searchResultRow, { backgroundColor: c.surface }]}
                    onPress={() => jumpToSong(index)}
                  >
                    <View style={[styles.searchResultBadge, { backgroundColor: c.accent }]}>
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
                    <Ionicons name="musical-notes-outline" size={32} color={c.subtext} />
                    <Text style={[styles.searchEmpty, { color: c.subtext }]}>No songs found</Text>
                  </View>
                ) : null
              }
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Toast message={toastMessage} opacity={toastOpacity} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  page: {},
  // paddingTop is overridden inline (insets.top + 12) — see the matching
  // comment in app/(tabs)/bible.tsx.
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  // Comfortable reading-column width on tablet-up instead of lyrics running
  // the full browser-window width.
  lyricsContentDesktop: { alignItems: 'center' },
  lyricsColumnDesktop: { width: '100%', maxWidth: READING_CONTENT_MAX_WIDTH },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  // On tablet-up these become centered floating dialogs instead of
  // full-bleed bottom sheets.
  modalOverlayDesktop: { justifyContent: 'center', alignItems: 'center' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  sheetDesktop: { width: '100%', maxWidth: 440, borderRadius: 24 },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#999', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 8 },
  settingLabel: { fontSize: 15, fontWeight: '600' },
  langToggle: { flexDirection: 'row', gap: 10 },
  langBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(150,150,150,0.2)', alignItems: 'center' },
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
  searchSheetDesktop: { width: '100%', maxWidth: 480, height: '70%', maxHeight: 560, borderRadius: 24 },
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

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { MutableRefObject, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ThemeToggleIcon from '../components/ThemeToggleIcon';
import { BIBLE_ASSETS, BIBLE_VERSIONS, BOOKS, cleanText } from '../utils/bibleData';
import { getMemBibleSettings, saveBibleSettings } from '../utils/bibleSettings';
import { useTheme } from '../utils/ThemeContext';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  c: any;
  fontSize: number;
  setFontSize: (updater: (f: number) => number) => void;
  isBilingual: boolean;
  bilingualEligible: boolean;
  setIsBilingual: (v: boolean) => void;
  secondaryVersion: string;
  setSecondaryVersion: (v: string) => void;
  secondaryVersionRef: MutableRefObject<string>;
  version: string;
  setVersion: (v: string) => void;
  versionRef: MutableRefObject<string>;
  selectedBook: any;
  selectedChapter: number;
  setSecondaryVerses: (v: any[]) => void;
  setPrimaryVerses: (v: any[]) => void;
  isEnglish: boolean;
}

function SettingsModal({
  visible, onClose, c, fontSize, setFontSize,
  isBilingual, bilingualEligible, setIsBilingual,
  secondaryVersion, setSecondaryVersion, secondaryVersionRef,
  version, setVersion, versionRef,
  selectedBook, selectedChapter, setSecondaryVerses, setPrimaryVerses, isEnglish,
}: SettingsModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: c.surface }]}>
          <Text style={[styles.modalTitle, { color: c.text }]}>⚙️ Reading Settings</Text>
          <Text style={[styles.settingLabel, { color: c.subtext }]}>Font Size</Text>
          <View style={styles.fontSizeRow}>
            <TouchableOpacity style={[styles.fontBtn, { borderColor: c.accent }]} onPress={() => { const v = Math.max(12, fontSize - 2); setFontSize(() => v); saveBibleSettings({ fontSize: v }); }}>
              <Text style={[styles.fontBtnText, { color: c.accent }]}>A-</Text>
            </TouchableOpacity>
            <Text style={[styles.fontSizeValue, { color: c.text }]}>{fontSize}px</Text>
            <TouchableOpacity style={[styles.fontBtn, { borderColor: c.accent }]} onPress={() => { const v = Math.min(30, fontSize + 2); setFontSize(() => v); saveBibleSettings({ fontSize: v }); }}>
              <Text style={[styles.fontBtnText, { color: c.accent }]}>A+</Text>
            </TouchableOpacity>
          </View>
          {bilingualEligible && (
            <>
              <Text style={[styles.settingLabel, { color: c.subtext }]}>Reading Mode</Text>
              <View style={styles.modeRow}>
                <TouchableOpacity
                  style={[styles.modeBtn, { backgroundColor: c.raised }, !isBilingual && { backgroundColor: c.accent }]}
                  onPress={() => setIsBilingual(false)}
                >
                  <Text style={{ color: isBilingual ? c.subtext : '#fff', fontWeight: '600', fontSize: 13 }}>Single</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeBtn, { backgroundColor: c.raised }, isBilingual && { backgroundColor: c.accent }]}
                  onPress={() => setIsBilingual(true)}
                >
                  <Text style={{ color: isBilingual ? '#fff' : c.subtext, fontWeight: '600', fontSize: 13 }}>Bilingual</Text>
                </TouchableOpacity>
              </View>
              {isBilingual && (
                <>
                  <Text style={[styles.settingLabel, { color: c.subtext }]}>Tamil Version</Text>
                  <View style={styles.versionPickRow}>
                    {BIBLE_VERSIONS.filter(v => v.lang === 'Tamil').map(v => (
                      <TouchableOpacity
                        key={v.code}
                        style={[
                          styles.versionPick,
                          { backgroundColor: c.raised },
                          version === v.code && { backgroundColor: c.accent },
                        ]}
                        onPress={() => {
                          setVersion(v.code);
                          versionRef.current = v.code;
                          saveBibleSettings({ primaryVersion: v.code });
                          if (selectedBook && selectedChapter) {
                            const priData = BIBLE_ASSETS[v.code]?.[selectedBook.id];
                            if (priData) setPrimaryVerses(priData[String(selectedChapter)] || []);
                          }
                        }}
                      >
                        <Text style={{ color: version === v.code ? '#fff' : c.subtext, fontSize: 11, fontWeight: '600' }}>{v.short}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={[styles.settingLabel, { color: c.subtext }]}>English Version</Text>
                  <View style={styles.versionPickRow}>
                    {BIBLE_VERSIONS.filter(v => v.lang === 'English').map(v => (
                      <TouchableOpacity
                        key={v.code}
                        style={[
                          styles.versionPick,
                          { backgroundColor: c.raised },
                          secondaryVersion === v.code && { backgroundColor: c.accent },
                        ]}
                        onPress={() => {
                          setSecondaryVersion(v.code);
                          secondaryVersionRef.current = v.code;
                          saveBibleSettings({ secondaryVersion: v.code });
                          if (selectedBook && selectedChapter) {
                            const secData = BIBLE_ASSETS[v.code]?.[selectedBook.id];
                            if (secData) setSecondaryVerses(secData[String(selectedChapter)] || []);
                          }
                        }}
                      >
                        <Text style={{ color: secondaryVersion === v.code ? '#fff' : c.subtext, fontSize: 11, fontWeight: '600' }}>{v.short}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </>
          )}
          <TouchableOpacity style={[styles.closeBtn, { backgroundColor: c.accent }]} onPress={onClose}>
            <Text style={styles.closeBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

interface BookSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  c: any;
  bookModalTestament: 'OT' | 'NT';
  setBookModalTestament: (t: 'OT' | 'NT') => void;
  isEnglish: boolean;
  isBilingual: boolean;
  OTBooks: any[];
  NTBooks: any[];
  onSelectBook: (book: any) => void;
}

function BookSelectorModal({
  visible, onClose, c, bookModalTestament, setBookModalTestament,
  isEnglish, isBilingual, OTBooks, NTBooks, onSelectBook,
}: BookSelectorModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.bookModalCard, { backgroundColor: c.surface }]}>
          <View style={[styles.bookModalHeader, { backgroundColor: c.headerBg }]}>
            <Text style={[styles.bookModalTitle, { color: c.text }]}>Select Book</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={c.text} />
            </TouchableOpacity>
          </View>
          <View style={[styles.testamentRow, { backgroundColor: c.surface }]}>
            <TouchableOpacity style={[styles.testamentBtn, bookModalTestament === 'OT' && { backgroundColor: c.accent }]} onPress={() => setBookModalTestament('OT')}>
              <Text style={[styles.testamentText, { color: bookModalTestament === 'OT' ? '#fff' : c.subtext }]}>
                {isEnglish ? 'Old Testament' : 'பழைய ஏற்பாடு'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.testamentBtn, bookModalTestament === 'NT' && { backgroundColor: c.accent }]} onPress={() => setBookModalTestament('NT')}>
              <Text style={[styles.testamentText, { color: bookModalTestament === 'NT' ? '#fff' : c.subtext }]}>
                {isEnglish ? 'New Testament' : 'புதிய ஏற்பாடு'}
              </Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={bookModalTestament === 'OT' ? OTBooks : NTBooks}
            key={`modal-books-${bookModalTestament}`}
            keyExtractor={item => item.id.toString()}
            numColumns={2}
            contentContainerStyle={{ padding: 12 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.bookCard, { backgroundColor: c.bg, borderWidth: 1, borderColor: c.divider }]}
                onPress={() => onSelectBook(item)}
              >
                <Text style={[styles.bookName, { color: c.text }]}>
                  {isBilingual ? item.name : isEnglish ? item.name : item.tamil}
                </Text>
                {isBilingual && <Text style={[styles.bookTamil, { color: c.subtext }]}>{item.tamil}</Text>}
                <Text style={[styles.bookChapters, { color: c.accent }]}>{item.chapters} chapters</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

export default function BibleReaderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    bookId: string;
    chapter: string;
    version: string;
    isBilingual: string;
    secondaryVersion: string;
  }>();
  const { colors: c, theme, cycleTheme } = useTheme();
  const insets = useSafeAreaInsets();

  const [selectedBook, setSelectedBook] = useState<any>(BOOKS.find(b => b.id === Number(params.bookId)));
  const [selectedChapter, setSelectedChapter] = useState(Number(params.chapter));
  const [version, setVersion] = useState(params.version || 'TAMOVR');
  const versionRef = useRef(params.version || 'TAMOVR');
  const [isBilingual, setIsBilingual] = useState(params.isBilingual === '1');
  const bilingualEligible = params.isBilingual === '1';
  const [secondaryVersion, setSecondaryVersion] = useState(
    () => getMemBibleSettings().secondaryVersion
  );
  const secondaryVersionRef = useRef(getMemBibleSettings().secondaryVersion);
  const [primaryVerses, setPrimaryVerses] = useState<any[]>([]);
  const [secondaryVerses, setSecondaryVerses] = useState<any[]>([]);
  const [fontSize, setFontSize] = useState(() => getMemBibleSettings().fontSize);
  const [activeVerse, setActiveVerse] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookModalTestament, setBookModalTestament] = useState<'OT' | 'NT'>('OT');
  const versesListRef = useRef<FlatList>(null);
  const verseBarRef = useRef<ScrollView>(null);
  const pendingScrollRef = useRef<number | null>(null);
  const VERSE_BTN_WIDTH = 40;

  const isEnglish = BIBLE_VERSIONS.find(v => v.code === version)?.lang === 'English';
  const OTBooks = BOOKS.filter(b => b.id <= 39);
  const NTBooks = BOOKS.filter(b => b.id >= 40);

  // Initial chapter load — values from memCache are synchronously correct, no async wait needed
  useEffect(() => {
    loadChapterData(selectedBook, selectedChapter, versionRef.current, isBilingual, secondaryVersionRef.current);
  }, []);

  // Defensive re-fetch: catches any edge case where secondary verses didn't load
  useEffect(() => {
    if (!isBilingual || isEnglish || !secondaryVersion || !selectedBook) return;
    const secData = BIBLE_ASSETS[secondaryVersion]?.[selectedBook.id];
    if (secData) setSecondaryVerses(secData[String(selectedChapter)] || []);
  }, [secondaryVersion, selectedChapter, selectedBook?.id, isBilingual]);

  // Defensive re-fetch: catches any edge case where primary (Tamil) verses didn't load
  useEffect(() => {
    if (!isBilingual || isEnglish || !version || !selectedBook) return;
    const priData = BIBLE_ASSETS[version]?.[selectedBook.id];
    if (priData) setPrimaryVerses(priData[String(selectedChapter)] || []);
  }, [version, selectedChapter, selectedBook?.id, isBilingual]);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showBookModal) { setShowBookModal(false); return true; }
      router.back();
      return true;
    });
    return () => handler.remove();
  }, [showBookModal]);

  const loadChapterData = (book: any, chapter: number, ver: string, bilingual: boolean, secVer: string) => {
    const versionIsEnglish = BIBLE_VERSIONS.find(v => v.code === ver)?.lang === 'English';
    try {
      const bookData = BIBLE_ASSETS[ver]?.[book.id];
      if (bookData) setPrimaryVerses(bookData[String(chapter)] || []);
      if (bilingual && !versionIsEnglish) {
        const secData = BIBLE_ASSETS[secVer]?.[book.id];
        if (secData) setSecondaryVerses(secData[String(chapter)] || []);
        else setSecondaryVerses([]);
      } else {
        setSecondaryVerses([]);
      }
      setSelectedVerses(new Set());
    setActiveVerse(0);
      pendingScrollRef.current = null;
      setTimeout(() => {
        versesListRef.current?.scrollToOffset({ offset: 0, animated: false });
        verseBarRef.current?.scrollTo({ x: 0, animated: false });
      }, 100);
    } catch (e) {}
  };

  const navigateChapter = (dir: 'next' | 'prev') => {
    if (!selectedBook) return;
    const totalChapters = selectedBook.chapters;
    let newBook = selectedBook;
    let newChapter = selectedChapter;
    if (dir === 'next') {
      if (selectedChapter < totalChapters) {
        newChapter = selectedChapter + 1;
      } else {
        const nb = BOOKS.find(b => b.id === selectedBook.id + 1);
        if (!nb) return;
        newBook = nb;
        newChapter = 1;
      }
    } else {
      if (selectedChapter > 1) {
        newChapter = selectedChapter - 1;
      } else {
        const pb = BOOKS.find(b => b.id === selectedBook.id - 1);
        if (!pb) return;
        newBook = pb;
        newChapter = pb.chapters;
      }
    }
    setSelectedBook(newBook);
    setSelectedChapter(newChapter);
    loadChapterData(newBook, newChapter, versionRef.current, isBilingual, secondaryVersionRef.current);
  };

  const syncVerseBar = (idx: number) => {
    const barX = idx * VERSE_BTN_WIDTH - 120;
    verseBarRef.current?.scrollTo({ x: Math.max(0, barX), animated: false });
  };

  const jumpToVerse = (verseIdx: number) => {
    setActiveVerse(verseIdx);
    syncVerseBar(verseIdx);
    pendingScrollRef.current = verseIdx;
    try {
      versesListRef.current?.scrollToIndex({ index: verseIdx, animated: true, viewPosition: 0 });
    } catch (e) {}
  };

  const handleScrollToIndexFailed = (info: { index: number; highestMeasuredFrameIndex: number }) => {
    const idx = info.index;
    versesListRef.current?.scrollToIndex({ index: info.highestMeasuredFrameIndex, animated: false });
    setTimeout(() => {
      if (pendingScrollRef.current === idx) {
        versesListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0 });
      }
    }, 200);
  };

  const [selectedVerses, setSelectedVerses] = useState<Set<number>>(new Set());

  const toggleVerseSelection = (verseNum: number) => {
    setSelectedVerses(prev => {
      const next = new Set(prev);
      if (next.has(verseNum)) next.delete(verseNum);
      else next.add(verseNum);
      return next;
    });
  };

  const clearSelection = () => setSelectedVerses(new Set());

  const copyVerse = async (verseNum: number, text: string) => {
    const bookName = isEnglish ? selectedBook?.name : selectedBook?.tamil;
    const copyText = `${bookName} ${selectedChapter}:${verseNum} - ${cleanText(text)}`;
    await Clipboard.setStringAsync(copyText);
    ToastAndroid.show('Verse copied!', ToastAndroid.SHORT);
  };

  const copySelectedVerses = async () => {
    const sorted = Array.from(selectedVerses).sort((a, b) => a - b);
    const isBilingualCopy = isBilingual && !isEnglish && secondaryVerses.length > 0;

    const blocks = sorted.map(vNum => {
      if (isBilingualCopy) {
        const bookName = selectedBook?.tamil;
        const primaryVerse = primaryVerses.find(v => v.verse === vNum);
        const secVerse = secondaryVerses.find(v => v.verse === vNum);
        const ref = `${bookName} ${selectedChapter}:${vNum}`;
        const tamilText = cleanText(primaryVerse?.text || '');
        const engText = cleanText(secVerse?.text || '');
        return `${ref}\n${tamilText}${engText ? `\n${engText}` : ''}`;
      } else {
        const bookName = isEnglish ? selectedBook?.name : selectedBook?.tamil;
        const verse = primaryVerses.find(v => v.verse === vNum);
        return `${bookName} ${selectedChapter}:${vNum}\n${cleanText(verse?.text || '')}`;
      }
    });

    await Clipboard.setStringAsync(blocks.join('\n\n'));
    ToastAndroid.show(`${sorted.length} verse${sorted.length > 1 ? 's' : ''} copied!`, ToastAndroid.SHORT);
    clearSelection();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 60 && Math.abs(g.dy) < 30 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -80) navigateChapter('next');
        else if (g.dx > 80) navigateChapter('prev');
      },
    })
  ).current;

  const showBilingual = isBilingual && !isEnglish && secondaryVerses.length > 0;
  const maxVerses = Math.max(primaryVerses.length, showBilingual ? secondaryVerses.length : 0);
  const primaryVersionInfo = BIBLE_VERSIONS.find(v => v.code === version);
  const secVersionInfo = BIBLE_VERSIONS.find(v => v.code === secondaryVersion);
  const totalChapters = selectedBook?.chapters || 1;
  const bookDisplayName = isBilingual ? selectedBook?.name : isEnglish ? selectedBook?.name : selectedBook?.tamil;
  const isFirstChapterFirstBook = selectedChapter === 1 && selectedBook?.id === 1;
  const isLastChapterLastBook = selectedChapter === totalChapters && selectedBook?.id === 66;

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]} {...panResponder.panHandlers}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { backgroundColor: c.headerBg, paddingRight: 16 + insets.right }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <TouchableOpacity onPress={() => {
            setBookModalTestament(selectedBook?.id <= 39 ? 'OT' : 'NT');
            setShowBookModal(true);
          }}>
            <Text style={[styles.headerTitle, { color: c.text, textDecorationLine: 'underline' }]} numberOfLines={1}>
              {bookDisplayName} {selectedChapter}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.headerSubtitle, { color: c.subtext }]}>
            {showBilingual ? `${primaryVersionInfo?.short} + ${secVersionInfo?.short}` : primaryVersionInfo?.short} • tap name to change book
          </Text>
        </View>
        <TouchableOpacity onPress={() => { const v = Math.max(12, fontSize - 2); setFontSize(() => v); saveBibleSettings({ fontSize: v }); }} style={styles.fontQuickBtn}>
          <Text style={[styles.fontQuickText, { color: c.text }]}>A-</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { const v = Math.min(30, fontSize + 2); setFontSize(() => v); saveBibleSettings({ fontSize: v }); }} style={styles.fontQuickBtn}>
          <Text style={[styles.fontQuickText, { color: c.text }]}>A+</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={cycleTheme} style={styles.themeBtn}>
          <ThemeToggleIcon theme={theme} size={20} color={c.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.settingsBtn}>
          <Ionicons name="settings-outline" size={20} color={c.text} />
        </TouchableOpacity>
      </View>

      <View style={[styles.verseJumpBar, { backgroundColor: c.surface, borderBottomColor: c.divider }]}>
        <ScrollView ref={verseBarRef} horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 8, gap: 4 }}>
          {primaryVerses.map((_, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.verseJumpBtn, { width: VERSE_BTN_WIDTH - 4 }, activeVerse === i && { backgroundColor: c.accent }]}
              onPress={() => jumpToVerse(i)}
            >
              <Text style={[styles.verseJumpText, { color: activeVerse === i ? '#fff' : c.accent }]}>{i + 1}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {selectedVerses.size > 0 && (
        <View style={[styles.selectionBar, { backgroundColor: c.accent }]}>
          <TouchableOpacity onPress={clearSelection} style={styles.selectionClear}>
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.selectionCount}>{selectedVerses.size} verse{selectedVerses.size > 1 ? 's' : ''} selected</Text>
          <TouchableOpacity onPress={copySelectedVerses} style={styles.selectionCopy}>
            <Ionicons name="copy-outline" size={18} color="#fff" />
            <Text style={styles.selectionCopyText}>Copy</Text>
          </TouchableOpacity>
        </View>
      )}

      {showBilingual ? (
        <FlatList
          ref={versesListRef}
          data={Array.from({ length: maxVerses }, (_, i) => i)}
          key="bilingual"
          keyExtractor={i => i.toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          onViewableItemsChanged={({ viewableItems }) => {
            if (viewableItems.length > 0) {
              const idx = viewableItems[0].index ?? 0;
              setActiveVerse(idx);
              syncVerseBar(idx);
            }
          }}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          onScrollToIndexFailed={handleScrollToIndexFailed}
          renderItem={({ item: i }) => {
            const verseNum = i + 1;
            const isSelected = selectedVerses.has(verseNum);
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => toggleVerseSelection(verseNum)}
                onLongPress={() => toggleVerseSelection(verseNum)}
              >
                <View style={[
                  styles.bilingualVerseBlock,
                  { borderColor: isSelected ? c.accent : c.divider },
                  isSelected && { borderWidth: 2, backgroundColor: c.accent + '15' },
                ]}>
                  <View style={[styles.verseNumBadge, { backgroundColor: isSelected ? c.accent : c.accent }]}>
                    <Text style={styles.verseNumBadgeText}>{verseNum}</Text>
                    {isSelected && <Ionicons name="checkmark" size={13} color="#fff" />}
                  </View>
                  {primaryVerses[i] && (
                    <View style={[styles.tamilSection, { backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.divider }]}>
                      <Text style={[styles.versionTag, { color: c.accent }]}>{primaryVersionInfo?.short}</Text>
                      <Text style={{ fontSize, color: c.text, lineHeight: fontSize * 1.7 }}>{cleanText(primaryVerses[i]?.text)}</Text>
                    </View>
                  )}
                  {secondaryVerses[i] && (
                    <View style={[styles.englishSection, { backgroundColor: c.bg }]}>
                      <Text style={[styles.versionTag, { color: c.subtext }]}>{secVersionInfo?.short}</Text>
                      <Text style={{ fontSize, color: c.text, lineHeight: fontSize * 1.7 }}>{cleanText(secondaryVerses[i]?.text)}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      ) : (
        <FlatList
          ref={versesListRef}
          data={primaryVerses}
          key="single"
          keyExtractor={(_, i) => i.toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          onViewableItemsChanged={({ viewableItems }) => {
            if (viewableItems.length > 0) {
              const idx = viewableItems[0].index ?? 0;
              setActiveVerse(idx);
              syncVerseBar(idx);
            }
          }}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          onScrollToIndexFailed={handleScrollToIndexFailed}
          renderItem={({ item }) => {
            const isSelected = selectedVerses.has(item.verse);
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => toggleVerseSelection(item.verse)}
                onLongPress={() => toggleVerseSelection(item.verse)}
              >
                {isSelected ? (
                  <View style={{
                    marginBottom: 12,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: c.accent,
                    backgroundColor: c.accent + '15',
                  }}>
                    <View style={{
                      backgroundColor: c.accent,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>{item.verse}</Text>
                      <Ionicons name="checkmark" size={13} color="#fff" />
                    </View>
                    <View style={{ padding: 12 }}>
                      <Text style={{ fontSize, color: c.text, lineHeight: fontSize * 1.7 }}>{cleanText(item.text)}</Text>
                    </View>
                  </View>
                ) : (
                  <View style={[styles.verseRow, { borderBottomColor: c.divider }]}>
                    <Text style={[styles.verseNumber, { fontSize: fontSize - 3, color: c.accent }]}>{item.verse}</Text>
                    <Text style={[styles.verseText, { fontSize, color: c.text, lineHeight: fontSize * 1.7 }]}>{cleanText(item.text)}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      <View style={[styles.bottomNav, { backgroundColor: c.surface, borderTopColor: c.divider, paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={[styles.navBtn, isFirstChapterFirstBook && styles.navBtnDisabled]}
          onPress={() => !isFirstChapterFirstBook && navigateChapter('prev')}>
          <Ionicons name="chevron-back" size={20} color={isFirstChapterFirstBook ? '#ccc' : c.accent} />
          <Text style={[styles.navBtnText, { color: isFirstChapterFirstBook ? '#ccc' : c.accent }]}>
            {isEnglish || isBilingual ? 'Previous' : 'முந்தையது'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navChapterInfo} onPress={() => router.back()}>
          <Text style={[styles.navChapterText, { color: c.text }]}>Ch {selectedChapter}/{totalChapters}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navBtnRight, isLastChapterLastBook && styles.navBtnDisabled]}
          onPress={() => !isLastChapterLastBook && navigateChapter('next')}>
          <Text style={[styles.navBtnText, { color: isLastChapterLastBook ? '#ccc' : c.accent }]}>
            {isEnglish || isBilingual ? 'Next' : 'அடுத்தது'}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={isLastChapterLastBook ? '#ccc' : c.accent} />
        </TouchableOpacity>
      </View>

      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        c={c}
        fontSize={fontSize}
        setFontSize={setFontSize}
        isBilingual={isBilingual}
        bilingualEligible={bilingualEligible}
        setIsBilingual={setIsBilingual}
        secondaryVersion={secondaryVersion}
        setSecondaryVersion={setSecondaryVersion}
        secondaryVersionRef={secondaryVersionRef}
        version={version}
        setVersion={setVersion}
        versionRef={versionRef}
        selectedBook={selectedBook}
        selectedChapter={selectedChapter}
        setSecondaryVerses={setSecondaryVerses}
        setPrimaryVerses={setPrimaryVerses}
        isEnglish={isEnglish}
      />

      <BookSelectorModal
        visible={showBookModal}
        onClose={() => setShowBookModal(false)}
        c={c}
        bookModalTestament={bookModalTestament}
        setBookModalTestament={setBookModalTestament}
        isEnglish={isEnglish}
        isBilingual={isBilingual}
        OTBooks={OTBooks}
        NTBooks={NTBooks}
        onSelectBook={(book) => {
          setShowBookModal(false);
          setSelectedBook(book);
          setSelectedChapter(1);
          loadChapterData(book, 1, versionRef.current, isBilingual, secondaryVersionRef.current);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 50, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 16, fontWeight: 'bold' },
  headerSubtitle: { fontSize: 11, marginTop: 2 },
  backBtn: { padding: 4 },
  themeBtn: { padding: 4 },
  settingsBtn: { padding: 4 },
  fontQuickBtn: { backgroundColor: 'rgba(150,150,150,0.2)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4 },
  fontQuickText: { fontWeight: 'bold', fontSize: 11 },
  verseJumpBar: { borderBottomWidth: 1, paddingVertical: 6 },
  verseJumpBtn: { height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  verseJumpText: { fontSize: 13, fontWeight: '700' },
  selectionBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  selectionClear: { padding: 4 },
  selectionCount: { flex: 1, color: '#fff', fontWeight: '700', fontSize: 14 },
  selectionCopy: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  selectionCopyText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  verseNumberWrap: { alignItems: 'center', minWidth: 26, marginTop: 2, gap: 2 },
  verseRow: { flexDirection: 'row', marginBottom: 12, gap: 8, paddingBottom: 12, borderBottomWidth: 0.5, alignItems: 'flex-start' },
  verseNumber: { fontWeight: 'bold', minWidth: 26, marginTop: 2 },
  verseText: { flex: 1 },
  bilingualVerseBlock: { marginBottom: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 1, elevation: 2 },
  verseNumBadge: { paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  verseNumBadgeText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  longPressHint: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
  tamilSection: { padding: 12 },
  englishSection: { padding: 12 },
  versionTag: { fontSize: 10, fontWeight: 'bold', marginBottom: 4, textTransform: 'uppercase' },
  bottomNav: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingVertical: 14, paddingHorizontal: 20 },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  navBtnRight: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'flex-end' },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: { fontSize: 13, fontWeight: '600' },
  navChapterInfo: { flex: 1, alignItems: 'center' },
  navChapterText: { fontSize: 14, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  settingLabel: { fontSize: 13, fontWeight: '600', marginBottom: 10, marginTop: 16 },
  fontSizeRow: { flexDirection: 'row', alignItems: 'center', gap: 16, justifyContent: 'center' },
  fontBtn: { borderWidth: 2, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  fontBtnText: { fontWeight: 'bold', fontSize: 16 },
  fontSizeValue: { fontSize: 18, fontWeight: 'bold', minWidth: 60, textAlign: 'center' },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  versionPickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  versionPick: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  closeBtn: { borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20 },
  closeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  bookModalCard: { flex: 1, marginTop: 60, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  bookModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 20 },
  bookModalTitle: { fontSize: 18, fontWeight: 'bold' },
  testamentRow: { flexDirection: 'row', padding: 8, gap: 8 },
  testamentBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  testamentText: { fontSize: 12, fontWeight: '600' },
  bookCard: { flex: 1, margin: 6, borderRadius: 12, padding: 14, elevation: 2 },
  bookName: { fontSize: 13, fontWeight: 'bold' },
  bookTamil: { fontSize: 11, marginTop: 2 },
  bookChapters: { fontSize: 10, marginTop: 6, fontWeight: '600' },
});

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ReactNode, useEffect, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../components/AppText';
import ThemeToggleIcon from '../../components/ThemeToggleIcon';
import { BIBLE_VERSIONS, BOOKS } from '../../utils/bibleData';
import { getMemBibleSettings, saveBibleSettings } from '../../utils/bibleSettings';
import { useTheme } from '../../utils/ThemeContext';
import { ThemeName } from '../../utils/theme';

// Fixed hex (not theme tokens), same pattern as READING_SECTIONS in reading.tsx.
const TAMIL_ACCENT = '#ef4444';
const TAMIL_ICON_COLORS = ['#7f1d2e', '#ef4444'];
const ENGLISH_ACCENT = '#22c55e';
const ENGLISH_ICON_COLOR = '#16a34a';

interface BilingualCardStyle {
  gradient: [string, string, string];
  // Dark-only extras: a warm glow overlay laid on top of `gradient`, a subtle border, a
  // tinted shadow, gradient-filled chips (vs. flat color), and a distinct dot-pattern tint.
  // Left undefined for light/sepia so their look is unchanged.
  glowGradient?: [string, string, string];
  glowLocations?: [number, number, number];
  cardBorder?: string;
  shadowColor?: string;
  text: string;
  subtext: string;
  chipBackBg: string;
  chipBackGradient?: [string, string];
  chipBackText: string;
  chipFrontBg: string;
  chipFrontGradient?: [string, string];
  chipFrontText: string;
  swapBg: string;
  swapIcon: string;
  buttonBg: string;
  buttonText: string;
  buttonIconBg: string;
  buttonIconColor: string;
  decoration: string;
  dotColor?: string;
}

// The Bilingual card is a deliberate exception to the rest of this screen: instead of
// tinting the theme's own surface color (which read as a washed-out, muddy tint against
// light/sepia surfaces), each theme gets its own self-contained, high-contrast, "premium"
// look — a base gradient plus a second glow gradient layered on top (glowGradient),
// concentrated toward the bottom-right CTA corner via glowLocations, a subtle border
// (cardBorder), and gradient-filled chips (chipBackGradient/chipFrontGradient) for a 3D,
// stacked-card feel. Each theme's glow/border/chip colors are its own: brighter royal-blue
// "sheen" for light, warm orange glow for dark, and amber "sunlit parchment" for sepia —
// same layered technique, different palette per theme.
const BILINGUAL_STYLES: Record<ThemeName, BilingualCardStyle> = {
  light: {
    // Royal-blue base with a soft light-blue "sheen" glowing in from the bottom-right,
    // like light catching a glossy surface — brighter rather than warmer, to suit light
    // mode's cleaner, airier feel.
    gradient: ['#152a6b', '#1e3fae', '#3b5bdb'],
    glowGradient: ['rgba(147,197,253,0)', 'rgba(147,197,253,0)', 'rgba(147,197,253,0.4)'],
    glowLocations: [0, 0.5, 1],
    cardBorder: 'rgba(255,255,255,0.18)',
    shadowColor: '#1e3fae',
    text: '#ffffff',
    subtext: 'rgba(255,255,255,0.85)',
    chipBackBg: '#d1479f',
    chipBackGradient: ['#f472b6', '#c23a8c'],
    chipBackText: '#ffffff',
    chipFrontBg: '#1b1440',
    chipFrontGradient: ['#2d2160', '#150f38'],
    chipFrontText: '#ffffff',
    swapBg: '#ffffff',
    swapIcon: '#1e3fae',
    buttonBg: '#ffffff',
    buttonText: '#1e3fae',
    buttonIconBg: '#1e3fae',
    buttonIconColor: '#ffffff',
    decoration: 'rgba(255,255,255,0.16)',
    dotColor: 'rgba(255,255,255,0.32)',
  },
  dark: {
    // Deep purple-to-burgundy base that blends into the dark background, with a warm
    // red/orange glow layered on top (via glowGradient below) concentrated toward the
    // bottom-right corner, near the CTA — a premium, moody look rather than a flat
    // saturated gradient.
    gradient: ['#1b0f2e', '#241132', '#2c1330'],
    glowGradient: ['rgba(255,90,45,0)', 'rgba(255,90,45,0)', 'rgba(255,74,58,0.45)'],
    glowLocations: [0, 0.5, 1],
    cardBorder: 'rgba(255,255,255,0.08)',
    shadowColor: '#ff6a2b',
    text: '#ffffff',
    subtext: 'rgba(255,255,255,0.85)',
    chipBackBg: '#c2447a',
    chipBackGradient: ['#e0508f', '#b52e68'],
    chipBackText: '#ffffff',
    chipFrontBg: '#241b47',
    chipFrontGradient: ['#332048', '#1c0f2b'],
    chipFrontText: '#ffffff',
    swapBg: '#ffffff',
    swapIcon: '#2b1740',
    buttonBg: '#ff6a2b',
    buttonText: '#ffffff',
    buttonIconBg: '#ffffff',
    buttonIconColor: '#ff6a2b',
    decoration: 'rgba(255,255,255,0.14)',
    dotColor: 'rgba(255,255,255,0.22)',
  },
  sepia: {
    // Warm parchment-to-leather base with an amber glow gathering toward the bottom-right,
    // like sunlight catching an old book cover — matches the gold/brown accent already used
    // for its Start Reading button.
    gradient: ['#eccf93', '#d9a441', '#a3672c'],
    glowGradient: ['rgba(196,120,40,0)', 'rgba(196,120,40,0)', 'rgba(139,69,19,0.4)'],
    glowLocations: [0, 0.5, 1],
    cardBorder: 'rgba(139,69,19,0.25)',
    shadowColor: '#a3672c',
    text: '#3a2213',
    subtext: 'rgba(58,34,19,0.72)',
    chipBackBg: '#ffffff',
    chipBackGradient: ['#fffaf0', '#efdcb0'],
    chipBackText: '#3a2213',
    chipFrontBg: '#3a2213',
    chipFrontGradient: ['#4a2f1a', '#2b1810'],
    chipFrontText: '#f4ecd8',
    swapBg: '#ffffff',
    swapIcon: '#a3672c',
    buttonBg: '#8b4513',
    buttonText: '#ffffff',
    buttonIconBg: 'rgba(255,255,255,0.3)',
    buttonIconColor: '#8b4513',
    decoration: 'rgba(58,34,19,0.14)',
    dotColor: 'rgba(58,34,19,0.24)',
  },
};

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  c: any;
  fontSize: number;
  setFontSize: (updater: (f: number) => number) => void;
}

function SettingsModal({ visible, onClose, c, fontSize, setFontSize }: SettingsModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: c.surface }]}>
          <Text style={[styles.modalTitle, { color: c.text }]}>⚙️ Reading Settings</Text>
          <Text style={[styles.settingLabel, { color: c.subtext }]}>Font Size</Text>
          <View style={styles.fontSizeRow}>
            <TouchableOpacity style={[styles.fontBtn, { borderColor: c.accent }]} onPress={() => setFontSize(f => Math.max(12, f - 2))}>
              <Text style={[styles.fontBtnText, { color: c.accent }]}>A-</Text>
            </TouchableOpacity>
            <Text style={[styles.fontSizeValue, { color: c.text }]}>{fontSize}px</Text>
            <TouchableOpacity style={[styles.fontBtn, { borderColor: c.accent }]} onPress={() => setFontSize(f => Math.min(30, f + 2))}>
              <Text style={[styles.fontBtnText, { color: c.accent }]}>A+</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.closeBtn, { backgroundColor: c.accent }]} onPress={onClose}>
            <Text style={styles.closeBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

interface Props {
  headerTitle?: ReactNode;
}

export default function BibleScreen({ headerTitle }: Props) {
  const router = useRouter();
  const { colors: c, theme, cycleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  // Fixed item width (rather than flex:1) so a partially-filled last row — e.g. chapters
  // 26-27 of a 27-chapter book — keeps the same box size instead of stretching to fill it.
  const CHAPTER_COLUMNS = 5;
  const chapterItemWidth = (windowWidth - 12 * 2 - CHAPTER_COLUMNS * (4 * 2)) / CHAPTER_COLUMNS;
  const [version, setVersion] = useState(() => getMemBibleSettings().version);
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const [view, setView] = useState<'home' | 'books' | 'chapters'>('home');
  const [testament, setTestament] = useState<'OT' | 'NT'>('OT');
  const [fontSize, setFontSize] = useState(() => getMemBibleSettings().fontSize);
  const [isBilingual, setIsBilingual] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const isEnglish = BIBLE_VERSIONS.find(v => v.code === version)?.lang === 'English';

  const selectVersion = (v: string) => {
    setVersion(v);
    saveBibleSettings({ version: v });
  };

  useEffect(() => {
    const backAction = () => {
      if (view === 'chapters') { setView('books'); return true; }
      if (view === 'books') { setView('home'); setIsBilingual(false); return true; }
      return false;
    };
    const handler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => handler.remove();
  }, [view]);

  const openChapter = (book: any, chapter: number) => {
    router.push({
      pathname: '/bible-reader',
      params: {
        bookId: String(book.id),
        chapter: String(chapter),
        version,
        isBilingual: isBilingual ? '1' : '0',
        secondaryVersion: getMemBibleSettings().secondaryVersion,
      },
    });
  };

  const OTBooks = BOOKS.filter(b => b.id <= 39);
  const NTBooks = BOOKS.filter(b => b.id >= 40);



  if (view === 'home') {
    const tamilVersions = BIBLE_VERSIONS.filter(v => v.lang === 'Tamil');
    const englishVersions = BIBLE_VERSIONS.filter(v => v.lang === 'English');
    const bs = BILINGUAL_STYLES[theme];
    return (
      <View style={[styles.container, { backgroundColor: c.bg }]}>
        <StatusBar barStyle={theme === 'light' ? 'dark-content' : 'light-content'} />
        <View style={[styles.header, { backgroundColor: c.headerBg, paddingRight: 16 + insets.right }]}>
          {headerTitle ? (
            <View style={{ flex: 1 }}>{headerTitle}</View>
          ) : (
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: c.text }]}>📖 Bible</Text>
              <Text style={[styles.headerSubtitle, { color: c.subtext }]}>{BIBLE_VERSIONS.length} versions available</Text>
            </View>
          )}
          <TouchableOpacity onPress={cycleTheme} style={styles.themeBtn}>
            <ThemeToggleIcon theme={theme} size={26} color={c.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={22} color={c.text} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => {
            setIsBilingual(true); setVersion(getMemBibleSettings().primaryVersion);
            setView('books'); setTestament('OT');
          }}>
            <LinearGradient
              colors={bs.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.bilingualCard,
                { shadowColor: bs.shadowColor ?? '#7c3aed' },
                bs.cardBorder ? { borderWidth: 1, borderColor: bs.cardBorder } : null,
              ]}
            >
              {bs.glowGradient && (
                <LinearGradient
                  colors={bs.glowGradient}
                  locations={bs.glowLocations}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <Ionicons name="book-outline" size={72} color={bs.decoration} style={styles.bilingualDecoration} />
              <View style={styles.bilingualDotGrid}>
                {Array.from({ length: 9 }).map((_, i) => (
                  <View key={i} style={[styles.bilingualDot, { backgroundColor: bs.dotColor ?? bs.decoration }]} />
                ))}
              </View>

              <View style={styles.bilingualTopRow}>
                <View style={styles.chipStack}>
                  <LinearGradient
                    colors={bs.chipBackGradient ?? [bs.chipBackBg, bs.chipBackBg]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.chipBack}
                  >
                    <Text style={[styles.chipText, { color: bs.chipBackText }]}>தமிழ்</Text>
                  </LinearGradient>
                  <LinearGradient
                    colors={bs.chipFrontGradient ?? [bs.chipFrontBg, bs.chipFrontBg]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.chipFront}
                  >
                    <Text style={[styles.chipText, { color: bs.chipFrontText }]}>English</Text>
                  </LinearGradient>
                  <View style={[styles.swapBadge, { backgroundColor: bs.swapBg }]}>
                    <Ionicons name="swap-vertical" size={14} color={bs.swapIcon} />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bilingualTitle, { color: bs.text }]}>Bilingual Reading</Text>
                  <Text style={[styles.bilingualDesc, { color: bs.subtext }]}>
                    Read Tamil (top) and English (bottom) together
                  </Text>
                </View>
              </View>

              <View style={[styles.startBtn, { backgroundColor: bs.buttonBg }]}>
                <Text style={[styles.startBtnText, { color: bs.buttonText }]}>Start Reading</Text>
                <View style={[styles.startBtnIcon, { backgroundColor: bs.buttonIconBg }]}>
                  <Ionicons name="arrow-forward" size={14} color={bs.buttonIconColor} />
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.sectionLabelRow}>
            <View style={[styles.sectionBar, { backgroundColor: TAMIL_ACCENT }]} />
            <Text style={[styles.sectionLabel, { color: c.subtext }]}>Tamil Versions</Text>
          </View>
          {tamilVersions.map((v, i) => (
            <TouchableOpacity key={v.code} style={[styles.versionCard, { backgroundColor: c.surface }]}
              onPress={() => { setIsBilingual(false); selectVersion(v.code); setView('books'); setTestament('OT'); }}>
              <View style={[styles.versionIcon, { backgroundColor: TAMIL_ICON_COLORS[i % TAMIL_ICON_COLORS.length] }]}><Text style={styles.versionIconText}>த</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.versionName, { color: c.text }]}>{v.name}</Text>
                <Text style={[styles.versionShort, { color: c.subtext }]}>{v.short}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={TAMIL_ACCENT} />
            </TouchableOpacity>
          ))}

          <View style={[styles.sectionLabelRow, { marginTop: 16 }]}>
            <View style={[styles.sectionBar, { backgroundColor: ENGLISH_ACCENT }]} />
            <Text style={[styles.sectionLabel, { color: c.subtext }]}>English Versions</Text>
          </View>
          {englishVersions.map(v => (
            <TouchableOpacity key={v.code} style={[styles.versionCard, { backgroundColor: c.surface }]}
              onPress={() => { setIsBilingual(false); selectVersion(v.code); setView('books'); setTestament('OT'); }}>
              <View style={[styles.versionIcon, { backgroundColor: ENGLISH_ICON_COLOR }]}><Text style={styles.versionIconText}>E</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.versionName, { color: c.text }]}>{v.name}</Text>
                <Text style={[styles.versionShort, { color: c.subtext }]}>{v.short}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={ENGLISH_ACCENT} />
            </TouchableOpacity>
          ))}
        </ScrollView>
        <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} c={c} fontSize={fontSize} setFontSize={setFontSize} />
      </View>
    );
  }

  if (view === 'books') {
    const books = testament === 'OT' ? OTBooks : NTBooks;
    const currentVersion = BIBLE_VERSIONS.find(v => v.code === version);
    const otLabel = isEnglish ? 'Old Testament (OT)' : 'பழைய ஏற்பாடு (OT)';
    const ntLabel = isEnglish ? 'New Testament (NT)' : 'புதிய ஏற்பாடு (NT)';
    const selectLabel = isEnglish ? 'Select a book' : 'புத்தகம் தேர்வு செய்யுங்கள்';
    return (
      <View style={[styles.container, { backgroundColor: c.bg }]}>
        <View style={[styles.header, { backgroundColor: c.headerBg, paddingRight: 16 + insets.right }]}>
          <TouchableOpacity onPress={() => { setView('home'); setIsBilingual(false); }} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={c.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: c.text }]}>{isBilingual ? 'Bilingual' : currentVersion?.name}</Text>
            <Text style={[styles.headerSubtitle, { color: c.subtext }]}>{selectLabel}</Text>
          </View>
          <TouchableOpacity onPress={cycleTheme} style={styles.themeBtn}>
            <ThemeToggleIcon theme={theme} size={26} color={c.text} />
          </TouchableOpacity>
        </View>
        <View style={[styles.testamentRow, { backgroundColor: c.surface }]}>
          <TouchableOpacity style={[styles.testamentBtn, testament === 'OT' && { backgroundColor: c.accent }]} onPress={() => setTestament('OT')}>
            <Text style={[styles.testamentText, { color: testament === 'OT' ? '#fff' : c.subtext }]}>{otLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.testamentBtn, testament === 'NT' && { backgroundColor: c.accent }]} onPress={() => setTestament('NT')}>
            <Text style={[styles.testamentText, { color: testament === 'NT' ? '#fff' : c.subtext }]}>{ntLabel}</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={books} key={`books-${testament}`}
          keyExtractor={item => item.id.toString()} numColumns={2}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.bookCard, { backgroundColor: c.surface }]}
              onPress={() => { setSelectedBook(item); setView('chapters'); }}>
              <Text style={[styles.bookName, { color: c.text }]}>{isBilingual ? item.name : isEnglish ? item.name : item.tamil}</Text>
              {isBilingual && <Text style={[styles.bookTamil, { color: c.subtext }]}>{item.tamil}</Text>}
              <Text style={[styles.bookChapters, { color: c.accent }]}>{item.chapters} chapters</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  }

  if (view === 'chapters' && selectedBook) {
    const chapters = Array.from({ length: selectedBook.chapters }, (_, i) => i + 1);
    const chapterTitle = isBilingual ? `${selectedBook.name} | ${selectedBook.tamil}` : isEnglish ? selectedBook.name : selectedBook.tamil;
    return (
      <View style={[styles.container, { backgroundColor: c.bg }]}>
        <View style={[styles.header, { backgroundColor: c.headerBg, paddingRight: 16 + insets.right }]}>
          <TouchableOpacity onPress={() => setView('books')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={c.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: c.text }]}>{chapterTitle}</Text>
            <Text style={[styles.headerSubtitle, { color: c.subtext }]}>{isEnglish || isBilingual ? 'Select chapter' : 'அதிகாரம் தேர்வு செய்யுங்கள்'}</Text>
          </View>
          <TouchableOpacity onPress={cycleTheme} style={styles.themeBtn}>
            <ThemeToggleIcon theme={theme} size={26} color={c.text} />
          </TouchableOpacity>
        </View>
        <FlatList
          data={chapters} key={`chapters-${selectedBook.id}`}
          keyExtractor={item => item.toString()} numColumns={5}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.chapterBtn, { backgroundColor: c.surface, width: chapterItemWidth }]} onPress={() => openChapter(selectedBook, item)}>
              <Text
                style={[styles.chapterText, { color: c.accent }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 50, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 16, fontWeight: 'bold' },
  headerSubtitle: { fontSize: 11, marginTop: 2 },
  backBtn: { padding: 4 },
  settingsBtn: { padding: 4 },
  themeBtn: { padding: 4 },
  bilingualCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  bilingualDecoration: { position: 'absolute', right: -4, top: -8, transform: [{ rotate: '-8deg' }] },
  bilingualDotGrid: {
    position: 'absolute',
    right: 20,
    bottom: 18,
    width: 44,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  bilingualDot: { width: 4, height: 4, borderRadius: 2 },
  bilingualTopRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  chipStack: { width: 116, height: 94 },
  chipBack: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 92,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-7deg' }],
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  chipFront: {
    position: 'absolute',
    top: 46,
    left: 22,
    width: 92,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '5deg' }],
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  // Sits in the gap between the two chips rather than centered on either — the previous
  // spacing let it land on top of "English"'s text.
  swapBadge: {
    position: 'absolute',
    top: 28,
    left: 64,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  bilingualTitle: { fontSize: 18, fontWeight: '800' },
  bilingualDesc: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 24,
    paddingLeft: 18,
    paddingRight: 6,
    paddingVertical: 6,
    marginTop: 16,
    gap: 10,
  },
  startBtnText: { fontSize: 14, fontWeight: '700' },
  startBtnIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionBar: { width: 4, height: 16, borderRadius: 2 },
  sectionLabel: { fontSize: 13, fontWeight: 'bold' },
  versionCard: { borderRadius: 14, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 3, gap: 12 },
  versionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  versionIconText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  versionName: { fontSize: 15, fontWeight: 'bold' },
  versionShort: { fontSize: 12, marginTop: 2 },
  testamentRow: { flexDirection: 'row', padding: 8, gap: 8 },
  testamentBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  testamentText: { fontSize: 12, fontWeight: '600' },
  bookCard: { flex: 1, margin: 6, borderRadius: 12, padding: 14, elevation: 2 },
  bookName: { fontSize: 13, fontWeight: 'bold' },
  bookTamil: { fontSize: 11, marginTop: 2 },
  bookChapters: { fontSize: 10, marginTop: 6, fontWeight: '600' },
  chapterBtn: { margin: 4, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 4, alignItems: 'center', elevation: 2 },
  chapterText: { fontSize: 16, fontWeight: 'bold', width: '100%', textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  settingLabel: { fontSize: 13, fontWeight: '600', marginBottom: 10, marginTop: 16 },
  fontSizeRow: { flexDirection: 'row', alignItems: 'center', gap: 16, justifyContent: 'center' },
  fontBtn: { borderWidth: 2, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  fontBtnText: { fontWeight: 'bold', fontSize: 16 },
  fontSizeValue: { fontSize: 18, fontWeight: 'bold', minWidth: 60, textAlign: 'center' },
  closeBtn: { borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20 },
  closeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

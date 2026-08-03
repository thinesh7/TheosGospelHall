import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../components/AppText';
import { useResponsiveColumns } from '../../components/layout/ResponsiveGrid';
import ThemeToggleIcon from '../../components/ThemeToggleIcon';
import { CONTENT_MAX_WIDTH } from '../../constants/layout';
import { useBreakpoint } from '../../hooks/use-breakpoint';
import { BIBLE_VERSIONS, BOOKS } from '../../utils/bibleData';
import { getMemBibleSettings, saveBibleSettings } from '../../utils/bibleSettings';
import { useTheme } from '../../utils/ThemeContext';

interface BibleNav {
  view: 'home' | 'books' | 'chapters';
  version?: string;
  bilingual: boolean;
  testament: 'OT' | 'NT';
  bookId?: string;
}

const HOME_NAV: BibleNav = { view: 'home', bilingual: false, testament: 'OT' };

// Web-only: mirrors BibleNav into the URL's query string via the raw History
// API instead of expo-router's router.push(). TabShell.web.tsx's own
// tab-switch fix explains why: router.push() to a route inside the (tabs)
// group — which '/bible' still is, even just navigating within itself —
// remounts the entire tab shell (a fresh Home/Videos/Bible/etc. instance on
// top of whatever the previous one hadn't cleaned up yet). Browsing several
// chapters in one sitting used to reproduce exactly the "gets slower the
// longer you use it" degradation that fix targeted, just via this different
// trigger. Reading/writing the URL directly keeps the original design's
// goals (browser back works, refresh/deep-link lands on the right screen)
// without ever calling router.push for same-tab navigation.
function parseBibleSearch(search: string): BibleNav {
  const p = new URLSearchParams(search);
  const rawView = p.get('view');
  return {
    view: rawView === 'books' || rawView === 'chapters' ? rawView : 'home',
    version: p.get('version') || undefined,
    bilingual: p.get('bilingual') === '1',
    testament: p.get('testament') === 'NT' ? 'NT' : 'OT',
    bookId: p.get('bookId') || undefined,
  };
}

function buildBibleUrl(nav: BibleNav): string {
  const p = new URLSearchParams();
  if (nav.view !== 'home') p.set('view', nav.view);
  if (nav.version) p.set('version', nav.version);
  if (nav.bilingual) p.set('bilingual', '1');
  if (nav.testament) p.set('testament', nav.testament);
  if (nav.bookId) p.set('bookId', nav.bookId);
  const qs = p.toString();
  return qs ? `/bible?${qs}` : '/bible';
}

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  c: any;
  fontSize: number;
  setFontSize: (updater: (f: number) => number) => void;
}

function SettingsModal({ visible, onClose, c, fontSize, setFontSize }: SettingsModalProps) {
  const { isTabletUp } = useBreakpoint();
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={[styles.modalOverlay, isTabletUp && styles.modalOverlayDesktop]}>
        <View style={[styles.modalCard, { backgroundColor: c.surface }, isTabletUp && styles.modalCardDesktop]}>
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
          <TouchableOpacity style={[styles.closeBtn, { backgroundColor: c.accent }]} onPress={onClose}>
            <Text style={styles.closeBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function BibleScreen() {
  const router = useRouter();
  // Version/Book/Chapter selection lives in the URL (?view=books&version=...
  // &testament=...&bookId=...) instead of local useState, and every forward
  // step uses router.push (a real, distinct history entry) rather than a
  // setState call. That makes the browser/hardware back button work like
  // ordinary navigation — the same proven mechanism bible-reader.tsx's own
  // back button already relies on — instead of needing this screen to
  // separately shadow browser history itself to make its own internal
  // steps back-button-aware. It also means a page refresh or deep link
  // lands on the right screen instead of always resetting to 'home'.
  const params = useLocalSearchParams<{ view?: string; version?: string; bilingual?: string; testament?: string; bookId?: string }>();
  // Web sources its own nav state from the URL directly (see parseBibleSearch
  // above) rather than expo-router's params — seeded from whatever the page
  // actually loaded on (a fresh load, refresh, or deep link), then kept in
  // sync by the popstate listener below for browser back/forward.
  const [webNav, setWebNav] = useState<BibleNav>(() => (Platform.OS === 'web' ? parseBibleSearch(window.location.search) : HOME_NAV));
  const nav: BibleNav = Platform.OS === 'web' ? webNav : {
    view: params.view === 'books' || params.view === 'chapters' ? params.view : 'home',
    version: params.version,
    bilingual: params.bilingual === '1',
    testament: params.testament === 'NT' ? 'NT' : 'OT',
    bookId: params.bookId,
  };
  const { colors: c, theme, cycleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const view = nav.view;
  const isBilingual = nav.bilingual;
  const testament = nav.testament;
  // Only meaningful once the user has actually picked a version (books/
  // chapters views, where it's always present in the URL) — 'home' falls
  // back to the persisted last choice, which selectVersion below keeps
  // updated for next time regardless of in-page navigation.
  const version = nav.version || getMemBibleSettings().version;
  const selectedBook = nav.bookId ? BOOKS.find(b => b.id === Number(nav.bookId)) : null;
  const [fontSize, setFontSize] = useState(() => getMemBibleSettings().fontSize);
  const [showSettings, setShowSettings] = useState(false);
  // Fixed 2/5-column grids only ever suited a phone-width screen — scale up
  // on tablet/desktop instead of leaving a phone-narrow grid stranded in a
  // much wider viewport.
  const bookColumns = useResponsiveColumns({ mobile: 2, tablet: 3, desktop: 5 });
  const chapterColumns = useResponsiveColumns({ mobile: 5, tablet: 7, desktop: 10 });

  const isEnglish = BIBLE_VERSIONS.find(v => v.code === version)?.lang === 'English';

  useEffect(() => {
    // Web has no hardware back key — the browser's own back button already
    // works correctly here since every forward step is a real history
    // entry (see the params/router.push comment above). Native still needs
    // this: router.back() at the tab's own root screen ('home') would pop
    // *out* of the tab, so it's deliberately left unhandled there (return
    // false) to fall through to the OS's default behavior instead.
    if (Platform.OS === 'web') return;
    const backAction = () => {
      if (view === 'home') return false;
      router.back();
      return true;
    };
    const handler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => handler.remove();
  }, [view, router]);

  // Browser back/forward within Bible's own browsing steps — mirrors
  // TabShell.web.tsx's own popstate listener for tab switches, which this
  // doesn't conflict with: TabShell's handler only reacts when its own
  // `tghTab` marker is present, and otherwise just re-confirms the already-
  // active tab from the pathname (still '/bible' either way) — a harmless
  // no-op alongside this one syncing the actual view/version/testament/book.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onPopState = () => setWebNav(parseBibleSearch(window.location.search));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const goToBooks = (v: string, bilingual: boolean) => {
    if (!bilingual) saveBibleSettings({ version: v });
    const next: BibleNav = { view: 'books', version: v, bilingual, testament: 'OT' };
    if (Platform.OS === 'web') {
      window.history.pushState({ tghBible: true }, '', buildBibleUrl(next));
      setWebNav(next);
    } else {
      router.push({ pathname: '/bible', params: { view: 'books', version: v, bilingual: bilingual ? '1' : '0', testament: 'OT' } });
    }
  };

  const setTestament = (t: 'OT' | 'NT') => {
    // In place — switching OT/NT is a filter, not a navigation step, so it
    // shouldn't add its own back-button stop (replaceState/router.setParams,
    // not push).
    if (Platform.OS === 'web') {
      const next: BibleNav = { ...nav, testament: t };
      window.history.replaceState({ tghBible: true }, '', buildBibleUrl(next));
      setWebNav(next);
    } else {
      router.setParams({ testament: t });
    }
  };

  // Symmetric with pushState above — window.history.back() is what actually
  // pops the raw entries goToBooks/goToChapters push, whereas router.back()
  // is bound to expo-router's own navigation stack, which never learned
  // about those (they were pushed directly, bypassing router.push).
  const goBack = () => {
    if (Platform.OS === 'web') window.history.back();
    else router.back();
  };

  const goToChapters = (book: any) => {
    const next: BibleNav = { view: 'chapters', version, bilingual: isBilingual, testament, bookId: String(book.id) };
    if (Platform.OS === 'web') {
      window.history.pushState({ tghBible: true }, '', buildBibleUrl(next));
      setWebNav(next);
    } else {
      router.push({
        pathname: '/bible',
        params: { view: 'chapters', version, bilingual: isBilingual ? '1' : '0', testament, bookId: String(book.id) },
      });
    }
  };

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
    return (
      <View style={[styles.container, { backgroundColor: c.bg }]}>
        <StatusBar barStyle={theme === 'light' ? 'dark-content' : 'light-content'} />
        <View style={[styles.header, { backgroundColor: c.headerBg, paddingRight: 16 + insets.right, paddingTop: insets.top + 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: c.text }]}>📖 Bible</Text>
            <Text style={[styles.headerSubtitle, { color: c.subtext }]}>5 versions available</Text>
          </View>
          <TouchableOpacity onPress={cycleTheme} style={styles.themeBtn}>
            <ThemeToggleIcon theme={theme} size={22} color={c.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={22} color={c.text} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}>
          <TouchableOpacity
            style={[styles.bilingualCard, { backgroundColor: c.accent }]}
            onPress={() => goToBooks(getMemBibleSettings().primaryVersion, true)}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.bilingualTitleRow}>
                <View style={styles.bilingualMark}>
                  <Text style={styles.bilingualMarkText}>அ / A</Text>
                </View>
                <Text style={styles.bilingualTitle}>Bilingual Reading</Text>
              </View>
              <Text style={styles.bilingualDesc}>Tamil (top) + English (bottom) together</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.sectionLabel, { color: c.subtext }]}>Tamil Versions</Text>
          {tamilVersions.map(v => (
            <TouchableOpacity key={v.code} style={[styles.versionCard, { backgroundColor: c.surface }]}
              onPress={() => goToBooks(v.code, false)}>
              <View style={[styles.versionIcon, { backgroundColor: c.accent }]}><Text style={styles.versionIconText}>த</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.versionName, { color: c.text }]}>{v.name}</Text>
                <Text style={[styles.versionShort, { color: c.subtext }]}>{v.short}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.subtext} />
            </TouchableOpacity>
          ))}
          <Text style={[styles.sectionLabel, { color: c.subtext, marginTop: 16 }]}>English Versions</Text>
          {englishVersions.map(v => (
            <TouchableOpacity key={v.code} style={[styles.versionCard, { backgroundColor: c.surface }]}
              onPress={() => goToBooks(v.code, false)}>
              <View style={[styles.versionIcon, { backgroundColor: '#1a6b3a' }]}><Text style={styles.versionIconText}>E</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.versionName, { color: c.text }]}>{v.name}</Text>
                <Text style={[styles.versionShort, { color: c.subtext }]}>{v.short}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.subtext} />
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
        <View style={[styles.header, { backgroundColor: c.headerBg, paddingRight: 16 + insets.right, paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={c.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: c.text }]}>{isBilingual ? 'Bilingual' : currentVersion?.name}</Text>
            <Text style={[styles.headerSubtitle, { color: c.subtext }]}>{selectLabel}</Text>
          </View>
          <TouchableOpacity onPress={cycleTheme} style={styles.themeBtn}>
            <ThemeToggleIcon theme={theme} size={22} color={c.text} />
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
          data={books} key={`books-${testament}-${bookColumns}`}
          keyExtractor={item => item.id.toString()} numColumns={bookColumns}
          // Bounded list (max 39 books per testament) — render it in full
          // rather than rely on FlatList's default initialNumToRender of 10,
          // which combined with a multi-column grid meant only the first
          // couple of rows appeared until scrolled (most noticeable on web,
          // same underlying issue as the Bible reader's verse list).
          initialNumToRender={books.length}
          contentContainerStyle={{ padding: 12, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.bookCard, { backgroundColor: c.surface }]}
              onPress={() => goToChapters(item)}>
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
        <View style={[styles.header, { backgroundColor: c.headerBg, paddingRight: 16 + insets.right, paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={c.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: c.text }]}>{chapterTitle}</Text>
            <Text style={[styles.headerSubtitle, { color: c.subtext }]}>{isEnglish || isBilingual ? 'Select chapter' : 'அதிகாரம் தேர்வு செய்யுங்கள்'}</Text>
          </View>
          <TouchableOpacity onPress={cycleTheme} style={styles.themeBtn}>
            <ThemeToggleIcon theme={theme} size={22} color={c.text} />
          </TouchableOpacity>
        </View>
        <FlatList
          data={chapters} key={`chapters-${selectedBook.id}-${chapterColumns}`}
          keyExtractor={item => item.toString()} numColumns={chapterColumns}
          // Bounded list (max 150 chapters, Psalms) — same reasoning as the
          // books grid above: render it in full instead of leaving it to
          // FlatList's default initialNumToRender of 10.
          initialNumToRender={chapters.length}
          contentContainerStyle={{ padding: 12, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.chapterBtn, { backgroundColor: c.surface }]} onPress={() => openChapter(selectedBook, item)}>
              <Text style={[styles.chapterText, { color: c.accent }]}>{item}</Text>
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
  // paddingTop is overridden inline at every usage (insets.top + 12) —
  // insets.top is the real device safe-area/status-bar height (~0 on web,
  // where the hardcoded 50 this used to be left a large dead gap at the
  // top of the screen), rather than a guessed constant.
  header: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 16, fontWeight: 'bold' },
  headerSubtitle: { fontSize: 11, marginTop: 2 },
  backBtn: { padding: 4 },
  settingsBtn: { padding: 4 },
  themeBtn: { padding: 4 },
  bilingualCard: { borderRadius: 16, padding: 20, marginBottom: 20, flexDirection: 'row', alignItems: 'center', elevation: 4 },
  bilingualTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bilingualMark: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  bilingualMarkText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  bilingualTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  bilingualDesc: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  sectionLabel: { fontSize: 13, fontWeight: 'bold', marginBottom: 10 },
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
  chapterBtn: { flex: 1, margin: 6, borderRadius: 10, padding: 14, alignItems: 'center', elevation: 2 },
  chapterText: { fontSize: 16, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  // On tablet-up this becomes a centered floating dialog instead of a
  // full-bleed bottom sheet, matching the same pattern used in bible-reader.tsx.
  modalOverlayDesktop: { justifyContent: 'center', alignItems: 'center' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalCardDesktop: { width: '100%', maxWidth: 440, borderRadius: 24 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  settingLabel: { fontSize: 13, fontWeight: '600', marginBottom: 10, marginTop: 16 },
  fontSizeRow: { flexDirection: 'row', alignItems: 'center', gap: 16, justifyContent: 'center' },
  fontBtn: { borderWidth: 2, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  fontBtnText: { fontWeight: 'bold', fontSize: 16 },
  fontSizeValue: { fontSize: 18, fontWeight: 'bold', minWidth: 60, textAlign: 'center' },
  closeBtn: { borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20 },
  closeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

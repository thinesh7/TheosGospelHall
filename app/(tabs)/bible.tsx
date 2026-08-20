import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  BackHandler,
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
import BibleBooksView from '../../components/bible/BibleBooksView';
import BibleChaptersView from '../../components/bible/BibleChaptersView';
import ThemeToggleIcon from '../../components/ThemeToggleIcon';
import { CONTENT_MAX_WIDTH } from '../../constants/layout';
import { useBreakpoint } from '../../hooks/use-breakpoint';
import { BIBLE_VERSIONS, BOOKS } from '../../utils/bibleData';
import { getMemBibleSettings, saveBibleSettings } from '../../utils/bibleSettings';
import { useTheme } from '../../utils/ThemeContext';

// Native-only nav state — home/books/chapters browsed via local state inside
// this one persistent screen (it's mounted once inside TabShell.tsx's
// PagerView, never itself a routed Stack entry — see nativeGoBack's own
// comment below for why). Reader is a genuine routed push either way
// (app/bible-reader.tsx), on both platforms.
//
// Web does NOT use this nav state at all: Books and Chapters are their own
// routes (app/bible-books.tsx, app/bible-chapters.tsx), reached via
// router.push/back exactly like Reader always was. That used to be raw
// window.history.pushState/back specifically to avoid remounting the whole
// (tabs) tab shell (routing to '/bible' — this same screen's own path —
// resolves right back to it). But Expo Router's own web history engine
// (createMemoryHistory.js) reacts to ANY popstate, including the ones our
// own raw window.history.back() triggered — it can't tell those apart from
// the user's real browser back button — and respondsby resyncing its
// internal state in a way that cascaded into remounting the entire (tabs)
// navigator (confirmed by instrumenting window.history: WebBackGuard's and
// this screen's own mount-only effects fired again on the very first Back
// press). A genuinely different top-level route sidesteps that: pushing/
// popping it never touches '/bible', so the (tabs) instance underneath
// isn't a match for it and stays mounted — same mechanism bible-reader
// already used successfully. BibleWebNavChrome recreates the sidebar/tab-bar
// around Books/Chapters so browsing still looks like it's inside this tab's
// own layout, even though it's technically a sibling screen now (see that
// component's own comment); only the Reader stays a full-screen takeover
// with no chrome, matching how it already looked before this split.
interface NativeBibleNav {
  view: 'home' | 'books' | 'chapters';
  version?: string;
  bilingual: boolean;
  bookId?: string;
}

const HOME_NAV: NativeBibleNav = { view: 'home', bilingual: false };

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
  const [nativeNav, setNativeNav] = useState<NativeBibleNav>(HOME_NAV);
  const { colors: c, theme, cycleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const view = Platform.OS === 'web' ? 'home' : nativeNav.view;
  const isBilingual = nativeNav.bilingual;
  const version = nativeNav.version || getMemBibleSettings().version;
  const [fontSize, setFontSize] = useState(() => getMemBibleSettings().fontSize);
  const [showSettings, setShowSettings] = useState(false);

  const isEnglish = BIBLE_VERSIONS.find(v => v.code === version)?.lang === 'English';

  // Steps native's local nav state back one level: chapters -> books ->
  // home. Shared by the hardware back handler below and BibleBooksView/
  // BibleChaptersView's onClose. Web never calls this — its Books/Chapters
  // are separate routes, popped via router.back() directly.
  const nativeGoBack = () => {
    setNativeNav(prev => {
      if (prev.view === 'chapters') return { ...prev, view: 'books', bookId: undefined };
      if (prev.view === 'books') return HOME_NAV;
      return prev;
    });
  };

  useEffect(() => {
    // Web has no hardware back key, and doesn't use this nav state at all
    // (see NativeBibleNav's own comment) — nothing to step here.
    if (Platform.OS === 'web') return;
    const backAction = () => {
      if (nativeNav.view === 'home') return false;
      nativeGoBack();
      return true;
    };
    const handler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => handler.remove();
  }, [nativeNav.view]);

  const goToBooks = (v: string, bilingual: boolean) => {
    if (!bilingual) saveBibleSettings({ version: v });
    if (Platform.OS === 'web') {
      router.push({ pathname: '/bible-books', params: { version: v, bilingual: bilingual ? '1' : '0' } });
      return;
    }
    setNativeNav({ view: 'books', version: v, bilingual });
  };

  const goToChapters = (book: any) => {
    setNativeNav(prev => ({ ...prev, view: 'chapters', bookId: String(book.id) }));
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

  const tamilVersions = BIBLE_VERSIONS.filter(v => v.lang === 'Tamil');
  const englishVersions = BIBLE_VERSIONS.filter(v => v.lang === 'English');

  if (view === 'books') {
    return (
      <BibleBooksView
        version={version}
        isBilingual={isBilingual}
        onSelectBook={goToChapters}
        onClose={nativeGoBack}
      />
    );
  }

  if (view === 'chapters' && nativeNav.bookId) {
    return (
      <BibleChaptersView
        bookId={nativeNav.bookId}
        version={version}
        isBilingual={isBilingual}
        onSelectChapter={(chapter) => openChapter(BOOKS.find(b => b.id === Number(nativeNav.bookId)), chapter)}
        onClose={nativeGoBack}
      />
    );
  }

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

const styles = StyleSheet.create({
  container: { flex: 1 },
  // paddingTop is overridden inline at every usage (insets.top + 12) —
  // insets.top is the real device safe-area/status-bar height (~0 on web,
  // where the hardcoded 50 this used to be left a large dead gap at the
  // top of the screen), rather than a guessed constant.
  header: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 16, fontWeight: 'bold' },
  headerSubtitle: { fontSize: 11, marginTop: 2 },
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

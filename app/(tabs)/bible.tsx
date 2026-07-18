import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ThemeToggleIcon from '../../components/ThemeToggleIcon';
import { BIBLE_VERSIONS, BOOKS } from '../../utils/bibleData';
import { getMemBibleSettings, saveBibleSettings } from '../../utils/bibleSettings';
import { useTheme } from '../../utils/ThemeContext';

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

export default function BibleScreen() {
  const router = useRouter();
  const { colors: c, theme, cycleTheme } = useTheme();
  const insets = useSafeAreaInsets();
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
    return (
      <View style={[styles.container, { backgroundColor: c.bg }]}>
        <StatusBar barStyle={theme === 'light' ? 'dark-content' : 'light-content'} />
        <View style={[styles.header, { backgroundColor: c.headerBg, paddingRight: 16 + insets.right }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: c.text }]}>📖 Bible</Text>
            <Text style={[styles.headerSubtitle, { color: c.subtext }]}>4 versions available</Text>
          </View>
          <TouchableOpacity onPress={cycleTheme} style={styles.themeBtn}>
            <ThemeToggleIcon theme={theme} size={22} color={c.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={22} color={c.text} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <TouchableOpacity style={[styles.bilingualCard, { backgroundColor: c.accent }]} onPress={() => {
            setIsBilingual(true); setVersion(getMemBibleSettings().primaryVersion);
            setView('books'); setTestament('OT');
          }}>
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
              onPress={() => { setIsBilingual(false); selectVersion(v.code); setView('books'); setTestament('OT'); }}>
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
              onPress={() => { setIsBilingual(false); selectVersion(v.code); setView('books'); setTestament('OT'); }}>
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
        <View style={[styles.header, { backgroundColor: c.headerBg, paddingRight: 16 + insets.right }]}>
          <TouchableOpacity onPress={() => { setView('home'); setIsBilingual(false); }} style={styles.backBtn}>
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
            <ThemeToggleIcon theme={theme} size={22} color={c.text} />
          </TouchableOpacity>
        </View>
        <FlatList
          data={chapters} key={`chapters-${selectedBook.id}`}
          keyExtractor={item => item.toString()} numColumns={5}
          contentContainerStyle={{ padding: 12 }}
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
  header: { padding: 16, paddingTop: 50, flexDirection: 'row', alignItems: 'center', gap: 8 },
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

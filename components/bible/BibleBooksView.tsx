import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../AppText';
import { useResponsiveColumns } from '../layout/ResponsiveGrid';
import ThemeToggleIcon from '../ThemeToggleIcon';
import { CONTENT_MAX_WIDTH } from '../../constants/layout';
import { BIBLE_VERSIONS, BOOKS } from '../../utils/bibleData';
import { useTheme } from '../../utils/ThemeContext';

export interface BibleBooksViewProps {
  version: string;
  isBilingual: boolean;
  onSelectBook: (book: any) => void;
  onClose: () => void;
}

export default function BibleBooksView({ version, isBilingual, onSelectBook, onClose }: BibleBooksViewProps) {
  const { colors: c, theme, cycleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  // In-place filter, not a navigation step — resets to OT on every fresh
  // entry into this screen rather than being carried in the URL/params,
  // matching how it always behaved (see app/(tabs)/bible.tsx's history).
  const [testament, setTestament] = useState<'OT' | 'NT'>('OT');
  const bookColumns = useResponsiveColumns({ mobile: 2, tablet: 3, desktop: 5 });

  const isEnglish = BIBLE_VERSIONS.find(v => v.code === version)?.lang === 'English';
  const currentVersion = BIBLE_VERSIONS.find(v => v.code === version);
  const OTBooks = BOOKS.filter(b => b.id <= 39);
  const NTBooks = BOOKS.filter(b => b.id >= 40);
  const books = testament === 'OT' ? OTBooks : NTBooks;
  const otLabel = isEnglish ? 'Old Testament (OT)' : 'பழைய ஏற்பாடு (OT)';
  const ntLabel = isEnglish ? 'New Testament (NT)' : 'புதிய ஏற்பாடு (NT)';
  const selectLabel = isEnglish ? 'Select a book' : 'புத்தகம் தேர்வு செய்யுங்கள்';

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <View style={[styles.header, { backgroundColor: c.headerBg, paddingRight: 16 + insets.right, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
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
            onPress={() => onSelectBook(item)}>
            <Text style={[styles.bookName, { color: c.text }]}>{isBilingual ? item.name : isEnglish ? item.name : item.tamil}</Text>
            {isBilingual && <Text style={[styles.bookTamil, { color: c.subtext }]}>{item.tamil}</Text>}
            <Text style={[styles.bookChapters, { color: c.accent }]}>{item.chapters} chapters</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 16, fontWeight: 'bold' },
  headerSubtitle: { fontSize: 11, marginTop: 2 },
  backBtn: { padding: 4 },
  themeBtn: { padding: 4 },
  testamentRow: { flexDirection: 'row', padding: 8, gap: 8 },
  testamentBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  testamentText: { fontSize: 12, fontWeight: '600' },
  bookCard: { flex: 1, margin: 6, borderRadius: 12, padding: 14, elevation: 2 },
  bookName: { fontSize: 13, fontWeight: 'bold' },
  bookTamil: { fontSize: 11, marginTop: 2 },
  bookChapters: { fontSize: 10, marginTop: 6, fontWeight: '600' },
});

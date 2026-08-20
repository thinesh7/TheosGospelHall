import { Ionicons } from '@expo/vector-icons';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../AppText';
import { useResponsiveColumns } from '../layout/ResponsiveGrid';
import ThemeToggleIcon from '../ThemeToggleIcon';
import { CONTENT_MAX_WIDTH } from '../../constants/layout';
import { BIBLE_VERSIONS, BOOKS } from '../../utils/bibleData';
import { useTheme } from '../../utils/ThemeContext';

export interface BibleChaptersViewProps {
  bookId: string;
  version: string;
  isBilingual: boolean;
  onSelectChapter: (chapter: number) => void;
  onClose: () => void;
}

export default function BibleChaptersView({ bookId, version, isBilingual, onSelectChapter, onClose }: BibleChaptersViewProps) {
  const { colors: c, theme, cycleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const chapterColumns = useResponsiveColumns({ mobile: 5, tablet: 7, desktop: 10 });

  const isEnglish = BIBLE_VERSIONS.find(v => v.code === version)?.lang === 'English';
  const selectedBook = BOOKS.find(b => b.id === Number(bookId));
  const chapters = selectedBook ? Array.from({ length: selectedBook.chapters }, (_, i) => i + 1) : [];
  const chapterTitle = selectedBook ? (isBilingual ? `${selectedBook.name} | ${selectedBook.tamil}` : isEnglish ? selectedBook.name : selectedBook.tamil) : '';

  if (!selectedBook) return null;

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <View style={[styles.header, { backgroundColor: c.headerBg, paddingRight: 16 + insets.right, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
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
        // books grid: render it in full instead of leaving it to FlatList's
        // default initialNumToRender of 10.
        initialNumToRender={chapters.length}
        contentContainerStyle={{ padding: 12, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.chapterBtn, { backgroundColor: c.surface }]} onPress={() => onSelectChapter(item)}>
            <Text style={[styles.chapterText, { color: c.accent }]}>{item}</Text>
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
  chapterBtn: { flex: 1, margin: 6, borderRadius: 10, padding: 14, alignItems: 'center', elevation: 2 },
  chapterText: { fontSize: 16, fontWeight: 'bold' },
});

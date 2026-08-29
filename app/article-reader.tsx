import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, BackHandler, Modal, ScrollView, Share, StyleSheet, TouchableOpacity, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../components/AppText';
import ThemeToggleIcon from '../components/ThemeToggleIcon';
import {
  DEFAULT_ARTICLE_READER_SETTINGS,
  getArticleReaderSettings,
  saveArticleReaderSettings,
} from '../utils/articleReaderSettings';
import { Article, getArticle, getCachedArticle } from '../utils/articles';
import { buildArticleMarkdownStyles } from '../utils/articleMarkdownStyles';
import { useTheme } from '../utils/ThemeContext';

const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 24;

export default function ArticleReaderScreen() {
  const router = useRouter();
  const { articleId } = useLocalSearchParams<{ articleId: string }>();
  const { colors: c, theme, cycleTheme } = useTheme();
  const insets = useSafeAreaInsets();

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [fontSize, setFontSize] = useState(DEFAULT_ARTICLE_READER_SETTINGS.fontSize);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    getArticleReaderSettings().then(s => {
      setFontSize(s.fontSize);
      setSettingsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    saveArticleReaderSettings({ fontSize });
  }, [fontSize, settingsLoaded]);

  useEffect(() => {
    if (!articleId) return;
    let cancelled = false;
    getCachedArticle(articleId).then(cached => {
      if (!cancelled && cached) {
        setArticle(cached);
        setLoading(false);
      }
    });
    getArticle(articleId).then(fresh => {
      if (cancelled) return;
      if (fresh) setArticle(fresh);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [articleId]);

  // Without this, hardware back falls through to the Reading hub's own
  // listener (still mounted in the background — tabs are kept alive, not
  // unmounted — see app/(tabs)/reading.tsx), which swallows the press
  // instead of popping this screen. bible-reader.tsx claims it the same way.
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showSettings) { setShowSettings(false); return true; }
      router.back();
      return true;
    });
    return () => handler.remove();
  }, [showSettings]);

  const markdownStyles = useMemo(() => buildArticleMarkdownStyles(c, fontSize), [c, fontSize]);

  const shareArticle = async () => {
    if (!article) return;
    try {
      await Share.share({ message: `${article.title}\n\n${article.bodyMarkdown}` });
    } catch {}
  };

  if (loading && !article) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.page, { backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      </>
    );
  }

  if (!article) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.page, { backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
          <Ionicons name="alert-circle-outline" size={40} color={c.subtext} />
          <Text style={[styles.notFoundText, { color: c.subtext }]}>Article not found.</Text>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backLinkBtn, { backgroundColor: c.accent }]}>
            <Text style={styles.backLinkText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: c.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.topBar, { backgroundColor: c.headerBg, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </TouchableOpacity>
        <View style={styles.topBarActions}>
          <TouchableOpacity onPress={shareArticle} style={styles.iconBtn}>
            <Ionicons name="share-social-outline" size={22} color={c.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={cycleTheme} style={styles.iconBtn}>
            <ThemeToggleIcon theme={theme} size={22} color={c.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.iconBtn}>
            <Ionicons name="text-outline" size={22} color={c.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: c.text }]}>{article.title}</Text>
        {!!(article.author || article.publishedAt) && (
          <Text style={[styles.byline, { color: c.subtext }]}>
            {article.author}
            {article.author && article.publishedAt ? '  •  ' : ''}
            {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
          </Text>
        )}
        <Markdown style={markdownStyles}>{article.bodyMarkdown}</Markdown>
      </ScrollView>

      <Modal visible={showSettings} transparent animationType="slide" onRequestClose={() => setShowSettings(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSettings(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.sheet, { backgroundColor: c.headerBg }]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, { color: c.text }]}>Font Size</Text>
            <View style={styles.fontSizeRow}>
              <TouchableOpacity
                style={[styles.fontBtn, { borderColor: c.accent }]}
                onPress={() => setFontSize(f => Math.max(MIN_FONT_SIZE, f - 1))}
              >
                <Text style={[styles.fontBtnText, { color: c.accent }]}>A-</Text>
              </TouchableOpacity>
              <Text style={[styles.fontSizeValue, { color: c.text }]}>{fontSize}px</Text>
              <TouchableOpacity
                style={[styles.fontBtn, { borderColor: c.accent }]}
                onPress={() => setFontSize(f => Math.min(MAX_FONT_SIZE, f + 1))}
              >
                <Text style={[styles.fontBtnText, { color: c.accent }]}>A+</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.doneBtn, { backgroundColor: c.accent }]} onPress={() => setShowSettings(false)}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  topBarActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 4 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 60 },
  title: { fontSize: 26, fontWeight: '800', lineHeight: 32, marginBottom: 8 },
  byline: { fontSize: 13, marginBottom: 20 },
  notFoundText: { fontSize: 15, marginTop: 12, marginBottom: 20 },
  backLinkBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  backLinkText: { color: '#fff', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#999', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 15, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  fontSizeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 20 },
  fontBtn: { width: 44, height: 44, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  fontBtnText: { fontWeight: '700', fontSize: 15 },
  fontSizeValue: { fontSize: 16, fontWeight: '700', minWidth: 50, textAlign: 'center' },
  doneBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

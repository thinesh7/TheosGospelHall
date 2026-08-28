import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ReactNode, useEffect, useState } from 'react';
import { FlatList, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../AppText';
import ThemeToggleIcon from '../ThemeToggleIcon';
import { ArticleIndexEntry, getArticlesIndex, subscribePublishedArticles } from '../../utils/articles';
import { useTheme } from '../../utils/ThemeContext';

const formatDate = (millis: number | null) => {
  if (!millis) return '';
  return new Date(millis).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

interface Props {
  headerTitle?: ReactNode;
}

export default function ArticlesScreen({ headerTitle }: Props) {
  const router = useRouter();
  const { colors: c, theme, cycleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [articles, setArticles] = useState<ArticleIndexEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getArticlesIndex().then(cached => {
      if (cached.length > 0) setArticles(cached);
    });
    const unsubscribe = subscribePublishedArticles(list => {
      setArticles(list);
      setLoaded(true);
    });
    return unsubscribe;
  }, []);

  const openArticle = (id: string) => {
    router.push({ pathname: '/article-reader', params: { articleId: id } });
  };

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <StatusBar barStyle={theme === 'light' ? 'dark-content' : 'light-content'} />
      <View style={[styles.header, { backgroundColor: c.headerBg, paddingRight: 16 + insets.right }]}>
        {headerTitle ? (
          <View style={{ flex: 1 }}>{headerTitle}</View>
        ) : (
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: c.text }]}>📰 TGH Articles</Text>
            <Text style={[styles.headerSubtitle, { color: c.subtext }]}>
              {articles.length} {articles.length === 1 ? 'article' : 'articles'} available
            </Text>
          </View>
        )}
        <TouchableOpacity onPress={cycleTheme} style={styles.themeBtn}>
          <ThemeToggleIcon theme={theme} size={22} color={c.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={articles}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: c.surface }]}
            onPress={() => openArticle(item.id)}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={2}>{item.title}</Text>
              {!!item.subtitle && (
                <Text style={[styles.cardSubtitle, { color: c.subtext }]} numberOfLines={2}>{item.subtitle}</Text>
              )}
              <View style={styles.cardMetaRow}>
                {!!item.author && <Text style={[styles.cardMeta, { color: c.subtext }]}>{item.author}</Text>}
                {!!item.author && !!item.publishedAt && <Text style={[styles.cardMeta, { color: c.subtext }]}> • </Text>}
                {!!item.publishedAt && <Text style={[styles.cardMeta, { color: c.subtext }]}>{formatDate(item.publishedAt)}</Text>}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.subtext} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loaded ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="newspaper-outline" size={40} color={c.subtext} />
              <Text style={[styles.emptyText, { color: c.subtext }]}>No articles published yet</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 16,
    paddingLeft: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold' },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  themeBtn: { padding: 6, marginLeft: 8 },
  listContent: { padding: 16, flexGrow: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, lineHeight: 18, marginBottom: 6 },
  cardMetaRow: { flexDirection: 'row', flexWrap: 'wrap' },
  cardMeta: { fontSize: 12 },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 80, gap: 12 },
  emptyText: { fontSize: 14, fontStyle: 'italic' },
});

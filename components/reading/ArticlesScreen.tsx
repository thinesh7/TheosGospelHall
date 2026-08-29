import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../AppText';
import ThemeToggleIcon from '../ThemeToggleIcon';
import { getBookmarkedArticleIds, setBookmarkedArticleIds } from '../../utils/articleBookmarks';
import { ArticleCategoryEntry, ArticleIndexEntry, getArticlesIndex, getCachedCategories, subscribeCategories, syncArticles } from '../../utils/articles';
import { ThemeName } from '../../utils/theme';
import { useTheme } from '../../utils/ThemeContext';

const formatDate = (millis: number | null) => {
  if (!millis) return '';
  return new Date(millis).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const ALL_FILTER = 'All Articles';

interface ArticleThemeStyle {
  bg: string;
  headerBg: string;
  /** Subtle 2-stop sheen rather than a dramatic gradient — cards read as flat, clean
   *  surfaces with just a whisper of highlight, matching the reference exactly. */
  card: [string, string];
  /** Same as `card` for light/dark (no alternation there); a distinct second tone for
   *  sepia's explicit "Article cards" vs. "Secondary card" split. */
  cardAlt: [string, string];
  cardBorder: string;
  shadowColor: string;
  text: string;
  subtext: string;
  divider: string;
  bookmarkBg: string;
  bookmarkIcon: string;
  avatarBg: string;
  avatarIcon: string;
  chevronBg: string;
  chevronIcon: string;
  chipBg: string;
  chipText: string;
  chipSelectedBg: string;
  chipSelectedText: string;
  footerBg: string;
  footerIconGradient: [string, string];
  footerDash: string;
}

// Three distinct, professionally themed variants — Blue Light, Dark Gold, and Sepia — using
// exact hex from the design spec. Unlike Bible/Reading's saturated "feature card" gradients,
// these cards are deliberately flat/clean (a near-imperceptible 2-stop sheen only) with
// depth coming from the border + tinted shadow instead, matching this screen's calmer,
// editorial-list character.
const ARTICLE_STYLES: Record<ThemeName, ArticleThemeStyle> = {
  light: {
    bg: '#f7f9fc',
    headerBg: '#f1f6fb',
    card: ['#ffffff', '#f7fafd'],
    cardAlt: ['#ffffff', '#f7fafd'],
    cardBorder: '#d5e0ec',
    shadowColor: '#0f3460',
    text: '#101b32',
    subtext: '#5f6b7a',
    divider: '#d5e0ec',
    bookmarkBg: 'rgba(15,52,96,0.08)',
    bookmarkIcon: '#0f3460',
    avatarBg: 'rgba(15,52,96,0.08)',
    avatarIcon: '#5f6b7a',
    chevronBg: '#e7f0fa',
    chevronIcon: '#0f3460',
    chipBg: '#e7f0fa',
    chipText: '#101b32',
    chipSelectedBg: '#0f3460',
    chipSelectedText: '#ffffff',
    footerBg: '#f1f6fb',
    footerIconGradient: ['#3d6a9c', '#0f3460'],
    footerDash: '#d5e0ec',
  },
  dark: {
    bg: '#121212',
    headerBg: '#121212',
    card: ['#1c1c1c', '#1c1c1c'],
    cardAlt: ['#1c1c1c', '#1c1c1c'],
    cardBorder: '#353535',
    shadowColor: '#000000',
    text: '#f5f5f5',
    subtext: '#a0a0a0',
    divider: '#353535',
    bookmarkBg: 'rgba(255,255,255,0.08)',
    bookmarkIcon: '#f5f5f5',
    avatarBg: 'rgba(255,255,255,0.08)',
    avatarIcon: '#a0a0a0',
    chevronBg: 'rgba(255,107,112,0.14)',
    chevronIcon: '#ff6b70',
    chipBg: 'transparent',
    chipText: '#e0e0e0',
    chipSelectedBg: '#ff6b70',
    chipSelectedText: '#1a1a1a',
    footerBg: '#1c1c1c',
    footerIconGradient: ['#ff8a8e', '#ff6b70'],
    footerDash: 'rgba(255,107,112,0.4)',
  },
  sepia: {
    // Soft parchment/ivory rather than saturated gold-tan, muted caramel/bronze
    // accents in place of the old bright orange-brown, and subtle tan borders —
    // no blue, no green, nothing neon or overly dark.
    bg: '#f7ecd9',
    headerBg: '#f7ecd9',
    card: ['#fbf3e6', '#f5e9d5'],
    cardAlt: ['#f6ead4', '#efdfc0'],
    cardBorder: '#e3d3ba',
    shadowColor: '#6b4a2c',
    text: '#3b2a1a',
    subtext: '#7a6650',
    divider: '#e3d3ba',
    bookmarkBg: 'rgba(169,113,63,0.16)',
    bookmarkIcon: '#a9713f',
    avatarBg: 'rgba(169,113,63,0.16)',
    avatarIcon: '#7a6650',
    chevronBg: 'rgba(169,113,63,0.18)',
    chevronIcon: '#a9713f',
    chipBg: '#f0e3ca',
    chipText: '#5c3f28',
    chipSelectedBg: '#8a5a32',
    chipSelectedText: '#faf3e6',
    footerBg: '#f0e3ca',
    footerIconGradient: ['#c2955f', '#5c3f28'],
    footerDash: 'rgba(138,90,50,0.35)',
  },
};

/** The header's icon-badge gradient for this screen — exposed so reading.tsx's shared
 *  ReadingSectionHeader can color the Articles icon box to match this screen's own palette
 *  (independent of the Reading hub's own orange-family Articles card). */
export function getArticleHeaderIconGradient(theme: ThemeName): [string, string] {
  return ARTICLE_STYLES[theme].footerIconGradient;
}

interface Props {
  headerTitle?: ReactNode;
}

export default function ArticlesScreen({ headerTitle }: Props) {
  const router = useRouter();
  const { theme, cycleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [articles, setArticles] = useState<ArticleIndexEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [categories, setCategories] = useState<ArticleCategoryEntry[]>([]);
  const [selectedFilter, setSelectedFilter] = useState(ALL_FILTER);
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());

  const st = ARTICLE_STYLES[theme];
  const filters = useMemo(() => [ALL_FILTER, ...categories.map(c => c.name)], [categories]);

  // Cache-first, same as songs.tsx: show the cached index immediately, then
  // sync in the background (no permanent onSnapshot connection) and update
  // once that resolves. Pull-to-refresh below re-runs the same sync.
  useEffect(() => {
    getArticlesIndex().then(cached => {
      if (cached.length > 0) setArticles(cached);
    });
    syncArticles().then(result => {
      if (result.index.length > 0 || result.updated) setArticles(result.index);
      setLoaded(true);
    });
  }, []);

  const onPullToRefresh = async () => {
    setRefreshing(true);
    const result = await syncArticles();
    if (result.index.length > 0 || result.updated) setArticles(result.index);
    setRefreshing(false);
  };

  useEffect(() => {
    getCachedCategories().then(cached => {
      if (cached.length > 0) setCategories(cached);
    });
    const unsubscribe = subscribeCategories(setCategories);
    return unsubscribe;
  }, []);

  // If the previously selected category filter gets deleted by an admin
  // while this screen is open, fall back to "All Articles" instead of
  // silently showing an empty list for a filter that no longer exists.
  useEffect(() => {
    if (selectedFilter !== ALL_FILTER && categories.length > 0 && !categories.some(c => c.name === selectedFilter)) {
      setSelectedFilter(ALL_FILTER);
    }
  }, [categories, selectedFilter]);

  useEffect(() => {
    getBookmarkedArticleIds().then(ids => setBookmarked(new Set(ids)));
  }, []);

  const toggleBookmark = (id: string) => {
    setBookmarked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      setBookmarkedArticleIds(Array.from(next));
      return next;
    });
  };

  const openArticle = (id: string) => {
    router.push({ pathname: '/article-reader', params: { articleId: id } });
  };

  const filteredArticles = useMemo(
    () => (selectedFilter === ALL_FILTER ? articles : articles.filter(a => a.category === selectedFilter)),
    [articles, selectedFilter]
  );

  return (
    <View style={[styles.container, { backgroundColor: st.bg }]}>
      <StatusBar barStyle={theme === 'light' ? 'dark-content' : 'light-content'} />
      <View style={[styles.header, { backgroundColor: st.headerBg, paddingRight: 16 + insets.right }]}>
        {headerTitle ? (
          <View style={{ flex: 1 }}>{headerTitle}</View>
        ) : (
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: st.text }]}>📝 TGH Articles</Text>
            <Text style={[styles.headerSubtitle, { color: st.subtext }]}>
              {articles.length} {articles.length === 1 ? 'article' : 'articles'} available
            </Text>
          </View>
        )}
        <TouchableOpacity onPress={cycleTheme} style={styles.themeBtn}>
          <ThemeToggleIcon theme={theme} size={22} color={st.text} />
        </TouchableOpacity>
      </View>

      {/* Plain ScrollView, not FlatList: with only a handful of chips, FlatList's Android
          virtualization (removeClippedSubviews + windowed rendering) can under-measure
          variable-width items depending on screen width, clipping/truncating chips near the
          viewport edge on some devices. ScrollView renders every chip up front, so each one
          is always sized by its own text with no device-dependent clipping. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.chipList, { backgroundColor: st.headerBg }]}
        contentContainerStyle={styles.chipListContent}
      >
        {filters.map(item => {
          const selected = item === selectedFilter;
          return (
            <TouchableOpacity
              key={item}
              style={[styles.chip, { backgroundColor: selected ? st.chipSelectedBg : st.chipBg }]}
              onPress={() => setSelectedFilter(item)}
              activeOpacity={0.85}
            >
              <Text style={[styles.chipText, { color: selected ? st.chipSelectedText : st.chipText }]}>{item}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={filteredArticles}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onPullToRefresh} colors={[st.chevronIcon]} tintColor={st.chevronIcon} />
        }
        renderItem={({ item, index }) => {
          const cardColors = index % 2 === 0 ? st.card : st.cardAlt;
          const isBookmarked = bookmarked.has(item.id);
          return (
            <TouchableOpacity onPress={() => openArticle(item.id)} activeOpacity={0.9}>
              <LinearGradient
                colors={cardColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.card, { shadowColor: st.shadowColor, borderColor: st.cardBorder }]}
              >
                <View style={styles.cardTopRow}>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity
                    onPress={() => toggleBookmark(item.id)}
                    style={[styles.bookmarkBtn, { backgroundColor: st.bookmarkBg }]}
                    hitSlop={6}
                  >
                    <Ionicons name={isBookmarked ? 'bookmark' : 'bookmark-outline'} size={16} color={st.bookmarkIcon} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.cardTitle, { color: st.text }]} numberOfLines={2}>{item.title}</Text>
                {!!item.subtitle && (
                  <Text style={[styles.cardSubtitle, { color: st.subtext }]} numberOfLines={3}>{item.subtitle}</Text>
                )}

                <View style={[styles.divider, { backgroundColor: st.divider }]} />

                <View style={styles.metaRow}>
                  <View style={[styles.avatar, { backgroundColor: st.avatarBg }]}>
                    <Ionicons name="person" size={14} color={st.avatarIcon} />
                  </View>
                  <Text style={[styles.metaText, { color: st.subtext }]} numberOfLines={1}>
                    {[item.author, formatDate(item.publishedAt)].filter(Boolean).join('  •  ')}
                  </Text>
                  <View style={{ flex: 1 }} />
                  <View style={[styles.chevronBadge, { backgroundColor: st.chevronBg }]}>
                    <Ionicons name="chevron-forward" size={16} color={st.chevronIcon} />
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          loaded ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="newspaper-outline" size={40} color={st.subtext} />
              <Text style={[styles.emptyText, { color: st.subtext }]}>No articles published yet</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          <View style={[styles.footerCard, { backgroundColor: st.footerBg, borderColor: st.cardBorder }]}>
            <View style={styles.footerIconRow}>
              <View style={[styles.footerDash, { backgroundColor: st.footerDash }]} />
              <View>
                <LinearGradient colors={st.footerIconGradient} style={styles.footerIconBadge}>
                  <Ionicons name="book" size={22} color="#fff" />
                </LinearGradient>
                <Ionicons name="sparkles" size={13} color={st.footerDash} style={styles.footerSparkle} />
              </View>
              <View style={[styles.footerDash, { backgroundColor: st.footerDash }]} />
            </View>
            <Text style={[styles.footerTitle, { color: st.text }]}>More inspiring articles coming soon!</Text>
            <Text style={[styles.footerSubtitle, { color: st.subtext }]}>Stay tuned for more faith-filled content.</Text>
          </View>
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

  // Root cause of the cross-device clipping: `ScrollView` (unlike a plain View)
  // always clips its content to its own outer frame on the cross axis — that's
  // how it hides the part of the content that's scrolled out of view. That
  // outer frame's height was left fully unspecified (`flexGrow: 0`, no
  // height/minHeight), so it depended entirely on Yoga auto-measuring the
  // chip's text at layout time. On some devices that auto-measured height came
  // out a few px short of what the actual glyphs needed — depending on system
  // font, density, or font-scale — and since ScrollView clips rather than
  // growing, any shortfall silently sliced the tops/bottoms off the letters
  // while the pill's own rounded background (drawn at the same frame height)
  // looked unaffected. A `minHeight` is a floor, not a cap: the row still
  // grows to fit taller content on any device, but it can never measure out
  // shorter than this comfortably-generous, device-agnostic minimum, so the
  // clip boundary can never land inside the text. `chip`'s own minHeight (40)
  // is the actual clip guard; this outer floor just matches that plus the
  // row's own paddingVertical (6 + 6) so the frame is never smaller than the
  // pill needs — set any higher and it just adds visible empty space above
  // and below the pill inside the row, without protecting anything further.
  chipList: { flexGrow: 0, marginBottom: 10, minHeight: 52 },
  chipListContent: { paddingHorizontal: 16, paddingVertical: 6, gap: 8, alignItems: 'center' },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 0,
  },

  listContent: { padding: 16, paddingTop: 4, flexGrow: 1 },
  card: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
    elevation: 4,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  bookmarkBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, lineHeight: 24 },
  cardSubtitle: { fontSize: 14, lineHeight: 20, marginBottom: 14 },
  divider: { height: 1, marginBottom: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  metaText: { fontSize: 12, flexShrink: 1 },
  chevronBadge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },

  emptyWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 80, gap: 12 },
  emptyText: { fontSize: 14, fontStyle: 'italic' },

  footerCard: { borderRadius: 20, borderWidth: 1, padding: 24, alignItems: 'center', marginTop: 4 },
  footerIconRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  footerIconBadge: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  footerSparkle: { position: 'absolute', top: -4, right: -6 },
  footerDash: { width: 28, height: 2, borderRadius: 1 },
  footerTitle: { fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 6 },
  footerSubtitle: { fontSize: 13, textAlign: 'center' },
});

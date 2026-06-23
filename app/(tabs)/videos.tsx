import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { getCachedLivePlaylists, syncLivePlaylists } from '../../utils/livePlaylistsSync';
import { ytFetch } from '../../utils/youtubeProxy';

const CHANNEL_ID = 'UCFg0eNTRs2UIcihQAVpyrJA';
const UPLOADS_PLAYLIST_ID = 'UUFg0eNTRs2UIcihQAVpyrJA';
const SHORTS_PLAYLIST_ID = 'PLZISpWbe8RUjb_YX_C2yEEB7IZnhU9VRA';
const VIDEOS_PLAYLIST_ID = 'PLZISpWbe8RUgXpqMWjZCAZUTmYQ8b1qAb';
const FALLBACK_LIVE_IDS = ['PLZISpWbe8RUidyhPJNs5xa8-WOnHq-NLj'];

const { width: SW, height: SH } = Dimensions.get('window');
const PLAYER_H = SW * 9 / 16;
const SHORTS_PLAYER_H = SH * 0.55;

type Tab = 'shorts' | 'videos' | 'live' | 'all';

const formatDate = (dateStr: string) => {
  try {
    const datePart = (dateStr || '').split('T')[0];
    const [year, month, day] = datePart.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${day} ${months[parseInt(month) - 1]} ${year}`;
  } catch { return dateStr || ''; }
};

const decodeHtml = (s: string) =>
  (s || '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');

const byDateDesc = (a: any, b: any) => (b?.snippet?.publishedAt || '').localeCompare(a?.snippet?.publishedAt || '');

const dedupeById = (items: any[]) => {
  const seen = new Set<string>();
  return items.filter(v => {
    const id = v?.snippet?.resourceId?.videoId;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const mapItems = (raw: any[]) =>
  raw
    .filter(i => i?.snippet?.resourceId?.videoId && i?.snippet?.thumbnails?.medium && i?.snippet?.title !== 'Deleted video' && i?.snippet?.title !== 'Private video')
    .map(i => ({
      snippet: {
        title: decodeHtml(i.snippet.title),
        publishedAt: i.snippet.publishedAt,
        thumbnails: i.snippet.thumbnails,
        resourceId: { videoId: i.snippet.resourceId.videoId },
      },
    }));

async function enrichDates(items: any[]): Promise<any[]> {
  const ids = items.map(i => i?.snippet?.resourceId?.videoId).filter(Boolean);
  if (!ids.length) return items;

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));

  const map: Record<string, string> = {};

  for (const chunk of chunks) {
    try {
      const data = await ytFetch('videos', {
        id: chunk.join(','),
        part: 'snippet,liveStreamingDetails',
      });
      (data.items || []).forEach((v: any) => {
        if (!v?.id) return;
        const liveStart = v?.liveStreamingDetails?.actualStartTime;
        const published = v?.snippet?.publishedAt;
        map[v.id] = liveStart || published;
      });
    } catch {}
  }

  return items.map(item => {
    const videoId = item?.snippet?.resourceId?.videoId;
    const authoritative = videoId ? map[videoId] : undefined;
    return {
      ...item,
      snippet: {
        ...item.snippet,
        publishedAt: authoritative || item.snippet?.publishedAt,
      },
    };
  });
}

interface VideoModalProps {
  visible: boolean;
  videoId: string | null;
  title: string;
  onClose: () => void;
}

function VideoModal({ visible, videoId, title, onClose }: VideoModalProps) {
  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.videoModal}>
        <StatusBar hidden />
        <YoutubePlayer
            height={PLAYER_H}
            width={SW}
            videoId={videoId || ''}
            play={visible && !!videoId}
            webViewProps={{ allowsInlineMediaPlayback: true, mediaPlaybackRequiresUserAction: false }}
          />
        <Text style={styles.videoModalTitle} numberOfLines={3}>{title}</Text>
        <TouchableOpacity style={styles.modalClose} onPress={onClose}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

export default function VideosScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('shorts');
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const [shorts, setShorts] = useState<any[]>([]);
  const [shortsLoaded, setShortsLoaded] = useState(false);
  const [shortsNextToken, setShortsNextToken] = useState('');
  const [loadingShorts, setLoadingShorts] = useState(false);
  const [loadingMoreShorts, setLoadingMoreShorts] = useState(false);

  const [videos, setVideos] = useState<any[]>([]);
  const [videosLoaded, setVideosLoaded] = useState(false);
  const [videosNextToken, setVideosNextToken] = useState('');
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [loadingMoreVideos, setLoadingMoreVideos] = useState(false);

  const [liveVideos, setLiveVideos] = useState<any[]>([]);
  const [liveLoaded, setLiveLoaded] = useState(false);
  const [liveNextTokens, setLiveNextTokens] = useState<Record<string, string>>({});
  const [loadingLive, setLoadingLive] = useState(false);
  const [loadingMoreLive, setLoadingMoreLive] = useState(false);
  const [liveIds, setLiveIds] = useState<string[]>(FALLBACK_LIVE_IDS);

  const [allVideos, setAllVideos] = useState<any[]>([]);
  const [allLoaded, setAllLoaded] = useState(false);
  const [allNextToken, setAllNextToken] = useState('');
  const [loadingAll, setLoadingAll] = useState(false);
  const [loadingMoreAll, setLoadingMoreAll] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [activeVideoTitle, setActiveVideoTitle] = useState('');

  const [shortsPlayerVisible, setShortsPlayerVisible] = useState(false);
  const [currentShortIndex, setCurrentShortIndex] = useState(0);
  const [playingShortId, setPlayingShortId] = useState<string | null>(null);

  const shortsListRef = useRef<FlatList>(null);
  const shortsNextRef = useRef('');
  const loadingMoreShortsRef = useRef(false);
  const shortsDataRef = useRef<any[]>([]);

  useEffect(() => { shortsNextRef.current = shortsNextToken; }, [shortsNextToken]);
  useEffect(() => { loadingMoreShortsRef.current = loadingMoreShorts; }, [loadingMoreShorts]);
  useEffect(() => { shortsDataRef.current = shorts; }, [shorts]);

  useEffect(() => { fetchShorts(); }, []);

  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    const t = setTimeout(() => doSearch(search), 600);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (activeTab === 'videos' && !videosLoaded) fetchVideos();
    if (activeTab === 'live' && !liveLoaded) loadLiveAndFetch();
    if (activeTab === 'all' && !allLoaded) fetchAll();
  }, [activeTab]);

  const openVideo = (videoId: string, title: string) => {
    setActiveVideoId(videoId);
    setActiveVideoTitle(title);
    setVideoModalVisible(true);
  };

  const closeVideo = () => { setVideoModalVisible(false); setActiveVideoId(null); };

  const fetchShorts = async (pageToken = '') => {
    try {
      if (!pageToken) setLoadingShorts(true); else setLoadingMoreShorts(true);
      const data = await ytFetch('playlistItems', { playlistId: SHORTS_PLAYLIST_ID, part: 'snippet', maxResults: '50', ...(pageToken ? { pageToken } : {}) });
      const enriched = await enrichDates(mapItems(data.items || []));
      if (pageToken) {
        setShorts(prev => { const s = new Set(prev.map((v: any) => v.snippet.resourceId.videoId)); return [...prev, ...enriched.filter((v: any) => !s.has(v.snippet.resourceId.videoId))]; });
      } else { setShorts(dedupeById(enriched)); }
      setShortsNextToken(data.nextPageToken || '');
      setShortsLoaded(true);
    } catch (e) {} finally { setLoadingShorts(false); setLoadingMoreShorts(false); }
  };

  const fetchVideos = async (pageToken = '') => {
    try {
      if (!pageToken) setLoadingVideos(true); else setLoadingMoreVideos(true);
      const data = await ytFetch('playlistItems', { playlistId: VIDEOS_PLAYLIST_ID, part: 'snippet', maxResults: '50', ...(pageToken ? { pageToken } : {}) });
      const enriched = (await enrichDates(mapItems(data.items || []))).sort(byDateDesc);
      if (pageToken) {
        setVideos(prev => { const s = new Set(prev.map((v: any) => v.snippet.resourceId.videoId)); return [...prev, ...enriched.filter((v: any) => !s.has(v.snippet.resourceId.videoId))].sort(byDateDesc); });
      } else { setVideos(dedupeById(enriched)); }
      setVideosNextToken(data.nextPageToken || '');
      setVideosLoaded(true);
    } catch (e) {} finally { setLoadingVideos(false); setLoadingMoreVideos(false); }
  };

  const loadLiveAndFetch = async () => {
    const cached = await getCachedLivePlaylists();
    let ids = cached.filter(p => p.isActive).map(p => p.playlistId);
    if (!ids.length) ids = FALLBACK_LIVE_IDS;
    setLiveIds(ids);
    fetchLive(false, ids);
    const fresh = await syncLivePlaylists();
    let freshIds = fresh.filter(p => p.isActive).map(p => p.playlistId);
    if (!freshIds.length) freshIds = FALLBACK_LIVE_IDS;
    setLiveIds(freshIds);
  };

  const fetchLive = async (loadMore: boolean, idsOverride?: string[]) => {
    try {
      if (!loadMore) setLoadingLive(true); else setLoadingMoreLive(true);
      const ids = idsOverride || liveIds;
      const toFetch = loadMore ? ids.filter(id => liveNextTokens[id]) : ids;
      if (!toFetch.length) return;
      const results = await Promise.all(toFetch.map(async id => {
        const data = await ytFetch('playlistItems', { playlistId: id, part: 'snippet', maxResults: '50', ...(loadMore && liveNextTokens[id] ? { pageToken: liveNextTokens[id] } : {}) });
        const enriched = await enrichDates(mapItems(data.items || []));
        return { items: enriched, nextPageToken: data.nextPageToken || '' };
      }));
      const newTokens = { ...liveNextTokens };
      toFetch.forEach((id, i) => { newTokens[id] = results[i].nextPageToken; });
      setLiveNextTokens(newTokens);
      const newItems = results.flatMap(r => r.items);
      if (loadMore) {
        setLiveVideos(prev => { const s = new Set(prev.map((v: any) => v.snippet.resourceId.videoId)); return [...prev, ...newItems.filter((v: any) => !s.has(v.snippet.resourceId.videoId))].sort(byDateDesc); });
      } else { setLiveVideos(dedupeById(newItems).sort(byDateDesc)); }
      setLiveLoaded(true);
    } catch (e) {} finally { setLoadingLive(false); setLoadingMoreLive(false); }
  };

  const fetchAll = async (pageToken = '') => {
    try {
      if (!pageToken) setLoadingAll(true); else setLoadingMoreAll(true);
      const data = await ytFetch('playlistItems', { playlistId: UPLOADS_PLAYLIST_ID, part: 'snippet', maxResults: '50', ...(pageToken ? { pageToken } : {}) });
      const enriched = (await enrichDates(mapItems(data.items || []))).sort(byDateDesc);
      if (pageToken) {
        setAllVideos(prev => { const s = new Set(prev.map((v: any) => v.snippet.resourceId.videoId)); return [...prev, ...enriched.filter((v: any) => !s.has(v.snippet.resourceId.videoId))].sort(byDateDesc); });
      } else { setAllVideos(dedupeById(enriched)); }
      setAllNextToken(data.nextPageToken || '');
      setAllLoaded(true);
    } catch (e) {} finally { setLoadingAll(false); setLoadingMoreAll(false); }
  };

  const doSearch = async (query: string) => {
    try {
      setSearching(true);
      const data = await ytFetch('search', {
        channelId: CHANNEL_ID,
        part: 'snippet',
        type: 'video',
        maxResults: '50',
        order: 'relevance',
        q: query,
      });
      const q = query.toLowerCase();
      setSearchResults(
        (data.items || [])
          .filter((i: any) =>
            i?.id?.videoId &&
            i?.snippet?.thumbnails &&
            decodeHtml(i.snippet.title).toLowerCase().includes(q)
          )
          .map((i: any) => ({
            snippet: {
              title: decodeHtml(i.snippet.title),
              publishedAt: i.snippet.publishedAt,
              thumbnails: i.snippet.thumbnails,
              resourceId: { videoId: i.id.videoId },
            },
          }))
      );
    } catch (e) {} finally { setSearching(false); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setShorts([]); setShortsLoaded(false); setShortsNextToken('');
    setVideos([]); setVideosLoaded(false); setVideosNextToken('');
    setLiveVideos([]); setLiveLoaded(false); setLiveNextTokens({});
    setAllVideos([]); setAllLoaded(false); setAllNextToken('');
    await Promise.all([fetchShorts(), fetchVideos(), loadLiveAndFetch(), fetchAll()]);
    setShortsLoaded(true); setVideosLoaded(true); setLiveLoaded(true); setAllLoaded(true);
    setRefreshing(false);
  };

  const handleShortEnd = useCallback((index: number) => {
    const next = index + 1;
    if (next < shortsDataRef.current.length) {
      shortsListRef.current?.scrollToIndex({ index: next, animated: true });
    } else if (shortsNextRef.current && !loadingMoreShortsRef.current) {
      fetchShorts(shortsNextRef.current);
    }
  }, []);

  const onShortsViewable = useRef(({ viewableItems }: any) => {
    if (!viewableItems.length) return;
    const index = viewableItems[0].index ?? 0;
    setCurrentShortIndex(index);
    setPlayingShortId(viewableItems[0].item?.snippet?.resourceId?.videoId || null);
    if (index === shortsDataRef.current.length - 1 && shortsNextRef.current && !loadingMoreShortsRef.current) {
      fetchShorts(shortsNextRef.current);
    }
  }).current;

  const shortsViewConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  const ShortsPlayerItem = useCallback(({ item, index }: any) => {
    const videoId = item?.snippet?.resourceId?.videoId;
    const isActive = playingShortId === videoId;
    return (
      <View style={styles.shortsItem}>
        <StatusBar hidden />
        <View style={styles.shortsVideoWrap}>
          {isActive ? (
            <YoutubePlayer
              height={SHORTS_PLAYER_H}
              width={SW}
              videoId={videoId}
              play
              onChangeState={(s: string) => { if (s === 'ended') handleShortEnd(index); }}
              webViewProps={{ allowsInlineMediaPlayback: true, mediaPlaybackRequiresUserAction: false, allowsFullscreenVideo: true }}
              initialPlayerParams={{ rel: 0, modestbranding: 1, controls: 1 }}
            />
          ) : (
            <View style={{ width: SW, height: SHORTS_PLAYER_H, backgroundColor: '#000' }} />
          )}
        </View>
        <View style={styles.shortsOverlay}>
          <Text style={styles.shortsTitle} numberOfLines={3}>{item?.snippet?.title}</Text>
          <Text style={styles.shortsCounter}>{index + 1} / {shortsDataRef.current.length}</Text>
        </View>
        <TouchableOpacity style={styles.shortsClose} onPress={() => { setShortsPlayerVisible(false); setPlayingShortId(null); }}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }, [playingShortId, handleShortEnd]);

  const VideoCard = ({ item }: any) => {
    const videoId = item?.snippet?.resourceId?.videoId;
    const thumb = item?.snippet?.thumbnails?.medium?.url;
    const title = decodeHtml(item?.snippet?.title || '');
    const date = item?.snippet?.publishedAt || '';
    if (!videoId || !thumb) return null;
    return (
      <TouchableOpacity style={styles.card} onPress={() => openVideo(videoId, title)}>
        <Image source={{ uri: thumb }} style={styles.thumb} />
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
          <Text style={styles.cardDate}>{formatDate(date)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const ShortCard = ({ item, index }: any) => {
    const videoId = item?.snippet?.resourceId?.videoId;
    const thumb = item?.snippet?.thumbnails?.high?.url || item?.snippet?.thumbnails?.medium?.url;
    const title = decodeHtml(item?.snippet?.title || '');
    if (!videoId || !thumb) return null;
    return (
      <TouchableOpacity style={styles.shortCard} onPress={() => { setCurrentShortIndex(index); setPlayingShortId(videoId); setShortsPlayerVisible(true); }}>
        <Image source={{ uri: thumb }} style={styles.shortThumb} />
        <View style={styles.shortPlayIcon}><Ionicons name="play-circle" size={36} color="rgba(255,255,255,0.9)" /></View>
        <View style={styles.shortOverlay}><Text style={styles.shortTitle} numberOfLines={2}>{title}</Text></View>
      </TouchableOpacity>
    );
  };

  const LiveCard = ({ item }: any) => {
    const videoId = item?.snippet?.resourceId?.videoId;
    const thumb = item?.snippet?.thumbnails?.medium?.url;
    const title = decodeHtml(item?.snippet?.title || '');
    const date = item?.snippet?.publishedAt || '';
    if (!videoId || !thumb) return null;
    return (
      <TouchableOpacity style={styles.card} onPress={() => openVideo(videoId, title)}>
        <View>
          <Image source={{ uri: thumb }} style={styles.thumb} />
          <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveBadgeText}>LIVE</Text></View>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
          <Text style={styles.cardDate}>{formatDate(date)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const LoadMore = ({ token, loading, onPress }: { token: string; loading: boolean; onPress: () => void }) =>
    token ? (
      <TouchableOpacity style={styles.loadMore} onPress={onPress}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loadMoreText}>Load More</Text>}
      </TouchableOpacity>
    ) : null;

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'shorts', label: 'Shorts', icon: 'flash' },
    { key: 'videos', label: 'Videos', icon: 'videocam' },
    { key: 'live', label: 'Live', icon: 'radio' },
    { key: 'all', label: 'All', icon: 'grid' },
  ];

  const isSearching = !!search.trim();
  const hasMoreLive = Object.values(liveNextTokens).some(t => !!t);

  return (
    <View style={styles.container}>
      <VideoModal visible={videoModalVisible} videoId={activeVideoId} title={activeVideoTitle} onClose={closeVideo} />

      <Modal visible={shortsPlayerVisible} animationType="slide" statusBarTranslucent onRequestClose={() => { setShortsPlayerVisible(false); setPlayingShortId(null); }}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <FlatList
            ref={shortsListRef}
            data={shorts}
            keyExtractor={item => item.snippet.resourceId.videoId}
            renderItem={({ item, index }) => <ShortsPlayerItem item={item} index={index} />}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            snapToInterval={SH}
            snapToAlignment="start"
            decelerationRate="fast"
            onViewableItemsChanged={onShortsViewable}
            viewabilityConfig={shortsViewConfig}
            getItemLayout={(_, index) => ({ length: SH, offset: SH * index, index })}
            initialScrollIndex={currentShortIndex}
            onScrollToIndexFailed={() => {}}
          />
        </View>
      </Modal>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={20} color="#666" />
        <TextInput style={styles.searchInput} placeholder="Search all sermons..." placeholderTextColor="#999" value={search} onChangeText={setSearch} />
        {searching && <ActivityIndicator size="small" color="#0f3460" />}
        {!!search && <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={20} color="#999" /></TouchableOpacity>}
      </View>

      {!isSearching && (
        <View style={styles.tabsRow}>
          {TABS.map(t => (
            <TouchableOpacity key={t.key} style={[styles.tab, activeTab === t.key && styles.tabActive]} onPress={() => setActiveTab(t.key)}>
              <Ionicons name={t.icon as any} size={14} color={activeTab === t.key ? '#fff' : '#555'} />
              <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {isSearching && (
        searching
          ? <ActivityIndicator color="#0f3460" style={{ marginTop: 40 }} size="large" />
          : <FlatList data={searchResults} keyExtractor={(_, i) => `sr${i}`} renderItem={({ item }) => <VideoCard item={item} />} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.empty}>No results found</Text>} />
      )}

      {!isSearching && activeTab === 'shorts' && (
        loadingShorts
          ? <ActivityIndicator size="large" color="#0f3460" style={{ marginTop: 40 }} />
          : <FlatList
              data={shorts}
              keyExtractor={i => i.snippet.resourceId.videoId}
              refreshing={refreshing}
              onRefresh={onRefresh}
              renderItem={({ item, index }) => <ShortCard item={item} index={index} />}
              numColumns={2}
              contentContainerStyle={styles.list}
              columnWrapperStyle={{ gap: 8 }}
              ListEmptyComponent={<Text style={styles.empty}>No shorts found</Text>}
              ListFooterComponent={<LoadMore token={shortsNextToken} loading={loadingMoreShorts} onPress={() => fetchShorts(shortsNextToken)} />}
            />
      )}

      {!isSearching && activeTab === 'videos' && (
        loadingVideos
          ? <ActivityIndicator size="large" color="#0f3460" style={{ marginTop: 40 }} />
          : <FlatList
              data={videos}
              keyExtractor={i => i.snippet.resourceId.videoId}
              refreshing={refreshing}
              onRefresh={onRefresh}
              renderItem={({ item }) => <VideoCard item={item} />}
              contentContainerStyle={styles.list}
              ListEmptyComponent={<Text style={styles.empty}>No videos found</Text>}
              ListFooterComponent={<LoadMore token={videosNextToken} loading={loadingMoreVideos} onPress={() => fetchVideos(videosNextToken)} />}
            />
      )}

      {!isSearching && activeTab === 'live' && (
        loadingLive
          ? <ActivityIndicator size="large" color="#0f3460" style={{ marginTop: 40 }} />
          : <FlatList
              data={liveVideos}
              keyExtractor={i => i.snippet.resourceId.videoId}
              refreshing={refreshing}
              onRefresh={onRefresh}
              renderItem={({ item }) => <LiveCard item={item} />}
              contentContainerStyle={styles.list}
              ListEmptyComponent={<Text style={styles.empty}>No live streams found</Text>}
              ListFooterComponent={hasMoreLive ? <TouchableOpacity style={styles.loadMore} onPress={() => fetchLive(true)}>{loadingMoreLive ? <ActivityIndicator color="#fff" /> : <Text style={styles.loadMoreText}>Load More</Text>}</TouchableOpacity> : null}
            />
      )}

      {!isSearching && activeTab === 'all' && (
        loadingAll
          ? <ActivityIndicator size="large" color="#0f3460" style={{ marginTop: 40 }} />
          : <FlatList
              data={allVideos}
              keyExtractor={i => i.snippet.resourceId.videoId}
              refreshing={refreshing}
              onRefresh={onRefresh}
              renderItem={({ item }) => <VideoCard item={item} />}
              contentContainerStyle={styles.list}
              ListEmptyComponent={<Text style={styles.empty}>No videos found</Text>}
              ListFooterComponent={<LoadMore token={allNextToken} loading={loadingMoreAll} onPress={() => fetchAll(allNextToken)} />}
            />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 12, marginTop: 50, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, elevation: 3 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: '#1a1a2e' },
  tabsRow: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', elevation: 2 },
  tabActive: { backgroundColor: '#0f3460' },
  tabText: { fontSize: 12, color: '#555', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  list: { padding: 12, paddingBottom: 100 },
  card: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, overflow: 'hidden', elevation: 3 },
  thumb: { width: '100%', height: 185 },
  cardInfo: { padding: 10 },
  cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#1a1a2e' },
  cardDate: { fontSize: 12, color: '#888', marginTop: 4 },
  shortCard: { flex: 1, borderRadius: 12, overflow: 'hidden', elevation: 3, marginBottom: 8, backgroundColor: '#000', minHeight: 220 },
  shortThumb: { width: '100%', height: 220 },
  shortPlayIcon: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  shortOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.65)', padding: 8 },
  shortTitle: { fontSize: 11, color: '#fff', fontWeight: '600' },
  liveBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: '#ff0000', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  empty: { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 14 },
  loadMore: { backgroundColor: '#0f3460', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 20 },
  loadMoreText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  shortsItem: { width: SW, height: SH, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  shortsVideoWrap: { width: SW, height: SHORTS_PLAYER_H, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', marginTop: SH * 0.15 },
  shortsOverlay: { position: 'absolute', bottom: 60, left: 16, right: 16 },
  shortsTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  shortsCounter: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  shortsClose: { position: 'absolute', top: 50, right: 16, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 6, zIndex: 10 },
  videoModal: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  videoModalTitle: { color: '#fff', fontSize: 15, fontWeight: '600', padding: 20, lineHeight: 22 },
  modalClose: { position: 'absolute', top: 50, right: 16, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 8, zIndex: 10 },
});

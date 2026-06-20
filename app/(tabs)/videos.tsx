import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getCachedLivePlaylists, syncLivePlaylists } from '../../utils/livePlaylistsSync';
import YoutubePlayer from 'react-native-youtube-iframe';

const API_KEY = 'AIzaSyDB77b7nPE0Fs4tMvrOVZTqq12CXkaZdBg';
const CHANNEL_ID = 'UCFg0eNTRs2UIcihQAVpyrJA';
const PLAYLIST_ID = 'UUFg0eNTRs2UIcihQAVpyrJA';
const SHORTS_PLAYLIST_ID = 'PLZISpWbe8RUjb_YX_C2yEEB7IZnhU9VRA';

const FALLBACK_LIVE_PLAYLIST_IDS = [
  'PLZISpWbe8RUidyhPJNs5xa8-WOnHq-NLj',
];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PLAYER_HEIGHT = SCREEN_HEIGHT * 0.55;

type Tab = 'home' | 'shorts' | 'live' | 'playlists';

const formatDate = (dateStr: string) => {
  try {
    const datePart = (dateStr || '').split('T')[0];
    const parts = datePart.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parts[0];
    const month = parseInt(parts[1], 10);
    const day = parts[2];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${day} ${months[month - 1]} ${year}`;
  } catch { return dateStr || ''; }
};

const decodeHtml = (text: string): string => {
  return (text || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
};

const sortByDate = (a: any, b: any) => {
  const da = (a?.snippet?.publishedAt || '');
  const db = (b?.snippet?.publishedAt || '');
  return db.localeCompare(da);
};

const dedupeById = (items: any[]): any[] => {
  const seen = new Set<string>();
  return items.filter((v: any) => {
    const id = v?.snippet?.resourceId?.videoId;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

export default function VideosScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const [videos, setVideos] = useState<any[]>([]);
  const [allVideos, setAllVideos] = useState<any[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [nextPageToken, setNextPageToken] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  const [shorts, setShorts] = useState<any[]>([]);
  const [loadingShorts, setLoadingShorts] = useState(false);
  const [shortsLoaded, setShortsLoaded] = useState(false);
  const [shortsNextToken, setShortsNextToken] = useState('');
  const [loadingMoreShorts, setLoadingMoreShorts] = useState(false);

  const [liveVideos, setLiveVideos] = useState<any[]>([]);
  const [loadingLive, setLoadingLive] = useState(false);
  const [liveLoaded, setLiveLoaded] = useState(false);
  const [liveNextTokens, setLiveNextTokens] = useState<Record<string, string>>({});
  const [loadingMoreLive, setLoadingMoreLive] = useState(false);
  const [livePlaylistIds, setLivePlaylistIds] = useState<string[]>(FALLBACK_LIVE_PLAYLIST_IDS);

  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [playlistsLoaded, setPlaylistsLoaded] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  const [shortsPlayerVisible, setShortsPlayerVisible] = useState(false);
  const [currentShortIndex, setCurrentShortIndex] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const shortsPlayerRef = useRef<FlatList>(null);
  const shortsNextTokenRef = useRef('');
  const loadingMoreShortsRef = useRef(false);
  const shortsRef = useRef<any[]>([]);

  useEffect(() => { shortsNextTokenRef.current = shortsNextToken; }, [shortsNextToken]);
  useEffect(() => { loadingMoreShortsRef.current = loadingMoreShorts; }, [loadingMoreShorts]);
  useEffect(() => { shortsRef.current = shorts; }, [shorts]);

  useEffect(() => { fetchVideos(); }, []);

  useEffect(() => {
    if (search.trim() === '') { setSearchResults([]); return; }
    const timer = setTimeout(() => searchVideos(search), 600);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (activeTab === 'shorts' && !shortsLoaded) fetchShorts();
    if (activeTab === 'live' && !liveLoaded) {
      (async () => {
        const ids = await loadLivePlaylistIds();
        fetchLive(false, ids);
      })();
    }
    if (activeTab === 'playlists' && !playlistsLoaded) fetchPlaylists();
  }, [activeTab]);

  useEffect(() => {
    if (allVideos.length > 0) setVideos(allVideos);
  }, [allVideos]);

  const fetchVideos = async (pageToken = '') => {
    try {
      if (!pageToken) setLoadingVideos(true);
      else setLoadingMore(true);
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?key=${API_KEY}&playlistId=${PLAYLIST_ID}&part=snippet&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}`
      );
      const data = await res.json();
      const items = (data.items || []).filter(
        (item: any) => item?.snippet?.resourceId?.videoId &&
          item?.snippet?.thumbnails?.medium &&
          item?.snippet?.title !== 'Deleted video' &&
          item?.snippet?.title !== 'Private video'
      );
      if (pageToken) {
        setAllVideos(prev => {
          const existingIds = new Set(prev.map((v: any) => v.snippet.resourceId.videoId));
          const unique = items.filter((v: any) => !existingIds.has(v.snippet.resourceId.videoId));
          return [...prev, ...unique].sort(sortByDate);
        });
      } else {
        const deduped = dedupeById(items).sort(sortByDate);
        setAllVideos(deduped);
        setVideos(deduped);
      }
      setNextPageToken(data.nextPageToken || '');
    } catch (e) {
      console.log('Error fetching videos', e);
    } finally {
      setLoadingVideos(false);
      setLoadingMore(false);
    }
  };

  const fetchShorts = async (pageToken = '') => {
    try {
      if (!pageToken) setLoadingShorts(true);
      else setLoadingMoreShorts(true);
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?key=${API_KEY}&playlistId=${SHORTS_PLAYLIST_ID}&part=snippet&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}`
      );
      const data = await res.json();
      const mapped = (data.items || [])
        .filter((item: any) => item?.snippet?.resourceId?.videoId && item?.snippet?.thumbnails?.medium)
        .map((item: any) => ({
          snippet: {
            title: decodeHtml(item.snippet.title),
            publishedAt: item.snippet.publishedAt,
            thumbnails: item.snippet.thumbnails,
            resourceId: { videoId: item.snippet.resourceId.videoId },
          },
        }));
      if (pageToken) {
        setShorts(prev => {
          const existingIds = new Set(prev.map((v: any) => v.snippet.resourceId.videoId));
          const unique = mapped.filter((v: any) => !existingIds.has(v.snippet.resourceId.videoId));
          return [...prev, ...unique];
        });
      } else {
        setShorts(dedupeById(mapped));
      }
      setShortsNextToken(data.nextPageToken || '');
      setShortsLoaded(true);
    } catch (e) {
      console.log('Error fetching shorts', e);
    } finally {
      setLoadingShorts(false);
      setLoadingMoreShorts(false);
    }
  };

  const loadLivePlaylistIds = async (): Promise<string[]> => {
    const cached = await getCachedLivePlaylists();
    let ids = cached.filter(p => p.isActive).map(p => p.playlistId);
    if (ids.length === 0) ids = FALLBACK_LIVE_PLAYLIST_IDS;
    setLivePlaylistIds(ids);

    const fresh = await syncLivePlaylists();
    let freshIds = fresh.filter(p => p.isActive).map(p => p.playlistId);
    if (freshIds.length === 0) freshIds = FALLBACK_LIVE_PLAYLIST_IDS;
    setLivePlaylistIds(freshIds);
    return freshIds;
  };

  const fetchLivePlaylistPage = async (playlistId: string, pageToken = '') => {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?key=${API_KEY}&playlistId=${playlistId}&part=snippet&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}`
    );
    const data = await res.json();
    const mapped = (data.items || [])
      .filter((item: any) => item?.snippet?.resourceId?.videoId && item?.snippet?.thumbnails?.medium)
      .map((item: any) => ({
        snippet: {
          title: decodeHtml(item.snippet.title),
          publishedAt: item.snippet.publishedAt,
          thumbnails: item.snippet.thumbnails,
          resourceId: { videoId: item.snippet.resourceId.videoId },
        },
      }));
    return { items: mapped, nextPageToken: data.nextPageToken || '' };
  };

  const fetchLive = async (loadMore: boolean, idsOverride?: string[]) => {
    try {
      if (!loadMore) setLoadingLive(true);
      else setLoadingMoreLive(true);

      const ids = idsOverride || livePlaylistIds;

      const playlistsToFetch = loadMore
        ? ids.filter(id => liveNextTokens[id])
        : ids;

      if (playlistsToFetch.length === 0) {
        setLoadingLive(false);
        setLoadingMoreLive(false);
        return;
      }

      const results = await Promise.all(
        playlistsToFetch.map(id => fetchLivePlaylistPage(id, loadMore ? liveNextTokens[id] : ''))
      );

      const newItems = results.flatMap(r => r.items);
      const newTokens: Record<string, string> = { ...liveNextTokens };
      playlistsToFetch.forEach((id, i) => { newTokens[id] = results[i].nextPageToken; });
      setLiveNextTokens(newTokens);

      if (loadMore) {
        setLiveVideos(prev => {
          const existingIds = new Set(prev.map((v: any) => v.snippet.resourceId.videoId));
          const unique = newItems.filter((v: any) => !existingIds.has(v.snippet.resourceId.videoId));
          return [...prev, ...unique].sort(sortByDate);
        });
      } else {
        setLiveVideos(dedupeById(newItems).sort(sortByDate));
      }
      setLiveLoaded(true);
    } catch (e) {
      console.log('Error fetching live', e);
    } finally {
      setLoadingLive(false);
      setLoadingMoreLive(false);
    }
  };

  const fetchPlaylists = async () => {
    try {
      setLoadingPlaylists(true);
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/playlists?key=${API_KEY}&channelId=${CHANNEL_ID}&part=snippet,contentDetails&maxResults=50`
      );
      const data = await res.json();
      setPlaylists(data.items || []);
      setPlaylistsLoaded(true);
    } catch (e) {
      console.log('Error fetching playlists', e);
    } finally {
      setLoadingPlaylists(false);
    }
  };

  const searchVideos = async (query: string) => {
    try {
      setSearching(true);
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${CHANNEL_ID}&part=snippet&type=video&maxResults=20&order=date&q=${encodeURIComponent(query)}`
      );
      const data = await res.json();
      const mapped = (data.items || [])
        .filter((item: any) => item?.id?.videoId && item?.snippet?.thumbnails)
        .map((item: any) => ({
          snippet: {
            title: decodeHtml(item.snippet.title),
            publishedAt: item.snippet.publishedAt,
            thumbnails: item.snippet.thumbnails,
            resourceId: { videoId: item.id.videoId },
          },
        }));
      setSearchResults(mapped);
    } catch (e) {
      console.log('Error searching', e);
    } finally {
      setSearching(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setAllVideos([]);
    setVideos([]);
    setShorts([]);
    setShortsNextToken('');
    setLiveVideos([]);
    setLiveNextTokens({});
    setPlaylists([]);
    setNextPageToken('');
    setShortsLoaded(false);
    setLiveLoaded(false);
    setPlaylistsLoaded(false);
    await Promise.all([
      fetchVideos(),
      fetchShorts(),
      loadLivePlaylistIds().then(ids => fetchLive(false, ids)),
      fetchPlaylists(),
    ]);
    setShortsLoaded(true);
    setLiveLoaded(true);
    setPlaylistsLoaded(true);
    setRefreshing(false);
  };

  const openShortsPlayer = (index: number) => {
    setCurrentShortIndex(index);
    setPlayingId(shorts[index]?.snippet?.resourceId?.videoId || null);
    setShortsPlayerVisible(true);
  };

  const closeShortsPlayer = () => {
    setShortsPlayerVisible(false);
    setPlayingId(null);
  };

  const handleVideoEnd = useCallback((index: number) => {
    const currentShorts = shortsRef.current;
    const nextIndex = index + 1;
    if (nextIndex < currentShorts.length) {
      shortsPlayerRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    } else if (shortsNextTokenRef.current && !loadingMoreShortsRef.current) {
      fetchShorts(shortsNextTokenRef.current);
    }
  }, []);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const index = viewableItems[0].index ?? 0;
      setCurrentShortIndex(index);
      setPlayingId(viewableItems[0].item?.snippet?.resourceId?.videoId || null);
      const isLast = index === shortsRef.current.length - 1;
      if (isLast && shortsNextTokenRef.current && !loadingMoreShortsRef.current) {
        fetchShorts(shortsNextTokenRef.current);
      }
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  const ShortsPlayerItem = useCallback(({ item, index }: any) => {
    const videoId = item?.snippet?.resourceId?.videoId;
    const title = item?.snippet?.title || '';
    const isActive = playingId === videoId;

    return (
      <View style={styles.shortsPlayerItem}>
        <StatusBar hidden />
        <View style={styles.shortsVideoWrapper}>
          {isActive ? (
            <YoutubePlayer
              height={PLAYER_HEIGHT}
              width={SCREEN_WIDTH}
              videoId={videoId}
              play={true}
              onChangeState={(state: string) => {
                if (state === 'ended') handleVideoEnd(index);
              }}
              onError={() => {
                Linking.openURL(`https://www.youtube.com/shorts/${videoId}`);
              }}
              webViewProps={{
                allowsInlineMediaPlayback: true,
                mediaPlaybackRequiresUserAction: false,
                allowsFullscreenVideo: true,
                scalesPageToFit: true,
                injectedJavaScript: `
                  document.body.style.margin='0';
                  document.body.style.padding='0';
                  document.querySelector('iframe') && (document.querySelector('iframe').style.width='100%');
                  true;
                `,
              }}
              initialPlayerParams={{
                rel: 0,
                modestbranding: 1,
                controls: 1,
                fs: 1,
              }}
            />
          ) : (
            <View style={{ width: SCREEN_WIDTH, height: PLAYER_HEIGHT, backgroundColor: '#000' }} />
          )}
        </View>
        <View style={styles.shortsOverlay}>
          <Text style={styles.shortsVideoTitle} numberOfLines={3}>{title}</Text>
          <Text style={styles.shortsCounter}>{index + 1} / {shortsRef.current.length}</Text>
        </View>
        <TouchableOpacity style={styles.shortsCloseBtn} onPress={closeShortsPlayer}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }, [playingId, handleVideoEnd]);

  const VideoCard = ({ item }: any) => {
    const videoId = item?.snippet?.resourceId?.videoId;
    const thumbUrl = item?.snippet?.thumbnails?.medium?.url;
    const title = decodeHtml(item?.snippet?.title || '');
    const date = item?.snippet?.publishedAt || '';
    if (!videoId || !thumbUrl) return null;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${videoId}`)}
      >
        <Image source={{ uri: thumbUrl }} style={styles.thumbnail} />
        <View style={styles.cardInfo}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          <Text style={styles.date}>{formatDate(date)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const ShortCard = ({ item, index }: any) => {
    const videoId = item?.snippet?.resourceId?.videoId;
    const thumbUrl = item?.snippet?.thumbnails?.high?.url || item?.snippet?.thumbnails?.medium?.url;
    const title = decodeHtml(item?.snippet?.title || '');
    if (!videoId || !thumbUrl) return null;
    return (
      <TouchableOpacity
        style={styles.shortCard}
        onPress={() => openShortsPlayer(index)}
      >
        <Image source={{ uri: thumbUrl }} style={styles.shortThumbnail} />
        <View style={styles.shortPlayIcon}>
          <Ionicons name="play-circle" size={36} color="rgba(255,255,255,0.9)" />
        </View>
        <View style={styles.shortOverlay}>
          <Text style={styles.shortTitle} numberOfLines={2}>{title}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const PlaylistCard = ({ item }: any) => {
    const thumbUrl = item?.snippet?.thumbnails?.medium?.url;
    const title = decodeHtml(item?.snippet?.title || '');
    const count = item?.contentDetails?.itemCount || 0;
    return (
      <TouchableOpacity
        style={styles.playlistCard}
        onPress={() => Linking.openURL(`https://www.youtube.com/playlist?list=${item.id}`)}
      >
        <View style={styles.playlistThumbWrap}>
          {thumbUrl
            ? <Image source={{ uri: thumbUrl }} style={styles.playlistThumb} />
            : <View style={[styles.playlistThumb, { backgroundColor: '#ddd' }]} />
          }
          <View style={styles.playlistCount}>
            <Ionicons name="list" size={11} color="#fff" />
            <Text style={styles.playlistCountText}>{count}</Text>
          </View>
        </View>
        <View style={styles.playlistInfo}>
          <Text style={styles.playlistTitle} numberOfLines={2}>{title}</Text>
          <Text style={styles.playlistMeta}>{count} videos</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'home', label: 'All', icon: 'videocam' },
    { key: 'shorts', label: 'Shorts', icon: 'flash' },
    { key: 'live', label: 'Live', icon: 'radio' },
    { key: 'playlists', label: 'Playlists', icon: 'list' },
  ];

  const isSearching = search.trim().length > 0;
  const hasMoreLive = Object.values(liveNextTokens).some(t => !!t);

  return (
    <View style={styles.container}>

      <Modal
        visible={shortsPlayerVisible}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closeShortsPlayer}
      >
        <View style={styles.shortsPlayerContainer}>
          <FlatList
            ref={shortsPlayerRef}
            data={shorts}
            keyExtractor={(item) => item.snippet.resourceId.videoId}
            renderItem={({ item, index }) => <ShortsPlayerItem item={item} index={index} />}
            pagingEnabled
            horizontal={false}
            showsVerticalScrollIndicator={false}
            snapToInterval={SCREEN_HEIGHT}
            snapToAlignment="start"
            decelerationRate="fast"
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            getItemLayout={(_, index) => ({
              length: SCREEN_HEIGHT,
              offset: SCREEN_HEIGHT * index,
              index,
            })}
            initialScrollIndex={currentShortIndex}
            onScrollToIndexFailed={() => {}}
          />
        </View>
      </Modal>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search all sermons..."
          placeholderTextColor="#999"
          value={search}
          onChangeText={setSearch}
        />
        {searching && <ActivityIndicator size="small" color="#0f3460" />}
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {!isSearching && (
        <View style={styles.tabsRow}>
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons
                name={tab.icon as any}
                size={14}
                color={activeTab === tab.key ? '#fff' : '#555'}
              />
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {isSearching && (
        searching
          ? <ActivityIndicator color="#0f3460" style={{ marginTop: 40 }} size="large" />
          : <FlatList
              data={searchResults}
              keyExtractor={(_, i) => `s${i}`}
              renderItem={({ item }) => <VideoCard item={item} />}
              contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
              ListEmptyComponent={<Text style={styles.empty}>No results found</Text>}
            />
      )}

      {!isSearching && activeTab === 'home' && (
        loadingVideos
          ? <ActivityIndicator size="large" color="#0f3460" style={{ marginTop: 40 }} />
          : <FlatList
              data={videos}
              keyExtractor={(item) => item.snippet.resourceId.videoId}
              refreshing={refreshing}
              onRefresh={onRefresh}
              renderItem={({ item }) => <VideoCard item={item} />}
              contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
              ListEmptyComponent={<Text style={styles.empty}>No videos found</Text>}
              ListFooterComponent={
                nextPageToken ? (
                  <TouchableOpacity style={styles.loadMore} onPress={() => fetchVideos(nextPageToken)}>
                    {loadingMore
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.loadMoreText}>Load More Videos</Text>
                    }
                  </TouchableOpacity>
                ) : null
              }
            />
      )}

      {!isSearching && activeTab === 'shorts' && (
        loadingShorts
          ? <ActivityIndicator size="large" color="#0f3460" style={{ marginTop: 40 }} />
          : <FlatList
              data={shorts}
              keyExtractor={(item) => item.snippet.resourceId.videoId}
              refreshing={refreshing}
              onRefresh={onRefresh}
              renderItem={({ item, index }) => <ShortCard item={item} index={index} />}
              numColumns={2}
              contentContainerStyle={{ padding: 8, paddingBottom: 100 }}
              columnWrapperStyle={{ gap: 8 }}
              ListEmptyComponent={<Text style={styles.empty}>No shorts found</Text>}
              ListFooterComponent={
                shortsNextToken ? (
                  <TouchableOpacity style={styles.loadMore} onPress={() => fetchShorts(shortsNextToken)}>
                    {loadingMoreShorts
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.loadMoreText}>Load More Videos</Text>
                    }
                  </TouchableOpacity>
                ) : null
              }
            />
      )}

      {!isSearching && activeTab === 'live' && (
        loadingLive
          ? <ActivityIndicator size="large" color="#0f3460" style={{ marginTop: 40 }} />
          : <FlatList
              data={liveVideos}
              keyExtractor={(item) => item.snippet.resourceId.videoId}
              refreshing={refreshing}
              onRefresh={onRefresh}
              renderItem={({ item }) => {
                const videoId = item?.snippet?.resourceId?.videoId;
                const thumbUrl = item?.snippet?.thumbnails?.medium?.url;
                if (!videoId || !thumbUrl) return null;
                return (
                  <TouchableOpacity
                    style={styles.card}
                    onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${videoId}`)}
                  >
                    <View>
                      <Image source={{ uri: thumbUrl }} style={styles.thumbnail} />
                      <View style={styles.liveBadge}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveBadgeText}>LIVE</Text>
                      </View>
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.title} numberOfLines={2}>{decodeHtml(item.snippet.title)}</Text>
                      <Text style={styles.date}>{formatDate(item.snippet.publishedAt)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
              ListEmptyComponent={<Text style={styles.empty}>No live streams found</Text>}
              ListFooterComponent={
                hasMoreLive ? (
                  <TouchableOpacity style={styles.loadMore} onPress={() => fetchLive(true)}>
                    {loadingMoreLive
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.loadMoreText}>Load More Videos</Text>
                    }
                  </TouchableOpacity>
                ) : null
              }
            />
      )}

      {!isSearching && activeTab === 'playlists' && (
        loadingPlaylists
          ? <ActivityIndicator size="large" color="#0f3460" style={{ marginTop: 40 }} />
          : <FlatList
              data={playlists}
              keyExtractor={(item) => item.id}
              refreshing={refreshing}
              onRefresh={onRefresh}
              renderItem={({ item }) => <PlaylistCard item={item} />}
              contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
              ListEmptyComponent={<Text style={styles.empty}>No playlists found</Text>}
            />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 12,
    marginTop: 50,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    elevation: 3,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: '#1a1a2e' },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    elevation: 2,
  },
  tabActive: { backgroundColor: '#0f3460' },
  tabText: { fontSize: 12, color: '#555', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, overflow: 'hidden', elevation: 3 },
  thumbnail: { width: '100%', height: 185 },
  cardInfo: { padding: 10 },
  title: { fontSize: 14, fontWeight: 'bold', color: '#1a1a2e' },
  date: { fontSize: 12, color: '#888', marginTop: 4 },
  shortCard: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    marginBottom: 8,
    backgroundColor: '#000',
    minHeight: 220,
  },
  shortThumbnail: { width: '100%', height: 220 },
  shortPlayIcon: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shortOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    padding: 8,
  },
  shortTitle: { fontSize: 11, color: '#fff', fontWeight: '600' },
  liveBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#ff0000',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  playlistCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 3,
    flexDirection: 'row',
  },
  playlistThumbWrap: { position: 'relative' },
  playlistThumb: { width: 120, height: 80 },
  playlistCount: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  playlistCountText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  playlistInfo: { flex: 1, padding: 10, justifyContent: 'center' },
  playlistTitle: { fontSize: 13, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 4 },
  playlistMeta: { fontSize: 12, color: '#888' },
  empty: { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 14 },
  loadMore: { backgroundColor: '#0f3460', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 20 },
  loadMoreText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  shortsPlayerContainer: { flex: 1, backgroundColor: '#000' },
  shortsPlayerItem: {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      backgroundColor: '#000',
      justifyContent: 'center',
      alignItems: 'center',
    },
  shortsVideoWrapper: {
      width: SCREEN_WIDTH,
      height: PLAYER_HEIGHT,
      backgroundColor: '#000',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: SCREEN_HEIGHT * 0.15,
      paddingHorizontal: 0,
    },
  shortsOverlay: {
    position: 'absolute',
    bottom: 60,
    left: 16,
    right: 16,
  },
  shortsVideoTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    marginBottom: 4,
  },
  shortsCounter: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  shortsCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 6,
    zIndex: 10,
  },
});

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const API_KEY = 'AIzaSyDB77b7nPE0Fs4tMvrOVZTqq12CXkaZdBg';
const CHANNEL_ID = 'UCFg0eNTRs2UIcihQAVpyrJA';
const PLAYLIST_ID = 'UUFg0eNTRs2UIcihQAVpyrJA';

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

const parseDuration = (iso: string): number => {
  try {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 9999;
    const h = parseInt(match[1] || '0', 10);
    const m = parseInt(match[2] || '0', 10);
    const s = parseInt(match[3] || '0', 10);
    return h * 3600 + m * 60 + s;
  } catch { return 9999; }
};

export default function VideosScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Videos
  const [videos, setVideos] = useState<any[]>([]);
  const [allVideos, setAllVideos] = useState<any[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [nextPageToken, setNextPageToken] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  // Shorts
  const [shorts, setShorts] = useState<any[]>([]);
  const [loadingShorts, setLoadingShorts] = useState(false);
  const [shortsLoaded, setShortsLoaded] = useState(false);
  const [shortsNextToken, setShortsNextToken] = useState('');
  const [loadingMoreShorts, setLoadingMoreShorts] = useState(false);

  // Live — now with pagination
  const [liveVideos, setLiveVideos] = useState<any[]>([]);
  const [loadingLive, setLoadingLive] = useState(false);
  const [liveLoaded, setLiveLoaded] = useState(false);
  const [liveNextToken, setLiveNextToken] = useState('');
  const [loadingMoreLive, setLoadingMoreLive] = useState(false);

  // Playlists
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [playlistsLoaded, setPlaylistsLoaded] = useState(false);

  // Pull to refresh
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchVideos(); }, []);

  useEffect(() => {
    if (search.trim() === '') { setSearchResults([]); return; }
    const timer = setTimeout(() => searchVideos(search), 600);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (activeTab === 'shorts' && !shortsLoaded) fetchShorts();
    if (activeTab === 'live' && !liveLoaded) fetchLive();
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
          const combined = [...prev, ...items];
          return combined.sort((a: any, b: any) => {
            const da = (a?.snippet?.publishedAt || '').split('T')[0];
            const db = (b?.snippet?.publishedAt || '').split('T')[0];
            return db.localeCompare(da);
          });
        });
      } else {
        const sorted = [...items].sort((a: any, b: any) => {
          const da = (a?.snippet?.publishedAt || '').split('T')[0];
          const db = (b?.snippet?.publishedAt || '').split('T')[0];
          return db.localeCompare(da);
        });
        setAllVideos(sorted);
        setVideos(sorted);
      }
      setNextPageToken(data.nextPageToken || '');
    } catch (e) {
      console.log('Error fetching videos', e);
    } finally {
      setLoadingVideos(false);
      setLoadingMore(false);
    }
  };

  // Simple duration check — trust YouTube's videoDuration=short parameter
  // Only remove obvious long videos using a lightweight API check
  const filterShortsByDuration = async (items: any[]): Promise<any[]> => {
    try {
      if (items.length === 0) return [];
      const videoIds = items.map((i: any) => i.snippet.resourceId.videoId).join(',');
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?key=${API_KEY}&id=${videoIds}&part=contentDetails`
      );
      const data = await res.json();
      const durationMap: Record<string, number> = {};
      (data.items || []).forEach((v: any) => {
        durationMap[v.id] = parseDuration(v.contentDetails?.duration || '');
      });
      return items.filter((i: any) => {
        const secs = durationMap[i.snippet.resourceId.videoId];
        if (secs === undefined) return true;
        return secs <= 180;
      });
    } catch (e) {
      console.log('Duration filter error', e);
      return items; // if API fails — return all
    }
  };

  const fetchShorts = async (pageToken = '') => {
    try {
      if (!pageToken) setLoadingShorts(true);
      else setLoadingMoreShorts(true);
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${CHANNEL_ID}&part=snippet&type=video&maxResults=50&order=date&videoDuration=short${pageToken ? `&pageToken=${pageToken}` : ''}`
      );
      const data = await res.json();
      const mapped = (data.items || [])
        .filter((item: any) => {
          if (!item?.id?.videoId || !item?.snippet?.thumbnails) return false;
          return true;
        })
        .map((item: any) => ({
          snippet: {
            title: decodeHtml(item.snippet.title),
            publishedAt: item.snippet.publishedAt,
            thumbnails: item.snippet.thumbnails,
            resourceId: { videoId: item.id.videoId },
          },
        }));
      const filtered = await filterShortsByDuration(mapped);
      if (pageToken) {
        setShorts(prev => [...prev, ...filtered]);
      } else {
        setShorts(filtered);
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

  // Live with full pagination support
  const fetchLive = async (pageToken = '') => {
    try {
      if (!pageToken) setLoadingLive(true);
      else setLoadingMoreLive(true);
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${CHANNEL_ID}&part=snippet&type=video&eventType=completed&maxResults=50&order=date${pageToken ? `&pageToken=${pageToken}` : ''}`
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
      if (pageToken) {
        setLiveVideos(prev => [...prev, ...mapped]);
      } else {
        setLiveVideos(mapped);
      }
      setLiveNextToken(data.nextPageToken || '');
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

  // Pull to refresh — resets and refetches all tabs
  const onRefresh = async () => {
    setRefreshing(true);
    setAllVideos([]);
    setVideos([]);
    setShorts([]);
    setShortsNextToken('');
    setLiveVideos([]);
    setLiveNextToken('');
    setPlaylists([]);
    setNextPageToken('');
    await Promise.all([
      fetchVideos(),
      fetchShorts(),
      fetchLive(),
      fetchPlaylists(),
    ]);
    setShortsLoaded(true);
    setLiveLoaded(true);
    setPlaylistsLoaded(true);
    setRefreshing(false);
  };

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

  const ShortCard = ({ item }: any) => {
    const videoId = item?.snippet?.resourceId?.videoId;
    const thumbUrl = item?.snippet?.thumbnails?.high?.url || item?.snippet?.thumbnails?.medium?.url;
    const title = decodeHtml(item?.snippet?.title || '');
    if (!videoId || !thumbUrl) return null;
    return (
      <TouchableOpacity
        style={styles.shortCard}
        onPress={() => Linking.openURL(`https://www.youtube.com/shorts/${videoId}`)}
      >
        <Image source={{ uri: thumbUrl }} style={styles.shortThumbnail} />
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

  return (
    <View style={styles.container}>

      {/* Search */}
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

      {/* Tabs */}
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

      {/* Search results */}
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

      {/* Videos tab */}
      {!isSearching && activeTab === 'home' && (
        loadingVideos
          ? <ActivityIndicator size="large" color="#0f3460" style={{ marginTop: 40 }} />
          : <FlatList
              data={videos}
              keyExtractor={(_, i) => `v${i}`}
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

      {/* Shorts tab */}
      {!isSearching && activeTab === 'shorts' && (
        loadingShorts
          ? <ActivityIndicator size="large" color="#0f3460" style={{ marginTop: 40 }} />
          : <FlatList
              data={shorts}
              keyExtractor={(_, i) => `sh${i}`}
              refreshing={refreshing}
              onRefresh={onRefresh}
              renderItem={({ item }) => <ShortCard item={item} />}
              numColumns={2}
              contentContainerStyle={{ padding: 8, paddingBottom: 100 }}
              columnWrapperStyle={{ gap: 8 }}
              ListEmptyComponent={<Text style={styles.empty}>No shorts found</Text>}
              ListFooterComponent={
                shortsNextToken ? (
                  <TouchableOpacity style={styles.loadMore} onPress={() => fetchShorts(shortsNextToken)}>
                    {loadingMoreShorts
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.loadMoreText}>Load More Shorts</Text>
                    }
                  </TouchableOpacity>
                ) : null
              }
            />
      )}

      {/* Live tab */}
      {!isSearching && activeTab === 'live' && (
        loadingLive
          ? <ActivityIndicator size="large" color="#0f3460" style={{ marginTop: 40 }} />
          : <FlatList
              data={liveVideos}
              keyExtractor={(_, i) => `l${i}`}
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
                liveNextToken ? (
                  <TouchableOpacity style={styles.loadMore} onPress={() => fetchLive(liveNextToken)}>
                    {loadingMoreLive
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.loadMoreText}>Load More Live</Text>
                    }
                  </TouchableOpacity>
                ) : null
              }
            />
      )}

      {/* Playlists tab */}
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
});
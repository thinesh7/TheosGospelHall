import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Linking,
  Modal,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { useTheme } from '../../utils/ThemeContext';
import { getCachedLivePlaylists, syncLivePlaylists } from '../../utils/livePlaylistsSync';
import { ytFetch } from '../../utils/youtubeProxy';

const CHANNEL_ID = 'UCFg0eNTRs2UIcihQAVpyrJA';
const UPLOADS_PLAYLIST_ID = 'UUFg0eNTRs2UIcihQAVpyrJA';
const SHORTS_PLAYLIST_ID = 'PLZISpWbe8RUjb_YX_C2yEEB7IZnhU9VRA';
const VIDEOS_PLAYLIST_ID = 'PLZISpWbe8RUgXpqMWjZCAZUTmYQ8b1qAb';
const FALLBACK_LIVE_IDS = ['PLZISpWbe8RUidyhPJNs5xa8-WOnHq-NLj'];

const getWindow = () => Dimensions.get('window');
const { width: SW } = getWindow();

type Tab = 'shorts' | 'videos' | 'live' | 'all';

function useWindowDimensions() {
  const [dims, setDims] = useState(getWindow);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setDims(window));
    return () => sub.remove();
  }, []);
  return dims;
}

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

const parseDuration = (iso: string): string => {
  if (!iso) return '';
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '';
  const h = parseInt(match[1] || '0');
  const m = parseInt(match[2] || '0');
  const s = parseInt(match[3] || '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

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
        duration: '',
      },
    }));

async function enrichDates(items: any[]): Promise<any[]> {
  const ids = items.map(i => i?.snippet?.resourceId?.videoId).filter(Boolean);
  if (!ids.length) return items;
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));
  const map: Record<string, { date: string; duration: string }> = {};
  for (const chunk of chunks) {
    try {
      const data = await ytFetch('videos', { id: chunk.join(','), part: 'snippet,liveStreamingDetails,contentDetails' });
      (data.items || []).forEach((v: any) => {
        if (!v?.id) return;
        map[v.id] = {
          date: v?.liveStreamingDetails?.actualStartTime || v?.snippet?.publishedAt,
          duration: parseDuration(v?.contentDetails?.duration || ''),
        };
      });
    } catch {}
  }
  return items.map(item => {
    const videoId = item?.snippet?.resourceId?.videoId;
    const info = videoId ? map[videoId] : undefined;
    return {
      ...item,
      snippet: {
        ...item.snippet,
        publishedAt: info?.date || item.snippet?.publishedAt,
        duration: info?.duration || '',
      },
    };
  });
}

function BrokenTvIcon() {
  return (
    <View style={errorStyles.iconWrap}>
      <View style={errorStyles.tv}>
        <View style={errorStyles.tvScreen}>
          <View style={errorStyles.xEyesRow}>
            <View style={errorStyles.xEye}>
              <View style={[errorStyles.xLine, errorStyles.xLine1]} />
              <View style={[errorStyles.xLine, errorStyles.xLine2]} />
            </View>
            <View style={errorStyles.xEye}>
              <View style={[errorStyles.xLine, errorStyles.xLine1]} />
              <View style={[errorStyles.xLine, errorStyles.xLine2]} />
            </View>
          </View>
          <View style={errorStyles.mouth} />
        </View>
        <View style={errorStyles.tvBase} />
        <View style={errorStyles.antenna1} />
        <View style={errorStyles.antenna2} />
        <View style={errorStyles.crack1} />
        <View style={errorStyles.crack2} />
      </View>
      <View style={errorStyles.playBadge}>
        <Ionicons name="play" size={12} color="#fff" />
      </View>
    </View>
  );
}

interface VideoErrorProps { onRetry: () => void; }

function VideoErrorState({ onRetry }: VideoErrorProps) {
  const { colors } = useTheme();
  return (
    <View style={[errorStyles.container, { backgroundColor: colors.bg }]}>
      <BrokenTvIcon />
      <Text style={[errorStyles.title, { color: colors.text }]}>Oh! No...</Text>
      <Text style={[errorStyles.subtitle, { color: colors.subtext }]}>Looks like something went wrong.</Text>
      <View style={[errorStyles.tipsBox, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
        <View style={errorStyles.tipRow}>
          <Ionicons name="wifi" size={18} color="#e05c5c" />
          <Text style={[errorStyles.tipText, { color: colors.text }]}>Please check your internet connection.</Text>
        </View>
        <View style={[errorStyles.divider, { backgroundColor: colors.divider }]} />
        <View style={errorStyles.tipRow}>
          <Ionicons name="refresh-circle" size={18} color={colors.subtext} />
          <Text style={[errorStyles.tipText, { color: colors.text }]}>Close the app fully and try again.</Text>
        </View>
      </View>
      <TouchableOpacity style={errorStyles.retryBtn} onPress={onRetry} activeOpacity={0.85}>
        <Ionicons name="refresh" size={16} color="#fff" />
        <Text style={errorStyles.retryText}>Try Again</Text>
      </TouchableOpacity>
      <Text style={[errorStyles.footer, { color: colors.subtext }]}>Still not working? Please try again later.</Text>
    </View>
  );
}

const LOADING_MESSAGES = [
  '🎬 Preparing your video...',
  '📡 Connecting to the stream...',
  '🍿 Almost ready, your video is on the way...',
  '✨ Getting everything ready for you...',
];

function VideoLoadingState() {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    Animated.loop(Animated.timing(spinAnim, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true })).start();
  }, []);

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.04, duration: 900, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 900, useNativeDriver: true }),
    ])).start();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setMsgIndex(i => (i + 1) % LOADING_MESSAGES.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={loadingStyles.container}>
      <View style={loadingStyles.filmStrip}>
        {[...Array(5)].map((_, i) => <View key={i} style={loadingStyles.filmHole} />)}
      </View>
      <Animated.View style={[loadingStyles.playCircle, { transform: [{ scale: scaleAnim }] }]}>
        <Animated.View style={[loadingStyles.spinRing, { transform: [{ rotate: spin }] }]} />
        <Ionicons name="play" size={36} color="#fff" style={{ marginLeft: 4 }} />
      </Animated.View>
      <View style={loadingStyles.filmStrip}>
        {[...Array(5)].map((_, i) => <View key={i} style={loadingStyles.filmHole} />)}
      </View>
      <Animated.Text style={[loadingStyles.message, { opacity: fadeAnim }]}>{LOADING_MESSAGES[msgIndex]}</Animated.Text>
      <Text style={loadingStyles.subMessage}>This may take a few seconds</Text>
    </View>
  );
}

const TAB_LOADING_MESSAGES: Record<string, string[]> = {
  shorts: ['⚡ Loading Shorts...', '🎬 Fetching latest clips...', '✨ Almost there...'],
  videos: ['🎬 Loading Videos...', '📡 Fetching sermons...', '✨ Almost there...'],
  live: ['📡 Loading Live Streams...', '🔴 Fetching broadcasts...', '✨ Almost there...'],
  all: ['🎬 Loading All Videos...', '📡 Fetching content...', '✨ Almost there...'],
  search: ['🔍 Searching sermons...', '📡 Finding results...', '✨ Almost there...'],
};

function TabLoadingState({ tab }: { tab: string }) {
  const { colors } = useTheme();
  const spinAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const bar1 = useRef(new Animated.Value(0.3)).current;
  const bar2 = useRef(new Animated.Value(0.6)).current;
  const bar3 = useRef(new Animated.Value(1)).current;
  const bar4 = useRef(new Animated.Value(0.5)).current;
  const [msgIndex, setMsgIndex] = useState(0);
  const messages = TAB_LOADING_MESSAGES[tab] || TAB_LOADING_MESSAGES.videos;

  useEffect(() => {
    Animated.loop(Animated.timing(spinAnim, { toValue: 1, duration: 1800, easing: Easing.linear, useNativeDriver: true })).start();
  }, []);

  useEffect(() => {
    const animBar = (anim: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.2, duration: 400, useNativeDriver: true }),
      ]));
    Animated.parallel([animBar(bar1, 0), animBar(bar2, 150), animBar(bar3, 300), animBar(bar4, 450)]).start();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
        setMsgIndex(i => (i + 1) % messages.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={[tabLoadingStyles.container, { backgroundColor: colors.bg }]}>
      <View style={tabLoadingStyles.iconArea}>
        <Animated.View style={[tabLoadingStyles.spinRing, { borderTopColor: colors.accent, transform: [{ rotate: spin }] }]} />
        <Ionicons name="play-circle" size={32} color={colors.accent} />
      </View>
      <View style={tabLoadingStyles.barsRow}>
        {[bar1, bar2, bar3, bar4].map((bar, i) => (
          <Animated.View key={i} style={[tabLoadingStyles.bar, { backgroundColor: colors.accent, opacity: bar }]} />
        ))}
      </View>
      <Animated.Text style={[tabLoadingStyles.message, { color: colors.text, opacity: fadeAnim }]}>{messages[msgIndex]}</Animated.Text>
      <Text style={[tabLoadingStyles.sub, { color: colors.subtext }]}>Fetching from YouTube...</Text>
    </View>
  );
}

function VideoActions({ videoId, title, absolute = false }: { videoId: string; title: string; absolute?: boolean }) {
  const { colors } = useTheme();
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

  const openYouTube = () => {
    Linking.openURL(`vnd.youtube://${videoId}`)
      .catch(() => Linking.openURL(youtubeUrl));
  };

  const shareVideo = async () => {
    await Share.share({
      message: `${title}\n\n${youtubeUrl}`,
      url: youtubeUrl,
      title,
    });
  };

  return (
    <View style={[actionStyles.container, absolute && actionStyles.containerAbsolute]}>
      <TouchableOpacity style={actionStyles.iconBtn} onPress={openYouTube} activeOpacity={0.8}>
        <View style={[actionStyles.iconCircle, { backgroundColor: '#ff0000' }]}>
          <Ionicons name="logo-youtube" size={22} color="#fff" />
        </View>
        <Text style={[actionStyles.iconLabel, { color: '#fff' }]}>YouTube</Text>
      </TouchableOpacity>
      <TouchableOpacity style={actionStyles.iconBtn} onPress={shareVideo} activeOpacity={0.8}>
        <View style={[actionStyles.iconCircle, { backgroundColor: '#4f7fff' }]}>
          <Ionicons name="share-social" size={22} color="#fff" />
        </View>
        <Text style={[actionStyles.iconLabel, { color: '#fff' }]}>Share</Text>
      </TouchableOpacity>
    </View>
  );
}

interface VideoModalProps {
  visible: boolean;
  videoId: string | null;
  title: string;
  onClose: () => void;
}

function VideoModal({ visible, videoId, title, onClose }: VideoModalProps) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const [playerReady, setPlayerReady] = useState(false);

  useEffect(() => { if (!visible) setPlayerReady(false); }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.videoModal, isLandscape && styles.videoModalLandscape]}>
        <StatusBar hidden />
        {!playerReady && (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', zIndex: 10 }]}>
            <VideoLoadingState />
          </View>
        )}
        {(() => {
          const videoH = isLandscape ? height : width * 9 / 16;
          const videoW = isLandscape ? height * 16 / 9 : width;
          return (
            <YoutubePlayer
              height={videoH}
              width={videoW}
              videoId={videoId || ''}
              play={visible && !!videoId}
              onReady={() => setPlayerReady(true)}
              webViewProps={{ allowsInlineMediaPlayback: true, mediaPlaybackRequiresUserAction: false, allowsFullscreenVideo: true }}
            />
          );
        })()}
        {!isLandscape && (
          <>
            <Text style={styles.videoModalTitle} numberOfLines={3}>{title}</Text>
            <VideoActions videoId={videoId || ''} title={title} />
          </>
        )}
        <TouchableOpacity style={[styles.modalClose, isLandscape && styles.modalCloseLandscape]} onPress={onClose}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function ShortsPlayerItemInner({ item, index, isActive, onEnd, onClose, total }: any) {
  const [shortReady, setShortReady] = useState(false);
  const videoId = item?.snippet?.resourceId?.videoId;
  const title = item?.snippet?.title ?? '';
  const { width: w, height: h } = useWindowDimensions();
  const isLandscape = w > h;
  const shortsH = isLandscape ? h : h * 0.55;
  const shortsW = isLandscape ? h * 9 / 16 : w;

  useEffect(() => { setShortReady(false); }, [videoId]);

  return (
    <View style={{ width: w, height: h, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
      <StatusBar hidden />
      <View style={{
        width: isLandscape ? w : w,
        height: shortsH,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: isLandscape ? 0 : h * 0.15,
      }}>
        {isActive ? (
          <>
            {!shortReady && (
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', zIndex: 10, marginBottom: isLandscape ? 0 : h * 0.2 }]}>
                <VideoLoadingState />
              </View>
            )}
            <YoutubePlayer
              height={shortsH}
              width={isLandscape ? shortsW : w}
              videoId={videoId}
              play
              onReady={() => setShortReady(true)}
              onChangeState={(s: string) => { if (s === 'ended') onEnd(index); }}
              webViewProps={{ allowsInlineMediaPlayback: true, mediaPlaybackRequiresUserAction: false, allowsFullscreenVideo: true }}
              initialPlayerParams={{ rel: 0, modestbranding: 1, controls: 1 }}
            />
          </>
        ) : (
          <View style={{ width: isLandscape ? shortsW : w, height: shortsH, backgroundColor: '#000' }} />
        )}
      </View>
      {!isLandscape && shortReady && (
        <>
          <VideoActions videoId={videoId || ''} title={title} absolute />
          <View style={styles.shortsOverlay}>
            <Text style={styles.shortsTitle} numberOfLines={3}>{title}</Text>
            <Text style={styles.shortsCounter}>{index + 1} / {total}</Text>
          </View>
        </>
      )}
      {shortReady && (
        <TouchableOpacity style={[styles.shortsClose, isLandscape && { top: 16 }]} onPress={onClose}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function VideosScreen() {
  const { colors } = useTheme();

  const [activeTab, setActiveTab] = useState<Tab>('shorts');
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const [shorts, setShorts] = useState<any[]>([]);
  const [shortsLoaded, setShortsLoaded] = useState(false);
  const [shortsError, setShortsError] = useState(false);
  const [shortsNextToken, setShortsNextToken] = useState('');
  const [loadingShorts, setLoadingShorts] = useState(false);
  const [loadingMoreShorts, setLoadingMoreShorts] = useState(false);

  const [videos, setVideos] = useState<any[]>([]);
  const [videosLoaded, setVideosLoaded] = useState(false);
  const [videosError, setVideosError] = useState(false);
  const [videosNextToken, setVideosNextToken] = useState('');
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [loadingMoreVideos, setLoadingMoreVideos] = useState(false);

  const [liveVideos, setLiveVideos] = useState<any[]>([]);
  const [liveLoaded, setLiveLoaded] = useState(false);
  const [liveError, setLiveError] = useState(false);
  const [liveNextTokens, setLiveNextTokens] = useState<Record<string, string>>({});
  const [loadingLive, setLoadingLive] = useState(false);
  const [loadingMoreLive, setLoadingMoreLive] = useState(false);
  const [liveIds, setLiveIds] = useState<string[]>(FALLBACK_LIVE_IDS);

  const [allVideos, setAllVideos] = useState<any[]>([]);
  const [allLoaded, setAllLoaded] = useState(false);
  const [allError, setAllError] = useState(false);
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
    if (activeTab === 'videos') {
      if (videosError) { setVideosError(false); fetchVideos('', true); }
      else if (!videosLoaded) fetchVideos();
    }
    if (activeTab === 'live') {
      if (liveError) { setLiveError(false); loadLiveAndFetch(); }
      else if (!liveLoaded) loadLiveAndFetch();
    }
    if (activeTab === 'all') {
      if (allError) { setAllError(false); fetchAll('', true); }
      else if (!allLoaded) fetchAll();
    }
    if (activeTab === 'shorts' && shortsError) {
      setShortsError(false);
      fetchShorts('', true);
    }
  }, [activeTab]);

  useEffect(() => {
    if (shortsPlayerVisible) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } else {
      ScreenOrientation.unlockAsync();
    }
    return () => { ScreenOrientation.unlockAsync(); };
  }, [shortsPlayerVisible]);

  const openVideo = (videoId: string, title: string) => {
    setActiveVideoId(videoId);
    setActiveVideoTitle(title);
    setVideoModalVisible(true);
  };

  const closeVideo = () => { setVideoModalVisible(false); setActiveVideoId(null); };

  const fetchShorts = async (pageToken = '', forceLoad = false) => {
    try {
      if (!pageToken || forceLoad) { setLoadingShorts(true); setShortsError(false); setShortsLoaded(false); } else setLoadingMoreShorts(true);
      const data = await ytFetch('playlistItems', { playlistId: SHORTS_PLAYLIST_ID, part: 'snippet', maxResults: '50', ...(pageToken ? { pageToken } : {}) });
      const enriched = await enrichDates(mapItems(data.items || []));
      if (pageToken) {
        setShorts(prev => { const s = new Set(prev.map((v: any) => v.snippet.resourceId.videoId)); return [...prev, ...enriched.filter((v: any) => !s.has(v.snippet.resourceId.videoId))]; });
      } else { setShorts(dedupeById(enriched)); }
      setShortsNextToken(data.nextPageToken || '');
      setShortsLoaded(true);
    } catch {
      if (!pageToken) setShortsError(true);
    } finally { setLoadingShorts(false); setLoadingMoreShorts(false); }
  };

  const fetchVideos = async (pageToken = '', forceLoad = false) => {
    try {
      if (!pageToken || forceLoad) { setLoadingVideos(true); setVideosError(false); setVideosLoaded(false); } else setLoadingMoreVideos(true);
      const data = await ytFetch('playlistItems', { playlistId: VIDEOS_PLAYLIST_ID, part: 'snippet', maxResults: '50', ...(pageToken ? { pageToken } : {}) });
      const enriched = (await enrichDates(mapItems(data.items || []))).sort(byDateDesc);
      if (pageToken) {
        setVideos(prev => { const s = new Set(prev.map((v: any) => v.snippet.resourceId.videoId)); return [...prev, ...enriched.filter((v: any) => !s.has(v.snippet.resourceId.videoId))].sort(byDateDesc); });
      } else { setVideos(dedupeById(enriched)); }
      setVideosNextToken(data.nextPageToken || '');
      setVideosLoaded(true);
    } catch {
      if (!pageToken) setVideosError(true);
    } finally { setLoadingVideos(false); setLoadingMoreVideos(false); }
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
      if (!loadMore) { setLoadingLive(true); setLiveError(false); } else setLoadingMoreLive(true);
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
    } catch {
      if (!loadMore) setLiveError(true);
    } finally { setLoadingLive(false); setLoadingMoreLive(false); }
  };

  const fetchAll = async (pageToken = '', forceLoad = false) => {
    try {
      if (!pageToken || forceLoad) { setLoadingAll(true); setAllError(false); setAllLoaded(false); } else setLoadingMoreAll(true);
      const data = await ytFetch('playlistItems', { playlistId: UPLOADS_PLAYLIST_ID, part: 'snippet', maxResults: '50', ...(pageToken ? { pageToken } : {}) });
      const enriched = (await enrichDates(mapItems(data.items || []))).sort(byDateDesc);
      if (pageToken) {
        setAllVideos(prev => { const s = new Set(prev.map((v: any) => v.snippet.resourceId.videoId)); return [...prev, ...enriched.filter((v: any) => !s.has(v.snippet.resourceId.videoId))].sort(byDateDesc); });
      } else { setAllVideos(dedupeById(enriched)); }
      setAllNextToken(data.nextPageToken || '');
      setAllLoaded(true);
    } catch {
      if (!pageToken) setAllError(true);
    } finally { setLoadingAll(false); setLoadingMoreAll(false); }
  };

  const doSearch = async (query: string) => {
    try {
      setSearching(true);
      const data = await ytFetch('search', { channelId: CHANNEL_ID, part: 'snippet', type: 'video', maxResults: '50', order: 'relevance', q: query });
      const q = query.toLowerCase();
      setSearchResults(
        (data.items || [])
          .filter((i: any) => i?.id?.videoId && i?.snippet?.thumbnails && decodeHtml(i.snippet.title).toLowerCase().includes(q))
          .map((i: any) => ({
            snippet: {
              title: decodeHtml(i.snippet.title),
              publishedAt: i.snippet.publishedAt,
              thumbnails: i.snippet.thumbnails,
              resourceId: { videoId: i.id.videoId },
              duration: '',
            },
          }))
      );
    } catch {} finally { setSearching(false); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setShorts([]); setShortsLoaded(false); setShortsNextToken(''); setShortsError(false);
    setVideos([]); setVideosLoaded(false); setVideosNextToken(''); setVideosError(false);
    setLiveVideos([]); setLiveLoaded(false); setLiveNextTokens({}); setLiveError(false);
    setAllVideos([]); setAllLoaded(false); setAllNextToken(''); setAllError(false);
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
      <ShortsPlayerItemInner
        item={item}
        index={index}
        isActive={isActive}
        onEnd={handleShortEnd}
        onClose={() => { setShortsPlayerVisible(false); setPlayingShortId(null); }}
        total={shortsDataRef.current.length}
      />
    );
  }, [playingShortId, handleShortEnd]);

  const VideoCard = ({ item }: any) => {
    const { width: cardW } = useWindowDimensions();
    const videoId = item?.snippet?.resourceId?.videoId;
    const thumb = item?.snippet?.thumbnails?.medium?.url;
    const title = decodeHtml(item?.snippet?.title || '');
    const date = item?.snippet?.publishedAt || '';
    const duration = item?.snippet?.duration || '';
    if (!videoId || !thumb) return null;
    return (
      <TouchableOpacity style={[styles.card, { backgroundColor: colors.surface }]} onPress={() => openVideo(videoId, title)}>
        <View>
          <Image source={{ uri: thumb }} style={[styles.thumb, { height: cardW * 0.52 }]} />
          {!!duration && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{duration}</Text>
            </View>
          )}
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>{title}</Text>
          <Text style={[styles.cardDate, { color: colors.subtext }]}>{formatDate(date)}</Text>
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
    const { width: cardW } = useWindowDimensions();
    const videoId = item?.snippet?.resourceId?.videoId;
    const thumb = item?.snippet?.thumbnails?.medium?.url;
    const title = decodeHtml(item?.snippet?.title || '');
    const date = item?.snippet?.publishedAt || '';
    const duration = item?.snippet?.duration || '';
    if (!videoId || !thumb) return null;
    return (
      <TouchableOpacity style={[styles.card, { backgroundColor: colors.surface }]} onPress={() => openVideo(videoId, title)}>
        <View>
          <Image source={{ uri: thumb }} style={[styles.thumb, { height: cardW * 0.52 }]} />
          <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveBadgeText}>LIVE</Text></View>
          {!!duration && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{duration}</Text>
            </View>
          )}
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>{title}</Text>
          <Text style={[styles.cardDate, { color: colors.subtext }]}>{formatDate(date)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const LoadMore = ({ token, loading, onPress }: { token: string; loading: boolean; onPress: () => void }) =>
    token ? (
      <TouchableOpacity style={[styles.loadMore, { backgroundColor: colors.accent }]} onPress={onPress}>
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
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
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
            snapToInterval={Dimensions.get('window').height}
            snapToAlignment="start"
            decelerationRate="fast"
            onViewableItemsChanged={onShortsViewable}
            viewabilityConfig={shortsViewConfig}
            getItemLayout={(_, index) => ({ length: Dimensions.get('window').height, offset: Dimensions.get('window').height * index, index })}
            initialScrollIndex={currentShortIndex}
            onScrollToIndexFailed={() => {}}
          />
        </View>
      </Modal>

      <View style={[styles.searchRow, { backgroundColor: colors.surface }]}>
        <Ionicons name="search" size={20} color={colors.subtext} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search all sermons..."
          placeholderTextColor={colors.subtext}
          value={search}
          onChangeText={setSearch}
        />
        {searching && <ActivityIndicator size="small" color={colors.accent} />}
        {!!search && <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={20} color={colors.subtext} /></TouchableOpacity>}
      </View>

      {!isSearching && (
        <View style={styles.tabsRow}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, { backgroundColor: activeTab === t.key ? colors.accent : colors.surface }]}
              onPress={() => setActiveTab(t.key)}
            >
              <Ionicons name={t.icon as any} size={14} color={activeTab === t.key ? '#fff' : colors.subtext} />
              <Text style={[styles.tabText, { color: activeTab === t.key ? '#fff' : colors.subtext }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {isSearching && (
        searching
          ? <TabLoadingState tab="search" />
          : <FlatList data={searchResults} keyExtractor={(_, i) => `sr${i}`} renderItem={({ item }) => <VideoCard item={item} />} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={[styles.empty, { color: colors.subtext }]}>No results found</Text>} />
      )}

      {!isSearching && activeTab === 'shorts' && (
        loadingShorts ? <TabLoadingState tab="shorts" />
        : shortsError ? <VideoErrorState onRetry={() => { setShortsLoaded(false); fetchShorts(); }} />
        : <FlatList data={shorts} keyExtractor={i => i.snippet.resourceId.videoId} refreshing={refreshing} onRefresh={onRefresh} renderItem={({ item, index }) => <ShortCard item={item} index={index} />} numColumns={2} contentContainerStyle={styles.list} columnWrapperStyle={{ gap: 8 }} ListEmptyComponent={<Text style={[styles.empty, { color: colors.subtext }]}>No shorts found</Text>} ListFooterComponent={<LoadMore token={shortsNextToken} loading={loadingMoreShorts} onPress={() => fetchShorts(shortsNextToken)} />} />
      )}

      {!isSearching && activeTab === 'videos' && (
        loadingVideos ? <TabLoadingState tab="videos" />
        : videosError ? <VideoErrorState onRetry={() => { setVideosLoaded(false); fetchVideos(); }} />
        : <FlatList data={videos} keyExtractor={i => i.snippet.resourceId.videoId} refreshing={refreshing} onRefresh={onRefresh} renderItem={({ item }) => <VideoCard item={item} />} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={[styles.empty, { color: colors.subtext }]}>No videos found</Text>} ListFooterComponent={<LoadMore token={videosNextToken} loading={loadingMoreVideos} onPress={() => fetchVideos(videosNextToken)} />} />
      )}

      {!isSearching && activeTab === 'live' && (
        loadingLive ? <TabLoadingState tab="live" />
        : liveError ? <VideoErrorState onRetry={() => { setLiveLoaded(false); loadLiveAndFetch(); }} />
        : <FlatList data={liveVideos} keyExtractor={i => i.snippet.resourceId.videoId} refreshing={refreshing} onRefresh={onRefresh} renderItem={({ item }) => <LiveCard item={item} />} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={[styles.empty, { color: colors.subtext }]}>No live streams found</Text>} ListFooterComponent={hasMoreLive ? <TouchableOpacity style={[styles.loadMore, { backgroundColor: colors.accent }]} onPress={() => fetchLive(true)}>{loadingMoreLive ? <ActivityIndicator color="#fff" /> : <Text style={styles.loadMoreText}>Load More</Text>}</TouchableOpacity> : null} />
      )}

      {!isSearching && activeTab === 'all' && (
        loadingAll ? <TabLoadingState tab="all" />
        : allError ? <VideoErrorState onRetry={() => { setAllLoaded(false); fetchAll(); }} />
        : <FlatList data={allVideos} keyExtractor={i => i.snippet.resourceId.videoId} refreshing={refreshing} onRefresh={onRefresh} renderItem={({ item }) => <VideoCard item={item} />} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={[styles.empty, { color: colors.subtext }]}>No videos found</Text>} ListFooterComponent={<LoadMore token={allNextToken} loading={loadingMoreAll} onPress={() => fetchAll(allNextToken)} />} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', margin: 12, marginTop: 50, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, elevation: 3 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15 },
  tabsRow: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 20, elevation: 2 },
  tabText: { fontSize: 12, fontWeight: '600' },
  list: { padding: 12, paddingBottom: 100 },
  card: { borderRadius: 12, marginBottom: 12, overflow: 'hidden', elevation: 3 },
  thumb: { width: '100%', resizeMode: 'cover' },
  cardInfo: { padding: 10 },
  cardTitle: { fontSize: 14, fontWeight: 'bold' },
  cardDate: { fontSize: 12, marginTop: 4 },
  durationBadge: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.78)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  durationText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  shortCard: { flex: 1, borderRadius: 12, overflow: 'hidden', elevation: 3, marginBottom: 8, backgroundColor: '#000', minHeight: 220 },
  shortThumb: { width: '100%', height: 220 },
  shortPlayIcon: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  shortOverlay: { position: 'absolute', bottom: 160, left: 16, right: 16 },
  shortTitle: { fontSize: 11, color: '#fff', fontWeight: '600' },
  liveBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: '#ff0000', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
  loadMore: { borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 20 },
  loadMoreText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  shortsOverlay: { position: 'absolute', bottom: 100, left: 16, right: 16 },
  shortsTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  shortsCounter: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  shortsClose: { position: 'absolute', top: 50, right: 16, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 6, zIndex: 10 },
  videoModal: { flex: 1, backgroundColor: '#000', justifyContent: 'center', paddingTop: 10 },
  videoModalLandscape: { justifyContent: 'center', alignItems: 'center' },
  videoModalTitle: { color: '#fff', fontSize: 15, fontWeight: '600', padding: 20, lineHeight: 22 },
  modalClose: { position: 'absolute', top: 50, right: 16, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 8, zIndex: 10 },
  modalCloseLandscape: { top: 16, right: 16 },
});

const errorStyles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 60 },
  iconWrap: { width: 120, height: 120, marginBottom: 24, alignItems: 'center', justifyContent: 'center' },
  tv: { width: 100, height: 80, backgroundColor: '#4a5568', borderRadius: 14, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  tvScreen: { width: 72, height: 52, backgroundColor: '#e8eaf0', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  xEyesRow: { flexDirection: 'row', gap: 14, marginBottom: 6 },
  xEye: { width: 16, height: 16, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  xLine: { position: 'absolute', width: 14, height: 2.5, backgroundColor: '#2d3748', borderRadius: 2 },
  xLine1: { transform: [{ rotate: '45deg' }] },
  xLine2: { transform: [{ rotate: '-45deg' }] },
  mouth: { width: 18, height: 3, backgroundColor: '#2d3748', borderRadius: 2 },
  tvBase: { position: 'absolute', bottom: -6, width: 40, height: 6, backgroundColor: '#4a5568', borderRadius: 3 },
  antenna1: { position: 'absolute', top: -18, left: 28, width: 2.5, height: 18, backgroundColor: '#4a5568', borderRadius: 2, transform: [{ rotate: '-15deg' }] },
  antenna2: { position: 'absolute', top: -18, right: 28, width: 2.5, height: 18, backgroundColor: '#4a5568', borderRadius: 2, transform: [{ rotate: '15deg' }] },
  crack1: { position: 'absolute', top: 8, right: 10, width: 2, height: 16, backgroundColor: '#2d3748', borderRadius: 1, transform: [{ rotate: '20deg' }] },
  crack2: { position: 'absolute', top: 14, right: 8, width: 2, height: 10, backgroundColor: '#2d3748', borderRadius: 1, transform: [{ rotate: '-10deg' }] },
  playBadge: { position: 'absolute', bottom: 12, left: 12, width: 24, height: 24, borderRadius: 12, backgroundColor: '#e05c5c', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '800', marginBottom: 6, letterSpacing: 0.3 },
  subtitle: { fontSize: 14, marginBottom: 24, textAlign: 'center' },
  tipsBox: { width: '100%', borderRadius: 14, paddingVertical: 4, paddingHorizontal: 16, marginBottom: 28, borderWidth: 1.5, borderStyle: 'dashed' },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  tipText: { fontSize: 13, flex: 1, lineHeight: 18 },
  divider: { height: 1 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#7c83e5', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 30, marginBottom: 16 },
  retryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  footer: { fontSize: 12, textAlign: 'center' },
});

const loadingStyles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', gap: 24 },
  filmStrip: { flexDirection: 'row', gap: 10 },
  filmHole: { width: 16, height: 16, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  playCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)' },
  spinRing: { position: 'absolute', width: 90, height: 90, borderRadius: 45, borderWidth: 2.5, borderColor: 'transparent', borderTopColor: '#ff6b6b', borderRightColor: 'rgba(255,107,107,0.3)' },
  message: { fontSize: 15, color: '#fff', fontWeight: '600', textAlign: 'center', paddingHorizontal: 32, lineHeight: 22 },
  subMessage: { fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
});

const tabLoadingStyles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingBottom: 60 },
  iconArea: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  spinRing: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 2.5, borderColor: 'transparent', borderRightColor: 'transparent' },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 28 },
  bar: { width: 4, height: 28, borderRadius: 3 },
  message: { fontSize: 15, fontWeight: '600', textAlign: 'center', paddingHorizontal: 40, lineHeight: 22 },
  sub: { fontSize: 12, textAlign: 'center' },
});

const actionStyles = StyleSheet.create({
  container: { flexDirection: 'row', justifyContent: 'center', gap: 32, paddingVertical: 16 },
  containerAbsolute: { position: 'absolute', bottom: 200, left: 0, right: 0 },
  iconBtn: { alignItems: 'center', gap: 6 },
  iconCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  iconLabel: { fontSize: 11, fontWeight: '600' },
});

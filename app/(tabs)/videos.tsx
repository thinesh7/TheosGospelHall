import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ScreenOrientation from 'expo-screen-orientation';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Linking,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import YoutubePlayer from '@/components/video/YoutubePlayer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../components/AppText';
import { TextInput } from '../../components/AppTextInput';
import VideoMaintenancePage from '../../components/VideoMaintenancePage';
import { CONTENT_MAX_WIDTH, radii, spacing, WIDE_CONTENT_MAX_WIDTH } from '../../constants/layout';
import { useBreakpoint } from '../../hooks/use-breakpoint';
import { useTheme } from '../../utils/ThemeContext';
import { getCachedLivePlaylists, syncLivePlaylists } from '../../utils/livePlaylistsSync';
import { subscribeVideoMaintenance } from '../../utils/videoMaintenance';
import { QuotaExhaustedError, ytFetch } from '../../utils/youtubeProxy';

const CHANNEL_ID = 'UCFg0eNTRs2UIcihQAVpyrJA';
const UPLOADS_PLAYLIST_ID = 'UUFg0eNTRs2UIcihQAVpyrJA';
const SHORTS_PLAYLIST_ID = 'PLZISpWbe8RUjb_YX_C2yEEB7IZnhU9VRA';
const VIDEOS_PLAYLIST_ID = 'PLZISpWbe8RUgXpqMWjZCAZUTmYQ8b1qAb';
const SONGS_PLAYLIST_ID = 'PLKm9fFPbrDuw';
const FALLBACK_LIVE_IDS = ['PLZISpWbe8RUidyhPJNs5xa8-WOnHq-NLj'];
const PROGRESS_STORAGE_KEY = 'video_progress_v1';
const COMPLETION_THRESHOLD = 0.98;
// Ideal card width the desktop grid tries to hit — numColumns is derived by
// dividing the available width by this and clamping to [3, 5] columns.
const TARGET_CARD_WIDTH = 300;
// 220 (was 160) + a [3,6] column cap (was [4,8]) — a real YouTube Shorts
// shelf tops out around 6 columns on a wide desktop; 8 cramped cards down
// to a width barely bigger than a phone's, which read as too small/dense.
const TARGET_SHORT_CARD_WIDTH = 220;
const GRID_GAP = spacing.lg;

// FlatList's numColumns lays cards out with flex:1 per row — when the last
// row has fewer items than numColumns, those flex:1 cards stretch to fill
// the row instead of the grid leaving it incomplete (e.g. 2 leftover shorts
// on a 6-wide row blown up to fill the whole row). Padding the data out to
// a full row with filler entries keeps every real card the same size; the
// filler cells (see isGridFiller/styles.gridFillerCell below) render as
// empty space instead.
const GRID_FILLER = { __gridFiller: true } as const;
function padGridRow<T>(data: T[], numColumns: number): (T | typeof GRID_FILLER)[] {
  if (numColumns <= 1) return data;
  const remainder = data.length % numColumns;
  return remainder === 0 ? data : [...data, ...Array(numColumns - remainder).fill(GRID_FILLER)];
}
function isGridFiller(item: unknown): item is typeof GRID_FILLER {
  return !!(item as any)?.__gridFiller;
}

const getWindow = () => Dimensions.get('window');
const { width: SW } = getWindow();

// expo-keep-awake's activate/deactivate are both async functions — they
// never throw synchronously, they return a rejected Promise (deactivate
// rejects if the tagged wake lock never actually activated, e.g. the
// browser's Wake Lock API declined/doesn't support it). A try/catch around
// the call does nothing for an async rejection; .catch() is what's actually
// needed, matching the library's own internal cleanup code.
function safeActivateKeepAwake(tag: string) {
  activateKeepAwakeAsync(tag).catch(() => {});
}
function safeDeactivateKeepAwake(tag: string) {
  deactivateKeepAwake(tag).catch(() => {});
}
// Same reasoning as above — expo-screen-orientation's lock/unlockAsync are
// also async and can reject (device/OS restrictions, a rapid-fire fullscreen
// toggle racing a previous lock request, etc.), and every call site here
// fired them without a .catch(), so any rejection surfaced as an unhandled
// promise rejection — on native that crashes the app and unmounts back to
// whatever's behind the modal, which is exactly the "entering fullscreen
// crashes and returns to the video list" symptom.
function safeLockOrientation(lock: ScreenOrientation.OrientationLock) {
  ScreenOrientation.lockAsync(lock).catch(() => {});
}
function safeUnlockOrientation() {
  ScreenOrientation.unlockAsync().catch(() => {});
}

// react-native-youtube-iframe loads its player HTML into a native WebView
// exactly once per mount and never re-measures itself afterward. This app
// previously tried to correct that after the fact from the *outside* —
// forcing CSS on the internal iframe and calling the player's setSize() API
// on a timer, then (still not reliably) via a ResizeObserver — but every
// version of that reactive-fixup approach still visibly failed on-device: a
// cropped/zoomed/off-center player with dead black space above it whenever
// the *first* size the WebView was constructed with was wrong (see
// Video_Module_Regression_Report.docx). Rather than keep patching that after
// the fact, the fix now lives on the *input* side instead: see
// VideoModal's sizeReady below, which simply never constructs the native
// player until the container's real, final width is already known — a
// wrong-then-corrected size can't happen if nothing is built until after
// the correction. See also the textZoom={100} webViewProps prop near this
// component's <YoutubePlayer/>, for a second, independent native-only cause
// of the same symptom (the system font/display-size accessibility setting).

type Tab = 'shorts' | 'videos' | 'songs' | 'live' | 'categories' | 'all';

interface VideoProgress {
  position: number;
  duration: number;
  updatedAt: number;
}

async function saveVideoProgress(videoId: string, position: number, duration: number): Promise<void> {
  if (!videoId || duration <= 0) return;
  try {
    const raw = await AsyncStorage.getItem(PROGRESS_STORAGE_KEY);
    const map: Record<string, VideoProgress> = raw ? JSON.parse(raw) : {};
    map[videoId] = { position, duration, updatedAt: Date.now() };
    await AsyncStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

async function getVideoProgress(videoId: string, minSeconds = 20): Promise<VideoProgress | null> {
  if (!videoId) return null;
  try {
    const raw = await AsyncStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return null;
    const map: Record<string, VideoProgress> = JSON.parse(raw);
    const entry = map[videoId];
    if (!entry || entry.duration <= 0) return null;
    const ratio = entry.position / entry.duration;
    if (ratio >= COMPLETION_THRESHOLD) return null;
    if (entry.position < minSeconds) return null;
    return entry;
  } catch { return null; }
}

async function clearVideoProgress(videoId: string): Promise<void> {
  if (!videoId) return;
  try {
    const raw = await AsyncStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return;
    const map: Record<string, VideoProgress> = JSON.parse(raw);
    delete map[videoId];
    await AsyncStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

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

const formatDateTime = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return formatDate(dateStr);
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${formatDate(dateStr)}, ${hours}:${String(minutes).padStart(2, '0')} ${ampm}`;
  } catch { return formatDate(dateStr); }
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

// Live-broadcast status can change within minutes, so the Live tab uses a
// much shorter ytFetch cache window than the 5-minute default used for
// ordinary shorts/videos/songs metadata, which rarely changes.
const LIVE_STATUS_CACHE_TTL_MS = 60 * 1000;

// `ttlMs` is forwarded to ytFetch so live-status-sensitive callers (the Live
// tab) can request a much shorter cache window than the 5-minute default
// used for ordinary shorts/videos/songs metadata, which rarely changes.
async function enrichDates(items: any[], ttlMs?: number): Promise<any[]> {
  const ids = items.map(i => i?.snippet?.resourceId?.videoId).filter(Boolean);
  if (!ids.length) return items;
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));
  const map: Record<string, { date: string; duration: string; isUpcoming: boolean; isLiveNow: boolean }> = {};
  for (const chunk of chunks) {
    try {
      const data = await ytFetch(
        'videos',
        { id: chunk.join(','), part: 'snippet,liveStreamingDetails,contentDetails' },
        ttlMs
      );
      (data.items || []).forEach((v: any) => {
        if (!v?.id) return;
        const liveDetails = v?.liveStreamingDetails;
        const isUpcoming = !!liveDetails?.scheduledStartTime && !liveDetails?.actualStartTime;
        map[v.id] = {
          date: isUpcoming ? liveDetails.scheduledStartTime : (liveDetails?.actualStartTime || v?.snippet?.publishedAt),
          duration: parseDuration(v?.contentDetails?.duration || ''),
          isUpcoming,
          isLiveNow: v?.snippet?.liveBroadcastContent === 'live',
        };
      });
    } catch (e) {
      if (e instanceof QuotaExhaustedError) throw e;
    }
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
        isUpcoming: info?.isUpcoming || false,
        isLiveNow: info?.isLiveNow || false,
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
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={errorStyles.container}
      showsVerticalScrollIndicator={false}
    >
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
    </ScrollView>
  );
}

function QuotaExhaustedScreen({ onRetry }: { onRetry: () => void }) {
  const { colors } = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={errorStyles.container}
      showsVerticalScrollIndicator={false}
    >
      <BrokenTvIcon />
      <Text style={[errorStyles.title, { color: colors.text }]}>Oh! No...</Text>
      <Text style={[errorStyles.subtitle, { color: colors.subtext }]}>{"Sorry, we're experiencing a technical issue. Please try again later."}</Text>
      <TouchableOpacity style={errorStyles.retryBtn} onPress={onRetry} activeOpacity={0.85}>
        <Ionicons name="refresh" size={16} color="#fff" />
        <Text style={errorStyles.retryText}>Try Again</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function PlayerErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(224,92,92,0.15)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="wifi-outline" size={32} color="#e05c5c" />
      </View>
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' }}>Oh no! No internet connection.</Text>
      <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>Please check your connection and try again.</Text>
      <TouchableOpacity onPress={onRetry} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#7c83e5', paddingHorizontal: 28, paddingVertical: 13, borderRadius: 28, marginTop: 4 }}>
        <Ionicons name="refresh" size={16} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}


const LOADING_MESSAGES = [
  '🎬 Preparing your video...',
  '📡 Connecting to the stream...',
  '🍿 Almost ready, your video is on the way...',
  '✨ Getting everything ready for you...',
];

function VideoLoadingState({ accentColor = '#ff6b6b' }: { accentColor?: string }) {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const [msgIndex, setMsgIndex] = useState(0);

  // Both loops must be stopped on unmount — Animated.loop().start() with no
  // stored handle keeps recursing forever (on web this is a real JS-driven
  // requestAnimationFrame loop, since useNativeDriver silently falls back to
  // JS animation there), even after this component is gone. Left unfixed,
  // switching tabs while a loading state is showing leaks an animation loop
  // per mount, each continuously invalidating the frame.
  useEffect(() => {
    const anim = Animated.loop(Animated.timing(spinAnim, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true }));
    anim.start();
    return () => anim.stop();
  }, []);

  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.04, duration: 900, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 900, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
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
        <Animated.View style={[loadingStyles.spinRing, { borderTopColor: accentColor, borderRightColor: accentColor + '4D', transform: [{ rotate: spin }] }]} />
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
  songs: ['🎵 Loading Songs...', '📡 Fetching music...', '✨ Almost there...'],
  live: ['📡 Loading Live Streams...', '🔴 Fetching broadcasts...', '✨ Almost there...'],
  categories: ['🗂️ Loading Playlists...', '📡 Getting things ready...', '✨ Almost there...'],
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

  // See the matching comment in VideoLoadingState above — these loops need
  // an explicit .stop() on unmount or they keep running (and, on web,
  // continuously invalidating the frame via JS-driven rAF) indefinitely.
  useEffect(() => {
    const anim = Animated.loop(Animated.timing(spinAnim, { toValue: 1, duration: 1800, easing: Easing.linear, useNativeDriver: true }));
    anim.start();
    return () => anim.stop();
  }, []);

  useEffect(() => {
    const animBar = (anim: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.2, duration: 400, useNativeDriver: true }),
      ]));
    const anim = Animated.parallel([animBar(bar1, 0), animBar(bar2, 150), animBar(bar3, 300), animBar(bar4, 450)]);
    anim.start();
    return () => anim.stop();
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

function VideoActions({ videoId, title, absolute = false, direction = 'row' }: { videoId: string; title: string; absolute?: boolean; direction?: 'row' | 'column' }) {
  const { colors } = useTheme();
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const [linkCopied, setLinkCopied] = useState(false);

  const openYouTube = () => {
    Linking.openURL(`vnd.youtube://${videoId}`)
      .catch(() => Linking.openURL(youtubeUrl));
  };

  // react-native-web has no native share sheet — Share.share() silently
  // fails there, so web gets a Copy Link action with a brief in-place
  // confirmation instead (this component is embedded in several different
  // full-screen contexts, so a self-contained label swap is more robust
  // than a floating toast that would need a viewport-sized positioned
  // ancestor it can't guarantee everywhere it's used).
  const shareVideo = async () => {
    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(youtubeUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
      return;
    }
    try {
      await Share.share({
        message: `${title}\n\n${youtubeUrl}`,
        url: youtubeUrl,
        title,
      });
    } catch {}
  };

  return (
    <View style={[actionStyles.container, absolute && actionStyles.containerAbsolute, direction === 'column' && actionStyles.containerColumn]}>
      <TouchableOpacity style={actionStyles.iconBtn} onPress={openYouTube} activeOpacity={0.8}>
        <View style={[actionStyles.iconCircle, { backgroundColor: '#ff0000' }]}>
          <Ionicons name="logo-youtube" size={22} color="#fff" />
        </View>
        <Text style={[actionStyles.iconLabel, { color: '#fff' }]}>YouTube</Text>
      </TouchableOpacity>
      <TouchableOpacity style={actionStyles.iconBtn} onPress={shareVideo} activeOpacity={0.8}>
        <View style={[actionStyles.iconCircle, { backgroundColor: linkCopied ? '#22c55e' : '#4f7fff' }]}>
          <Ionicons
            name={linkCopied ? 'checkmark' : Platform.OS === 'web' ? 'link' : 'share-social'}
            size={22}
            color="#fff"
          />
        </View>
        <Text style={[actionStyles.iconLabel, { color: '#fff' }]}>
          {linkCopied ? 'Copied!' : Platform.OS === 'web' ? 'Copy Link' : 'Share'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

interface ResumePromptProps {
  visible: boolean;
  onResume: () => void;
  onStartOver: () => void;
}

function ResumePrompt({ visible, onResume, onStartOver }: ResumePromptProps) {
  const { isTabletUp } = useBreakpoint();
  if (!visible) return null;
  // Mobile keeps the bottom-sheet treatment (anchored near the thumb,
  // standard mobile-dialog convention). Desktop centers it as a normal
  // dialog card instead — a sheet tuned for a phone's bottom safe area
  // read as broken/misplaced against the now-smaller, side-railed desktop
  // video layout.
  return (
    <View style={[resumeStyles.overlay, isTabletUp && resumeStyles.overlayCenter]}>
      <View style={[resumeStyles.card, isTabletUp && resumeStyles.cardDesktop]}>
        <View style={resumeStyles.iconRow}>
          <View style={resumeStyles.iconCircle}>
            <Ionicons name="time" size={28} color="#fff" />
          </View>
        </View>
        <Text style={resumeStyles.heading}>Continue Watching?</Text>
        <TouchableOpacity style={resumeStyles.btnResume} onPress={onResume} activeOpacity={0.85}>
          <Ionicons name="play" size={18} color="#fff" />
          <Text style={resumeStyles.btnResumeText}>Resume</Text>
        </TouchableOpacity>
        <TouchableOpacity style={resumeStyles.btnStart} onPress={onStartOver} activeOpacity={0.85}>
          <Ionicons name="refresh" size={16} color="rgba(255,255,255,0.8)" />
          <Text style={resumeStyles.btnStartText}>Start Over</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function LockOverlay({ onUnlock }: { onUnlock: () => void }) {
  const lastTapRef = useRef(0);

  const handleUnlockPress = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      lastTapRef.current = 0;
      onUnlock();
    } else {
      lastTapRef.current = now;
    }
  };

  return (
    <TouchableOpacity style={lockStyles.overlay} activeOpacity={1} onPress={() => {}}>
      <View style={lockStyles.badge}>
        <View style={lockStyles.badgeIconCircle}>
          <Ionicons name="lock-closed" size={22} color="#fff" />
        </View>
        <Text style={lockStyles.badgeText}>Locked</Text>
      </View>
      <TouchableOpacity style={lockStyles.unlockBtn} onPress={handleUnlockPress} activeOpacity={0.8}>
        <Ionicons name="lock-open" size={22} color="#fff" />
        <Text style={lockStyles.unlockText}>Double tap to unlock</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

interface VideoModalProps {
  visible: boolean;
  videoId: string | null;
  title: string;
  isLive?: boolean;
  onClose: () => void;
  // Optional list-navigation mode, used by Songs (not by the plain Videos
  // tab, which never passes these). onEnded fires when playback naturally
  // completes; onPrev/onNext fire on an explicit swipe or button press.
  onPrev?: () => void;
  onNext?: () => void;
  onEnded?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  // True only for the videoId change caused by onEnded's auto-advance, so
  // the effect below can skip the Continue Watching resume prompt and
  // always start the next song from the beginning.
  autoAdvance?: boolean;
}

function VideoModal({ visible, videoId, title, isLive, onClose, onPrev, onNext, onEnded, hasPrev, hasNext, autoAdvance }: VideoModalProps) {
  const { width: windowWidth, height } = useWindowDimensions();
  // Web-only fallback for the one frame before onLayout below fires —
  // harmless there since YoutubePlayer.web.tsx's <div>/<iframe> both reflow
  // live with ordinary CSS regardless of what value this starts at.
  const [measuredWidth, setMeasuredWidth] = useState(0);
  // Native restores main's exact original mechanism: useWindowDimensions()
  // read directly, always live, no gating on a separate onLayout
  // measurement. An onLayout/measuredWidth fallback used to sit in front of
  // this for native too — added during migration on a theory that
  // useWindowDimensions() itself was unreliable here — but on-device
  // testing traced the actual cropped/zoomed/off-center player (see
  // Video_Module_Regression_Report.docx) to the videoModal alignItems
  // regression and the videoW formula gaining tablet/desktop capping
  // (both fixed above/below), not to this hook. Since main proves
  // useWindowDimensions() alone is correct here — including reacting
  // instantly to a device rotating into/out of fullscreen, which an
  // onLayout-based gate can only catch after that view's own next layout
  // pass — native no longer waits on anything extra.
  const width = Platform.OS === 'web' ? (measuredWidth || windowWidth) : windowWidth;
  // Only web ever needs to wait on a measurement; native's width is always
  // immediately available (see above), matching main exactly.
  const sizeReady = Platform.OS === 'web' ? width > 0 : true;
  const { colors } = useTheme();
  const { isMobile, isTabletUp } = useBreakpoint();
  const insets = useSafeAreaInsets();
  // Fullscreen-landscape treatment (hides title/actions, fills the screen
  // edge-to-edge) is meant for a device rotated sideways. On web, a browser
  // window is always wider than tall regardless of orientation, so a
  // desktop/tablet *browser tab* being wide must not be mistaken for a
  // rotated phone — gated to mobile web there. On native, width>height is
  // an unambiguous real device rotation (there's no "wide window" case to
  // guard against), so every native device — including tablets — keeps
  // main's original behavior of going fullscreen in landscape.
  const isLandscape = (Platform.OS !== 'web' || isMobile) && width > height;
  const [playerReady, setPlayerReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showResume, setShowResume] = useState(false);
  // Muted until a pending resume decision is settled. seekTo() on a freshly-
  // ready player starts it playing as a side effect (see handleReady below),
  // independent of the play/pause state — on native, react-native-youtube-
  // iframe exposes no imperative pauseVideo(), so pausing after the fact
  // can't win that race reliably. Baking `mute` into the *initial* embed
  // params (below) instead means the iframe never has a chance to be
  // audible in the first place, regardless of that race — the reactive
  // `mute` prop then just has to unmute once the user actually resumes.
  const [videoMuted, setVideoMuted] = useState(false);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [locked, setLocked] = useState(false);
  const playerRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const resumePositionRef = useRef<number>(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef<number>(0);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set whenever videoId changes to something other than what was already
  // showing (Prev/Next or auto-advance), so the 'paused' handling in
  // onChangeState below can ignore it — loadVideoById() reliably fires a
  // transient 'paused' state of its own on web while the new video is still
  // buffering, before the real 'playing' state arrives. Left unguarded, that
  // transient event was read as a genuine user pause, which then actively
  // called pauseVideo() (see YoutubePlayer.web.tsx's play-prop effect) and
  // stopped the next song from ever starting. Cleared on the first real
  // 'playing' event, with a timeout backstop in case autoplay is genuinely
  // blocked and 'playing' never comes, so a real pause tap isn't ignored forever.
  const prevVideoIdRef = useRef<string | null>(null);
  const switchingVideoRef = useRef(false);
  const switchGuardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fsOverlayOpacity = useRef(new Animated.Value(0)).current;
  // Slide-in for song-to-song navigation only (see the hasSongNav-gated
  // effect below) — set right before calling the real onNext/onPrev so the
  // content effect knows which axis/side to slide in from. null on the
  // modal's initial open, which correctly skips the animation. Two axes:
  // horizontal for the desktop Prev/Next buttons and left/right swipes,
  // vertical for up/down swipes — the vertical swipe restores the original
  // feed's up-for-next browsing gesture (Songs used to be a vertically
  // paged, TikTok/Reels-style feed) on top of today's single-player modal.
  const songSlideX = useRef(new Animated.Value(0)).current;
  const songSlideY = useRef(new Animated.Value(0)).current;
  const songNavDirectionRef = useRef<'next' | 'prev' | null>(null);
  const songNavAxisRef = useRef<'x' | 'y'>('x');

  // Refs so the PanResponder (created once) and the 'ended' handler always
  // see the latest nav props without needing to be in their dependency arrays.
  const onPrevRef = useRef(onPrev);
  const onNextRef = useRef(onNext);
  const onEndedRef = useRef(onEnded);
  const hasPrevRef = useRef(hasPrev);
  const hasNextRef = useRef(hasNext);
  onPrevRef.current = onPrev;
  onNextRef.current = onNext;
  onEndedRef.current = onEnded;
  hasPrevRef.current = hasPrev;
  hasNextRef.current = hasNext;
  const hasSongNav = !!(onPrev || onNext);
  const handleSongPrev = useCallback(() => {
    songNavAxisRef.current = 'x';
    songNavDirectionRef.current = 'prev';
    onPrevRef.current?.();
  }, []);
  const handleSongNext = useCallback(() => {
    songNavAxisRef.current = 'x';
    songNavDirectionRef.current = 'next';
    onNextRef.current?.();
  }, []);

  // Swipe to move between songs — recognizes both the desktop Prev/Next
  // buttons' left/right convention *and* a vertical swipe (up = next, down
  // = previous), matching the original vertically-paged Songs feed's
  // gesture so it still feels like swiping through a feed even though only
  // one song is mounted at a time now. Inactive (never claims the gesture)
  // when this modal isn't in Songs nav mode, so plain Videos playback is
  // unaffected.
  //
  // claimedAxisRef records which axis onMoveShouldSetPanResponder actually
  // claimed the gesture for — onPanResponderRelease then acts on that same
  // axis, rather than independently re-deriving "which axis wins" from the
  // gesture's final dx/dy. Re-deriving it at release was the bug: a swipe
  // clearly claimed as horizontal (say dx=-90, dy=20 at the moment it was
  // claimed) can still drift to a final dy that *exceeds* dx by release —
  // any natural diagonal wobble over a longer drag — at which point the old
  // "whichever of dx/dy is bigger, right now" check would flip to reading
  // the vertical thresholds instead, and could fire the *opposite*
  // direction from the one the user's swipe actually meant (e.g. a
  // left-swipe-for-next ending with dy slightly larger than dx would read
  // as a downward swipe and fire "prev" instead). Acting on the
  // originally-claimed axis instead makes that impossible.
  const claimedAxisRef = useRef<'x' | 'y' | null>(null);
  const navPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => {
        const horizontal = Math.abs(g.dx) > 60 && Math.abs(g.dy) < 30 && Math.abs(g.dx) > Math.abs(g.dy) * 2;
        const vertical = Math.abs(g.dy) > 60 && Math.abs(g.dx) < 30 && Math.abs(g.dy) > Math.abs(g.dx) * 2;
        if (horizontal) { claimedAxisRef.current = 'x'; return true; }
        if (vertical) { claimedAxisRef.current = 'y'; return true; }
        return false;
      },
      onPanResponderRelease: (_, g) => {
        const axis = claimedAxisRef.current;
        claimedAxisRef.current = null;
        if (axis === 'x') {
          if (g.dx < -80 && hasNextRef.current) { songNavAxisRef.current = 'x'; songNavDirectionRef.current = 'next'; onNextRef.current?.(); }
          else if (g.dx > 80 && hasPrevRef.current) { songNavAxisRef.current = 'x'; songNavDirectionRef.current = 'prev'; onPrevRef.current?.(); }
        } else if (axis === 'y') {
          if (g.dy < -80 && hasNextRef.current) { songNavAxisRef.current = 'y'; songNavDirectionRef.current = 'next'; onNextRef.current?.(); }
          else if (g.dy > 80 && hasPrevRef.current) { songNavAxisRef.current = 'y'; songNavDirectionRef.current = 'prev'; onPrevRef.current?.(); }
        }
      },
    })
  ).current;

  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(fsOverlayOpacity, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    }, 80);
    return () => clearTimeout(t);
  }, [width, height]);

  useEffect(() => {
    if (!visible) {
      setPlayerReady(false);
      setPlaying(false);
      setShowResume(false);
      setVideoMuted(false);
      setLocked(false);
      setProgressLoaded(false);
      setLoadError(false);
      resumePositionRef.current = 0;
      durationRef.current = 0;
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      if (switchGuardTimeoutRef.current) clearTimeout(switchGuardTimeoutRef.current);
      switchingVideoRef.current = false;
      prevVideoIdRef.current = null;
      fsOverlayOpacity.setValue(0);
      safeLockOrientation(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      return;
    }
    if (!videoId) return;
    setProgressLoaded(false);
    setLoadError(false);
    resumePositionRef.current = 0;
    if (prevVideoIdRef.current !== null && prevVideoIdRef.current !== videoId) {
      switchingVideoRef.current = true;
      if (switchGuardTimeoutRef.current) clearTimeout(switchGuardTimeoutRef.current);
      switchGuardTimeoutRef.current = setTimeout(() => { switchingVideoRef.current = false; }, 4000);
    }
    prevVideoIdRef.current = videoId;
    const armLoadTimeout = () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        setLoadError(prev => { if (!prev) return true; return prev; });
      }, 15000);
    };
    if (isLive) {
      setProgressLoaded(true);
      armLoadTimeout();
      return;
    }
    if (autoAdvance) {
      // Auto-advancing to the next song after one finishes always starts
      // from 0:00 — the Continue Watching resume prompt only applies when
      // the user manually opened this video/song.
      setProgressLoaded(true);
      armLoadTimeout();
      return;
    }
    getVideoProgress(videoId).then(progress => {
      if (!mountedRef.current) return;
      resumePositionRef.current = progress ? progress.position : 0;
      if (progress) durationRef.current = progress.duration;
      // Settled before progressLoaded flips (which is what actually mounts
      // the player below), so the very first render of <YoutubePlayer> for
      // this video already has the right initialPlayerParams.mute baked in.
      setVideoMuted(resumePositionRef.current > 0);
      setProgressLoaded(true);
      armLoadTimeout();
    });
  }, [visible, videoId, isLive, autoAdvance]);

  useEffect(() => {
    if (!playerReady || !videoId) return;
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = setInterval(async () => {
      if (!mountedRef.current || !playing) return;
      try {
        const position = await playerRef.current?.getCurrentTime();
        const duration = await playerRef.current?.getDuration();
        if (position !== undefined && duration !== undefined && duration > 0) {
          durationRef.current = duration;
          saveVideoProgress(videoId, position, duration);
        }
      } catch {}
    }, 5000);
    return () => { if (progressIntervalRef.current) clearInterval(progressIntervalRef.current); };
  }, [playerReady, playing, videoId]);

  const fsTransitionRef = useRef(false);

  const handleReady = useCallback(() => {
    if (!mountedRef.current) return;
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    setLoadError(false);
    setPlayerReady(true);
    if (resumePositionRef.current > 0) {
      playerRef.current?.seekTo(resumePositionRef.current, true);
      // YouTube's IFrame player has documented behavior where seekTo() on a
      // player that hasn't explicitly been paused yet (still "unstarted"/
      // "cued" right after onReady, which is exactly when this runs) starts
      // playback as a side effect of the seek itself — independent of our
      // own play/pause state or the autoplay setting. pauseVideo() (below)
      // asks the player to stop, and works on web, but
      // react-native-youtube-iframe exposes no such imperative method on
      // native (it's a no-op there via optional chaining), so it can't be
      // relied on to win that race on Android/iOS. `videoMuted` is what
      // actually keeps native silent: it was baked into this player's
      // *initial* embed params back when progressLoaded flipped (see the
      // getVideoProgress effect above), before this seekTo — and therefore
      // before any of this — could ever run.
      playerRef.current?.pauseVideo?.();
      setPlaying(false);
      setShowResume(true);
    } else {
      setPlaying(true);
      setShowResume(false);
    }
  }, []);

  const handleResume = useCallback(() => {
    setShowResume(false);
    setPlaying(true);
    setVideoMuted(false);
  }, []);

  const handleStartOver = useCallback(() => {
    setShowResume(false);
    if (videoId) clearVideoProgress(videoId);
    resumePositionRef.current = 0;
    playerRef.current?.seekTo(0, true);
    setPlaying(true);
    setVideoMuted(false);
  }, [videoId]);

  const onChangeState = useCallback((state: string) => {
    if (state === 'playing') {
      // playerReady normally flips on the player's onReady event — but a
      // 'playing' state change already means the player is unambiguously
      // ready, regardless of whether that separate onReady event fired.
      // Without this, a slow/dropped onReady (seen on web) left the loading
      // overlay stuck on screen even once the video was already playing.
      if (mountedRef.current) {
        if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
        setPlayerReady(true);
      }
      fsTransitionRef.current = false;
      if (switchGuardTimeoutRef.current) clearTimeout(switchGuardTimeoutRef.current);
      switchingVideoRef.current = false;
      // Not while showResume is up — handleReady's seekTo() (done to
      // position the player before the "Continue Watching?" prompt shows)
      // makes the underlying YouTube player emit a transient 'playing'
      // event of its own accord as a side effect of seeking. Without this
      // guard that overrode the intentional pause, so the video played on
      // in the background while the user was still being asked to choose
      // Resume or Start Over. handleReady's explicit pauseVideo() call is
      // the primary fix for the seek itself; this re-asserts the pause if a
      // 'playing' event still slips through (e.g. it raced the buffer).
      if (showResume) {
        playerRef.current?.pauseVideo?.();
      } else {
        setPlaying(true);
      }
    }
    // Songs auto-advance to the next one when playback naturally ends — a
    // no-op for the plain Videos tab, which never passes onEnded/hasNext.
    // Used to also require !isInFullscreen — auto-advance while fullscreen
    // was skipped outright, because changing videoId used to destroy and
    // recreate the underlying web iframe (see the matching comment in
    // YoutubePlayer.web.tsx), which forcibly exits fullscreen the instant
    // the fullscreen element leaves the DOM, and could crash outright if
    // that removal raced the browser's own fullscreen-exit teardown. Now
    // that a videoId change reuses the same iframe instead, auto-advance is
    // safe to fire unconditionally — and correctly keeps the next video
    // playing in fullscreen instead of always dropping out of it. The
    // try/catch is a last-resort net: nothing here is expected to throw,
    // but nothing in the auto-advance chain should ever be able to crash
    // the page regardless.
    if (state === 'ended' && hasNextRef.current) {
      try {
        onEndedRef.current?.();
      } catch {}
    }
    if (fsTransitionRef.current) return;
    // Ignore transient 'paused' events fired while switching to a new song
    // (see switchingVideoRef's declaration above) — only a 'paused' that
    // arrives once the switch has settled reflects a real user pause.
    if (switchingVideoRef.current) return;
    if (state === 'paused') setPlaying(false);
    if (state === 'paused' && playerReady && !showResume) {
      setTimeout(async () => {
        if (!mountedRef.current) return;
        const currentTime = await playerRef.current?.getCurrentTime();
        if (currentTime !== undefined) playerRef.current?.seekTo(currentTime, true);
      }, 300);
    }
  }, [playerReady, showResume]);

  const onFullScreenChange = useCallback((isFs: boolean) => {
    if (!mountedRef.current) return;
    fsTransitionRef.current = true;
    Animated.timing(fsOverlayOpacity, { toValue: 1, duration: 100, useNativeDriver: true }).start();
    if (isFs) {
      safeLockOrientation(ScreenOrientation.OrientationLock.LANDSCAPE);
      safeActivateKeepAwake('fullscreen');
    } else {
      safeLockOrientation(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      safeDeactivateKeepAwake('fullscreen');
    }
  }, []);

  // Slides the new song's content in from the direction of travel (right-to-
  // left on Next, left-to-right on Prev) — songNavDirectionRef is only ever
  // set by handleSongNext/handleSongPrev/the swipe handler above, so this is
  // strictly a song-navigation visual and never fires for the plain Videos
  // tab (hasSongNav false there) or on the modal's initial open (ref starts
  // null). videoId is the dependency, not activeSongIndex, since that's what
  // this component actually receives as a prop.
  useEffect(() => {
    if (!hasSongNav) return;
    const direction = songNavDirectionRef.current;
    const axis = songNavAxisRef.current;
    songNavDirectionRef.current = null;
    if (!direction) return;
    const anim = axis === 'y' ? songSlideY : songSlideX;
    anim.setValue(direction === 'next' ? 48 : -48);
    Animated.timing(anim, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [videoId, hasSongNav]);

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={() => { if (!locked) onClose(); }}>
      <View
        style={[styles.videoModal, Platform.OS === 'web' && isTabletUp && styles.videoModalDesktopCenter, isLandscape && styles.videoModalLandscape]}
        onLayout={e => setMeasuredWidth(e.nativeEvent.layout.width)}
        {...(hasSongNav && (Platform.OS !== 'web' || !isTabletUp) ? navPanResponder.panHandlers : {})}
      >
        <StatusBar hidden />
        {(!playerReady || !progressLoaded || !sizeReady) && (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', zIndex: 10 }]}>
            {loadError
              ? <PlayerErrorState onRetry={() => {
                  setLoadError(false); setProgressLoaded(false); setPlayerReady(false);
                  if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
                  if (!videoId) return;
                  setProgressLoaded(false);
                  if (isLive) {
                    setProgressLoaded(true);
                    loadTimeoutRef.current = setTimeout(() => { if (mountedRef.current) setLoadError(true); }, 15000);
                    return;
                  }
                  getVideoProgress(videoId).then(p => {
                    if (!mountedRef.current) return;
                    resumePositionRef.current = p ? p.position : 0;
                    setProgressLoaded(true);
                    loadTimeoutRef.current = setTimeout(() => { if (mountedRef.current) setLoadError(true); }, 15000);
                  });
                }} />
              : <VideoLoadingState accentColor={colors.accent} />
            }
          </View>
        )}
        <Animated.View style={{ transform: [{ translateX: songSlideX }, { translateY: songSlideY }] }}>
          {(() => {
            // Math.min caps the player at CONTENT_MAX_WIDTH on tablet/desktop
            // (a no-op on mobile, where width is already well under that cap)
            // instead of stretching it across the full browser window. On
            // desktop it's also capped by *height* — a width-only cap let a
            // short, wide browser window compute a video taller than the
            // actual viewport, which this component's own vertical centering
            // then clipped at the top instead of shrinking to fit. The
            // action icons sit in a side rail beside the video on desktop
            // (not stacked in a row below it, like mobile), so only the
            // title needs reserving room for, and the rail's own width is
            // reserved out of the horizontal budget so it doesn't overflow.
            const ACTIONS_RAIL_WIDTH = 110;
            const maxDesktopVideoH = isTabletUp ? height - 130 : Infinity;
            const maxDesktopVideoW = isTabletUp ? width - ACTIONS_RAIL_WIDTH - 24 : width;
            // Deliberately two separate formulas, not one shared calc — main
            // (the original Android app) never had tablet/desktop-width
            // capping at all: no isTabletUp, no CONTENT_MAX_WIDTH, no
            // ACTIONS_RAIL_WIDTH budget. Every attempt to keep native on the
            // *same* capped formula as web (even with isTabletUp always false
            // in practice on a phone) still visibly reproduced the migrated
            // app's cropped/zoomed/off-center player on-device (see
            // Video_Module_Regression_Report.docx) — so native now computes
            // its size exactly the way main's own VideoModal always did,
            // full stop, regardless of isTabletUp (which is itself
            // documented elsewhere in this file as occasionally misreporting
            // true during Android's very first layout pass — a native
            // formula that still branched on it could still transiently hit
            // the capped path). Web keeps the capped/responsive formula,
            // which was never reported broken and is genuinely needed there
            // (a browser window, unlike any physical device, can be
            // arbitrarily wide).
            const videoW = Platform.OS === 'web'
              ? (isLandscape ? height * 16 / 9 : Math.min(maxDesktopVideoW, CONTENT_MAX_WIDTH, (maxDesktopVideoH * 16) / 9))
              : (isLandscape ? height * 16 / 9 : width);
            const videoH = isLandscape ? height : videoW * 9 / 16;

            const videoBlock = progressLoaded && sizeReady && (
              <View style={{ width: videoW, height: videoH }}>
                <YoutubePlayer
                  ref={playerRef}
                  height={videoH}
                  width={videoW}
                  videoId={videoId || ''}
                  play={playing}
                  // Only the resume-prompt-specific mute applies here (see
                  // the getVideoProgress effect and handleReady above) — an
                  // earlier attempt also forced this permanently true
                  // whenever hasSongNav (i.e. for every Song, forever, with
                  // no way to unmute), on a mistaken reading of main's
                  // SongItem hardcoding initialPlayerParams.mute:1. On-device
                  // testing showed that was wrong: Songs are expected to
                  // play with sound like any other video, muted only for the
                  // same brief resume-prompt window plain Videos already get.
                  mute={videoMuted}
                  forceAndroidAutoplay={true}
                  onReady={handleReady}
                  onChangeState={onChangeState}
                  onFullScreenChange={onFullScreenChange}
                  onError={() => { if (mountedRef.current) { if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current); setLoadError(true); } }}
                  // useLocalHTML was tried here and reverted — it broke
                  // playback outright (YouTube error 153, "video player
                  // configuration error"). The remote lonelycpp.github.io
                  // page apparently supplies an origin YouTube's embed
                  // validation requires, that a locally-embedded page
                  // doesn't have. Back to the default (remote) loading.
                  // textZoom={100} (Android-only; harmlessly ignored on iOS/
                  // web) pins the WebView's layout to 100% regardless of the
                  // device's system font/display-size accessibility setting —
                  // react-native-webview inherits that system scale by
                  // default, which skews a viewport-percentage-based page
                  // like this player's (see YoutubePlayer.tsx's own comment)
                  // on any device with a non-default text/display size.
                  webViewProps={{ allowsInlineMediaPlayback: true, mediaPlaybackRequiresUserAction: false, allowsFullscreenVideo: true, textZoom: 100 }}
                  initialPlayerParams={{ rel: 0, modestbranding: 1, controls: 1, playsinline: 1, mute: resumePositionRef.current > 0 ? 1 : 0 }}
                />
                {showResume && videoId && (
                  <Image
                    source={{ uri: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` }}
                    style={[StyleSheet.absoluteFillObject, { resizeMode: 'cover' }]}
                  />
                )}
              </View>
            );

            // Same element tree on every breakpoint — only styles/props vary
            // (desktopPlayerRow's flexDirection, VideoActions' direction) —
            // rather than branching into two structurally different trees.
            // isTabletUp swapping between an entirely different element
            // shape mid-mount (it's derived from useWindowDimensions(),
            // which can transiently report a wrong value during Android's
            // very first layout pass before correcting itself) would tear
            // down and remount the video player, which is a plausible cause
            // of the corrupted/cropped rendering seen on native — this
            // keeps the same YoutubePlayer instance mounted regardless.
            return (
              <View style={Platform.OS === 'web' && isTabletUp ? styles.desktopPlayerRow : undefined}>
                <View>
                  {videoBlock}
                  {!isLandscape && <Text style={styles.videoModalTitle} numberOfLines={3}>{title}</Text>}
                </View>
                {!isLandscape && (
                  // On mobile web the Prev/Next buttons live inside this
                  // same wrapper (position:'relative', sized to fit exactly
                  // around VideoActions) instead of over the whole video —
                  // videoModalNavBtn's top:'50%'/marginTop:-22 then centers
                  // them against *this* row's own height, aligning them
                  // with the YouTube/Copy icons regardless of video or
                  // title height, with no measuring needed. Desktop's
                  // buttons are unaffected — they stay in their original
                  // position over the video, below.
                  <View style={Platform.OS !== 'web' || !isTabletUp ? styles.mobileActionsRowWrap : undefined}>
                    <VideoActions videoId={videoId || ''} title={title} direction={Platform.OS === 'web' && isTabletUp ? 'column' : 'row'} />
                    {hasSongNav && !isTabletUp && Platform.OS === 'web' && (
                      <>
                        <TouchableOpacity
                          style={[styles.videoModalNavBtn, styles.videoModalNavBtnLeft]}
                          disabled={!hasPrev}
                          onPress={handleSongPrev}
                        >
                          <Ionicons name="chevron-back" size={22} color={hasPrev ? '#fff' : 'rgba(255,255,255,0.3)'} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.videoModalNavBtn, styles.videoModalNavBtnRight]}
                          disabled={!hasNext}
                          onPress={handleSongNext}
                        >
                          <Ionicons name="chevron-forward" size={22} color={hasNext ? '#fff' : 'rgba(255,255,255,0.3)'} />
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )}
              </View>
            );
          })()}
        </Animated.View>
        {playerReady && (
          <ResumePrompt visible={showResume} onResume={handleResume} onStartOver={handleStartOver} />
        )}
        <View style={[styles.topRightRow, isLandscape && styles.topRightRowLandscape]}>
          {/* Screen-lock guards against accidental touches (e.g. in a
              pocket, or during fullscreen landscape) — not a concern with
              mouse-based desktop input, so it's mobile/tablet only. */}
          {(Platform.OS !== 'web' || !isTabletUp) && (
            <TouchableOpacity style={styles.lockToggleBtn} onPress={() => setLocked(true)}>
              <Ionicons name="lock-open-outline" size={24} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.roundIconBtn} onPress={onClose}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
        {hasSongNav && !isLandscape && (
          Platform.OS === 'web' && isTabletUp ? (
            // Desktop: unchanged, buttons over the video (rail layout
            // means the icons are beside it, not below, so there's no
            // "align with the icons" row to match here).
            <>
              <TouchableOpacity
                style={[styles.videoModalNavBtn, styles.videoModalNavBtnLeft]}
                disabled={!hasPrev}
                onPress={handleSongPrev}
              >
                <Ionicons name="chevron-back" size={22} color={hasPrev ? '#fff' : 'rgba(255,255,255,0.3)'} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.videoModalNavBtn, styles.videoModalNavBtnRight]}
                disabled={!hasNext}
                onPress={handleSongNext}
              >
                <Ionicons name="chevron-forward" size={22} color={hasNext ? '#fff' : 'rgba(255,255,255,0.3)'} />
              </TouchableOpacity>
            </>
          ) : Platform.OS === 'web' ? (
            // Mobile web: buttons render inline next to VideoActions
            // instead (see the mobileActionsRowWrap block above) — nothing
            // here.
            null
          ) : (
            // Native mobile: unchanged, swipe gesture still works there.
            <View style={[styles.songsSwipeHint, { bottom: insets.bottom + 16 }]}>
              <Ionicons name="chevron-back" size={16} color="rgba(255,255,255,0.5)" />
              <Text style={styles.songsSwipeHintText}>Swipe to navigate</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
            </View>
          )
        )}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', opacity: fsOverlayOpacity, zIndex: 50 }]} />
        {locked && <LockOverlay onUnlock={() => setLocked(false)} />}
      </View>
    </Modal>
  );
}

// Shared by ShortsPlayerItemInner: sizes the full-screen
// "theater" stage for a portrait (Shorts-style) video. Mobile keeps the
// exact previous full-bleed-phone-screen behavior. Desktop/tablet renders a
// centered, sensibly-sized portrait panel instead of treating the whole
// (much wider, much shorter) browser window as if it were an oversized
// phone screen held in portrait — the previous width/height-swap heuristic
// (min/max of Dimensions.get('screen')) produced a container far taller
// than the real viewport on desktop, which is what caused the video title
// to render mid-page and the layout to overflow/scroll oddly.
function useStagePlayerSize() {
  // Native restores main's exact original approach: Dimensions.get('screen')
  // captured once (a static hardware fact, not a layout measurement that
  // can be transiently wrong on a render pass), the same source and Math.min/
  // max portrait-normalization main always used for the Shorts player. Main
  // never had tablet/desktop sizing here at all — this doesn't fork on
  // isTabletUp/isMobile for native the way web does below, keeping native
  // fully immune to any breakpoint-detection flakiness, matching the same
  // Platform.OS-forked approach used for VideoModal's own sizing (see
  // Video_Module_Regression_Report.docx for what on-device testing showed
  // when native shared web's capped/reactive formula instead).
  const nativeDims = useRef((() => {
    const s = Dimensions.get('screen');
    const w = Math.min(s.width, s.height);
    const h = Math.max(s.width, s.height);
    return { width: w, height: h };
  })());
  const { width, height } = useWindowDimensions();
  const { isMobile } = useBreakpoint();
  if (Platform.OS !== 'web') {
    const w = nativeDims.current.width;
    return { containerW: w, containerH: nativeDims.current.height, videoW: w, videoH: w * 9 / 16 };
  }
  if (isMobile) {
    const w = Math.min(width, height);
    const h = Math.max(width, height);
    return { containerW: w, containerH: h, videoW: w, videoH: w * 9 / 16 };
  }
  // Reserves the same horizontal budget as Songs' desktop rail
  // (ACTIONS_RAIL_WIDTH in VideoModal) so the action icons sit in a column
  // beside the video instead of overflowing the viewport, matching that
  // layout exactly.
  const ACTIONS_RAIL_WIDTH = 110;
  const maxVideoH = height - 140; // leaves room for the title below
  const maxVideoW = width - ACTIONS_RAIL_WIDTH - 24;
  const videoW = Math.min(420, maxVideoW * 0.9, (maxVideoH * 9) / 16);
  const videoH = (videoW * 16) / 9;
  return { containerW: width, containerH: height, videoW, videoH };
}

function ShortsPlayerItemInner({ item, index, isActive, onEnd, onClose, total, onScrollLockChange, hasPrev, hasNext, onPrev, onNext }: any) {
  const [shortReady, setShortReady] = useState(false);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const videoId = item?.snippet?.resourceId?.videoId;
  const title = item?.snippet?.title ?? '';
  const { colors } = useTheme();
  const { isTabletUp } = useBreakpoint();
  const insets = useSafeAreaInsets();
  const playerRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const resumePositionRef = useRef<number>(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { containerW, containerH, videoW, videoH } = useStagePlayerSize();

  useEffect(() => () => {
    mountedRef.current = false;
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
  }, []);

  useEffect(() => {
    setShortReady(false);
    setProgressLoaded(false);
    setLoadError(false);
    resumePositionRef.current = 0;
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    if (!videoId) {
      setProgressLoaded(true);
      return;
    }
    getVideoProgress(videoId, 5).then(progress => {
      if (!mountedRef.current) return;
      resumePositionRef.current = progress ? progress.position : 0;
      setProgressLoaded(true);
    });
  }, [videoId]);

  useEffect(() => {
    if (!isActive || !progressLoaded || shortReady || loadError) {
      if (loadTimeoutRef.current) { clearTimeout(loadTimeoutRef.current); loadTimeoutRef.current = null; }
      return;
    }
    loadTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) setLoadError(prev => { if (!prev) return true; return prev; });
    }, 15000);
    return () => {
      if (loadTimeoutRef.current) { clearTimeout(loadTimeoutRef.current); loadTimeoutRef.current = null; }
    };
  }, [isActive, progressLoaded, shortReady, loadError]);

  useEffect(() => {
    if (!shortReady || !videoId) return;
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = setInterval(async () => {
      if (!mountedRef.current) return;
      try {
        const position = await playerRef.current?.getCurrentTime();
        const duration = await playerRef.current?.getDuration();
        if (position !== undefined && duration !== undefined && duration > 0) {
          saveVideoProgress(videoId, position, duration);
        }
      } catch {}
    }, 5000);
    return () => { if (progressIntervalRef.current) clearInterval(progressIntervalRef.current); };
  }, [shortReady, videoId]);

  const fsTransitionRef = useRef(false);
  const isFullscreenRef = useRef(false);

  const handleReady = useCallback(() => {
    if (!mountedRef.current) return;
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    setLoadError(false);
    setShortReady(true);
    if (resumePositionRef.current > 0) {
      playerRef.current?.seekTo(resumePositionRef.current, true);
    }
  }, []);

  const onFullScreenChange = useCallback((isFs: boolean) => {
    if (!mountedRef.current) return;
    fsTransitionRef.current = true;
    isFullscreenRef.current = isFs;
    if (isFs) {
      safeUnlockOrientation();
      safeActivateKeepAwake('fullscreen');
    } else {
      safeLockOrientation(ScreenOrientation.OrientationLock.PORTRAIT);
      safeDeactivateKeepAwake('fullscreen');
    }
  }, []);

  return (
    <View style={{ width: containerW, height: containerH, backgroundColor: '#000', justifyContent: 'center', ...(Platform.OS === 'web' && isTabletUp ? { alignItems: 'center' as const } : null) }}>
      <StatusBar hidden />
      {(!shortReady || !progressLoaded) && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', zIndex: 10 }]}>
          {loadError
            ? <PlayerErrorState onRetry={() => {
                if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
                setLoadError(false);
                setShortReady(false);
                setProgressLoaded(false);
                if (!videoId) return;
                getVideoProgress(videoId, 5).then(p => {
                  if (!mountedRef.current) return;
                  resumePositionRef.current = p ? p.position : 0;
                  setProgressLoaded(true);
                });
              }} />
            : <VideoLoadingState accentColor={colors.accent} />
          }
        </View>
      )}
      {/* Same unified-tree approach as VideoModal's Songs layout (see its
          own comment on why): the wrapping row/column Views are always
          present, only styles/props vary by isTabletUp — never swapping to
          a structurally different subtree, which avoids a remount (and the
          player restarting) if isTabletUp flips transiently. */}
      <View style={Platform.OS === 'web' && isTabletUp ? styles.desktopPlayerRow : undefined}>
        <View>
          {isActive && progressLoaded ? (
            <YoutubePlayer
              ref={playerRef}
              height={videoH}
              width={videoW}
              videoId={videoId}
              play
              forceAndroidAutoplay={true}
              onReady={handleReady}
              onFullScreenChange={onFullScreenChange}
              onError={() => { if (mountedRef.current) { if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current); setLoadError(true); } }}
              onChangeState={async (s: string) => {
                if (s === 'playing') {
                  // shortReady normally flips on the player's onReady event —
                  // but if we're already seeing a 'playing' state change, the
                  // player is unambiguously ready regardless of whether that
                  // separate onReady event fired/arrived. Without this, a
                  // slow/dropped onReady (seen on web, e.g. under a browser
                  // profile that blocks third-party cookies) left the loading
                  // overlay stuck on screen indefinitely even though the video
                  // was audibly/visibly already playing underneath it.
                  if (mountedRef.current) {
                    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
                    setShortReady(true);
                  }
                  fsTransitionRef.current = false;
                  onScrollLockChange(false);
                }
                if (s === 'ended' && isFullscreenRef.current) {
                  return;
                }
                if (fsTransitionRef.current) return;
                if (s === 'paused') onScrollLockChange(true);
                if (s === 'ended') {
                  onScrollLockChange(false);
                  if (videoId) clearVideoProgress(videoId);
                  setTimeout(() => onEnd(index), 300);
                }
                if (s === 'paused' && shortReady) {
                  setTimeout(async () => {
                    if (!mountedRef.current) return;
                    const currentTime = await playerRef.current?.getCurrentTime();
                    if (currentTime !== undefined) playerRef.current?.seekTo(currentTime, true);
                  }, 300);
                }
              }}
              webViewProps={{ allowsInlineMediaPlayback: true, mediaPlaybackRequiresUserAction: false, allowsFullscreenVideo: true }}
              initialPlayerParams={{ rel: 0, modestbranding: 1, controls: 1, playsinline: 1 }}
            />
          ) : (
            <View style={{ width: videoW, height: videoH, backgroundColor: '#000' }} />
          )}
          {shortReady && <Text style={styles.videoModalTitle} numberOfLines={3}>{title}</Text>}
        </View>
        {shortReady && (
          // Same treatment as Songs' VideoModal: on mobile web the Prev/Next
          // buttons render inline here, wrapped around VideoActions so
          // videoModalNavBtn's top:'50%' centers them against this row's
          // own height (aligned with the YouTube/Copy icons) instead of the
          // whole video. Desktop keeps its buttons in their original
          // position (rendered by the parent, over the video) — unaffected.
          <View style={Platform.OS !== 'web' || !isTabletUp ? styles.mobileActionsRowWrap : undefined}>
            <VideoActions videoId={videoId || ''} title={title} direction={Platform.OS === 'web' && isTabletUp ? 'column' : 'row'} />
            {!isTabletUp && Platform.OS === 'web' && (onPrev || onNext) && (
              <>
                <TouchableOpacity
                  style={[styles.videoModalNavBtn, styles.videoModalNavBtnLeft]}
                  disabled={!hasPrev}
                  onPress={onPrev}
                >
                  <Ionicons name="chevron-back" size={22} color={hasPrev ? '#fff' : 'rgba(255,255,255,0.3)'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.videoModalNavBtn, styles.videoModalNavBtnRight]}
                  disabled={!hasNext}
                  onPress={onNext}
                >
                  <Ionicons name="chevron-forward" size={22} color={hasNext ? '#fff' : 'rgba(255,255,255,0.3)'} />
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
      <TouchableOpacity style={styles.modalClose} onPress={onClose}>
        <Ionicons name="close" size={26} color="#fff" />
      </TouchableOpacity>
      {/* Native mobile only — mobile web gets the inline buttons above
          instead, since there's no swipe/scroll gesture happening there
          anymore for this hint to describe. */}
      {shortReady && Platform.OS !== 'web' && (
        <View style={[styles.songsSwipeHint, { bottom: insets.bottom + 16 }]}>
          <Ionicons name="chevron-up" size={16} color="rgba(255,255,255,0.5)" />
          <Text style={styles.songsSwipeHintText}>Swipe to navigate</Text>
          <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.5)" />
        </View>
      )}
    </View>
  );
}

interface VideosScreenProps {
  autoPlayLive?: { videoId: string; title: string } | null;
  onAutoPlayLiveConsumed?: () => void;
  isActive?: boolean;
}

function VideosScreenContent({ autoPlayLive, onAutoPlayLiveConsumed, isActive }: VideosScreenProps = {}) {
  const { colors } = useTheme();
  const { isMobile, isTablet, isTabletUp, width: bpWidth } = useBreakpoint();
  // On desktop web, bpWidth is the full browser window width — but the
  // actual content area is narrower than that once the persistent sidebar
  // (TabShell.web.tsx) is accounted for, so grid math based on bpWidth alone
  // could pick more columns than the real content area comfortably fits.
  // Measuring the root container's own rendered width via onLayout instead
  // gives the true available space, and stays correct even if the sidebar
  // width ever changes (no hardcoded subtraction constant to keep in sync).
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const gridWidth = measuredWidth || bpWidth;
  // Fluid column count for the video/song/live/category grids: 1 on mobile
  // (unchanged), 2 on tablet, and a 3-5 column grid on desktop that scales
  // with the actual available width instead of a single fixed count — a
  // "true desktop" grid rather than a stretched single-column mobile list.
  // Native is forced to 1 unconditionally (matching main, which never had
  // any of this multi-column logic) rather than via isMobile, for the same
  // reason as shortsNumColumns above.
  const numColumns = Platform.OS !== 'web' ? 1 : isMobile ? 1 : isTablet ? 2 : Math.max(3, Math.min(5, Math.round((Math.min(gridWidth, WIDE_CONTENT_MAX_WIDTH) - GRID_GAP * 2) / TARGET_CARD_WIDTH)));
  // key is applied directly as a JSX attribute at each call site below, not
  // through this spread — React 19 errors on a "key" prop arriving via a
  // spread object instead of a literal JSX attribute.
  const gridKey = `grid-${numColumns}`;
  const gridColumnProps = numColumns > 1
    ? { numColumns, columnWrapperStyle: styles.columnWrapper }
    : { numColumns: 1 };
  // Shorts thumbnails are portrait (much narrower than regular video cards),
  // so they get their own fluid column count with a smaller target width —
  // previously a hardcoded 2 columns regardless of viewport, the one grid
  // in this file with no responsive logic at all. Native keeps that fixed 2,
  // matching main exactly and unconditionally (not merely isMobile, which —
  // like isTabletUp — is derived from useWindowDimensions() and can
  // transiently misreport on Android's very first layout pass; hardcoding
  // this for native removes any dependency on that value being right).
  const shortsNumColumns = Platform.OS !== 'web' ? 2 : isMobile ? 2 : isTablet ? 3 : Math.max(3, Math.min(6, Math.round((Math.min(gridWidth, WIDE_CONTENT_MAX_WIDTH) - GRID_GAP * 2) / TARGET_SHORT_CARD_WIDTH)));

  const [activeTab, setActiveTab] = useState<Tab>('shorts');
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const tabsScrollRef = useRef<ScrollView>(null);
  const tabLayoutsRef = useRef<Record<string, { x: number; width: number }>>({});
  const tabsViewportWidthRef = useRef(0);

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

  const [songs, setSongs] = useState<any[]>([]);
  const [songsLoaded, setSongsLoaded] = useState(false);
  const [songsError, setSongsError] = useState(false);
  const [songsNextToken, setSongsNextToken] = useState('');
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [loadingMoreSongs, setLoadingMoreSongs] = useState(false);
  // Songs open into the same single-video VideoModal used by the Videos tab
  // (not a Shorts-style full-screen stage) — activeSongIndex is null when the
  // modal is showing a plain video, and set to the song's position in
  // `songs` when it's showing a song, which is what enables Prev/Next.
  const [activeSongIndex, setActiveSongIndex] = useState<number | null>(null);
  const [songAutoAdvance, setSongAutoAdvance] = useState(false);

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

  const [categories, setCategories] = useState<any[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [categoriesError, setCategoriesError] = useState(false);
  const [categoriesNextToken, setCategoriesNextToken] = useState('');
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingMoreCategories, setLoadingMoreCategories] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<{ id: string; title: string; itemCount: number } | null>(null);
  const [categoryVideos, setCategoryVideos] = useState<any[]>([]);
  const [categoryVideosLoaded, setCategoryVideosLoaded] = useState(false);
  const [categoryVideosError, setCategoryVideosError] = useState(false);
  const [categoryVideosNextToken, setCategoryVideosNextToken] = useState('');
  const [loadingCategoryVideos, setLoadingCategoryVideos] = useState(false);
  const [loadingMoreCategoryVideos, setLoadingMoreCategoryVideos] = useState(false);
  const categoryVideosCacheRef = useRef<Record<string, { videos: any[]; nextToken: string }>>({});

  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [activeVideoTitle, setActiveVideoTitle] = useState('');
  const [activeVideoIsLive, setActiveVideoIsLive] = useState(false);
  const [shortsPlayerVisible, setShortsPlayerVisible] = useState(false);
  const [shortsScrollEnabled, setShortsScrollEnabled] = useState(true);
  const [currentShortIndex, setCurrentShortIndex] = useState(0);
  const [playingShortId, setPlayingShortId] = useState<string | null>(null);

  const shortsListRef = useRef<FlatList>(null);
  const shortsNextRef = useRef('');
  const loadingMoreShortsRef = useRef(false);
  const shortsDataRef = useRef<any[]>([]);
  const shortItemSizeRef = useRef(Dimensions.get('screen').height);
  // Desktop-only horizontal slide, matching VideoModal's songSlideX/
  // songNavDirectionRef exactly (same values, same easing/duration) — see
  // the isTabletUp branch in the Shorts Modal below. direction is a ref
  // (not state) so setting it doesn't itself trigger a re-render; it's set
  // right before an explicit Prev/Next action and consumed once by the
  // effect below when playingShortId actually changes. Natural end-of-clip
  // auto-advance (handleShortEnd, called directly from onEnd — not through
  // handleShortNextClick) never sets it, so auto-advance doesn't slide,
  // exactly mirroring Songs' onEnded-vs-explicit-nav distinction.
  const shortSlideX = useRef(new Animated.Value(0)).current;
  const shortNavDirectionRef = useRef<'next' | 'prev' | null>(null);

  useEffect(() => { shortsNextRef.current = shortsNextToken; }, [shortsNextToken]);
  useEffect(() => { loadingMoreShortsRef.current = loadingMoreShorts; }, [loadingMoreShorts]);
  useEffect(() => { shortsDataRef.current = shorts; }, [shorts]);
  useEffect(() => { fetchShorts(); }, []);

  // Deliberately depends on shortsPlayerVisible ONLY — matches main exactly
  // (main's equivalent effect never included isMobile in its dependency
  // array at all). isMobile/isTabletUp are derived from
  // useWindowDimensions(), whose width/height swap the instant a device
  // physically rotates — on most phones, the landscape width alone crosses
  // the tablet breakpoint (700dp), flipping isMobile to false. If this
  // lock/unlock effect depended on isMobile too, that flip re-ran it *while
  // a Short was already open in fullscreen landscape* (isMobile flipping is
  // exactly what fullscreen rotation causes) and re-locked back to
  // PORTRAIT a moment after entering it — precisely the "briefly goes
  // landscape then immediately snaps back to portrait" symptom, and a
  // plausible source of instability when that raced against
  // onFullScreenChange's own lock/unlock calls on exit too. The item-size
  // sync below still reacts to isMobile (needed for web's responsive
  // recompute if the browser is resized mid-playback), but no longer
  // touches orientation at all.
  useEffect(() => {
    if (shortsPlayerVisible) {
      safeLockOrientation(ScreenOrientation.OrientationLock.PORTRAIT);
    } else {
      safeUnlockOrientation();
    }
  }, [shortsPlayerVisible]);

  useEffect(() => {
    if (!shortsPlayerVisible) return;
    // Must exactly match useStagePlayerSize's containerH — the actual
    // rendered height of each ShortsPlayerItemInner — or getItemLayout's
    // offsets desync from where items really sit and scrollToIndex/paging
    // land on the wrong position. Native uses 'screen' here (matching
    // useStagePlayerSize's own native branch and main's original
    // behavior) rather than 'window', which several other spots in this
    // file document as occasionally reporting a transiently wrong value
    // on Android's very first layout pass. Web keeps 'window' — 'screen'
    // (the physical monitor size) is wildly different from the browser's
    // actual viewport on desktop, which is what this comment originally
    // described going wrong before Prev/Next needed to scroll this list
    // programmatically on desktop.
    if (Platform.OS !== 'web') {
      const s = Dimensions.get('screen');
      shortItemSizeRef.current = Math.max(s.width, s.height);
    } else {
      const { width, height } = Dimensions.get('window');
      shortItemSizeRef.current = isMobile ? Math.max(width, height) : height;
    }
  }, [shortsPlayerVisible, isMobile]);

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
    if (activeTab === 'songs') {
      if (songsError) { setSongsError(false); fetchSongs('', true); }
      else if (!songsLoaded) fetchSongs();
    }
    if (activeTab === 'live') {
      if (liveError) { setLiveError(false); loadLiveAndFetch(); }
      else if (!liveLoaded) loadLiveAndFetch();
    }
    if (activeTab === 'all') {
      if (allError) { setAllError(false); fetchAll('', true); }
      else if (!allLoaded) fetchAll();
    }
    if (activeTab === 'categories') {
      if (categoriesError) { setCategoriesError(false); fetchCategories('', true); }
      else if (!categoriesLoaded) fetchCategories();
    }
    if (activeTab === 'shorts' && shortsError) {
      setShortsError(false);
      fetchShorts('', true);
    }
  }, [activeTab]);

  useEffect(() => {
    const layout = tabLayoutsRef.current[activeTab];
    const viewportWidth = tabsViewportWidthRef.current;
    if (!layout || !viewportWidth) return;
    const centeredX = layout.x + layout.width / 2 - viewportWidth / 2;
    tabsScrollRef.current?.scrollTo({ x: Math.max(0, centeredX), animated: true });
  }, [activeTab]);

  const openVideo = (videoId: string, title: string, isLive: boolean = false) => {
    setActiveVideoId(videoId);
    setActiveVideoTitle(title);
    setActiveVideoIsLive(isLive);
    setActiveSongIndex(null);
    setSongAutoAdvance(false);
    setVideoModalVisible(true);
  };

  const closeVideo = () => {
    setVideoModalVisible(false);
    setActiveVideoId(null);
    setActiveVideoIsLive(false);
    setActiveSongIndex(null);
    setSongAutoAdvance(false);
  };

  // On native, RN's Modal wires the hardware back button to onRequestClose
  // automatically. On web there's no such wiring — a video opening never
  // touched browser history, so pressing the browser Back button while a
  // video was open just fell through to whatever the surrounding page
  // history dictated instead of closing the video. Pushing one history
  // entry while the modal is open (and popping it again however it closes)
  // gives web the same "Back closes the video" behavior, mirroring how
  // song-reader/bible-reader already push their own entries for in-app nav.
  const videoHistoryPushedRef = useRef(false);
  const videoClosingViaPopRef = useRef(false);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onPopState = () => {
      if (videoHistoryPushedRef.current) {
        videoHistoryPushedRef.current = false;
        videoClosingViaPopRef.current = true;
        closeVideo();
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (videoModalVisible && !videoHistoryPushedRef.current) {
      window.history.pushState({ tghVideoModal: true }, '');
      videoHistoryPushedRef.current = true;
    } else if (!videoModalVisible && videoHistoryPushedRef.current) {
      videoHistoryPushedRef.current = false;
      if (!videoClosingViaPopRef.current) window.history.back();
      videoClosingViaPopRef.current = false;
    }
  }, [videoModalVisible]);

  // On desktop web, switching tabs just toggles this whole screen's
  // container to display:none — it stays mounted, so an open video's
  // iframe would otherwise keep playing invisibly in the background. Only
  // `isActive === false` (explicitly signaled by TabShell.web.tsx) closes
  // it; `undefined` (native, which unmounts tabs instead) is a no-op,
  // matching the existing isActive convention used above for category fetches.
  useEffect(() => {
    if (isActive === false) closeVideo();
  }, [isActive]);

  // Opens a song from `songs[index]` into the same VideoModal used for
  // regular videos — same player size/aspect ratio, single video at a time.
  // `autoAdvance` is true only when a song just ended and this is the
  // automatic transition to the next one: the Continue Watching resume
  // position must only apply when the user manually opened a song (tapping
  // the grid, Continue Watching, or Prev/Next), never on auto-advance.
  const openSongAt = (index: number, autoAdvance: boolean = false) => {
    const song = songs[index];
    const videoId = song?.snippet?.resourceId?.videoId;
    if (!videoId) return;
    setActiveVideoId(videoId);
    setActiveVideoTitle(decodeHtml(song?.snippet?.title || ''));
    setActiveVideoIsLive(false);
    setActiveSongIndex(index);
    setSongAutoAdvance(autoAdvance);
    setVideoModalVisible(true);
  };

  const goToPrevSong = () => {
    if (activeSongIndex === null || activeSongIndex <= 0) return;
    openSongAt(activeSongIndex - 1, false);
  };

  const goToNextSong = (autoAdvance: boolean = false) => {
    if (activeSongIndex === null) return;
    const next = activeSongIndex + 1;
    if (next < songs.length) {
      openSongAt(next, autoAdvance);
    } else if (songsNextToken && !loadingMoreSongs) {
      fetchSongs(songsNextToken);
    }
  };

  useEffect(() => {
    if (!autoPlayLive) return;
    setActiveTab('live');
    openVideo(autoPlayLive.videoId, autoPlayLive.title, true);
    onAutoPlayLiveConsumed?.();
  }, [autoPlayLive]);

  useEffect(() => {
    const onBackPress = () => {
      if (isActive !== false && selectedCategory) {
        closeCategory();
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [isActive, selectedCategory]);

  const fetchShorts = async (pageToken = '', forceLoad = false) => {
    try {
      if (!pageToken || forceLoad) { setLoadingShorts(true); setShortsError(false); setShortsLoaded(false); setQuotaExhausted(false); } else setLoadingMoreShorts(true);
      const data = await ytFetch('playlistItems', { playlistId: SHORTS_PLAYLIST_ID, part: 'snippet', maxResults: '50', ...(pageToken ? { pageToken } : {}) }, forceLoad ? 0 : undefined);
      const enriched = await enrichDates(mapItems(data.items || []), forceLoad ? 0 : undefined);
      if (pageToken) {
        setShorts(prev => { const s = new Set(prev.map((v: any) => v.snippet.resourceId.videoId)); return [...prev, ...enriched.filter((v: any) => !s.has(v.snippet.resourceId.videoId))]; });
      } else { setShorts(dedupeById(enriched)); }
      setShortsNextToken(data.nextPageToken || '');
      setShortsLoaded(true);
    } catch (e) {
      if (e instanceof QuotaExhaustedError) setQuotaExhausted(true);
      else if (!pageToken) setShortsError(true);
    } finally { setLoadingShorts(false); setLoadingMoreShorts(false); }
  };

  const fetchVideos = async (pageToken = '', forceLoad = false) => {
    try {
      if (!pageToken || forceLoad) { setLoadingVideos(true); setVideosError(false); setVideosLoaded(false); setQuotaExhausted(false); } else setLoadingMoreVideos(true);
      const data = await ytFetch('playlistItems', { playlistId: VIDEOS_PLAYLIST_ID, part: 'snippet', maxResults: '50', ...(pageToken ? { pageToken } : {}) }, forceLoad ? 0 : undefined);
      const enriched = (await enrichDates(mapItems(data.items || []), forceLoad ? 0 : undefined)).sort(byDateDesc);
      if (pageToken) {
        setVideos(prev => { const s = new Set(prev.map((v: any) => v.snippet.resourceId.videoId)); return [...prev, ...enriched.filter((v: any) => !s.has(v.snippet.resourceId.videoId))].sort(byDateDesc); });
      } else { setVideos(dedupeById(enriched)); }
      setVideosNextToken(data.nextPageToken || '');
      setVideosLoaded(true);
    } catch (e) {
      if (e instanceof QuotaExhaustedError) setQuotaExhausted(true);
      else if (!pageToken) setVideosError(true);
    } finally { setLoadingVideos(false); setLoadingMoreVideos(false); }
  };

  const fetchSongs = async (pageToken = '', forceLoad = false) => {
    try {
      if (!pageToken || forceLoad) { setLoadingSongs(true); setSongsError(false); setSongsLoaded(false); setQuotaExhausted(false); } else setLoadingMoreSongs(true);
      const data = await ytFetch('playlistItems', { playlistId: SONGS_PLAYLIST_ID, part: 'snippet', maxResults: '50', ...(pageToken ? { pageToken } : {}) }, forceLoad ? 0 : undefined);
      const enriched = await enrichDates(mapItems(data.items || []), forceLoad ? 0 : undefined);
      if (pageToken) {
        setSongs(prev => { const s = new Set(prev.map((v: any) => v.snippet.resourceId.videoId)); return [...prev, ...enriched.filter((v: any) => !s.has(v.snippet.resourceId.videoId))]; });
      } else { setSongs(dedupeById(enriched)); }
      setSongsNextToken(data.nextPageToken || '');
      setSongsLoaded(true);
    } catch (e) {
      if (e instanceof QuotaExhaustedError) setQuotaExhausted(true);
      else if (!pageToken) setSongsError(true);
    } finally { setLoadingSongs(false); setLoadingMoreSongs(false); }
  };

  const loadLiveAndFetch = async (force = false) => {
    const cached = await getCachedLivePlaylists();
    let ids = cached.filter(p => p.isActive).map(p => p.playlistId);
    if (!ids.length) ids = FALLBACK_LIVE_IDS;
    setLiveIds(ids);
    fetchLive(false, ids, force);
    const fresh = await syncLivePlaylists();
    let freshIds = fresh.filter(p => p.isActive).map(p => p.playlistId);
    if (!freshIds.length) freshIds = FALLBACK_LIVE_IDS;
    const idsChanged = ids.length !== freshIds.length || !ids.every(id => freshIds.includes(id));
    setLiveIds(freshIds);
    if (idsChanged) {
      setLiveNextTokens({});
      fetchLive(false, freshIds, force);
    }
  };

  const fetchLive = async (loadMore: boolean, idsOverride?: string[], force = false) => {
    try {
      if (!loadMore) { setLoadingLive(true); setLiveError(false); setQuotaExhausted(false); } else setLoadingMoreLive(true);
      const ids = idsOverride || liveIds;
      const toFetch = loadMore ? ids.filter(id => liveNextTokens[id]) : ids;
      if (!toFetch.length) return;
      const ttl = force ? 0 : LIVE_STATUS_CACHE_TTL_MS;
      const results = await Promise.all(toFetch.map(async id => {
        const data = await ytFetch(
          'playlistItems',
          { playlistId: id, part: 'snippet', maxResults: '50', ...(loadMore && liveNextTokens[id] ? { pageToken: liveNextTokens[id] } : {}) },
          ttl
        );
        const enriched = await enrichDates(mapItems(data.items || []), ttl);
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
    } catch (e) {
      if (e instanceof QuotaExhaustedError) setQuotaExhausted(true);
      else if (!loadMore) setLiveError(true);
    } finally { setLoadingLive(false); setLoadingMoreLive(false); }
  };

  const fetchAll = async (pageToken = '', forceLoad = false) => {
    try {
      if (!pageToken || forceLoad) { setLoadingAll(true); setAllError(false); setAllLoaded(false); setQuotaExhausted(false); } else setLoadingMoreAll(true);
      const data = await ytFetch('playlistItems', { playlistId: UPLOADS_PLAYLIST_ID, part: 'snippet', maxResults: '50', ...(pageToken ? { pageToken } : {}) }, forceLoad ? 0 : undefined);
      const enriched = (await enrichDates(mapItems(data.items || []), forceLoad ? 0 : undefined)).sort(byDateDesc);
      if (pageToken) {
        setAllVideos(prev => { const s = new Set(prev.map((v: any) => v.snippet.resourceId.videoId)); return [...prev, ...enriched.filter((v: any) => !s.has(v.snippet.resourceId.videoId))].sort(byDateDesc); });
      } else { setAllVideos(dedupeById(enriched)); }
      setAllNextToken(data.nextPageToken || '');
      setAllLoaded(true);
    } catch (e) {
      if (e instanceof QuotaExhaustedError) setQuotaExhausted(true);
      else if (!pageToken) setAllError(true);
    } finally { setLoadingAll(false); setLoadingMoreAll(false); }
  };

  const fetchCategories = async (pageToken = '', forceLoad = false) => {
    try {
      if (!pageToken || forceLoad) { setLoadingCategories(true); setCategoriesError(false); setCategoriesLoaded(false); setQuotaExhausted(false); } else setLoadingMoreCategories(true);
      const data = await ytFetch('playlists', { channelId: CHANNEL_ID, part: 'snippet,contentDetails', maxResults: '50', ...(pageToken ? { pageToken } : {}) }, forceLoad ? 0 : undefined);
      const mapped = (data.items || [])
        .filter((p: any) => p?.id && p?.snippet?.title && p?.snippet?.thumbnails)
        .map((p: any) => ({
          id: p.id,
          title: decodeHtml(p.snippet.title),
          thumbnail: p.snippet.thumbnails?.medium?.url || p.snippet.thumbnails?.default?.url,
          itemCount: p.contentDetails?.itemCount || 0,
        }));
      if (pageToken) {
        setCategories(prev => { const s = new Set(prev.map((c: any) => c.id)); return [...prev, ...mapped.filter((c: any) => !s.has(c.id))]; });
      } else { setCategories(mapped); }
      setCategoriesNextToken(data.nextPageToken || '');
      setCategoriesLoaded(true);
    } catch (e) {
      if (e instanceof QuotaExhaustedError) setQuotaExhausted(true);
      else if (!pageToken) setCategoriesError(true);
    } finally { setLoadingCategories(false); setLoadingMoreCategories(false); }
  };

  const fetchCategoryVideos = async (playlistId: string, pageToken = '', forceLoad = false) => {
    try {
      if (!pageToken || forceLoad) { setLoadingCategoryVideos(true); setCategoryVideosError(false); setCategoryVideosLoaded(false); setQuotaExhausted(false); } else setLoadingMoreCategoryVideos(true);
      const data = await ytFetch('playlistItems', { playlistId, part: 'snippet', maxResults: '50', ...(pageToken ? { pageToken } : {}) }, forceLoad ? 0 : undefined);
      const enriched = (await enrichDates(mapItems(data.items || []), forceLoad ? 0 : undefined)).sort(byDateDesc);
      let finalVideos: any[];
      if (pageToken) {
        const prev = categoryVideosCacheRef.current[playlistId]?.videos || [];
        const s = new Set(prev.map((v: any) => v.snippet.resourceId.videoId));
        finalVideos = [...prev, ...enriched.filter((v: any) => !s.has(v.snippet.resourceId.videoId))].sort(byDateDesc);
      } else {
        finalVideos = dedupeById(enriched);
      }
      const nextToken = data.nextPageToken || '';
      setCategoryVideos(finalVideos);
      setCategoryVideosNextToken(nextToken);
      setCategoryVideosLoaded(true);
      categoryVideosCacheRef.current[playlistId] = { videos: finalVideos, nextToken };
    } catch (e) {
      if (e instanceof QuotaExhaustedError) setQuotaExhausted(true);
      else if (!pageToken) setCategoryVideosError(true);
    } finally { setLoadingCategoryVideos(false); setLoadingMoreCategoryVideos(false); }
  };

  const openCategory = (category: { id: string; title: string; itemCount: number }) => {
    setSelectedCategory(category);
    const cached = categoryVideosCacheRef.current[category.id];
    if (cached) {
      setCategoryVideos(cached.videos);
      setCategoryVideosNextToken(cached.nextToken);
      setCategoryVideosLoaded(true);
      setCategoryVideosError(false);
      return;
    }
    setCategoryVideos([]);
    setCategoryVideosLoaded(false);
    setCategoryVideosError(false);
    setCategoryVideosNextToken('');
    fetchCategoryVideos(category.id, '', true);
  };

  const closeCategory = () => {
    setSelectedCategory(null);
    setCategoryVideos([]);
    setCategoryVideosLoaded(false);
    setCategoryVideosError(false);
    setCategoryVideosNextToken('');
  };

  const doSearch = async (query: string) => {
    try {
      setSearching(true);
      setQuotaExhausted(false);
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
    } catch (e) {
      if (e instanceof QuotaExhaustedError) setQuotaExhausted(true);
    } finally { setSearching(false); }
  };

  // Set when the current short is the last loaded one and a click/autoplay-
  // end fetches the next page — fetchShorts() only appends to `shorts`
  // state, it doesn't know to advance the player, so this flag + the effect
  // below watch for that state update landing and jump to the newly
  // available next item once it does (jumping immediately after firing the
  // fetch would race the still-in-flight request and fail).
  const pendingShortAdvanceRef = useRef(false);

  // ShortsPlayerItemInner's `isActive` (and so whether its YoutubePlayer is
  // even mounted — see its isActive ? <YoutubePlayer/> : <View/> below) is
  // driven entirely by playingShortId/currentShortIndex, normally kept in
  // sync by onShortsViewable as the user scrolls. A *programmatic*
  // scrollToIndex (Prev/Next buttons, the pending-advance effect) doesn't
  // reliably re-trigger that viewability callback — especially on web —
  // which left the old item's isActive stuck true (still playing,
  // off-screen) and the new item's stuck false (its player never mounts, so
  // it sits on the loading placeholder forever). Setting both explicitly
  // here, rather than waiting for viewability to catch up, is what actually
  // stops the old video and loads the new one.
  const goToShortIndex = useCallback((targetIndex: number) => {
    const item = shortsDataRef.current[targetIndex];
    if (!item) return;
    setCurrentShortIndex(targetIndex);
    setPlayingShortId(item.snippet?.resourceId?.videoId ?? null);
    shortsListRef.current?.scrollToIndex({ index: targetIndex, animated: true });
  }, []);

  const handleShortEnd = useCallback((index: number) => {
    const next = index + 1;
    if (next < shortsDataRef.current.length) {
      goToShortIndex(next);
    } else if (shortsNextRef.current && !loadingMoreShortsRef.current) {
      pendingShortAdvanceRef.current = true;
      fetchShorts(shortsNextRef.current);
    }
  }, [goToShortIndex]);

  useEffect(() => {
    if (!pendingShortAdvanceRef.current) return;
    const next = currentShortIndex + 1;
    if (shorts.length > next) {
      pendingShortAdvanceRef.current = false;
      goToShortIndex(next);
    }
  }, [shorts, currentShortIndex, goToShortIndex]);

  // Desktop Prev/Next buttons (mobile already has vertical swipe) — Prev
  // just steps back within whatever's already loaded (nothing needs
  // fetching, past items are never dropped from `shorts`); Next reuses
  // handleShortEnd's same "advance or fetch the next page" logic so the
  // button and autoplay-end behave identically.
  const shortHasPrev = currentShortIndex > 0;
  const shortHasNext = currentShortIndex < shorts.length - 1 || !!shortsNextToken;
  const handleShortPrevClick = useCallback(() => {
    if (currentShortIndex > 0) {
      shortNavDirectionRef.current = 'prev';
      goToShortIndex(currentShortIndex - 1);
    }
  }, [currentShortIndex, goToShortIndex]);
  const handleShortNextClick = useCallback(() => {
    shortNavDirectionRef.current = 'next';
    handleShortEnd(currentShortIndex);
  }, [handleShortEnd, currentShortIndex]);

  // Mirrors VideoModal's identical songSlideX effect exactly (same 48px
  // offset, same 260ms Easing.out(Easing.cubic)) — any web (desktop or
  // mobile-width), since native mobile keeps its native FlatList
  // paging/scroll-snap untouched (see the isTabletUp || web branch below).
  useEffect(() => {
    if (!(isTabletUp || Platform.OS === 'web')) return;
    const direction = shortNavDirectionRef.current;
    shortNavDirectionRef.current = null;
    if (!direction) return;
    shortSlideX.setValue(direction === 'next' ? 48 : -48);
    Animated.timing(shortSlideX, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [playingShortId, isTabletUp, shortSlideX]);

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
        onScrollLockChange={(locked: boolean) => setShortsScrollEnabled(!locked)}
        total={shortsDataRef.current.length}
      />
    );
  }, [playingShortId, handleShortEnd]);

  const VideoCard = ({ item }: any) => {
    const videoId = item?.snippet?.resourceId?.videoId;
    const thumb = item?.snippet?.thumbnails?.medium?.url;
    const title = decodeHtml(item?.snippet?.title || '');
    const date = item?.snippet?.publishedAt || '';
    const duration = item?.snippet?.duration || '';
    if (!videoId || !thumb) return null;
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface }, isTabletUp && [styles.cardDesktop, { borderColor: colors.divider }]]}
        onPress={() => openVideo(videoId, title)}
      >
        <View>
          <Image source={{ uri: thumb }} style={styles.thumb} />
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

  const SongCard = ({ item, index }: any) => {
    const videoId = item?.snippet?.resourceId?.videoId;
    const thumb = item?.snippet?.thumbnails?.medium?.url;
    const title = decodeHtml(item?.snippet?.title || '');
    const date = item?.snippet?.publishedAt || '';
    const duration = item?.snippet?.duration || '';
    if (!videoId || !thumb) return null;
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface }, isTabletUp && [styles.cardDesktop, { borderColor: colors.divider }]]}
        onPress={() => openSongAt(index)}
      >
        <View>
          <Image source={{ uri: thumb }} style={styles.thumb} />
          <View style={styles.songPlayOverlay}>
            <Ionicons name="musical-notes" size={20} color="#fff" />
          </View>
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

  // Native renders main's exact original card — thumbnail with the title
  // overlaid in a bottom gradient strip, not the redesigned "thumbnail +
  // separate info panel below" card web/desktop uses. Kept as fully
  // separate JSX/styles (not a shared component with conditional style
  // props) per the "completely separate Android/web implementations"
  // requirement — a style tweak here can't accidentally affect web's card.
  const ShortCardNative = ({ item, index }: any) => {
    const videoId = item?.snippet?.resourceId?.videoId;
    const thumb = item?.snippet?.thumbnails?.high?.url || item?.snippet?.thumbnails?.medium?.url;
    const title = decodeHtml(item?.snippet?.title || '');
    if (!videoId || !thumb) return null;
    return (
      <TouchableOpacity
        style={styles.shortCardNative}
        onPress={() => { setCurrentShortIndex(index); setPlayingShortId(videoId); setShortsPlayerVisible(true); }}
      >
        <Image source={{ uri: thumb }} style={styles.shortThumbNative} />
        <View style={styles.shortPlayIconNative}><Ionicons name="play-circle" size={36} color="rgba(255,255,255,0.9)" /></View>
        <View style={styles.shortOverlayNative}><Text style={styles.shortTitleNative} numberOfLines={2}>{title}</Text></View>
      </TouchableOpacity>
    );
  };

  const ShortCardWeb = ({ item, index }: any) => {
    const videoId = item?.snippet?.resourceId?.videoId;
    const thumb = item?.snippet?.thumbnails?.high?.url || item?.snippet?.thumbnails?.medium?.url;
    const title = decodeHtml(item?.snippet?.title || '');
    if (!videoId || !thumb) return null;
    return (
      <TouchableOpacity
        style={[styles.shortCard, { backgroundColor: colors.surface }, isTabletUp && [styles.cardDesktop, { borderColor: colors.divider }]]}
        onPress={() => { setCurrentShortIndex(index); setPlayingShortId(videoId); setShortsPlayerVisible(true); }}
      >
        <View>
          <Image source={{ uri: thumb }} style={styles.shortThumb} />
          <View style={styles.shortPlayIcon}><Ionicons name="play-circle" size={46} color="rgba(255,255,255,0.9)" /></View>
        </View>
        <View style={styles.shortInfo}>
          <Text style={[styles.shortTitle, { color: colors.text }]} numberOfLines={2}>{title}</Text>
        </View>
      </TouchableOpacity>
    );
  };
  const ShortCard = Platform.OS === 'web' ? ShortCardWeb : ShortCardNative;

  const LiveCard = ({ item }: any) => {
    const videoId = item?.snippet?.resourceId?.videoId;
    const thumb = item?.snippet?.thumbnails?.medium?.url;
    const title = decodeHtml(item?.snippet?.title || '');
    const date = item?.snippet?.publishedAt || '';
    const duration = item?.snippet?.duration || '';
    const isUpcoming = !!item?.snippet?.isUpcoming;
    if (!videoId || !thumb) return null;
    // enrichDates() already computed isLiveNow for this exact item when the
    // list loaded, and the Live tab refreshes that on a short (60s) TTL —
    // deliberately trusted as-is rather than re-checking with another
    // uncached YouTube API call on every single tap (that would cost one
    // extra request per tap, forever, with no way to cache it away — not
    // worth spending quota on tightening an already-60s-bounded staleness
    // window further).
    const handlePress = () => {
      openVideo(videoId, title, !!item?.snippet?.isLiveNow);
    };
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface }, isTabletUp && [styles.cardDesktop, { borderColor: colors.divider }]]}
        onPress={handlePress}
      >
        <View>
          <Image source={{ uri: thumb }} style={styles.thumb} />
          {isUpcoming ? (
            <View style={styles.scheduledBadge}>
              <Ionicons name="time" size={11} color="#fff" />
              <Text style={styles.scheduledBadgeText}>SCHEDULED</Text>
            </View>
          ) : (
            <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveBadgeText}>LIVE</Text></View>
          )}
          {!!duration && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{duration}</Text>
            </View>
          )}
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>{title}</Text>
          <Text style={[styles.cardDate, { color: colors.subtext }]}>{isUpcoming ? `Scheduled for ${formatDateTime(date)}` : formatDate(date)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const CategoryCard = ({ item }: any) => {
    if (!item?.id || !item?.thumbnail) return null;
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface }, isTabletUp && [styles.cardDesktop, { borderColor: colors.divider }]]}
        onPress={() => openCategory({ id: item.id, title: item.title, itemCount: item.itemCount })}
      >
        <View>
          <Image source={{ uri: item.thumbnail }} style={styles.thumb} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>{item.title} ({item.itemCount})</Text>
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

  const retryAfterQuotaExhausted = () => {
    setQuotaExhausted(false);
    if (isSearching) { doSearch(search); return; }
    if (activeTab === 'shorts') { setShortsLoaded(false); fetchShorts('', true); }
    else if (activeTab === 'videos') { setVideosLoaded(false); fetchVideos('', true); }
    else if (activeTab === 'songs') { setSongsLoaded(false); fetchSongs('', true); }
    else if (activeTab === 'live') { setLiveLoaded(false); loadLiveAndFetch(true); }
    else if (activeTab === 'categories' && selectedCategory) { setCategoryVideosLoaded(false); fetchCategoryVideos(selectedCategory.id, '', true); }
    else if (activeTab === 'categories') { setCategoriesLoaded(false); fetchCategories('', true); }
    else if (activeTab === 'all') { setAllLoaded(false); fetchAll('', true); }
  };

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'shorts', label: 'Shorts', icon: 'flash' },
    { key: 'videos', label: 'Videos', icon: 'videocam' },
    { key: 'songs', label: 'Songs', icon: 'musical-notes' },
    { key: 'live', label: 'Live', icon: 'radio' },
    { key: 'categories', label: 'Playlists', icon: 'apps' },
    { key: 'all', label: 'All', icon: 'grid' },
  ];

  const isSearching = !!search.trim();
  const hasMoreLive = Object.values(liveNextTokens).some(t => !!t);

  return (
    <View
      style={[styles.container, { backgroundColor: colors.bg }]}
      onLayout={e => setMeasuredWidth(e.nativeEvent.layout.width)}
    >
      <VideoModal
        visible={videoModalVisible}
        videoId={activeVideoId}
        title={activeVideoTitle}
        isLive={activeVideoIsLive}
        onClose={closeVideo}
        {...(activeSongIndex !== null ? {
          onPrev: goToPrevSong,
          onNext: () => goToNextSong(false),
          onEnded: () => goToNextSong(true),
          hasPrev: activeSongIndex > 0,
          hasNext: activeSongIndex < songs.length - 1,
          autoAdvance: songAutoAdvance,
        } : {})}
      />

      <Modal visible={shortsPlayerVisible} animationType="slide" statusBarTranslucent supportedOrientations={["portrait"]} onRequestClose={() => { setShortsPlayerVisible(false); setPlayingShortId(null); setShortsScrollEnabled(true); }}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {isTabletUp || Platform.OS === 'web' ? (
            // Desktop and mobile web: a single active short with Songs-style
            // horizontal Prev/Next + slide transition, instead of the
            // FlatList paging — matches VideoModal's Songs-nav UX exactly
            // (same nav-button styles/positions/alignment, same slide
            // animation). Native mobile keeps the FlatList/swipe-scroll
            // experience below, since it works reliably there.
            // Gated on shortsPlayerVisible too (not just shorts[index]) —
            // onClose sets that AND playingShortId(null) in the same
            // update; without this the isActive flip (which swaps
            // YoutubePlayer's iframe for a placeholder View) landed in the
            // same commit as the surrounding Modal tearing down, and the
            // two overlapping DOM mutations crashed with "Failed to
            // execute 'removeChild' on 'Node'". Gating on visibility here
            // means both changes collapse into a single clean unmount of
            // this whole subtree instead.
            shortsPlayerVisible && shorts[currentShortIndex] && (
              <Animated.View style={{ flex: 1, transform: [{ translateX: shortSlideX }] }}>
                <ShortsPlayerItemInner
                  item={shorts[currentShortIndex]}
                  index={currentShortIndex}
                  isActive={playingShortId === shorts[currentShortIndex]?.snippet?.resourceId?.videoId}
                  onEnd={handleShortEnd}
                  onClose={() => { setShortsPlayerVisible(false); setPlayingShortId(null); }}
                  onScrollLockChange={(locked: boolean) => setShortsScrollEnabled(!locked)}
                  total={shorts.length}
                  hasPrev={shortHasPrev}
                  hasNext={shortHasNext}
                  onPrev={handleShortPrevClick}
                  onNext={handleShortNextClick}
                />
              </Animated.View>
            )
          ) : (
            <FlatList
              ref={shortsListRef}
              data={shorts}
              keyExtractor={item => item.snippet.resourceId.videoId}
              renderItem={({ item, index }) => <ShortsPlayerItem item={item} index={index} />}
              pagingEnabled
              showsVerticalScrollIndicator={false}
              snapToInterval={shortItemSizeRef.current}
              snapToAlignment="start"
              decelerationRate="fast"
              onViewableItemsChanged={onShortsViewable}
              viewabilityConfig={shortsViewConfig}
              getItemLayout={(_, index) => ({ length: shortItemSizeRef.current, offset: shortItemSizeRef.current * index, index })}
              initialScrollIndex={currentShortIndex}
              onScrollToIndexFailed={() => {}}
              scrollEnabled={shortsScrollEnabled}
            />
          )}
          {/* Desktop (isTabletUp) only — these stay over the video, in their
              original position. Mobile web gets its own Prev/Next buttons
              instead, rendered inline inside ShortsPlayerItemInner (aligned
              with the YouTube/Copy icon row, same as Songs); native mobile
              gets the vertical swipe-up hint rendered there too. */}
          {isTabletUp && (
            <>
              <TouchableOpacity
                style={[styles.videoModalNavBtn, styles.videoModalNavBtnLeft]}
                disabled={!shortHasPrev}
                onPress={handleShortPrevClick}
              >
                <Ionicons name="chevron-back" size={22} color={shortHasPrev ? '#fff' : 'rgba(255,255,255,0.3)'} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.videoModalNavBtn, styles.videoModalNavBtnRight]}
                disabled={!shortHasNext}
                onPress={handleShortNextClick}
              >
                <Ionicons name="chevron-forward" size={22} color={shortHasNext ? '#fff' : 'rgba(255,255,255,0.3)'} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>

      <View style={[styles.searchRow, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider }]}>
        <TouchableOpacity onPress={() => doSearch(search)} disabled={!search.trim()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="search" size={20} color={search.trim() ? colors.accent : colors.subtext} />
        </TouchableOpacity>
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search all sermons..."
          placeholderTextColor={colors.subtext}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => doSearch(search)}
          returnKeyType="search"
        />
        {searching && <ActivityIndicator size="small" color={colors.accent} />}
        {!!search && <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={20} color={colors.subtext} /></TouchableOpacity>}
      </View>

      {!isSearching && (
        <ScrollView
          ref={tabsScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabsRow}
          onLayout={e => { tabsViewportWidthRef.current = e.nativeEvent.layout.width; }}
        >
          {TABS.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, { backgroundColor: activeTab === t.key ? colors.accent : colors.surface }]}
              onPress={() => setActiveTab(t.key)}
              onLayout={e => { tabLayoutsRef.current[t.key] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width }; }}
            >
              <Ionicons name={t.icon as any} size={15} color={activeTab === t.key ? '#fff' : colors.subtext} />
              <Text style={[styles.tabText, { color: activeTab === t.key ? '#fff' : colors.subtext }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {quotaExhausted ? (
        <QuotaExhaustedScreen onRetry={retryAfterQuotaExhausted} />
      ) : (
      <>
      {isSearching && (
        searching
          ? <TabLoadingState tab="search" />
          : <FlatList key={gridKey} {...gridColumnProps} data={padGridRow(searchResults, numColumns)} keyExtractor={(_, i) => `sr${i}`} renderItem={({ item }) => isGridFiller(item) ? <View style={styles.gridFillerCell} /> : <VideoCard item={item} />} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={[styles.empty, { color: colors.subtext }]}>No results found</Text>} />
      )}

      {!isSearching && activeTab === 'shorts' && (
        loadingShorts ? <TabLoadingState tab="shorts" />
        : shortsError ? <VideoErrorState onRetry={() => { setShortsLoaded(false); fetchShorts('', true); }} />
        : <FlatList key={`shorts-grid-${shortsNumColumns}`} data={padGridRow(shorts, shortsNumColumns)} keyExtractor={(i, idx) => isGridFiller(i) ? `filler-${idx}` : i.snippet.resourceId.videoId} refreshing={loadingShorts} onRefresh={() => fetchShorts('', true)} renderItem={({ item, index }) => isGridFiller(item) ? <View style={styles.gridFillerCell} /> : <ShortCard item={item} index={index} />} numColumns={shortsNumColumns} contentContainerStyle={Platform.OS === 'web' ? styles.list : styles.shortsListNative} columnWrapperStyle={Platform.OS === 'web' ? styles.shortsColumnWrapper : styles.shortsColumnWrapperNative} ListEmptyComponent={<Text style={[styles.empty, { color: colors.subtext }]}>No shorts found</Text>} ListFooterComponent={<LoadMore token={shortsNextToken} loading={loadingMoreShorts} onPress={() => fetchShorts(shortsNextToken)} />} />
      )}

      {!isSearching && activeTab === 'videos' && (
        loadingVideos ? <TabLoadingState tab="videos" />
        : videosError ? <VideoErrorState onRetry={() => { setVideosLoaded(false); fetchVideos('', true); }} />
        : <FlatList key={gridKey} {...gridColumnProps} data={padGridRow(videos, numColumns)} keyExtractor={(i, idx) => isGridFiller(i) ? `filler-${idx}` : i.snippet.resourceId.videoId} refreshing={loadingVideos} onRefresh={() => fetchVideos('', true)} renderItem={({ item }) => isGridFiller(item) ? <View style={styles.gridFillerCell} /> : <VideoCard item={item} />} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={[styles.empty, { color: colors.subtext }]}>No videos found</Text>} ListFooterComponent={<LoadMore token={videosNextToken} loading={loadingMoreVideos} onPress={() => fetchVideos(videosNextToken)} />} />
      )}

      {!isSearching && activeTab === 'songs' && (
        loadingSongs ? <TabLoadingState tab="songs" />
        : songsError ? <VideoErrorState onRetry={() => { setSongsLoaded(false); fetchSongs('', true); }} />
        : <FlatList key={gridKey} {...gridColumnProps} data={padGridRow(songs, numColumns)} keyExtractor={(i, idx) => isGridFiller(i) ? `filler-${idx}` : i.snippet.resourceId.videoId} refreshing={loadingSongs} onRefresh={() => fetchSongs('', true)} renderItem={({ item, index }) => isGridFiller(item) ? <View style={styles.gridFillerCell} /> : <SongCard item={item} index={index} />} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={[styles.empty, { color: colors.subtext }]}>No songs found</Text>} ListFooterComponent={<LoadMore token={songsNextToken} loading={loadingMoreSongs} onPress={() => fetchSongs(songsNextToken)} />} />
      )}

      {!isSearching && activeTab === 'live' && (
        loadingLive ? <TabLoadingState tab="live" />
        : liveError ? <VideoErrorState onRetry={() => { setLiveLoaded(false); loadLiveAndFetch(true); }} />
        : <FlatList key={gridKey} {...gridColumnProps} data={padGridRow(liveVideos, numColumns)} keyExtractor={(i, idx) => isGridFiller(i) ? `filler-${idx}` : i.snippet.resourceId.videoId} refreshing={loadingLive} onRefresh={() => loadLiveAndFetch(true)} renderItem={({ item }) => isGridFiller(item) ? <View style={styles.gridFillerCell} /> : <LiveCard item={item} />} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={[styles.empty, { color: colors.subtext }]}>No live streams found</Text>} ListFooterComponent={hasMoreLive ? <TouchableOpacity style={[styles.loadMore, { backgroundColor: colors.accent }]} onPress={() => fetchLive(true)}>{loadingMoreLive ? <ActivityIndicator color="#fff" /> : <Text style={styles.loadMoreText}>Load More</Text>}</TouchableOpacity> : null} />
      )}

      {!isSearching && activeTab === 'categories' && !selectedCategory && (
        loadingCategories ? <TabLoadingState tab="categories" />
        : categoriesError ? <VideoErrorState onRetry={() => { setCategoriesLoaded(false); fetchCategories('', true); }} />
        : <FlatList key={gridKey} {...gridColumnProps} data={padGridRow(categories, numColumns)} keyExtractor={(i, idx) => isGridFiller(i) ? `filler-${idx}` : i.id} refreshing={loadingCategories} onRefresh={() => fetchCategories('', true)} renderItem={({ item }) => isGridFiller(item) ? <View style={styles.gridFillerCell} /> : <CategoryCard item={item} />} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={[styles.empty, { color: colors.subtext }]}>No playlists found</Text>} ListFooterComponent={<LoadMore token={categoriesNextToken} loading={loadingMoreCategories} onPress={() => fetchCategories(categoriesNextToken)} />} />
      )}

      {!isSearching && activeTab === 'categories' && selectedCategory && (
        <TouchableOpacity style={styles.categoryBackRow} onPress={closeCategory} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
          <Text style={[styles.categoryBackText, { color: colors.text }]} numberOfLines={1}>{selectedCategory.title} ({selectedCategory.itemCount})</Text>
        </TouchableOpacity>
      )}

      {!isSearching && activeTab === 'categories' && selectedCategory && (
        loadingCategoryVideos ? <TabLoadingState tab="videos" />
        : categoryVideosError ? <VideoErrorState onRetry={() => { setCategoryVideosLoaded(false); fetchCategoryVideos(selectedCategory.id, '', true); }} />
        : <FlatList key={gridKey} {...gridColumnProps} style={{ flex: 1 }} data={padGridRow(categoryVideos, numColumns)} keyExtractor={(i, idx) => isGridFiller(i) ? `filler-${idx}` : i.snippet.resourceId.videoId} refreshing={loadingCategoryVideos} onRefresh={() => fetchCategoryVideos(selectedCategory.id, '', true)} renderItem={({ item }) => isGridFiller(item) ? <View style={styles.gridFillerCell} /> : <VideoCard item={item} />} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={[styles.empty, { color: colors.subtext }]}>No videos found</Text>} ListFooterComponent={<LoadMore token={categoryVideosNextToken} loading={loadingMoreCategoryVideos} onPress={() => fetchCategoryVideos(selectedCategory.id, categoryVideosNextToken)} />} />
      )}

      {!isSearching && activeTab === 'all' && (
        loadingAll ? <TabLoadingState tab="all" />
        : allError ? <VideoErrorState onRetry={() => { setAllLoaded(false); fetchAll('', true); }} />
        : <FlatList key={gridKey} {...gridColumnProps} data={padGridRow(allVideos, numColumns)} keyExtractor={(i, idx) => isGridFiller(i) ? `filler-${idx}` : i.snippet.resourceId.videoId} refreshing={loadingAll} onRefresh={() => fetchAll('', true)} renderItem={({ item }) => isGridFiller(item) ? <View style={styles.gridFillerCell} /> : <VideoCard item={item} />} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={[styles.empty, { color: colors.subtext }]}>No videos found</Text>} ListFooterComponent={<LoadMore token={allNextToken} loading={loadingMoreAll} onPress={() => fetchAll(allNextToken)} />} />
      )}
      </>
      )}
    </View>
  );
}

// Wraps the real screen so Video Maintenance mode (set from Admin Panel →
// App Management → Site Maintenance → Videos) can swap in a maintenance
// page without touching any of the existing Videos functionality above —
// the Videos tab itself always stays visible; only what renders inside it
// changes. Defaults to showing normal content (not a loading gate) so a
// slow/offline config fetch never blocks access, consistent with how the
// rest of the app fails open.
export default function VideosScreen(props: VideosScreenProps = {}) {
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeVideoMaintenance(config => setMaintenanceEnabled(config.enabled));
    return unsubscribe;
  }, []);

  if (maintenanceEnabled) return <VideoMaintenancePage />;
  return <VideosScreenContent {...props} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', margin: 12, marginTop: 50, borderRadius: radii.pill, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  searchInput: { flex: 1, fontSize: 15 },
  tabsScroll: { flexShrink: 0, flexGrow: 0, maxHeight: 60 },
  tabsRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 10, gap: 8, alignItems: 'center' },
  tab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 18, borderRadius: 20, elevation: 2, alignSelf: 'flex-start' },
  tabText: { fontSize: 13, fontWeight: '600' },
  // maxWidth/alignSelf keep the grid from stretching full-bleed across a
  // wide desktop viewport — width:'100%' lets it still fill narrower
  // (mobile/tablet) viewports up to that cap. WIDE_CONTENT_MAX_WIDTH (not
  // the standard CONTENT_MAX_WIDTH) since a video/card grid benefits from
  // more horizontal room than a text-reading column.
  list: { padding: 12, paddingBottom: 100, width: '100%', maxWidth: WIDE_CONTENT_MAX_WIDTH, alignSelf: 'center' },
  columnWrapper: { gap: GRID_GAP },
  // Invisible — occupies its column's width so real cards in an incomplete
  // last row don't stretch to fill it. See padGridRow/isGridFiller above.
  gridFillerCell: { flex: 1 },
  card: { flex: 1, borderRadius: 12, marginBottom: GRID_GAP, overflow: 'hidden', elevation: 3 },
  // Desktop-only refinement: a flatter, bordered card (common in web grid
  // UIs) instead of the mobile-native drop shadow, plus a pointer cursor as
  // a hover affordance — applied conditionally so mobile stays pixel-for-
  // pixel unchanged.
  cardDesktop: { elevation: 0, borderRadius: 14, borderWidth: 1, cursor: 'pointer' } as any,
  // aspectRatio (not a height computed from window width) so the thumbnail
  // renders correctly regardless of the card's actual rendered width — e.g.
  // the desktop web shell's sidebar means the content column is narrower
  // than the raw window width, which a width-based height calc got wrong.
  thumb: { width: '100%', aspectRatio: 16 / 9, resizeMode: 'cover' },
  cardInfo: { padding: 10 },
  cardTitle: { fontSize: 14, fontWeight: 'bold' },
  cardDate: { fontSize: 12, marginTop: 4 },
  durationBadge: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.78)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  durationText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  songPlayOverlay: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 16, padding: 4 },
  // Thumbnail + title-below-image card (like the rest of this grid's cards),
  // not the old title-overlaid-on-image treatment — matches how a real
  // YouTube Shorts shelf lays out its cards.
  shortsColumnWrapper: { gap: GRID_GAP },
  shortCard: { flex: 1, borderRadius: 12, overflow: 'hidden', elevation: 3, marginBottom: GRID_GAP },
  // aspectRatio (not a fixed height) so a bigger column width — from the
  // wider TARGET_SHORT_CARD_WIDTH above — scales the thumbnail up with it
  // instead of stretching a height sized for the old, narrower columns.
  shortThumb: { width: '100%', aspectRatio: 9 / 16, backgroundColor: '#000' },
  shortPlayIcon: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  shortInfo: { padding: 12 },
  shortTitle: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  // Native-only — main's original card: title overlaid on the thumbnail in
  // a bottom gradient strip, not a separate info panel below it. Kept as
  // fully separate style objects (not shared with the web card above) so a
  // future web-only tweak to shortCard/shortThumb/etc. can never bleed into
  // this, and vice versa.
  shortsListNative: { padding: 12, paddingBottom: 100 },
  shortsColumnWrapperNative: { gap: 8 },
  shortCardNative: { flex: 1, borderRadius: 12, overflow: 'hidden', elevation: 3, marginBottom: 8, backgroundColor: '#000', minHeight: 220 },
  shortThumbNative: { width: '100%', height: 220 },
  shortPlayIconNative: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  shortOverlayNative: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: 'rgba(0,0,0,0.45)' },
  shortTitleNative: { fontSize: 11, color: '#fff', fontWeight: '600' },
  liveBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: '#ff0000', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  scheduledBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: '#4f7fff', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 4 },
  scheduledBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  categoryBackRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 10 },
  categoryBackText: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
  loadMore: { borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 20 },
  loadMoreText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  shortsOverlay: { position: 'absolute', bottom: 100, left: 16, right: 16 },
  shortsTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  shortsCounter: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  shortsClose: { position: 'absolute', top: 50, right: 16, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 6, zIndex: 10 },
  songsSwipeHint: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  songsSwipeHintText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' },
  // No alignItems here — matches main exactly. It was added during the
  // migration (main never had it) to center desktopPlayerRow, which is
  // narrower than the modal on desktop/tablet (video+title capped to
  // CONTENT_MAX_WIDTH) — applied unconditionally, it also reached the
  // plain-phone case, where the direct child is instead a plain <View> (no
  // explicit width of its own) wrapping the video box *and*
  // videoModalTitle's own width:'100%' Text. A percentage-width child
  // inside a parent whose own width is resolved via alignItems:'center'
  // shrink-to-fit (rather than stretching to the modal's full, definite
  // width) is a real, confirmed-on-device Yoga layout hazard — the title
  // rendering far wider than the screen and centered, both edges clipped,
  // is exactly that failure mode, and is what the migrated app's own
  // regression report screenshots show. videoModalDesktopCenter below
  // applies the centering only where main never had this shape to begin
  // with (isTabletUp's desktopPlayerRow), leaving the phone case identical
  // to main's original, working layout.
  // justifyContent:'center' vertically centers the video+title+actions
  // column as a group within the full screen height (it's the only flex-
  // participating child — everything else here is position:'absolute').
  // A flex-start variant was tried to close the gap this leaves above a
  // 16:9 video on a tall phone, but that just relocated the same leftover
  // space entirely below the content instead of removing it — centered,
  // split top/bottom, is the correct look here, matching main.
  videoModal: { flex: 1, backgroundColor: '#000', justifyContent: 'center', paddingTop: 10 },
  videoModalDesktopCenter: { alignItems: 'center' },
  videoModalLandscape: { justifyContent: 'center', alignItems: 'center' },
  // Desktop: video+title on the left, the action icons as a vertical rail
  // beside it — alignItems:'center' is what actually centers that rail
  // against the video+title column's height, no extra centering needed on
  // VideoActions itself.
  desktopPlayerRow: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  videoModalTitle: { color: '#fff', fontSize: 15, fontWeight: '600', padding: 20, lineHeight: 22, width: '100%', maxWidth: 700, alignSelf: 'center' },
  modalClose: { position: 'absolute', top: 50, right: 16, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 8, zIndex: 10 },
  modalCloseLandscape: { top: 16, right: 16 },
  topRightRow: { position: 'absolute', top: 50, right: 16, flexDirection: 'row', gap: 10, zIndex: 10 },
  topRightRowLandscape: { top: 16 },
  roundIconBtn: { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 8 },
  lockToggleBtn: { backgroundColor: '#7c83e5', borderRadius: 22, padding: 10, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 4 },
  // Desktop/tablet Prev/Next for VideoModal's Songs nav mode — horizontal,
  // one button centered on each edge, matching the swipe-hint's left/right
  // convention below it on mobile.
  videoModalNavBtn: { position: 'absolute', top: '50%', marginTop: -22, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 22, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', cursor: 'pointer' } as any,
  videoModalNavBtnLeft: { left: 12 },
  videoModalNavBtnRight: { right: 12 },
  // Mobile web only — wraps VideoActions so its Prev/Next buttons
  // (videoModalNavBtn's top:'50%' above) center against this row's own
  // height instead of the whole video, aligning them with the YouTube/Copy
  // icons. position:'relative' is the only thing this needs; it otherwise
  // sizes itself to fit VideoActions exactly, so it doesn't affect layout.
  mobileActionsRowWrap: { position: 'relative' },
});

const resumeStyles = StyleSheet.create({
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, top: 0, justifyContent: 'flex-end', paddingBottom: 80, paddingHorizontal: 20, zIndex: 20, backgroundColor: 'rgba(0,0,0,0.45)' },
  overlayCenter: { justifyContent: 'center', alignItems: 'center', paddingBottom: 0 },
  card: { backgroundColor: 'rgba(18,18,28,0.97)', borderRadius: 24, paddingVertical: 28, paddingHorizontal: 24, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  cardDesktop: { width: 380 },
  iconRow: { marginBottom: 16 },
  iconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#7c83e5', alignItems: 'center', justifyContent: 'center' },
  heading: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 24, textAlign: 'center', letterSpacing: 0.2 },
  btnResume: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#7c83e5', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 32, width: '100%', justifyContent: 'center', marginBottom: 12 },
  btnResumeText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  btnStart: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 32, width: '100%', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  btnStartText: { color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '600' },
});

const lockStyles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 200, justifyContent: 'flex-end', alignItems: 'center' },
  badge: { position: 'absolute', top: 110, alignSelf: 'center', alignItems: 'center', gap: 10 },
  badgeIconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#7c83e5', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 5 },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  unlockBtn: { alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 30, paddingHorizontal: 26, paddingVertical: 14, marginBottom: 70 },
  unlockText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});

const errorStyles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 24 },
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
  tipsBox: { width: '100%', maxWidth: 420, borderRadius: 14, paddingVertical: 4, paddingHorizontal: 16, marginBottom: 28, borderWidth: 1.5, borderStyle: 'dashed' },
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
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
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
  // Desktop video player's side rail — stacked vertically instead of the
  // usual row, sitting beside the video rather than in a row below it.
  containerColumn: { flexDirection: 'column', gap: 24, paddingVertical: 0 },
  iconBtn: { alignItems: 'center', gap: 6 },
  iconCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  iconLabel: { fontSize: 11, fontWeight: '600' },
});

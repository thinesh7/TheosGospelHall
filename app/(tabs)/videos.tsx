import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../utils/ThemeContext';
import { getCachedLivePlaylists, syncLivePlaylists } from '../../utils/livePlaylistsSync';
import { ytFetch } from '../../utils/youtubeProxy';

const CHANNEL_ID = 'UCFg0eNTRs2UIcihQAVpyrJA';
const UPLOADS_PLAYLIST_ID = 'UUFg0eNTRs2UIcihQAVpyrJA';
const SHORTS_PLAYLIST_ID = 'PLZISpWbe8RUjb_YX_C2yEEB7IZnhU9VRA';
const VIDEOS_PLAYLIST_ID = 'PLZISpWbe8RUgXpqMWjZCAZUTmYQ8b1qAb';
const SONGS_PLAYLIST_ID = 'PLKm9fFPbrDuw';
const FALLBACK_LIVE_IDS = ['PLZISpWbe8RUidyhPJNs5xa8-WOnHq-NLj'];
const PROGRESS_STORAGE_KEY = 'video_progress_v1';
const COMPLETION_THRESHOLD = 0.98;

const getWindow = () => Dimensions.get('window');
const { width: SW } = getWindow();

type Tab = 'shorts' | 'videos' | 'songs' | 'live' | 'all';

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

interface ResumePromptProps {
  visible: boolean;
  onResume: () => void;
  onStartOver: () => void;
}

function ResumePrompt({ visible, onResume, onStartOver }: ResumePromptProps) {
  if (!visible) return null;
  return (
    <View style={resumeStyles.overlay}>
      <View style={resumeStyles.card}>
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

interface VideoModalProps {
  visible: boolean;
  videoId: string | null;
  title: string;
  isLive?: boolean;
  onClose: () => void;
}

function VideoModal({ visible, videoId, title, isLive, onClose }: VideoModalProps) {
  const { width, height } = useWindowDimensions();
  const { colors } = useTheme();
  const isLandscape = width > height;
  const [playerReady, setPlayerReady] = useState(false);
  const [isInFullscreen, setIsInFullscreen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const playerRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const resumePositionRef = useRef<number>(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef<number>(0);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    if (!visible) {
      setPlayerReady(false);
      setIsInFullscreen(false);
      setPlaying(false);
      setShowResume(false);
      setProgressLoaded(false);
      setLoadError(false);
      resumePositionRef.current = 0;
      durationRef.current = 0;
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      return;
    }
    if (!videoId) return;
    setProgressLoaded(false);
    setLoadError(false);
    resumePositionRef.current = 0;
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
    getVideoProgress(videoId).then(progress => {
      if (!mountedRef.current) return;
      resumePositionRef.current = progress ? progress.position : 0;
      if (progress) durationRef.current = progress.duration;
      setProgressLoaded(true);
      armLoadTimeout();
    });
  }, [visible, videoId, isLive]);

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
  }, []);

  const handleStartOver = useCallback(() => {
    setShowResume(false);
    if (videoId) clearVideoProgress(videoId);
    resumePositionRef.current = 0;
    playerRef.current?.seekTo(0, true);
    setPlaying(true);
  }, [videoId]);

  const onChangeState = useCallback((state: string) => {
    if (state === 'playing') {
      fsTransitionRef.current = false;
      setPlaying(true);
    }
    if (fsTransitionRef.current) return;
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
    setIsInFullscreen(isFs);
    if (isFs) {
      activateKeepAwakeAsync('fullscreen');
    } else {
      deactivateKeepAwake('fullscreen');
    }
  }, []);

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.videoModal, isLandscape && styles.videoModalLandscape]}>
        <StatusBar hidden />
        {(!playerReady || !progressLoaded) && (
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
        {progressLoaded && (() => {
          const videoH = isLandscape ? height : width * 9 / 16;
          const videoW = isLandscape ? height * 16 / 9 : width;
          return (
            <View style={{ width: videoW, height: videoH }}>
              <YoutubePlayer
                ref={playerRef}
                height={videoH}
                width={videoW}
                videoId={videoId || ''}
                play={playing}
                forceAndroidAutoplay={true}
                onReady={handleReady}
                onChangeState={onChangeState}
                onFullScreenChange={onFullScreenChange}
                onError={() => { if (mountedRef.current) { if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current); setLoadError(true); } }}
                webViewProps={{ allowsInlineMediaPlayback: true, mediaPlaybackRequiresUserAction: false, allowsFullscreenVideo: true }}
                initialPlayerParams={{ rel: 0, modestbranding: 1, controls: 1, playsinline: 1 }}
              />
              {showResume && videoId && (
                <Image
                  source={{ uri: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` }}
                  style={[StyleSheet.absoluteFillObject, { resizeMode: 'cover' }]}
                />
              )}
            </View>
          );
        })()}
        {!isLandscape && (
          <>
            <Text style={styles.videoModalTitle} numberOfLines={3}>{title}</Text>
            <VideoActions videoId={videoId || ''} title={title} />
          </>
        )}
        {playerReady && (
          <ResumePrompt visible={showResume} onResume={handleResume} onStartOver={handleStartOver} />
        )}
        <TouchableOpacity style={[styles.modalClose, isLandscape && styles.modalCloseLandscape]} onPress={onClose}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

interface SongsPlayerProps {
  visible: boolean;
  songs: any[];
  startIndex: number;
  onClose: () => void;
  onEndReached: () => void;
}

interface SongItemProps {
  item: any;
  index: number;
  isActive: boolean;
  currentIndex: number;
  playerReady: boolean;
  progressLoaded: boolean;
  colors: any;
  onReady: () => void;
  onChangeState: (state: string) => void;
  playerRef: React.RefObject<any>;
  showResume: boolean;
  onResume: () => void;
  onStartOver: () => void;
  fsTransitionRef: React.RefObject<boolean>;
  isFullscreenRef: React.RefObject<boolean>;
  loadError: boolean;
  onRetry: () => void;
  onPlayerError: () => void;
}

function SongItem({ item, index, isActive, playerReady, progressLoaded, colors, onReady, onChangeState, playerRef, showResume, onResume, onStartOver, fsTransitionRef, isFullscreenRef, loadError, onRetry, onPlayerError }: SongItemProps) {
  const videoId = item?.snippet?.resourceId?.videoId;
  const title = item?.snippet?.title || '';
  const dimsRef = useRef(Dimensions.get('window'));
  const videoH = dimsRef.current.width * 9 / 16;
  const videoW = dimsRef.current.width;
  const containerW = dimsRef.current.width;
  const containerH = dimsRef.current.height;
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const onFullScreenChange = useCallback((isFs: boolean) => {
    if (!mountedRef.current) return;
    fsTransitionRef.current = true;
    isFullscreenRef.current = isFs;
    if (isFs) {
      ScreenOrientation.unlockAsync();
      activateKeepAwakeAsync('fullscreen');
    } else {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
      deactivateKeepAwake('fullscreen');
    }
  }, [fsTransitionRef, isFullscreenRef]);

  return (
    <View style={{ width: containerW, height: containerH, backgroundColor: '#000', justifyContent: 'center' }}>
      {(!playerReady || !progressLoaded) && isActive && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', zIndex: 10 }]}>
          {loadError ? <PlayerErrorState onRetry={onRetry} /> : <VideoLoadingState accentColor={colors.accent} />}
        </View>
      )}
      {isActive && progressLoaded ? (
        <View style={{ width: videoW, height: videoH }}>
          <YoutubePlayer
            ref={playerRef}
            height={videoH}
            width={videoW}
            videoId={videoId}
            play={!showResume}
            forceAndroidAutoplay={true}
            onReady={onReady}
            onChangeState={onChangeState}
            onFullScreenChange={onFullScreenChange}
            webViewProps={{ allowsInlineMediaPlayback: true, mediaPlaybackRequiresUserAction: false, allowsFullscreenVideo: true }}
            initialPlayerParams={{ rel: 0, modestbranding: 1, controls: 1, mute: 1, playsinline: 1 }}
          />
          {showResume && videoId && (
            <Image
              source={{ uri: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` }}
              style={[StyleSheet.absoluteFillObject, { resizeMode: 'cover' }]}
            />
          )}
        </View>
      ) : (
        <View style={{ width: videoW, height: videoH, backgroundColor: '#000' }} />
      )}
      {isActive && playerReady && (
        <>
          <Text style={styles.videoModalTitle} numberOfLines={3}>{title}</Text>
          <VideoActions videoId={videoId || ''} title={title} />
        </>
      )}
      {isActive && playerReady && (
        <ResumePrompt visible={showResume} onResume={onResume} onStartOver={onStartOver} />
      )}
    </View>
  );
}

function SongsPlayer({ visible, songs, startIndex, onClose, onEndReached }: SongsPlayerProps) {
  const dims = useWindowDimensions();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const width = dims.width;
  const height = dims.height;
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [playerReady, setPlayerReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const listRef = useRef<FlatList>(null);
  const currentIndexRef = useRef(startIndex);
  const playerRef = useRef<any>(null);
  const itemSizeRef = useRef(height);
  const itemSize = itemSizeRef.current;
  const mountedRef = useRef(true);
  const resumePositionRef = useRef<number>(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef<number>(0);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(startIndex);
      currentIndexRef.current = startIndex;
      setPlayerReady(false);
      setPlaying(false);
      setShowResume(false);
      setProgressLoaded(false);
      resumePositionRef.current = 0;
    }
  }, [visible, startIndex]);

  useEffect(() => {
    setPlayerReady(false);
    setPlaying(false);
    setShowResume(false);
    setProgressLoaded(false);
    setScrollEnabled(true);
    setLoadError(false);
    fsTransitionRef.current = false;
    isFullscreenRef.current = false;
    resumePositionRef.current = 0;
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    const videoId = songs[currentIndex]?.snippet?.resourceId?.videoId;
    if (!videoId || !visible) {
      setProgressLoaded(true);
      return;
    }
    getVideoProgress(videoId).then(progress => {
      if (!mountedRef.current) return;
      resumePositionRef.current = progress ? progress.position : 0;
      if (progress) durationRef.current = progress.duration;
      setProgressLoaded(true);
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) setLoadError(prev => { if (!prev) return true; return prev; });
      }, 15000);
    });
  }, [currentIndex, visible]);

  useEffect(() => {
    const videoId = songs[currentIndex]?.snippet?.resourceId?.videoId;
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
  }, [playerReady, playing, currentIndex]);

  const onViewable = useRef(({ viewableItems }: any) => {
    if (!viewableItems.length) return;
    const idx = viewableItems[0].index ?? 0;
    currentIndexRef.current = idx;
    setCurrentIndex(idx);
    if (idx === songs.length - 1) onEndReached();
  }).current;

  const handleVideoEnd = useCallback(() => {
    const next = currentIndexRef.current + 1;
    if (next < songs.length) {
      listRef.current?.scrollToIndex({ index: next, animated: true });
    } else {
      onEndReached();
    }
  }, [songs.length, onEndReached]);

  const fsTransitionRef = useRef(false);
  const isFullscreenRef = useRef(false);

  const handleReady = useCallback(() => {
    if (!mountedRef.current) return;
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    setLoadError(false);
    setPlayerReady(true);
    if (resumePositionRef.current > 0) {
      playerRef.current?.seekTo(resumePositionRef.current, true);
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
  }, []);

  const handleStartOver = useCallback(() => {
    const videoId = songs[currentIndexRef.current]?.snippet?.resourceId?.videoId;
    setShowResume(false);
    if (videoId) clearVideoProgress(videoId);
    resumePositionRef.current = 0;
    playerRef.current?.seekTo(0, true);
    setPlaying(true);
  }, [songs]);

  const viewConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent supportedOrientations={["portrait"]} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <StatusBar hidden />
        <FlatList
          ref={listRef}
          data={songs}
          keyExtractor={item => item.snippet.resourceId.videoId}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={itemSize}
          snapToAlignment="start"
          decelerationRate="fast"
          onViewableItemsChanged={onViewable}
          viewabilityConfig={viewConfig}
          getItemLayout={(_, index) => ({ length: itemSize, offset: itemSize * index, index })}
          initialScrollIndex={startIndex}
          onScrollToIndexFailed={() => {}}
          scrollEnabled={scrollEnabled}
          extraData={{ currentIndex, playerReady, showResume, progressLoaded, scrollEnabled }}
          renderItem={({ item, index }) => {
            const isActive = index === currentIndex;
            return (
              <SongItem
                item={item}
                index={index}
                isActive={isActive}
                currentIndex={currentIndex}
                playerReady={playerReady}
                progressLoaded={progressLoaded}
                colors={colors}
                playerRef={playerRef}
                showResume={showResume}
                onResume={handleResume}
                onStartOver={handleStartOver}
                fsTransitionRef={fsTransitionRef}
                isFullscreenRef={isFullscreenRef}
                loadError={loadError}
                onRetry={() => {
                  if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
                  setLoadError(false);
                  setPlayerReady(false);
                  setProgressLoaded(false);
                  const vid = songs[currentIndexRef.current]?.snippet?.resourceId?.videoId;
                  if (!vid) return;
                  getVideoProgress(vid).then(p => {
                    if (!mountedRef.current) return;
                    resumePositionRef.current = p ? p.position : 0;
                    setProgressLoaded(true);
                    loadTimeoutRef.current = setTimeout(() => { if (mountedRef.current) setLoadError(true); }, 15000);
                  });
                }}
                onPlayerError={() => { if (mountedRef.current) { if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current); setLoadError(true); } }}
                onReady={handleReady}
                onChangeState={async (state: string) => {
                  if (state === 'playing') {
                    fsTransitionRef.current = false;
                    setPlaying(true);
                    setScrollEnabled(true);
                  }
                  if (state === 'ended' && isFullscreenRef.current) {
                    return;
                  }
                  if (fsTransitionRef.current) return;
                  if (state === 'paused') { setPlaying(false); setScrollEnabled(false); }
                  if (state === 'ended') {
                    setScrollEnabled(true);
                    handleVideoEnd();
                  } else if (state === 'paused' && playerReady && !showResume) {
                    setTimeout(async () => {
                      const currentTime = await playerRef.current?.getCurrentTime();
                      if (currentTime !== undefined) playerRef.current?.seekTo(currentTime, true);
                    }, 300);
                  }
                }}
              />
            );
          }}
        />
        <TouchableOpacity style={styles.modalClose} onPress={onClose}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
        {!showResume && (
          <View style={[styles.songsSwipeHint, { bottom: insets.bottom + 16 }]}>
            <Ionicons name="chevron-up" size={16} color="rgba(255,255,255,0.5)" />
            <Text style={styles.songsSwipeHintText}>Swipe to navigate</Text>
            <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.5)" />
          </View>
        )}
      </View>
    </Modal>
  );
}

function ShortsPlayerItemInner({ item, index, isActive, onEnd, onClose, total, onScrollLockChange }: any) {
  const [shortReady, setShortReady] = useState(false);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const videoId = item?.snippet?.resourceId?.videoId;
  const title = item?.snippet?.title ?? '';
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const playerRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const resumePositionRef = useRef<number>(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dimsRef = useRef((() => {
    const s = Dimensions.get('screen');
    const w = Math.min(s.width, s.height);
    const h = Math.max(s.width, s.height);
    return { width: w, height: h };
  })());
  const videoH = dimsRef.current.width * 9 / 16;
  const videoW = dimsRef.current.width;
  const containerW = dimsRef.current.width;
  const containerH = dimsRef.current.height;

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
      ScreenOrientation.unlockAsync();
      activateKeepAwakeAsync('fullscreen');
    } else {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
      deactivateKeepAwake('fullscreen');
    }
  }, []);

  return (
    <View style={{ width: containerW, height: containerH, backgroundColor: '#000', justifyContent: 'center' }}>
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
      {shortReady && (
        <>
          <Text style={styles.videoModalTitle} numberOfLines={3}>{title}</Text>
          <VideoActions videoId={videoId || ''} title={title} />
        </>
      )}
      <TouchableOpacity style={styles.modalClose} onPress={onClose}>
        <Ionicons name="close" size={26} color="#fff" />
      </TouchableOpacity>
      {shortReady && (
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
}

export default function VideosScreen({ autoPlayLive, onAutoPlayLiveConsumed }: VideosScreenProps = {}) {
  const { colors } = useTheme();

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
  const [songsPlayerVisible, setSongsPlayerVisible] = useState(false);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);

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

  useEffect(() => { shortsNextRef.current = shortsNextToken; }, [shortsNextToken]);
  useEffect(() => { loadingMoreShortsRef.current = loadingMoreShorts; }, [loadingMoreShorts]);
  useEffect(() => { shortsDataRef.current = shorts; }, [shorts]);
  useEffect(() => { fetchShorts(); }, []);

  useEffect(() => {
    if (songsPlayerVisible || shortsPlayerVisible) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
      if (shortsPlayerVisible) {
        const screen = Dimensions.get('screen');
        shortItemSizeRef.current = Math.max(screen.height, screen.width);
      }
    } else {
      ScreenOrientation.unlockAsync();
    }
  }, [songsPlayerVisible, shortsPlayerVisible]);

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
    setVideoModalVisible(true);
  };

  const closeVideo = () => { setVideoModalVisible(false); setActiveVideoId(null); setActiveVideoIsLive(false); };

  useEffect(() => {
    if (!autoPlayLive) return;
    setActiveTab('live');
    openVideo(autoPlayLive.videoId, autoPlayLive.title, true);
    onAutoPlayLiveConsumed?.();
  }, [autoPlayLive]);

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

  const fetchSongs = async (pageToken = '', forceLoad = false) => {
    try {
      if (!pageToken || forceLoad) { setLoadingSongs(true); setSongsError(false); setSongsLoaded(false); } else setLoadingMoreSongs(true);
      const data = await ytFetch('playlistItems', { playlistId: SONGS_PLAYLIST_ID, part: 'snippet', maxResults: '50', ...(pageToken ? { pageToken } : {}) });
      const enriched = await enrichDates(mapItems(data.items || []));
      if (pageToken) {
        setSongs(prev => { const s = new Set(prev.map((v: any) => v.snippet.resourceId.videoId)); return [...prev, ...enriched.filter((v: any) => !s.has(v.snippet.resourceId.videoId))]; });
      } else { setSongs(dedupeById(enriched)); }
      setSongsNextToken(data.nextPageToken || '');
      setSongsLoaded(true);
    } catch {
      if (!pageToken) setSongsError(true);
    } finally { setLoadingSongs(false); setLoadingMoreSongs(false); }
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
    setSongs([]); setSongsLoaded(false); setSongsNextToken(''); setSongsError(false);
    setLiveVideos([]); setLiveLoaded(false); setLiveNextTokens({}); setLiveError(false);
    setAllVideos([]); setAllLoaded(false); setAllNextToken(''); setAllError(false);
    await Promise.all([fetchShorts(), fetchVideos(), fetchSongs(), loadLiveAndFetch(), fetchAll()]);
    setShortsLoaded(true); setVideosLoaded(true); setSongsLoaded(true); setLiveLoaded(true); setAllLoaded(true);
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
        onScrollLockChange={(locked: boolean) => setShortsScrollEnabled(!locked)}
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

  const SongCard = ({ item, index }: any) => {
    const { width: cardW } = useWindowDimensions();
    const videoId = item?.snippet?.resourceId?.videoId;
    const thumb = item?.snippet?.thumbnails?.medium?.url;
    const title = decodeHtml(item?.snippet?.title || '');
    const duration = item?.snippet?.duration || '';
    if (!videoId || !thumb) return null;
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface }]}
        onPress={() => { setCurrentSongIndex(index); setSongsPlayerVisible(true); }}
      >
        <View>
          <Image source={{ uri: thumb }} style={[styles.thumb, { height: cardW * 0.52 }]} />
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
          <Text style={[styles.cardDate, { color: colors.subtext }]}>#{index + 1}</Text>
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
    const handlePress = async () => {
      let liveNow = false;
      try {
        const data = await ytFetch('videos', { id: videoId, part: 'snippet' });
        liveNow = data?.items?.[0]?.snippet?.liveBroadcastContent === 'live';
      } catch {}
      openVideo(videoId, title, liveNow);
    };
    return (
      <TouchableOpacity style={[styles.card, { backgroundColor: colors.surface }]} onPress={handlePress}>
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
    { key: 'songs', label: 'Songs', icon: 'musical-notes' },
    { key: 'live', label: 'Live', icon: 'radio' },
    { key: 'all', label: 'All', icon: 'grid' },
  ];

  const isSearching = !!search.trim();
  const hasMoreLive = Object.values(liveNextTokens).some(t => !!t);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <VideoModal visible={videoModalVisible} videoId={activeVideoId} title={activeVideoTitle} isLive={activeVideoIsLive} onClose={closeVideo} />

      <SongsPlayer
        visible={songsPlayerVisible}
        songs={songs}
        startIndex={currentSongIndex}
        onClose={() => setSongsPlayerVisible(false)}
        onEndReached={() => { if (songsNextToken && !loadingMoreSongs) fetchSongs(songsNextToken); }}
      />

      <Modal visible={shortsPlayerVisible} animationType="slide" statusBarTranslucent supportedOrientations={["portrait"]} onRequestClose={() => { setShortsPlayerVisible(false); setPlayingShortId(null); setShortsScrollEnabled(true); }}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
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

      {!isSearching && activeTab === 'songs' && (
        loadingSongs ? <TabLoadingState tab="songs" />
        : songsError ? <VideoErrorState onRetry={() => { setSongsLoaded(false); fetchSongs(); }} />
        : <FlatList data={songs} keyExtractor={i => i.snippet.resourceId.videoId} refreshing={refreshing} onRefresh={onRefresh} renderItem={({ item, index }) => <SongCard item={item} index={index} />} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={[styles.empty, { color: colors.subtext }]}>No songs found</Text>} ListFooterComponent={<LoadMore token={songsNextToken} loading={loadingMoreSongs} onPress={() => fetchSongs(songsNextToken)} />} />
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
  tabsScroll: { flexShrink: 0 },
  tabsRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 10, gap: 8, alignItems: 'center' },
  tab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 18, borderRadius: 20, elevation: 2, alignSelf: 'flex-start' },
  tabText: { fontSize: 13, fontWeight: '600' },
  list: { padding: 12, paddingBottom: 100 },
  card: { borderRadius: 12, marginBottom: 12, overflow: 'hidden', elevation: 3 },
  thumb: { width: '100%', resizeMode: 'cover' },
  cardInfo: { padding: 10 },
  cardTitle: { fontSize: 14, fontWeight: 'bold' },
  cardDate: { fontSize: 12, marginTop: 4 },
  durationBadge: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.78)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  durationText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  songPlayOverlay: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 16, padding: 4 },
  shortCard: { flex: 1, borderRadius: 12, overflow: 'hidden', elevation: 3, marginBottom: 8, backgroundColor: '#000', minHeight: 220 },
  shortThumb: { width: '100%', height: 220 },
  shortPlayIcon: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  shortOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: 'rgba(0,0,0,0.45)' },
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
  songsSwipeHint: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  songsSwipeHintText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' },
  videoModal: { flex: 1, backgroundColor: '#000', justifyContent: 'center', paddingTop: 10 },
  videoModalLandscape: { justifyContent: 'center', alignItems: 'center' },
  videoModalTitle: { color: '#fff', fontSize: 15, fontWeight: '600', padding: 20, lineHeight: 22 },
  modalClose: { position: 'absolute', top: 50, right: 16, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 8, zIndex: 10 },
  modalCloseLandscape: { top: 16, right: 16 },
});

const resumeStyles = StyleSheet.create({
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, top: 0, justifyContent: 'flex-end', paddingBottom: 80, paddingHorizontal: 20, zIndex: 20, backgroundColor: 'rgba(0,0,0,0.45)' },
  card: { backgroundColor: 'rgba(18,18,28,0.97)', borderRadius: 24, paddingVertical: 28, paddingHorizontal: 24, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  iconRow: { marginBottom: 16 },
  iconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#7c83e5', alignItems: 'center', justifyContent: 'center' },
  heading: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 24, textAlign: 'center', letterSpacing: 0.2 },
  btnResume: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#7c83e5', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 32, width: '100%', justifyContent: 'center', marginBottom: 12 },
  btnResumeText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  btnStart: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 32, width: '100%', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  btnStartText: { color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '600' },
});

const errorStyles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 200, marginTop: -30 },
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
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingBottom: 200 },
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

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

// Loaded once and shared across every player instance on the page — the
// YouTube IFrame API's own script calls a single global callback
// (onYouTubeIframeAPIReady) when it finishes loading.
let apiLoadPromise: Promise<void> | null = null;

function loadYouTubeIframeAPI(): Promise<void> {
  if ((window as any).YT?.Player) return Promise.resolve();
  if (apiLoadPromise) return apiLoadPromise;
  apiLoadPromise = new Promise(resolve => {
    const previous = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });
  return apiLoadPromise;
}

// Maps YT.PlayerState's numeric values to the string states the app's
// onChangeState handlers already switch on (checked against react-native-
// youtube-iframe's native string states — same names, kept identical here
// so no call site needs to branch by platform).
const STATE_NAMES: Record<number, string> = {
  '-1': 'unstarted',
  0: 'ended',
  1: 'playing',
  2: 'paused',
  3: 'buffering',
  5: 'video cued',
};

interface PlayerParams {
  rel?: number;
  modestbranding?: number;
  controls?: number;
  playsinline?: number;
  mute?: number;
}

interface YoutubePlayerProps {
  height: number;
  width: number;
  videoId: string;
  play?: boolean;
  onReady?: () => void;
  onChangeState?: (state: string) => void;
  onFullScreenChange?: (isFullscreen: boolean) => void;
  onError?: () => void;
  initialPlayerParams?: PlayerParams;
  // Native-only props accepted so call sites don't need to branch by platform — no-ops on web.
  forceAndroidAutoplay?: boolean;
  webViewProps?: unknown;
}

export interface YoutubePlayerHandle {
  getCurrentTime: () => Promise<number>;
  getDuration: () => Promise<number>;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
}

const YoutubePlayer = forwardRef<YoutubePlayerHandle, YoutubePlayerProps>(function YoutubePlayerWeb(
  { height, width, videoId, play, onReady, onChangeState, onError, initialPlayerParams },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerInstanceRef = useRef<any>(null);

  // Refs so the effect below (keyed only on videoId) always calls the
  // latest callback props without needing them in its dependency array —
  // avoids tearing down/recreating the underlying YT.Player on every
  // parent re-render.
  const onReadyRef = useRef(onReady);
  const onChangeStateRef = useRef(onChangeState);
  const onErrorRef = useRef(onError);
  onReadyRef.current = onReady;
  onChangeStateRef.current = onChangeState;
  onErrorRef.current = onError;

  useImperativeHandle(ref, () => ({
    getCurrentTime: async () => playerInstanceRef.current?.getCurrentTime?.() ?? 0,
    getDuration: async () => playerInstanceRef.current?.getDuration?.() ?? 0,
    seekTo: (seconds: number) => playerInstanceRef.current?.seekTo?.(seconds, true),
  }), []);

  useEffect(() => {
    let cancelled = false;
    let localPlayer: any = null;

    loadYouTubeIframeAPI().then(() => {
      if (cancelled || !containerRef.current) return;
      localPlayer = new (window as any).YT.Player(containerRef.current, {
        videoId,
        width,
        height,
        playerVars: {
          rel: initialPlayerParams?.rel ?? 0,
          modestbranding: initialPlayerParams?.modestbranding ?? 1,
          controls: initialPlayerParams?.controls ?? 1,
          playsinline: initialPlayerParams?.playsinline ?? 1,
          mute: initialPlayerParams?.mute ?? 0,
          autoplay: play ? 1 : 0,
        },
        events: {
          onReady: () => {
            playerInstanceRef.current = localPlayer;
            onReadyRef.current?.();
          },
          onStateChange: (event: { data: number }) => {
            const name = STATE_NAMES[event.data];
            if (name) onChangeStateRef.current?.(name);
          },
          onError: () => onErrorRef.current?.(),
        },
      });
      playerInstanceRef.current = localPlayer;
    });

    return () => {
      cancelled = true;
      localPlayer?.destroy?.();
      playerInstanceRef.current = null;
    };
    // Deliberately re-created only when videoId changes; width/height/play
    // are read once at construction (playerVars.autoplay / initial size) —
    // matches the native player's own per-videoId mount lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  return <div ref={containerRef} style={{ width, height }} />;
});

export default YoutubePlayer;

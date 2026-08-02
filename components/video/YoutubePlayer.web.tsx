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
  useLocalHTML?: boolean;
}

export interface YoutubePlayerHandle {
  getCurrentTime: () => Promise<number>;
  getDuration: () => Promise<number>;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  pauseVideo: () => void;
}

const YoutubePlayer = forwardRef<YoutubePlayerHandle, YoutubePlayerProps>(function YoutubePlayerWeb(
  { height, width, videoId, play, onReady, onChangeState, onFullScreenChange, onError, initialPlayerParams },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerInstanceRef = useRef<any>(null);
  const playerReadyRef = useRef(false);

  // Refs so the effect below (keyed only on videoId) always calls the
  // latest callback props without needing them in its dependency array —
  // avoids tearing down/recreating the underlying YT.Player on every
  // parent re-render.
  const onReadyRef = useRef(onReady);
  const onChangeStateRef = useRef(onChangeState);
  const onFullScreenChangeRef = useRef(onFullScreenChange);
  const onErrorRef = useRef(onError);
  onReadyRef.current = onReady;
  onChangeStateRef.current = onChangeState;
  onFullScreenChangeRef.current = onFullScreenChange;
  onErrorRef.current = onError;

  // The YT IFrame API has no onFullScreenChange event of its own — the
  // player's built-in fullscreen button just calls the browser's native
  // Fullscreen API directly on the iframe, bypassing our JS entirely. The
  // only way to observe that is the document-level fullscreenchange event;
  // this was previously never wired up at all, so callers' onFullScreenChange
  // (e.g. VideoModal's landscape-lock-on-fullscreen) silently never fired on
  // web. containerRef.contains(...) (not ===) because the fullscreen target
  // is the iframe the YT.Player API creates *inside* our container div, not
  // the div itself.
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fsElement = document.fullscreenElement || (document as any).webkitFullscreenElement || null;
      const isFs = !!fsElement && !!containerRef.current && containerRef.current.contains(fsElement);
      onFullScreenChangeRef.current?.(isFs);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    getCurrentTime: async () => playerInstanceRef.current?.getCurrentTime?.() ?? 0,
    getDuration: async () => playerInstanceRef.current?.getDuration?.() ?? 0,
    seekTo: (seconds: number) => playerInstanceRef.current?.seekTo?.(seconds, true),
    pauseVideo: () => playerInstanceRef.current?.pauseVideo?.(),
  }), []);

  // Tracks whatever videoId the player was last told to show — read by the
  // construction effect below (as the *initial* video) and kept current by
  // the switch effect further down (for every video after that one).
  const lastVideoIdRef = useRef(videoId);

  useEffect(() => {
    let cancelled = false;
    let localPlayer: any = null;

    loadYouTubeIframeAPI().then(() => {
      if (cancelled || !containerRef.current) return;
      localPlayer = new (window as any).YT.Player(containerRef.current, {
        videoId: lastVideoIdRef.current,
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
            playerReadyRef.current = true;
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
      playerReadyRef.current = false;
      localPlayer?.destroy?.();
      playerInstanceRef.current = null;
    };
    // Mount-only — deliberately NOT keyed on videoId (width/height are also
    // still read only once here, matching the native player's per-mount
    // lifecycle). A later videoId change (e.g. Songs auto-advance) is
    // handled by the switch effect below instead, which reuses this same
    // player/iframe rather than destroying and recreating it here.
    //
    // That matters specifically for fullscreen: destroying the iframe
    // removes it from the DOM, and if it happened to be the browser's
    // active fullscreen element (playing fullscreen when a video ends and
    // auto-advance fires), the browser force-exits fullscreen the instant
    // the element is removed — and if that removal raced the browser's own
    // fullscreen-exit teardown, the page crashed outright with a DOM/React
    // desync (the same class of bug already fixed for Shorts' close crash
    // elsewhere in this codebase). Reusing the existing iframe for the next
    // video sidesteps that race entirely, and — as a bonus — means
    // auto-advance now stays in fullscreen instead of involuntarily
    // kicking the user out of it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switches the already-constructed player to a new video in place, in
  // response to videoId changing after the initial mount — see the
  // construction effect above for why this doesn't touch the iframe DOM
  // element at all. loadVideoById/cueVideoById are the YouTube IFrame API's
  // own documented way to change what's loaded without recreating the
  // player; the choice between them mirrors the construction effect's own
  // `autoplay: play ? 1 : 0`.
  useEffect(() => {
    if (lastVideoIdRef.current === videoId) return; // already what construction just used, above
    lastVideoIdRef.current = videoId;
    // Not ready yet (still constructing) — nothing to switch; the
    // construction effect reads lastVideoIdRef.current fresh once it does
    // become ready, so this update won't be lost.
    if (!playerReadyRef.current || !playerInstanceRef.current) return;
    try {
      if (play) {
        playerInstanceRef.current.loadVideoById(videoId);
      } else {
        playerInstanceRef.current.cueVideoById(videoId);
      }
    } catch {
      // Never let a YouTube IFrame API quirk on some edge-case player state
      // crash the page — worst case the video just doesn't switch.
    }
  }, [videoId, play]);

  // Unlike native's react-native-youtube-iframe, the IFrame Player API only
  // reads `autoplay` once at construction — it never reacts to a `play` prop
  // changing on its own. This drives playVideo()/pauseVideo() imperatively
  // whenever `play` changes after the player is ready, which is what makes
  // autoplay-after-ready (and pause/resume) actually work on web.
  useEffect(() => {
    if (!playerReadyRef.current || !playerInstanceRef.current) return;
    if (play) {
      playerInstanceRef.current.playVideo?.();
    } else {
      playerInstanceRef.current.pauseVideo?.();
    }
  }, [play]);

  return <div ref={containerRef} style={{ width, height }} />;
});

export default YoutubePlayer;

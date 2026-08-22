import * as Speech from 'expo-speech';

export type TTSPlaybackState = 'idle' | 'playing' | 'paused';
export type TTSLanguage = 'English' | 'Tamil';

export interface TTSVerse {
  verse: number;
  text: string;
  unavailable?: boolean;
}

type Listener = (state: TTSPlaybackState, verseIndex: number) => void;

const LANGUAGE_TAGS: Record<TTSLanguage, string> = {
  English: 'en-US',
  Tamil: 'ta-IN',
};

let queue: TTSVerse[] = [];
let index = 0;
let lang: TTSLanguage = 'English';
let state: TTSPlaybackState = 'idle';
let listener: Listener | null = null;
let cleanFn: (text: string) => string = (t) => t;
let onError: ((message: string) => void) | null = null;
let onChapterComplete: (() => void) | null = null;
let currentVoice: string | undefined;

// ISO 639-1 prefix used to match a device Voice's `language` field (shows up as
// "ta-IN", "ta_IN", or just "ta" depending on platform/engine).
const LANGUAGE_PREFIX: Record<TTSLanguage, string> = {
  English: 'en',
  Tamil: 'ta',
};

let bestVoiceCache: Partial<Record<TTSLanguage, string | null>> = {};

/** Picks the best-sounding installed voice for a language and caches the result.
 *  On Android, Google's TTS engine ships both a small on-device voice (identifier
 *  ending "-local") and a fuller cloud-trained one (ending "-network") per language —
 *  the network voice sounds noticeably better, so it's preferred when present.
 *  Falls back to an iOS/other-platform "Enhanced" quality voice, then to whatever
 *  is available, then to undefined (OS default for the language). */
async function getBestVoice(language: TTSLanguage): Promise<string | undefined> {
  if (language in bestVoiceCache) return bestVoiceCache[language] ?? undefined;
  const prefix = LANGUAGE_PREFIX[language];
  let best: string | null = null;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const candidates = voices.filter((v) => v.language?.toLowerCase().replace('_', '-').startsWith(prefix));
    const network = candidates.find((v) => v.identifier.toLowerCase().includes('network'));
    const enhanced = candidates.find((v) => v.quality === Speech.VoiceQuality.Enhanced);
    best = network?.identifier ?? enhanced?.identifier ?? candidates[0]?.identifier ?? null;
  } catch {
    best = null;
  }
  bestVoiceCache[language] = best;
  return best ?? undefined;
}

function notify() {
  listener?.(state, index);
}

function speakCurrent() {
  const verse = queue[index];
  if (!verse) {
    stop();
    return;
  }
  const text = verse.unavailable ? '' : cleanFn(verse.text);
  if (!text) {
    advance();
    return;
  }
  Speech.speak(text, {
    language: LANGUAGE_TAGS[lang],
    voice: currentVoice,
    onDone: advance,
    onStopped: () => {},
    onError: () => {
      onError?.(`${lang} speech is not available on this device.`);
      stop();
    },
  });
}

function advance() {
  if (state !== 'playing') return;
  index += 1;
  notify();
  if (index >= queue.length) {
    // Chapter finished naturally (as opposed to a manual Stop) — let the caller decide
    // whether to continue into the next chapter via onChapterComplete.
    const chapterDone = onChapterComplete;
    stop();
    chapterDone?.();
    return;
  }
  speakCurrent();
}

/** Starts reading a chapter aloud from the given verse index (default: first verse).
 *  Resolves the best available voice for the language before speaking. */
export async function playChapter(
  verses: TTSVerse[],
  language: TTSLanguage,
  clean: (text: string) => string,
  opts?: { startIndex?: number; onError?: (message: string) => void; onChapterComplete?: () => void }
) {
  Speech.stop();
  queue = verses;
  lang = language;
  cleanFn = clean;
  onError = opts?.onError ?? null;
  onChapterComplete = opts?.onChapterComplete ?? null;
  index = opts?.startIndex ?? 0;
  state = 'playing';
  notify();
  currentVoice = await getBestVoice(language);
  if (state !== 'playing') return; // stopped/changed while resolving the voice
  speakCurrent();
}

/** Pause/resume is implemented as stop-and-remember rather than native pause: expo-speech's
 *  native pause() is iOS-only, so this keeps behavior consistent across Android/iOS/Web. */
export function pause() {
  if (state !== 'playing') return;
  Speech.stop();
  state = 'paused';
  notify();
}

export function resume() {
  if (state !== 'paused') return;
  state = 'playing';
  notify();
  speakCurrent();
}

export function stop() {
  Speech.stop();
  state = 'idle';
  queue = [];
  index = 0;
  onChapterComplete = null;
  notify();
}

export function subscribe(fn: Listener): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

export function getState(): TTSPlaybackState {
  return state;
}

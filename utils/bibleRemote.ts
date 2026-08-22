import AsyncStorage from '@react-native-async-storage/async-storage';
import { BIBLE_VERSIONS } from './bibleData';

export interface RemoteVerse {
  verse: number;
  text: string;
}

export type BibleFetchErrorKind = 'offline' | 'server' | 'not-found' | 'parse' | 'unsupported';

export class BibleFetchError extends Error {
  kind: BibleFetchErrorKind;
  constructor(kind: BibleFetchErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

const CACHE_PREFIX = 'tgh_bible_cache_v1';
const BOLLS_BASE = 'https://bolls.life';

// In-memory mirror of AsyncStorage, keyed the same way, so a chapter visited once
// this session renders instantly on every later visit without an AsyncStorage round-trip.
const memCache = new Map<string, RemoteVerse[]>();

function cacheKey(version: string, bookId: number, chapter: number): string {
  // language + version + book + chapter — a Tamil and English cache entry can never collide.
  return `${CACHE_PREFIX}:${version}:${bookId}:${chapter}`;
}

/** Synchronous cache peek — only checks memory. Use for render-time decisions. */
export function peekCachedChapterVerses(version: string, bookId: number, chapter: number): RemoteVerse[] | null {
  return memCache.get(cacheKey(version, bookId, chapter)) ?? null;
}

/** Full cache read (memory, then AsyncStorage). Resolves fast on a hit; never throws. */
export async function getCachedChapterVerses(version: string, bookId: number, chapter: number): Promise<RemoteVerse[] | null> {
  const key = cacheKey(version, bookId, chapter);
  const mem = memCache.get(key);
  if (mem) return mem;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.verses)) return null;
    memCache.set(key, parsed.verses);
    return parsed.verses;
  } catch {
    // Corrupt cache entry — treat as a miss rather than surfacing an error.
    return null;
  }
}

/** Fetches one chapter from bolls.life and writes it into both cache layers. */
export async function fetchAndCacheChapter(version: string, bookId: number, chapter: number): Promise<RemoteVerse[]> {
  const meta = BIBLE_VERSIONS.find(v => v.code === version);
  if (!meta || meta.source !== 'bolls' || !meta.bollsCode) {
    throw new BibleFetchError('unsupported', `"${version}" is not a remote-loadable Bible version.`);
  }

  let res: Response;
  try {
    res = await fetch(`${BOLLS_BASE}/get-chapter/${meta.bollsCode}/${bookId}/${chapter}/`);
  } catch {
    throw new BibleFetchError('offline', 'No internet connection.');
  }

  if (!res.ok) {
    throw new BibleFetchError('server', `Bible source unavailable (HTTP ${res.status}).`);
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new BibleFetchError('parse', 'Received an invalid response from the Bible source.');
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new BibleFetchError('not-found', 'This chapter is not available in this translation.');
  }

  const verses: RemoteVerse[] = data
    .filter((v: any) => v && typeof v.verse === 'number')
    .map((v: any) => ({ verse: v.verse, text: typeof v.text === 'string' ? v.text : '' }));

  const key = cacheKey(version, bookId, chapter);
  memCache.set(key, verses);
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ verses, cachedAt: Date.now() }));
  } catch {
    // Best-effort persistence — an in-memory-only cache for this session is still fine.
  }
  return verses;
}

/** User-facing message for a fetch failure, used only when no cached content exists to fall back on. */
export function describeFetchError(err: unknown): string {
  if (err instanceof BibleFetchError) {
    switch (err.kind) {
      case 'offline': return "You're offline. Connect to the internet to load this chapter.";
      case 'server': return 'The Bible source is temporarily unavailable. Please try again.';
      case 'not-found': return 'This chapter is not available in this translation.';
      case 'parse': return 'Something went wrong loading this chapter. Please try again.';
      case 'unsupported': return 'This version is not supported.';
    }
  }
  return 'Something went wrong loading this chapter. Please try again.';
}

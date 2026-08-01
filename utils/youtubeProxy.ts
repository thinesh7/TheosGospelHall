import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCachedApiKeys, syncApiKeys } from './apiKeysSync';

export const DEFAULT_API_KEY = process.env.EXPO_PUBLIC_YT_API_KEY || 'AIzaSyCDjHEyoBYP52F5OCE3l7N5NGg3HFd89YU';
const CHANNEL_ID = 'UCFg0eNTRs2UIcihQAVpyrJA';
const EXHAUSTION_STORAGE_KEY = 'tgh_exhausted_yt_keys';

export class QuotaExhaustedError extends Error {
  constructor() {
    super('All configured YouTube API keys have exhausted their quota.');
    this.name = 'QuotaExhaustedError';
  }
}

interface ExhaustionState {
  date: string;
  fullyDead: Set<string>;
  searchDead: Set<string>;
}

let backupKeysPromise: Promise<string[]> | null = null;
let exhaustionCache: ExhaustionState | null = null;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyExhaustionState(date: string): ExhaustionState {
  return { date, fullyDead: new Set(), searchDead: new Set() };
}

async function loadExhaustionState(): Promise<ExhaustionState> {
  const today = todayKey();
  if (exhaustionCache && exhaustionCache.date === today) return exhaustionCache;
  try {
    const raw = await AsyncStorage.getItem(EXHAUSTION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.date === today) {
        exhaustionCache = {
          date: today,
          fullyDead: new Set(parsed.fullyDead || []),
          searchDead: new Set(parsed.searchDead || []),
        };
        return exhaustionCache;
      }
    }
  } catch {}
  exhaustionCache = emptyExhaustionState(today);
  return exhaustionCache;
}

function persistExhaustionState() {
  if (!exhaustionCache) return;
  AsyncStorage.setItem(EXHAUSTION_STORAGE_KEY, JSON.stringify({
    date: exhaustionCache.date,
    fullyDead: Array.from(exhaustionCache.fullyDead),
    searchDead: Array.from(exhaustionCache.searchDead),
  })).catch(() => {});
}

function markKeyExhausted(key: string, isSearch: boolean) {
  const today = todayKey();
  if (!exhaustionCache || exhaustionCache.date !== today) exhaustionCache = emptyExhaustionState(today);
  if (isSearch) {
    exhaustionCache.searchDead.add(key);
  } else {
    exhaustionCache.fullyDead.add(key);
  }
  persistExhaustionState();
}

async function getBackupKeys(): Promise<string[]> {
  if (!backupKeysPromise) {
    backupKeysPromise = (async () => {
      const cached = await getCachedApiKeys();
      syncApiKeys().catch(() => {});
      return cached
        .filter(k => k.isActive && k.key)
        .sort((a, b) => a.order - b.order)
        .map(k => k.key);
    })();
  }
  return backupKeysPromise;
}

function isQuotaExceeded(data: any): boolean {
  return !!data?.error?.errors?.some((e: any) => e.reason === 'quotaExceeded');
}

async function fetchWithKey(endpoint: string, params: Record<string, string>, key: string): Promise<any> {
  const searchParams = new URLSearchParams({ ...params, key });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/${endpoint}?${searchParams}`);
  return res.json();
}

// Every list-type endpoint we call (playlistItems/videos/playlists/search) is
// re-requested with identical params far more often than the underlying data
// actually changes (tab remounts, enrichDates re-checking already-seen video
// IDs, the live-now check and the Live tab independently asking the same
// question). A short in-memory cache in front of the network call, keyed by
// endpoint+params, eliminates those without touching what any call site asks
// for or how it's shaped. Not persisted to AsyncStorage — session-only, so
// there's no cross-launch staleness risk.
const CACHEABLE_ENDPOINTS = new Set(['playlistItems', 'videos', 'playlists', 'search']);
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  data: any;
  expiresAt: number;
}

const responseCache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Promise<any>>();

function buildCacheKey(endpoint: string, params: Record<string, string>): string {
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`);
  return `${endpoint}?${sorted.join('&')}`;
}

async function performYtFetch(endpoint: string, params: Record<string, string>): Promise<any> {
  const isSearch = endpoint === 'search';
  const state = await loadExhaustionState();
  const backups = await getBackupKeys();
  const allKeys = [DEFAULT_API_KEY, ...backups];
  const candidates = allKeys.filter(k => !state.fullyDead.has(k) && !(isSearch && state.searchDead.has(k)));

  if (!candidates.length) {
    throw new QuotaExhaustedError();
  }

  for (const key of candidates) {
    const data = await fetchWithKey(endpoint, params, key);
    if (!isQuotaExceeded(data)) return data;
    markKeyExhausted(key, isSearch);
  }

  throw new QuotaExhaustedError();
}

// `ttlMs` lets time-sensitive callers (live-status checks) opt into a much
// shorter cache window than the default; pass 0 to bypass caching entirely.
export async function ytFetch(
  endpoint: string,
  params: Record<string, string>,
  ttlMs: number = DEFAULT_CACHE_TTL_MS
): Promise<any> {
  const cacheable = ttlMs > 0 && CACHEABLE_ENDPOINTS.has(endpoint);
  const cacheKey = cacheable ? buildCacheKey(endpoint, params) : '';

  if (cacheable) {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.data;
    const pending = pendingRequests.get(cacheKey);
    if (pending) return pending;
  }

  const request = performYtFetch(endpoint, params);
  if (cacheable) pendingRequests.set(cacheKey, request);

  try {
    const data = await request;
    if (cacheable) responseCache.set(cacheKey, { data, expiresAt: Date.now() + ttlMs });
    return data;
  } finally {
    if (cacheable) pendingRequests.delete(cacheKey);
  }
}

export type ApiKeyStatus = 'ok' | 'quotaExceeded' | 'invalid' | 'error';

export async function testApiKey(key: string): Promise<ApiKeyStatus> {
  try {
    const data = await fetchWithKey('channels', { id: CHANNEL_ID, part: 'id' }, key);
    if (!data?.error) return 'ok';
    if (isQuotaExceeded(data)) return 'quotaExceeded';
    return 'invalid';
  } catch {
    return 'error';
  }
}

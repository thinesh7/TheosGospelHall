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

export async function ytFetch(endpoint: string, params: Record<string, string>): Promise<any> {
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

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'tgh_bible_settings';

export interface BibleSettings {
  fontSize: number;
  secondaryVersion: string;
  version: string;
}

const DEFAULTS: BibleSettings = {
  fontSize: 17,
  secondaryVersion: 'ERV',
  version: 'TAMOVR',
};

let mem: BibleSettings | null = null;

/** Called once at app start (in _layout.tsx splash-hold). After this, getMemBibleSettings() is always synchronous. */
export async function loadBibleSettings(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    mem = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    mem = { ...DEFAULTS };
  }
}

/** Synchronous read — always returns the latest in-memory state. */
export function getMemBibleSettings(): BibleSettings {
  return mem ? { ...mem } : { ...DEFAULTS };
}

/** Merge-writes updates to both memory cache and AsyncStorage. */
export async function saveBibleSettings(updates: Partial<BibleSettings>): Promise<void> {
  mem = { ...(mem ?? DEFAULTS), ...updates };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(mem));
  } catch {}
}

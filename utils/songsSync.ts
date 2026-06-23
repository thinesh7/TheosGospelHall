import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from 'firebase/auth';
import { collection, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const INDEX_KEY = 'tgh_gk_songs_index';
const SONG_KEY_PREFIX = 'tgh_gk_song_';
const LAST_SYNC_KEY = 'tgh_gk_songs_last_sync';
const LEGACY_CACHE_PREFIX = 'tgh_gk_songs_cache';
const LEGACY_CLEANUP_DONE_KEY = 'tgh_gk_legacy_cleanup_done';

async function cleanupLegacyCache() {
  try {
    const alreadyDone = await AsyncStorage.getItem(LEGACY_CLEANUP_DONE_KEY);
    if (alreadyDone) return;

    const allKeys = await AsyncStorage.getAllKeys();
    const legacyKeys = allKeys.filter(k => k.startsWith(LEGACY_CACHE_PREFIX));
    if (legacyKeys.length > 0) {
      await AsyncStorage.multiRemove(legacyKeys);
    }
    await AsyncStorage.setItem(LEGACY_CLEANUP_DONE_KEY, '1');
  } catch (e) {}
}

export interface Song {
  songId: string;
  songNumber: number;
  title: string;
  lyrics: { tamil: string; english: string };
  lastModifiedTimestamp: number;
  version: number;
}

export interface SongIndexEntry {
  songId: string;
  songNumber: number;
  title: string;
  titleEnglish?: string;
}

const extractEnglishTitle = (englishLyrics: string): string => {
  const firstParagraph = englishLyrics.split('\n\n')[0]?.trim() || '';
  const firstLine = firstParagraph.split('\n')[0]?.trim() || '';
  return firstLine.replace(/^\d+\.\s*/, '');
};

export async function getSongsIndex(): Promise<SongIndexEntry[]> {
  try {
    const stored = await AsyncStorage.getItem(INDEX_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
}

export async function saveSongsIndexCache(index: SongIndexEntry[]) {
  await saveSongsIndex(index);
}

async function saveSongsIndex(index: SongIndexEntry[]) {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export async function getSongById(songId: string): Promise<Song | null> {
  try {
    const stored = await AsyncStorage.getItem(`${SONG_KEY_PREFIX}${songId}`);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (e) {
    return null;
  }
}

export async function getSongsByIds(songIds: string[]): Promise<Song[]> {
  try {
    const results = await Promise.all(
      songIds.map(id => AsyncStorage.getItem(`${SONG_KEY_PREFIX}${id}`))
    );
    return results
      .filter((s): s is string => !!s)
      .map(s => JSON.parse(s) as Song);
  } catch (e) {
    return [];
  }
}

export async function saveSongCache(song: Song) {
  await saveSong(song);
}

async function saveSong(song: Song) {
  await AsyncStorage.setItem(`${SONG_KEY_PREFIX}${song.songId}`, JSON.stringify(song));
}

async function saveSongsBatched(songs: Song[], batchSize = 50) {
  for (let i = 0; i < songs.length; i += batchSize) {
    const batch = songs.slice(i, i + batchSize);
    await Promise.all(batch.map(s => saveSong(s)));
  }
}

async function getLastSync(): Promise<number> {
  const stored = await AsyncStorage.getItem(LAST_SYNC_KEY);
  return stored ? parseInt(stored, 10) : 0;
}

async function setLastSync(timestamp: number) {
  await AsyncStorage.setItem(LAST_SYNC_KEY, String(timestamp));
}

export async function syncSongs(force: boolean = false): Promise<{ index: SongIndexEntry[]; updated: boolean }> {
  await cleanupLegacyCache();

  let existingIndex = await getSongsIndex();
  let lastSync = await getLastSync();

  if (existingIndex.length === 0 && lastSync > 0) {
    lastSync = 0;
    await setLastSync(0);
  }

  const effectiveLastSync = force ? 0 : lastSync;

  const needsBackfill = existingIndex.filter(e => !e.titleEnglish);
  let backfilled = false;
  if (needsBackfill.length > 0) {
    const backfillSongs = await getSongsByIds(needsBackfill.map(e => e.songId));
    const backfillMap = new Map(backfillSongs.map(s => [s.songId, s]));
    existingIndex = existingIndex.map(e => {
      if (e.titleEnglish) return e;
      const full = backfillMap.get(e.songId);
      if (full) {
        return { ...e, titleEnglish: extractEnglishTitle(full.lyrics.english) };
      }
      return e;
    });
    await saveSongsIndex(existingIndex);
    backfilled = true;
  }

  try {
    const q = effectiveLastSync > 0
      ? query(collection(db, 'GeethangalumKeerthanaigal'), where('lastModifiedTimestamp', '>', effectiveLastSync))
      : collection(db, 'GeethangalumKeerthanaigal');

    const snap = await getDocs(q);

    if (snap.empty && existingIndex.length > 0) {
      return { index: existingIndex, updated: backfilled };
    }

    const updatedSongs: Song[] = snap.docs.map(d => d.data() as Song);

    if (updatedSongs.length === 0) {
      return { index: existingIndex, updated: backfilled };
    }

    await saveSongsBatched(updatedSongs);

    const indexMap = new Map<string, SongIndexEntry>();
    existingIndex.forEach(e => indexMap.set(e.songId, e));
    updatedSongs.forEach(s => indexMap.set(s.songId, {
      songId: s.songId,
      songNumber: s.songNumber,
      title: s.title,
      titleEnglish: extractEnglishTitle(s.lyrics.english),
    }));

    const finalIndex = Array.from(indexMap.values()).sort((a, b) => a.songNumber - b.songNumber);

    await saveSongsIndex(finalIndex);

    const maxTimestamp = Math.max(...updatedSongs.map(s => s.lastModifiedTimestamp), lastSync);
    await setLastSync(maxTimestamp);

    return { index: finalIndex, updated: true };
  } catch (e) {
    return { index: existingIndex, updated: backfilled };
  }
}

export async function updateGeethangalumSong(
  songId: string,
  updates: { title?: string; lyrics?: { tamil: string; english: string } }
): Promise<void> {
  const q = query(collection(db, 'GeethangalumKeerthanaigal'), where('songId', '==', songId));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Song not found in Firestore');

  const docRef = snap.docs[0].ref;
  const now = Date.now();
  const lastModifiedBy = getAuth().currentUser?.email ?? 'unknown';
  await updateDoc(docRef, { ...updates, lastModifiedTimestamp: now, lastModifiedBy });

  const existing = await getSongById(songId);
  if (existing) {
    const merged: Song = { ...existing, ...updates, lastModifiedTimestamp: now };
    await saveSongCache(merged);

    const index = await getSongsIndex();
    const newIndex = index.map(e =>
      e.songId === songId
        ? { ...e, title: merged.title, titleEnglish: extractEnglishTitle(merged.lyrics.english) }
        : e
    );
    await saveSongsIndexCache(newIndex);
  }
}

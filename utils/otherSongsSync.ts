import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const INDEX_KEY = 'tgh_other_songs_index';
const SONG_KEY_PREFIX = 'tgh_other_song_';
const LAST_SYNC_KEY = 'tgh_other_songs_last_sync';
const FIRESTORE_COLLECTION = 'OtherSongs';

export interface OtherSong {
  songId: string;
  songNumber: number;
  title: string;
  lyrics: { tamil: string; english: string };
  lastModifiedTimestamp: number;
  version: number;
  isVisible?: boolean;
  titleEnglish?: string;
}

export interface OtherSongIndexEntry {
  songId: string;
  songNumber: number;
  title: string;
  titleEnglish?: string;
  isVisible?: boolean;
}

export const extractEnglishTitle = (englishLyrics: string): string => {
  const firstParagraph = englishLyrics.split('\n\n')[0]?.trim() || '';
  const firstLine = firstParagraph.split('\n')[0]?.trim() || '';
  return firstLine.replace(/^\d+\.\s*/, '');
};

export async function getOtherSongsIndex(): Promise<OtherSongIndexEntry[]> {
  try {
    const stored = await AsyncStorage.getItem(INDEX_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
}

export async function saveOtherSongsIndexCache(index: OtherSongIndexEntry[]) {
  await saveOtherSongsIndex(index);
}

async function saveOtherSongsIndex(index: OtherSongIndexEntry[]) {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export async function getOtherSongById(songId: string): Promise<OtherSong | null> {
  try {
    const stored = await AsyncStorage.getItem(`${SONG_KEY_PREFIX}${songId}`);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (e) {
    return null;
  }
}

export async function getOtherSongsByIds(songIds: string[]): Promise<OtherSong[]> {
  try {
    const results = await Promise.all(
      songIds.map(id => AsyncStorage.getItem(`${SONG_KEY_PREFIX}${id}`))
    );
    return results
      .filter((s): s is string => !!s)
      .map(s => JSON.parse(s) as OtherSong);
  } catch (e) {
    return [];
  }
}

export async function saveOtherSongCache(song: OtherSong) {
  await saveOtherSong(song);
}

async function saveOtherSong(song: OtherSong) {
  await AsyncStorage.setItem(`${SONG_KEY_PREFIX}${song.songId}`, JSON.stringify(song));
}

async function saveOtherSongsBatched(songs: OtherSong[], batchSize = 50) {
  for (let i = 0; i < songs.length; i += batchSize) {
    const batch = songs.slice(i, i + batchSize);
    await Promise.all(batch.map(s => saveOtherSong(s)));
  }
}

async function getLastSync(): Promise<number> {
  const stored = await AsyncStorage.getItem(LAST_SYNC_KEY);
  return stored ? parseInt(stored, 10) : 0;
}

async function setLastSync(timestamp: number) {
  await AsyncStorage.setItem(LAST_SYNC_KEY, String(timestamp));
}

export async function syncOtherSongs(force: boolean = false): Promise<{ index: OtherSongIndexEntry[]; updated: boolean }> {
  let existingIndex = await getOtherSongsIndex();
  let lastSync = await getLastSync();

  if (existingIndex.length === 0 && lastSync > 0) {
    lastSync = 0;
    await setLastSync(0);
  }

  const effectiveLastSync = force ? 0 : lastSync;

  const needsBackfill = existingIndex.filter(e => !e.titleEnglish);
  let backfilled = false;
  if (needsBackfill.length > 0) {
    const backfillSongs = await getOtherSongsByIds(needsBackfill.map(e => e.songId));
    const backfillMap = new Map(backfillSongs.map(s => [s.songId, s]));
    existingIndex = existingIndex.map(e => {
      if (e.titleEnglish) return e;
      const full = backfillMap.get(e.songId);
      if (full) {
        return { ...e, titleEnglish: extractEnglishTitle(full.lyrics.english) };
      }
      return e;
    });
    await saveOtherSongsIndex(existingIndex);
    backfilled = true;
  }

  try {
    const q = effectiveLastSync > 0
      ? query(collection(db, FIRESTORE_COLLECTION), where('lastModifiedTimestamp', '>', effectiveLastSync))
      : collection(db, FIRESTORE_COLLECTION);

    const snap = await getDocs(q);

    if (snap.empty && existingIndex.length > 0) {
      return { index: existingIndex, updated: backfilled };
    }

    const updatedSongs: OtherSong[] = snap.docs.map(d => d.data() as OtherSong);

    if (updatedSongs.length === 0) {
      return { index: existingIndex, updated: backfilled };
    }

    await saveOtherSongsBatched(updatedSongs);

    const indexMap = new Map<string, OtherSongIndexEntry>();
    existingIndex.forEach(e => indexMap.set(e.songId, e));
    updatedSongs.forEach(s => indexMap.set(s.songId, {
      songId: s.songId,
      songNumber: s.songNumber,
      title: s.title,
      titleEnglish: s.titleEnglish || extractEnglishTitle(s.lyrics.english),
      isVisible: s.isVisible !== false,
    }));

    const finalIndex = Array.from(indexMap.values()).sort((a, b) => a.songNumber - b.songNumber);

    await saveOtherSongsIndex(finalIndex);

    const maxTimestamp = Math.max(...updatedSongs.map(s => s.lastModifiedTimestamp), lastSync);
    await setLastSync(maxTimestamp);

    return { index: finalIndex, updated: true };
  } catch (e) {
    return { index: existingIndex, updated: backfilled };
  }
}

export async function getNextOtherSongNumber(): Promise<number> {
  const index = await getOtherSongsIndex();
  if (index.length === 0) return 1;
  return Math.max(...index.map(s => s.songNumber)) + 1;
}

export async function addOtherSong(data: {
  title: string;
  lyrics: { tamil: string; english: string };
  isVisible: boolean;
  titleEnglish: string;
}): Promise<OtherSong> {
  const ref = doc(collection(db, FIRESTORE_COLLECTION));
  const songNumber = await getNextOtherSongNumber();
  const now = Date.now();

  const strippedTitle = data.title.replace(/^\d+\.\s*/, '').trim();
  const finalTitle = `${songNumber}. ${strippedTitle}`;

  const song: OtherSong = {
    songId: ref.id,
    songNumber,
    title: finalTitle,
    lyrics: data.lyrics,
    lastModifiedTimestamp: now,
    version: 1,
    isVisible: data.isVisible,
    titleEnglish: data.titleEnglish,
  };

  await setDoc(ref, song);
  await saveOtherSongCache(song);

  const index = await getOtherSongsIndex();
  const entry: OtherSongIndexEntry = {
    songId: song.songId,
    songNumber: song.songNumber,
    title: song.title,
    titleEnglish: song.titleEnglish,
    isVisible: song.isVisible,
  };
  const updatedIndex = [...index, entry].sort((a, b) => a.songNumber - b.songNumber);
  await saveOtherSongsIndexCache(updatedIndex);

  return song;
}

export async function updateOtherSong(
  songId: string,
  updates: { title?: string; lyrics?: { tamil: string; english: string }; titleEnglish?: string }
): Promise<void> {
  const existing = await getOtherSongById(songId);
  if (!existing) return;

  const ref = doc(db, FIRESTORE_COLLECTION, songId);
  const now = Date.now();

  const finalUpdates: Partial<OtherSong> = { ...updates, lastModifiedTimestamp: now };

  if (updates.title !== undefined) {
    const stripped = updates.title.replace(/^\d+\.\s*/, '').trim();
    finalUpdates.title = `${existing.songNumber}. ${stripped}`;
  }

  await updateDoc(ref, finalUpdates as any);

  const merged: OtherSong = { ...existing, ...finalUpdates };
  await saveOtherSongCache(merged);

  const index = await getOtherSongsIndex();
  const newIndex = index.map(e =>
    e.songId === songId
      ? { ...e, title: merged.title, titleEnglish: merged.titleEnglish }
      : e
  );
  await saveOtherSongsIndexCache(newIndex);
}

export async function setOtherSongVisibility(songId: string, isVisible: boolean): Promise<void> {
  const ref = doc(db, FIRESTORE_COLLECTION, songId);
  await updateDoc(ref, { isVisible, lastModifiedTimestamp: Date.now() });

  const existing = await getOtherSongById(songId);
  if (existing) {
    await saveOtherSongCache({ ...existing, isVisible });
  }

  const index = await getOtherSongsIndex();
  const newIndex = index.map(e => (e.songId === songId ? { ...e, isVisible } : e));
  await saveOtherSongsIndexCache(newIndex);
}

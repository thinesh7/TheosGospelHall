import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDoc, collection, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const CACHE_KEY = 'tgh_live_playlists_cache';
const FIRESTORE_COLLECTION = 'LivePlaylists';

export interface LivePlaylist {
  id: string;
  playlistId: string;
  label: string;
  isActive: boolean;
  createdAt: number;
}

export async function getCachedLivePlaylists(): Promise<LivePlaylist[]> {
  try {
    const stored = await AsyncStorage.getItem(CACHE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
}

async function saveCachedLivePlaylists(list: LivePlaylist[]) {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(list));
}

// checkCurrentlyLive() (on every app launch) and the Videos screen's Live tab
// independently call this on their own schedules, often within seconds of
// each other — a short TTL lets the second call reuse the first's Firestore
// read instead of repeating it. Writers below always pass force=true so an
// admin edit is reflected immediately rather than serving stale data.
const SYNC_TTL_MS = 60 * 1000;
let lastSync: { ts: number; data: LivePlaylist[] } | null = null;

export async function syncLivePlaylists(force = false): Promise<LivePlaylist[]> {
  if (!force && lastSync && Date.now() - lastSync.ts < SYNC_TTL_MS) {
    return lastSync.data;
  }
  try {
    const snap = await getDocs(collection(db, FIRESTORE_COLLECTION));
    const list: LivePlaylist[] = snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as Omit<LivePlaylist, 'id'>),
    }));
    list.sort((a, b) => a.createdAt - b.createdAt);
    lastSync = { ts: Date.now(), data: list };
    await saveCachedLivePlaylists(list);
    return list;
  } catch (e) {
    return getCachedLivePlaylists();
  }
}

export async function addLivePlaylist(data: {
  playlistId: string;
  label: string;
  isActive: boolean;
  createdBy?: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, FIRESTORE_COLLECTION), {
    playlistId: data.playlistId.trim(),
    label: data.label.trim(),
    isActive: data.isActive,
    createdAt: Date.now(),
    ...(data.createdBy ? { createdBy: data.createdBy, modifiedBy: data.createdBy, modifiedAt: serverTimestamp() } : {}),
  });
  await syncLivePlaylists(true);
  return ref.id;
}

export async function updateLivePlaylist(
  id: string,
  updates: { playlistId?: string; label?: string; isActive?: boolean; modifiedBy?: string }
): Promise<void> {
  const { modifiedBy, ...fields } = updates;
  const ref = doc(db, FIRESTORE_COLLECTION, id);
  await updateDoc(ref, { ...fields, ...(modifiedBy ? { modifiedBy, modifiedAt: serverTimestamp() } : {}) });
  await syncLivePlaylists(true);
}

export async function setLivePlaylistActive(id: string, isActive: boolean): Promise<void> {
  const ref = doc(db, FIRESTORE_COLLECTION, id);
  await updateDoc(ref, { isActive });
  await syncLivePlaylists(true);
}

export async function deleteLivePlaylist(id: string): Promise<void> {
  const { deleteDoc } = await import('firebase/firestore');
  const ref = doc(db, FIRESTORE_COLLECTION, id);
  await deleteDoc(ref);
  await syncLivePlaylists(true);
}

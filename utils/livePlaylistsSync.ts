import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDoc, collection, doc, getDocs, updateDoc } from 'firebase/firestore';
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

export async function syncLivePlaylists(): Promise<LivePlaylist[]> {
  try {
    const snap = await getDocs(collection(db, FIRESTORE_COLLECTION));
    const list: LivePlaylist[] = snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as Omit<LivePlaylist, 'id'>),
    }));
    list.sort((a, b) => a.createdAt - b.createdAt);
    await saveCachedLivePlaylists(list);
    return list;
  } catch (e) {
    return getCachedLivePlaylists();
  }
}

export async function addLivePlaylist(data: { playlistId: string; label: string; isActive: boolean }): Promise<void> {
  await addDoc(collection(db, FIRESTORE_COLLECTION), {
    playlistId: data.playlistId.trim(),
    label: data.label.trim(),
    isActive: data.isActive,
    createdAt: Date.now(),
  });
  await syncLivePlaylists();
}

export async function updateLivePlaylist(
  id: string,
  updates: { playlistId?: string; label?: string }
): Promise<void> {
  const ref = doc(db, FIRESTORE_COLLECTION, id);
  await updateDoc(ref, { ...updates });
  await syncLivePlaylists();
}

export async function setLivePlaylistActive(id: string, isActive: boolean): Promise<void> {
  const ref = doc(db, FIRESTORE_COLLECTION, id);
  await updateDoc(ref, { isActive });
  await syncLivePlaylists();
}

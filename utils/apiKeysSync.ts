import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDoc, collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const CACHE_KEY = 'tgh_backup_api_keys_cache';
const FIRESTORE_COLLECTION = 'YoutubeApiKeys';

export interface BackupApiKey {
  id: string;
  key: string;
  label: string;
  isActive: boolean;
  order: number;
  createdAt: number;
}

export async function getCachedApiKeys(): Promise<BackupApiKey[]> {
  try {
    const stored = await AsyncStorage.getItem(CACHE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
}

async function saveCachedApiKeys(list: BackupApiKey[]) {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(list));
}

export async function syncApiKeys(): Promise<BackupApiKey[]> {
  try {
    const snap = await getDocs(collection(db, FIRESTORE_COLLECTION));
    const list: BackupApiKey[] = snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as Omit<BackupApiKey, 'id'>),
    }));
    list.sort((a, b) => a.order - b.order);
    await saveCachedApiKeys(list);
    return list;
  } catch (e) {
    return getCachedApiKeys();
  }
}

export async function addApiKey(data: { key: string; label: string; isActive: boolean; order: number }): Promise<string> {
  const ref = await addDoc(collection(db, FIRESTORE_COLLECTION), {
    key: data.key.trim(),
    label: data.label.trim(),
    isActive: data.isActive,
    order: data.order,
    createdAt: Date.now(),
  });
  await syncApiKeys();
  return ref.id;
}

export async function updateApiKey(
  id: string,
  updates: { key?: string; label?: string; isActive?: boolean; order?: number }
): Promise<void> {
  const ref = doc(db, FIRESTORE_COLLECTION, id);
  await updateDoc(ref, { ...updates });
  await syncApiKeys();
}

export async function setApiKeyActive(id: string, isActive: boolean): Promise<void> {
  const ref = doc(db, FIRESTORE_COLLECTION, id);
  await updateDoc(ref, { isActive });
  await syncApiKeys();
}

export async function deleteApiKey(id: string): Promise<void> {
  const { deleteDoc } = await import('firebase/firestore');
  const ref = doc(db, FIRESTORE_COLLECTION, id);
  await deleteDoc(ref);
  await syncApiKeys();
}

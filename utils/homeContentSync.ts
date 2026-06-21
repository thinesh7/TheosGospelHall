import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const CACHE_KEY = 'tgh_home_content';
const DOC_PATH = ['HomeContent', 'main'] as const;

export interface HomeContent {
  pastorPhotoUrl: string;
  pastorName: string;
  pastorDesignation: string;
  aboutPastorEnglish: string;
  aboutPastorTamil: string;
  aboutMinistryEnglish: string;
  aboutMinistryTamil: string;
  lastModifiedTimestamp: number;
}

export const EMPTY_HOME_CONTENT: HomeContent = {
  pastorPhotoUrl: '',
  pastorName: '',
  pastorDesignation: '',
  aboutPastorEnglish: '',
  aboutPastorTamil: '',
  aboutMinistryEnglish: '',
  aboutMinistryTamil: '',
  lastModifiedTimestamp: 0,
};

let memoryCache: HomeContent | null = null;

export function getMemoryCachedHomeContent(): HomeContent | null {
  return memoryCache;
}

export async function getCachedHomeContent(): Promise<HomeContent | null> {
  try {
    const stored = await AsyncStorage.getItem(CACHE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    memoryCache = parsed;
    return parsed;
  } catch (e) {
    return null;
  }
}

async function saveCachedHomeContent(content: HomeContent) {
  memoryCache = content;
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(content));
}

export function subscribeHomeContent(onUpdate: (content: HomeContent) => void): () => void {
  const ref = doc(db, ...DOC_PATH);
  const unsubscribe = onSnapshot(ref, snap => {
    if (snap.exists()) {
      const content = { ...EMPTY_HOME_CONTENT, ...(snap.data() as Partial<HomeContent>) };
      onUpdate(content);
      saveCachedHomeContent(content).catch(() => {});
    } else {
      onUpdate(EMPTY_HOME_CONTENT);
    }
  }, () => {});
  return unsubscribe;
}

export async function updateHomeContent(data: Omit<HomeContent, 'lastModifiedTimestamp'>): Promise<void> {
  const ref = doc(db, ...DOC_PATH);
  await setDoc(ref, { ...data, lastModifiedTimestamp: Date.now() }, { merge: true });
}

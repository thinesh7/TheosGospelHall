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

// index.tsx, contact.tsx, and the admin Home Content screen each subscribe
// independently, and the tab shell keeps Home/Contact mounted simultaneously
// — without ref-counting that's 2-3 concurrent onSnapshot listeners on the
// same doc for the app's whole foreground lifetime. Instead, keep exactly one
// real Firestore listener alive per process and fan its updates out to every
// subscriber; the public subscribe/unsubscribe contract is unchanged.
type HomeContentListener = (content: HomeContent) => void;

const listeners = new Set<HomeContentListener>();
let unsubscribeFirestore: (() => void) | null = null;
let lastSnapshotContent: HomeContent | null = null;

function ensureFirestoreListener() {
  if (unsubscribeFirestore) return;
  const ref = doc(db, ...DOC_PATH);
  unsubscribeFirestore = onSnapshot(ref, snap => {
    let content: HomeContent | null = null;
    if (snap.exists()) {
      content = { ...EMPTY_HOME_CONTENT, ...(snap.data() as Partial<HomeContent>) };
      saveCachedHomeContent(content).catch(() => {});
    } else if (!snap.metadata.fromCache) {
      content = EMPTY_HOME_CONTENT;
    }
    if (content) {
      lastSnapshotContent = content;
      listeners.forEach(listener => listener(content as HomeContent));
    }
  }, () => {});
}

export function subscribeHomeContent(onUpdate: HomeContentListener): () => void {
  listeners.add(onUpdate);
  ensureFirestoreListener();
  // Deliver the last known value to a newly-joined subscriber without
  // waiting for the next Firestore event — deferred to a microtask (never
  // synchronous) so it behaves like a real onSnapshot callback for callers
  // that build their unsubscribe-handle closure right after this call.
  if (lastSnapshotContent) {
    const snapshot = lastSnapshotContent;
    Promise.resolve().then(() => {
      if (listeners.has(onUpdate)) onUpdate(snapshot);
    });
  }
  return () => {
    listeners.delete(onUpdate);
    if (listeners.size === 0 && unsubscribeFirestore) {
      unsubscribeFirestore();
      unsubscribeFirestore = null;
      lastSnapshotContent = null;
    }
  };
}

export function fetchHomeContentOnce(): Promise<HomeContent | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsub();
      resolve(memoryCache);
    }, 6000);
    const unsub = subscribeHomeContent((content) => {
      clearTimeout(timer);
      unsub();
      resolve(content);
    });
  });
}

export async function updateHomeContent(data: Omit<HomeContent, 'lastModifiedTimestamp'>): Promise<void> {
  const ref = doc(db, ...DOC_PATH);
  await setDoc(ref, { ...data, lastModifiedTimestamp: Date.now() }, { merge: true });
}

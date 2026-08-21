import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { COLLECTIONS } from './testMode';

export type NotificationSource = 'admin' | 'special_meeting' | 'app_update';
export type NotificationCategory = 'bible_study' | 'prayer_meeting' | 'youth_meeting' | 'others';

export interface NotificationItem {
  id: string;
  message: string;
  link: string | null;
  source: NotificationSource;
  category: NotificationCategory | null;
  createdAt: number;
}

const CACHE_KEY = 'tgh_notifications_cache';
const READ_IDS_KEY = 'tgh_notification_read_ids';
const LIST_LIMIT = 100;

let memoryCache: NotificationItem[] = [];

export function getMemoryCachedNotifications(): NotificationItem[] {
  return memoryCache;
}

export async function getCachedNotifications(): Promise<NotificationItem[]> {
  try {
    const stored = await AsyncStorage.getItem(CACHE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    memoryCache = parsed;
    return parsed;
  } catch {
    return [];
  }
}

async function saveCachedNotifications(items: NotificationItem[]) {
  memoryCache = items;
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(items)).catch(() => {});
}

export function subscribeNotifications(onUpdate: (items: NotificationItem[]) => void): () => void {
  const q = query(collection(db, COLLECTIONS.notifications), orderBy('createdAt', 'desc'), limit(LIST_LIMIT));
  const unsubscribe = onSnapshot(q, snap => {
    const items: NotificationItem[] = snap.docs.map(d => {
      const data = d.data() as any;
      return {
        id: d.id,
        message: data.message ?? '',
        link: data.link ?? null,
        source: data.source ?? 'admin',
        category: data.category ?? null,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now(),
      };
    });
    onUpdate(items);
    saveCachedNotifications(items).catch(() => {});
  }, () => {});
  return unsubscribe;
}

export async function addNotification(input: {
  message: string;
  link?: string | null;
  source: NotificationSource;
  category?: NotificationCategory | null;
}): Promise<void> {
  await addDoc(collection(db, COLLECTIONS.notifications), {
    message: input.message.trim(),
    link: (input.link ?? '').trim() || null,
    source: input.source,
    category: input.category ?? null,
    createdAt: serverTimestamp(),
  });
}

// --- read/unread state (per-device, mirrors the AsyncStorage caching pattern
// used elsewhere in the app, e.g. homeContentSync.ts) ---

let memoryReadIds: Set<string> | null = null;
const readIdsListeners = new Set<(ids: Set<string>) => void>();

export async function getReadIds(): Promise<Set<string>> {
  if (memoryReadIds) return memoryReadIds;
  try {
    const stored = await AsyncStorage.getItem(READ_IDS_KEY);
    memoryReadIds = new Set(stored ? JSON.parse(stored) : []);
  } catch {
    memoryReadIds = new Set();
  }
  return memoryReadIds;
}

export function getMemoryReadIds(): Set<string> {
  return memoryReadIds ?? new Set();
}

// The bell (Home) and the Notification Center list mount independently, so a
// read marked in one place needs to reach the other without either of them
// depending on navigation focus events — a tiny in-memory pub-sub does that.
export function subscribeReadIds(listener: (ids: Set<string>) => void): () => void {
  readIdsListeners.add(listener);
  getReadIds().then(listener);
  return () => {
    readIdsListeners.delete(listener);
  };
}

export async function markNotificationRead(id: string): Promise<void> {
  const current = await getReadIds();
  if (current.has(id)) return;
  // A fresh Set (not a mutated one) matters here: listeners feed this
  // straight into React state via setReadIds(), and useState bails out of
  // re-rendering when the new value is reference-equal to the old one.
  const next = new Set(current);
  next.add(id);
  memoryReadIds = next;
  await AsyncStorage.setItem(READ_IDS_KEY, JSON.stringify(Array.from(next))).catch(() => {});
  readIdsListeners.forEach(l => l(next));
}

// Marking read this way (not per-tap) is what the Notification Center calls
// as soon as it has a list to show, so simply opening the screen clears the
// Home bell's badge — no "Mark All as Read" button needed.
export async function markAllRead(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const current = await getReadIds();
  const next = new Set(current);
  let changed = false;
  for (const id of ids) {
    if (!next.has(id)) {
      next.add(id);
      changed = true;
    }
  }
  if (!changed) return;
  memoryReadIds = next;
  await AsyncStorage.setItem(READ_IDS_KEY, JSON.stringify(Array.from(next))).catch(() => {});
  readIdsListeners.forEach(l => l(next));
}

export function getUnreadCount(items: NotificationItem[], readIds: Set<string>): number {
  return items.filter(n => !readIds.has(n.id)).length;
}

export type NotificationGroupTitle = 'Today' | 'Yesterday' | 'Earlier';

export function groupNotifications(
  items: NotificationItem[]
): { title: NotificationGroupTitle; data: NotificationItem[] }[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

  const today: NotificationItem[] = [];
  const yesterday: NotificationItem[] = [];
  const earlier: NotificationItem[] = [];

  for (const item of items) {
    if (item.createdAt >= startOfToday) today.push(item);
    else if (item.createdAt >= startOfYesterday) yesterday.push(item);
    else earlier.push(item);
  }

  const groups: { title: NotificationGroupTitle; data: NotificationItem[] }[] = [];
  if (today.length) groups.push({ title: 'Today', data: today });
  if (yesterday.length) groups.push({ title: 'Yesterday', data: yesterday });
  if (earlier.length) groups.push({ title: 'Earlier', data: earlier });
  return groups;
}

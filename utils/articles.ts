import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentData,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  QuerySnapshot,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

const COLLECTION = 'TGHArticles';
const CATEGORIES_COLLECTION = 'TGHArticleCategories';
const INDEX_CACHE_KEY = 'tgh_articles_published_index';
const ARTICLE_CACHE_PREFIX = 'tgh_article_';
const CATEGORIES_CACHE_KEY = 'tgh_article_categories';
const LAST_SYNC_KEY = 'tgh_articles_last_sync';

export type ArticleStatus = 'draft' | 'published';

// Categories used to be this fixed list; they're now admin-managed via
// subscribeCategories()/addCategory()/etc below. Kept only as the one-time
// seed so existing installs (and this list of categories) don't change.
const DEFAULT_CATEGORIES = ['Faith', 'Bible Study', 'Christian Living', 'Inspiration'];

// The category assigned to an article. Stored as a plain string (not a literal union) since
// the set of categories is now admin-editable — legacy articles or articles whose category
// was later deleted just won't match any current filter chip.
export interface ArticleCategoryEntry {
  id: string;
  name: string;
  order: number;
}

export interface ArticleIndexEntry {
  id: string;
  title: string;
  subtitle: string;
  author: string;
  category: string;
  status: ArticleStatus;
  order: number;
  updatedAt: number;
  publishedAt: number | null;
}

export interface Article extends ArticleIndexEntry {
  bodyMarkdown: string;
}

export interface ArticleInput {
  title: string;
  subtitle: string;
  author: string;
  category: string;
  status: ArticleStatus;
  bodyMarkdown: string;
}

const toMillis = (v: unknown): number => {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === 'number') return v;
  return 0;
};

function docToArticle(id: string, data: DocumentData): Article {
  return {
    id,
    title: data.title ?? '',
    subtitle: data.subtitle ?? '',
    author: data.author ?? '',
    category: typeof data.category === 'string' ? data.category : '',
    status: data.status === 'published' ? 'published' : 'draft',
    // Articles created before ordering existed have no `order` field —
    // send them to the end of the list rather than the front until an
    // admin explicitly arranges them (see sortArticles()).
    order: typeof data.order === 'number' ? data.order : Number.MAX_SAFE_INTEGER,
    updatedAt: toMillis(data.updatedAt),
    publishedAt: data.publishedAt ? toMillis(data.publishedAt) : null,
    bodyMarkdown: data.bodyMarkdown ?? '',
  };
}

function toIndexEntry(article: Article): ArticleIndexEntry {
  const { bodyMarkdown, ...rest } = article;
  return rest;
}

// Admin-set `order` always wins; ties (including the legacy "no order yet"
// fallback above) fall back to most-recently-published/edited first.
function sortArticles<T extends { order: number; updatedAt: number; publishedAt: number | null }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.order - b.order || (b.publishedAt ?? b.updatedAt) - (a.publishedAt ?? a.updatedAt));
}

function docToCategory(id: string, data: DocumentData): ArticleCategoryEntry {
  return {
    id,
    name: typeof data.name === 'string' ? data.name : '',
    order: typeof data.order === 'number' ? data.order : Number.MAX_SAFE_INTEGER,
  };
}

async function saveCategoriesCache(list: ArticleCategoryEntry[]) {
  try {
    await AsyncStorage.setItem(CATEGORIES_CACHE_KEY, JSON.stringify(list));
  } catch {}
}

export async function getCachedCategories(): Promise<ArticleCategoryEntry[]> {
  try {
    const stored = await AsyncStorage.getItem(CATEGORIES_CACHE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// One-time, best-effort seed so existing installs keep the same four
// categories articles already used, now as real editable documents instead
// of a hardcoded list. Only runs once per app session and only if the
// collection is genuinely empty — never overwrites admin edits/deletions.
let seedAttempted = false;
async function seedDefaultCategoriesIfEmpty() {
  if (seedAttempted) return;
  seedAttempted = true;
  try {
    const snap = await getDocs(collection(db, CATEGORIES_COLLECTION));
    if (!snap.empty) return;
    const batch = writeBatch(db);
    DEFAULT_CATEGORIES.forEach((name, index) => {
      const ref = doc(collection(db, CATEGORIES_COLLECTION));
      batch.set(ref, { name, order: index });
    });
    await batch.commit();
  } catch {}
}

export function subscribeCategories(cb: (categories: ArticleCategoryEntry[]) => void): () => void {
  seedDefaultCategoriesIfEmpty();
  const q = query(collection(db, CATEGORIES_COLLECTION));
  return onSnapshot(q, (snap: QuerySnapshot) => {
    const list = snap.docs
      .map(d => docToCategory(d.id, d.data()))
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    cb(list);
    saveCategoriesCache(list);
  }, () => {});
}

export async function addCategory(name: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Category name is required.');
  const snap = await getDocs(collection(db, CATEGORIES_COLLECTION));
  const orders = snap.docs.map(d => (typeof d.data().order === 'number' ? d.data().order : 0) as number);
  const nextOrder = orders.length > 0 ? Math.max(...orders) + 1 : 0;
  const ref = await addDoc(collection(db, CATEGORIES_COLLECTION), { name: trimmed, order: nextOrder });
  return ref.id;
}

export async function renameCategory(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Category name is required.');
  await updateDoc(doc(db, CATEGORIES_COLLECTION, id), { name: trimmed });
}

export async function deleteCategory(id: string): Promise<void> {
  await deleteDoc(doc(db, CATEGORIES_COLLECTION, id));
}

async function saveIndexCache(list: ArticleIndexEntry[]) {
  try {
    await AsyncStorage.setItem(INDEX_CACHE_KEY, JSON.stringify(list));
  } catch {}
}

async function saveArticleCache(article: Article) {
  try {
    await AsyncStorage.setItem(`${ARTICLE_CACHE_PREFIX}${article.id}`, JSON.stringify(article));
  } catch {}
}

export async function getArticlesIndex(): Promise<ArticleIndexEntry[]> {
  try {
    const stored = await AsyncStorage.getItem(INDEX_CACHE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export async function getCachedArticle(id: string): Promise<Article | null> {
  try {
    const stored = await AsyncStorage.getItem(`${ARTICLE_CACHE_PREFIX}${id}`);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

// Admin: every article regardless of status, in the admin-controlled order.
// No Firestore orderBy — sorting client-side (via sortArticles) means legacy
// docs missing `order` still show up instead of being silently excluded by
// a server-side orderBy on a field they don't have.
export function subscribeArticles(cb: (articles: Article[]) => void): () => void {
  const q = query(collection(db, COLLECTION));
  return onSnapshot(q, (snap: QuerySnapshot) => {
    cb(sortArticles(snap.docs.map(d => docToArticle(d.id, d.data()))));
  }, () => {});
}

async function getLastSync(): Promise<number> {
  try {
    const stored = await AsyncStorage.getItem(LAST_SYNC_KEY);
    return stored ? parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
}

async function setLastSync(timestamp: number) {
  try {
    await AsyncStorage.setItem(LAST_SYNC_KEY, String(timestamp));
  } catch {}
}

// Users: published articles only, in the same admin-controlled order. Mirrors
// utils/songsSync.ts's syncSongs() — cache-first, with an explicit sync
// (called on mount + pull-to-refresh in ArticlesScreen) instead of a
// permanently-open onSnapshot listener, and incremental after the first
// sync so only articles changed since `lastSync` get re-fetched.
//
// The incremental branch needs a Firestore composite index on
// (status ASC, updatedAt ASC) — see firestore.indexes.json — because unlike
// Songs' fully-public collection, TGHArticles' security rule restricts
// non-admin reads to `status == 'published'`, so a query combining that
// equality filter with the `updatedAt >` range filter can't run without one.
// Until that index is deployed on the live project this branch throws and
// falls back to the cached index (see catch below) — nothing breaks, sync
// just stays on full refreshes until then.
export async function syncArticles(force: boolean = false): Promise<{ index: ArticleIndexEntry[]; updated: boolean }> {
  const existingIndex = await getArticlesIndex();
  let lastSync = await getLastSync();

  if (existingIndex.length === 0 && lastSync > 0) {
    lastSync = 0;
    await setLastSync(0);
  }

  const effectiveLastSync = force ? 0 : lastSync;
  const isFullSync = effectiveLastSync === 0;

  try {
    const q = isFullSync
      ? query(collection(db, COLLECTION), where('status', '==', 'published'))
      : query(
          collection(db, COLLECTION),
          where('status', '==', 'published'),
          where('updatedAt', '>', Timestamp.fromMillis(effectiveLastSync)),
        );

    const snap = await getDocs(q);

    if (snap.empty) {
      // A full sync returning zero published articles is a real "nothing
      // published" state — clear the stale cached index instead of leaving
      // deleted/unpublished ghosts behind. An incremental sync returning
      // zero just means nothing changed since last time.
      if (isFullSync && existingIndex.length > 0) {
        await saveIndexCache([]);
        return { index: [], updated: true };
      }
      return { index: existingIndex, updated: false };
    }

    const changedArticles = sortArticles(snap.docs.map(d => docToArticle(d.id, d.data())));
    await Promise.all(changedArticles.map(saveArticleCache));

    let finalIndex: ArticleIndexEntry[];
    if (isFullSync) {
      // The full-sync query's result *is* the complete current published
      // set, so replace the cache outright — this is what drops entries for
      // articles unpublished or deleted since the last sync, which the
      // incremental (merge-only) branch below has no way to detect.
      finalIndex = changedArticles.map(toIndexEntry);
    } else {
      const indexMap = new Map<string, ArticleIndexEntry>();
      existingIndex.forEach(e => indexMap.set(e.id, e));
      changedArticles.forEach(a => indexMap.set(a.id, toIndexEntry(a)));
      finalIndex = sortArticles(Array.from(indexMap.values()));
    }
    await saveIndexCache(finalIndex);

    const maxTimestamp = Math.max(...changedArticles.map(a => a.updatedAt), lastSync);
    await setLastSync(maxTimestamp);

    return { index: finalIndex, updated: true };
  } catch {
    return { index: existingIndex, updated: false };
  }
}

export async function getArticle(id: string): Promise<Article | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  const article = docToArticle(snap.id, snap.data());
  await saveArticleCache(article);
  return article;
}

export async function addArticle(input: ArticleInput, order: number): Promise<string> {
  const currentUser = getAuth().currentUser?.email ?? 'unknown';
  const ref = await addDoc(collection(db, COLLECTION), {
    ...input,
    order,
    createdBy: currentUser,
    createdAt: serverTimestamp(),
    updatedBy: currentUser,
    updatedAt: serverTimestamp(),
    publishedAt: input.status === 'published' ? serverTimestamp() : null,
  });
  return ref.id;
}

// Persists a full reorder in one atomic write — `orderedIds` is the complete
// list in its new display order, and each article's `order` becomes its
// index in that list (0 = shown first).
export async function reorderArticles(orderedIds: string[]): Promise<void> {
  const currentUser = getAuth().currentUser?.email ?? 'unknown';
  const batch = writeBatch(db);
  orderedIds.forEach((id, index) => {
    batch.update(doc(db, COLLECTION, id), {
      order: index,
      updatedBy: currentUser,
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function updateArticle(id: string, input: ArticleInput, previousStatus: ArticleStatus): Promise<void> {
  const currentUser = getAuth().currentUser?.email ?? 'unknown';
  const becamePublished = input.status === 'published' && previousStatus !== 'published';
  await updateDoc(doc(db, COLLECTION, id), {
    ...input,
    updatedBy: currentUser,
    updatedAt: serverTimestamp(),
    ...(becamePublished ? { publishedAt: serverTimestamp() } : {}),
  });
}

export async function deleteArticle(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
  try {
    await AsyncStorage.removeItem(`${ARTICLE_CACHE_PREFIX}${id}`);
  } catch {}
}

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

// Users: published articles only, in the same admin-controlled order.
export function subscribePublishedArticles(cb: (articles: ArticleIndexEntry[]) => void): () => void {
  const q = query(collection(db, COLLECTION), where('status', '==', 'published'));
  return onSnapshot(q, (snap: QuerySnapshot) => {
    const articles = sortArticles(snap.docs.map(d => docToArticle(d.id, d.data())));
    const index = articles.map(toIndexEntry);
    cb(index);
    saveIndexCache(index);
    articles.forEach(saveArticleCache);
  }, () => {});
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

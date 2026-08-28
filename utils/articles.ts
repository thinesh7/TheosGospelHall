import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentData,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  QuerySnapshot,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

const COLLECTION = 'TGHArticles';
const INDEX_CACHE_KEY = 'tgh_articles_published_index';
const ARTICLE_CACHE_PREFIX = 'tgh_article_';

export type ArticleStatus = 'draft' | 'published';

export interface ArticleIndexEntry {
  id: string;
  title: string;
  subtitle: string;
  author: string;
  status: ArticleStatus;
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
    status: data.status === 'published' ? 'published' : 'draft',
    updatedAt: toMillis(data.updatedAt),
    publishedAt: data.publishedAt ? toMillis(data.publishedAt) : null,
    bodyMarkdown: data.bodyMarkdown ?? '',
  };
}

function toIndexEntry(article: Article): ArticleIndexEntry {
  const { bodyMarkdown, ...rest } = article;
  return rest;
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

// Admin: every article regardless of status, newest edit first.
// Single-field orderBy only — no composite Firestore index required.
export function subscribeArticles(cb: (articles: Article[]) => void): () => void {
  const q = query(collection(db, COLLECTION), orderBy('updatedAt', 'desc'));
  return onSnapshot(q, (snap: QuerySnapshot) => {
    cb(snap.docs.map(d => docToArticle(d.id, d.data())));
  }, () => {});
}

// Users: published articles only. Sorted client-side by publishedAt so the
// Firestore query stays a plain equality filter (no composite index needed).
export function subscribePublishedArticles(cb: (articles: ArticleIndexEntry[]) => void): () => void {
  const q = query(collection(db, COLLECTION), where('status', '==', 'published'));
  return onSnapshot(q, (snap: QuerySnapshot) => {
    const articles = snap.docs.map(d => docToArticle(d.id, d.data()));
    articles.sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
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

export async function addArticle(input: ArticleInput): Promise<string> {
  const currentUser = getAuth().currentUser?.email ?? 'unknown';
  const ref = await addDoc(collection(db, COLLECTION), {
    ...input,
    createdBy: currentUser,
    createdAt: serverTimestamp(),
    updatedBy: currentUser,
    updatedAt: serverTimestamp(),
    publishedAt: input.status === 'published' ? serverTimestamp() : null,
  });
  return ref.id;
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

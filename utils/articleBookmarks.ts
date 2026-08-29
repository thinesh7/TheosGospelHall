import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'tgh_article_bookmarks';

export async function getBookmarkedArticleIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function setBookmarkedArticleIds(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(ids));
  } catch {}
}

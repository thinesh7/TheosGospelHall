import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = 'tgh_article_reader_settings';

export interface ArticleReaderSettings {
  fontSize: number;
}

export const DEFAULT_ARTICLE_READER_SETTINGS: ArticleReaderSettings = {
  fontSize: 17,
};

export async function getArticleReaderSettings(): Promise<ArticleReaderSettings> {
  try {
    const stored = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!stored) return DEFAULT_ARTICLE_READER_SETTINGS;
    return { ...DEFAULT_ARTICLE_READER_SETTINGS, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_ARTICLE_READER_SETTINGS;
  }
}

export async function saveArticleReaderSettings(settings: ArticleReaderSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

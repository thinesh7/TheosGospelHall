import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = 'tgh_song_reader_settings';

export type ReaderLanguage = 'tamil' | 'english';

export interface ReaderSettings {
  language: ReaderLanguage;
  fontSize: number;
  thickness: number;
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  language: 'tamil',
  fontSize: 18,
  thickness: 400,
};

export async function getReaderSettings(): Promise<ReaderSettings> {
  try {
    const stored = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!stored) return DEFAULT_READER_SETTINGS;
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_READER_SETTINGS, ...parsed };
  } catch (e) {
    return DEFAULT_READER_SETTINGS;
  }
}

export async function saveReaderSettings(settings: ReaderSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

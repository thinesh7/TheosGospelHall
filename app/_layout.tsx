import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { getCachedHomeContent } from '@/utils/homeContentSync';
import { loadBibleSettings } from '@/utils/bibleSettings';
import { ThemeProvider as AppThemeProvider } from '@/utils/ThemeContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const prepare = async () => {
      try {
        await Promise.race([
          Promise.all([getCachedHomeContent(), loadBibleSettings()]),
          new Promise(resolve => setTimeout(resolve, 1500)),
        ]);
      } catch (e) {
      } finally {
        setIsReady(true);
        SplashScreen.hideAsync().catch(() => {});
      }
    };
    prepare();
  }, []);

  if (!isReady) return null;

  return (
    <AppThemeProvider>
      <NavThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="song-reader" options={{ headerShown: false }} />
          <Stack.Screen name="other-song-reader" options={{ headerShown: false }} />
          <Stack.Screen name="bible-reader" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
      </NavThemeProvider>
    </AppThemeProvider>
  );
}

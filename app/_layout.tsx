import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { loadBibleSettings } from '@/utils/bibleSettings';
import { getCachedHomeContent } from '@/utils/homeContentSync';
import { ThemeProvider as AppThemeProvider } from '@/utils/ThemeContext';
import WelcomeSetupScreen from '@/components/WelcomeSetupScreen';

export const unstable_settings = {
  anchor: '(tabs)',
};

const SETUP_KEY = 'tgh_app_setup_complete';

SplashScreen.preventAutoHideAsync().catch(() => {});

type AppState = 'checking' | 'welcome' | 'ready';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [appState, setAppState] = useState<AppState>('checking');

  useEffect(() => {
    const init = async () => {
      try {
        const setupDone = await AsyncStorage.getItem(SETUP_KEY);
        if (!setupDone) {
          SplashScreen.hideAsync().catch(() => {});
          setAppState('welcome');
        } else {
          await Promise.race([
            Promise.all([getCachedHomeContent(), loadBibleSettings()]),
            new Promise(resolve => setTimeout(resolve, 1500)),
          ]);
          SplashScreen.hideAsync().catch(() => {});
          setAppState('ready');
        }
      } catch {
        SplashScreen.hideAsync().catch(() => {});
        setAppState('ready');
      }
    };
    init();
  }, []);

  const handleSetupComplete = async () => {
    await AsyncStorage.setItem(SETUP_KEY, '1').catch(() => {});
    setAppState('ready');
  };

  if (appState === 'checking') return null;

  return (
    <AppThemeProvider>
      <NavThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        {appState === 'welcome' ? (
          <WelcomeSetupScreen onComplete={handleSetupComplete} />
        ) : (
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="song-reader" options={{ headerShown: false }} />
            <Stack.Screen name="other-song-reader" options={{ headerShown: false }} />
            <Stack.Screen name="bible-reader" options={{ headerShown: false }} />
          </Stack>
        )}
        <StatusBar style="auto" />
      </NavThemeProvider>
    </AppThemeProvider>
  );
}

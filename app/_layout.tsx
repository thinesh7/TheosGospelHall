import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import Constants from 'expo-constants';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AppState as RNAppState, Linking } from 'react-native';
import 'react-native-reanimated';

import ForceUpdateScreen from '@/components/ForceUpdateScreen';
import OptionalUpdateModal from '@/components/OptionalUpdateModal';
import WelcomeSetupScreen from '@/components/WelcomeSetupScreen';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppVersionConfig, fetchVersionConfig, getUpdateStatus, UpdateStatus } from '@/utils/appUpdate';
import { loadBibleSettings } from '@/utils/bibleSettings';
import { getCachedHomeContent } from '@/utils/homeContentSync';
import {
  configureNotificationHandler,
  getLastNotificationResponse,
  isDuplicateNotificationResponse,
  registerForPushNotifications,
  setupNotificationListeners,
  setupTokenRefreshListener,
} from '@/utils/notifications';
import { ThemeProvider as AppThemeProvider, useTheme } from '@/utils/ThemeContext';
import { UpdateGateProvider } from '@/utils/UpdateGateContext';

export const unstable_settings = { anchor: '(tabs)' };

const SETUP_KEY = 'tgh_app_setup_complete';

SplashScreen.preventAutoHideAsync().catch(() => {});

// A tapped "app update available" notification carries a Play Store url in
// its data payload (set in AppUpdateAdmin.tsx) — open that directly instead
// of just foregrounding the app, so the user lands straight on the update.
// Every other notification (admin broadcast, special meeting) opens the
// in-app Notification Center instead.
//
// Both callers below (the cold-start getLastNotificationResponse() check and
// the live addNotificationResponseReceivedListener) route through here.
async function handleNotificationResponse(response: any) {
  // On Android, resuming a killed app's Task from Recents can hand back a
  // response object that LOOKS like a notification tap but isn't one — every
  // field (identifier, title, date) comes back null/empty/0, confirmed via
  // on-device debug logging. A genuine tap always carries a real identifier
  // and a real delivery timestamp; reject anything missing either before
  // acting on it, rather than trying to dedupe something with no ID to key on.
  const id = response?.notification?.request?.identifier;
  const notifDate = response?.notification?.date;
  if (!id || !notifDate) return;
  if (await isDuplicateNotificationResponse(response)) return;
  const data = response?.notification?.request?.content?.data;
  if (data?.type === 'app_update' && typeof data.url === 'string' && data.url) {
    Linking.openURL(data.url).catch(() => {});
    return;
  }
  router.push('/notification-center');
}

type AppState = 'checking' | 'welcome' | 'ready';

/** react-native-screens gives the "(tabs)" route its own native screen container with a
 *  default (white) background, independent of any JS view inside it. On a back/pop
 *  transition out of a stacked screen (e.g. bible-reader), that native container is what
 *  briefly becomes visible as it's uncovered — before this fix, nothing set its color, so
 *  it flashed white in Dark/Sepia (Light's own background is close enough to white that
 *  the same flash isn't visible there). Rendered inside AppThemeProvider so it can read
 *  the current app theme, independent of the global React Navigation theme. */
function AppStack() {
  const { colors } = useTheme();
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
      <Stack.Screen name="song-reader" options={{ headerShown: false }} />
      <Stack.Screen name="other-song-reader" options={{ headerShown: false }} />
      <Stack.Screen name="bible-reader" options={{ headerShown: false }} />
      <Stack.Screen name="article-reader" options={{ headerShown: false }} />
      <Stack.Screen name="notification-center" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [appState, setAppState] = useState<AppState>('checking');
  const [versionCheckDone, setVersionCheckDone] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('none');
  const [updateConfig, setUpdateConfig] = useState<AppVersionConfig | null>(null);
  // In-memory only (not AsyncStorage): a skipped optional update must only be
  // suppressed for the current app session, and reappear on the next launch —
  // so it's held in a ref that's naturally reset when the process restarts.
  const skippedVersionRef = useRef<string | null>(null);

  // Checks for an app update: on mount, and again whenever the app returns to
  // the foreground (throttled), so a mandatory/optional update pushed while
  // the app was merely backgrounded (not killed) is still caught promptly.
  useEffect(() => {
    let lastCheckedAt = 0;
    const RECHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

    const runVersionCheck = async () => {
      lastCheckedAt = Date.now();
      try {
        // Fail open: if the config can't be fetched in time (offline, error),
        // leave whatever update state is already showing untouched rather
        // than guessing — a transient network blip should neither impose a
        // block nor clear an already-active one.
        const config = await Promise.race([
          fetchVersionConfig(),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 4000)),
        ]);
        if (!config) return;

        // If the installed version can't be determined, also leave existing
        // state untouched — don't guess a version that could wrongly force
        // an update (unlike a hardcoded fallback like '0.0.0', which always
        // reads as "below minimum").
        // Reads from app.json via Expo config rather than expo-application's
        // nativeApplicationVersion, which reports the Expo Go host app's own
        // version (not this project's) when running inside Expo Go — see the
        // matching comment in AppUpdateAdmin.tsx.
        const installedVersion = Constants.expoConfig?.version;
        if (!installedVersion) return;

        const status = getUpdateStatus(installedVersion, config);

        if (status === 'none') {
          setUpdateConfig(null);
          setUpdateStatus('none');
          return;
        }

        if (status === 'optional' && skippedVersionRef.current === config.latestVersion) {
          setUpdateConfig(null);
          setUpdateStatus('none');
          return;
        }

        setUpdateConfig(config);
        setUpdateStatus(status);
      } catch {
        // fail open — leave existing state untouched
      }
    };

    (async () => {
      await runVersionCheck();
      setVersionCheckDone(true);
    })();

    const subscription = RNAppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && Date.now() - lastCheckedAt > RECHECK_INTERVAL_MS) {
        runVersionCheck();
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const setupDone = await AsyncStorage.getItem(SETUP_KEY);
        if (!setupDone) {
          setAppState('welcome');
        } else {
          await Promise.race([
            Promise.all([getCachedHomeContent(), loadBibleSettings()]),
            new Promise(r => setTimeout(r, 1500)),
          ]);
          setAppState('ready');
        }
      } catch {
        setAppState('ready');
      }
    })();
  }, []);

  // Splash only hides once both the first-run/setup check AND the version
  // check have resolved, so there's no gap where unblocked content could
  // flash before a mandatory-update screen is decided.
  useEffect(() => {
    if (appState === 'checking' || !versionCheckDone) return;
    SplashScreen.hideAsync().catch(() => {});
  }, [appState, versionCheckDone]);

  useEffect(() => {
    if (appState !== 'ready') return;
    configureNotificationHandler();
    const tokenSub = setupTokenRefreshListener();
    const removeListeners = setupNotificationListeners(undefined, handleNotificationResponse);
    // Covers the case where the app was killed and launched by tapping the
    // notification — the response listener above only fires for taps
    // received while the app is already running.
    getLastNotificationResponse().then(response => {
      if (response) handleNotificationResponse(response);
    });
    const delay = setTimeout(() => {
      registerForPushNotifications();
    }, 5000);
    return () => {
      clearTimeout(delay);
      tokenSub.remove();
      removeListeners();
    };
  }, [appState]);

  if (appState === 'checking' || !versionCheckDone) return null;

  // Mandatory blocks the app outright; optional blocks only while its popup
  // is up (cleared the moment the user hits Skip) — either way, screens
  // further down the tree (e.g. the tabs layout's live-stream check) must
  // not run checks or show their own popups over/under the update prompt.
  const isUpdateGateActive = updateStatus === 'mandatory' || updateStatus === 'optional';

  return (
    <AppThemeProvider>
      <UpdateGateProvider active={isUpdateGateActive}>
      <NavThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        {appState === 'welcome' ? (
          <WelcomeSetupScreen onComplete={async () => {
            await AsyncStorage.setItem(SETUP_KEY, '1').catch(() => {});
            setAppState('ready');
          }} />
        ) : (
          <AppStack />
        )}
        {updateStatus === 'mandatory' && updateConfig && (
          <ForceUpdateScreen message={updateConfig.updateMessage} storeUrl={updateConfig.androidStoreUrl} />
        )}
        {updateStatus === 'optional' && updateConfig && (
          <OptionalUpdateModal
            visible
            message={updateConfig.updateMessage}
            storeUrl={updateConfig.androidStoreUrl}
            onSkip={() => {
              skippedVersionRef.current = updateConfig.latestVersion;
              setUpdateStatus('none');
            }}
          />
        )}
        <StatusBar style="auto" />
      </NavThemeProvider>
      </UpdateGateProvider>
    </AppThemeProvider>
  );
}

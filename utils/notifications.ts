import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { doc, setDoc } from 'firebase/firestore';
import { Alert, Linking, Platform } from 'react-native';
import { db } from '../firebaseConfig';

const isExpoGo = Constants.appOwnership === 'expo';
const TOKEN_KEY = 'tgh_push_token';
const CHANNEL_ID = 'tgh-default';

function getNotifications() {
  return require('expo-notifications') as typeof import('expo-notifications');
}

export function configureNotificationHandler() {
  if (isExpoGo) return;
  const Notifications = getNotifications();
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
    }),
  });
}

async function createAndroidChannel() {
  if (isExpoGo || Platform.OS !== 'android') return;
  const Notifications = getNotifications();
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Theos Gospel Hall',
    description: 'Church announcements, special meetings and events',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0f3460',
    sound: 'default',
    enableLights: true,
    enableVibrate: true,
    showBadge: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

async function getProjectId(): Promise<string | undefined> {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined
  );
}

async function saveToken(token: string) {
  if (!token.startsWith('ExponentPushToken')) return;
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch {}
  try {
    const safeId = token.replace(/[^a-zA-Z0-9]/g, '_');
    await setDoc(
      doc(db, 'pushTokens', safeId),
      {
        token,
        platform: Platform.OS,
        model: Device.modelName ?? 'unknown',
        osVersion: Device.osVersion ?? 'unknown',
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  } catch (e) {
    console.error('[Notifications] Failed to save token:', e);
  }
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (isExpoGo || !Device.isDevice) return null;
  const Notifications = getNotifications();

  await createAndroidChannel();

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  const projectId = await getProjectId();
  if (!projectId) {
    console.error('[Notifications] Missing EAS projectId');
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await saveToken(token);
    return token;
  } catch (e) {
    console.error('[Notifications] getExpoPushTokenAsync failed:', e);
    return null;
  }
}

export function setupTokenRefreshListener() {
  if (isExpoGo) return { remove: () => {} };
  const Notifications = getNotifications();
  return Notifications.addPushTokenListener(async ({ data: token }) => {
    await saveToken(token);
  });
}

export function setupNotificationListeners(
  onReceive?: (n: any) => void,
  onResponse?: (r: any) => void
) {
  if (isExpoGo) return () => {};
  const Notifications = getNotifications();
  const receiveSub = Notifications.addNotificationReceivedListener(n => {
    onReceive?.(n);
  });
  const responseSub = Notifications.addNotificationResponseReceivedListener(r => {
    onResponse?.(r);
  });
  return () => {
    receiveSub.remove();
    responseSub.remove();
  };
}

export async function checkStoredToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function promptBatteryOptimization() {
  if (Platform.OS !== 'android') return;
  Alert.alert(
    'Enable Notifications',
    'To receive notifications reliably, please disable battery optimization for this app.\n\nGo to Settings → Apps → Theos Gospel Hall → Battery → Unrestricted.',
    [
      { text: 'Later', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ]
  );
}

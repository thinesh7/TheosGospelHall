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

async function logTokenError(step: string, error: any) {
  try {
    const d = new Date();
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const day = d.getDate();
    const h24 = d.getHours();
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 || 12;
    const min = String(d.getMinutes()).padStart(2, '0');
    const sec = String(d.getSeconds()).padStart(2, '0');
    const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
    const docId = `${month}_${year}_${day}_${h12}_${min}_${sec}_${ampm}_${rand}`;
    await setDoc(
      doc(db, 'tokenErrors', docId),
      {
        step,
        error: String(error?.message ?? error ?? 'unknown'),
        model: Device.modelName ?? 'unknown',
        brand: Device.brand ?? 'unknown',
        osVersion: Device.osVersion ?? 'unknown',
        androidVersion: Device.platformApiLevel ?? 'unknown',
        platform: Platform.OS,
        timestamp: Date.now(),
      }
    );
  } catch {}
}

async function saveTokenToFirestore(token: string) {
  const safeId = token.replace(/[^a-zA-Z0-9]/g, '_');
  await setDoc(
    doc(db, 'pushTokens', safeId),
    {
      token,
      platform: Platform.OS,
      model: Device.modelName ?? 'unknown',
      brand: Device.brand ?? 'unknown',
      osVersion: Device.osVersion ?? 'unknown',
      updatedAt: Date.now(),
    },
    { merge: true }
  );
}

async function saveToken(token: string) {
  if (!token.startsWith('ExponentPushToken')) return;
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch {}
  try {
    await saveTokenToFirestore(token);
  } catch (e) {
    await logTokenError('firestoreSave', e);
  }
}

async function retryFirestoreIfNeeded() {
  try {
    const stored = await AsyncStorage.getItem(TOKEN_KEY);
    if (!stored || !stored.startsWith('ExponentPushToken')) return;
    await saveTokenToFirestore(stored);
  } catch (e) {
    await logTokenError('retryFirestoreSync', e);
  }
}

const FATAL_ERROR_CODES = [
  'TOO_MANY_REGISTRATIONS',
  'INVALID_CREDENTIALS',
  'PROJECT_NOT_FOUND',
  'INVALID_PROJECT_ID',
  'SENDER_ID_MISMATCH',
];

function isFatalTokenError(error: any): boolean {
  const msg = String(error?.message ?? error ?? '');
  return FATAL_ERROR_CODES.some(code => msg.includes(code));
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

  if (finalStatus !== 'granted') {
    await logTokenError('permission', `Permission status: ${finalStatus}`);
    return null;
  }

  const projectId = await getProjectId();
  if (!projectId) {
    await logTokenError('projectId', 'EAS projectId missing in app.json');
    retryFirestoreIfNeeded();
    return null;
  }

  const cached = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  if (cached && cached.startsWith('ExponentPushToken')) {
    try {
      await saveTokenToFirestore(cached);
    } catch (e) {
      await logTokenError('cachedTokenFirestoreSync', e);
    }
    return cached;
  }

  let token: string | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await Notifications.getExpoPushTokenAsync({ projectId });
      token = result.data;
      break;
    } catch (e) {
      await logTokenError(`tokenFetch_attempt_${attempt}`, e);
      if (isFatalTokenError(e)) {
        retryFirestoreIfNeeded();
        return null;
      }
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, attempt * 3000));
      }
    }
  }

  if (token) {
    await saveToken(token);
    return token;
  }

  retryFirestoreIfNeeded();
  return null;
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

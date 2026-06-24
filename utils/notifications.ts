import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { doc, increment, setDoc } from 'firebase/firestore';
import { Alert, Linking, Platform } from 'react-native';
import { db } from '../firebaseConfig';

const isExpoGo = Constants.appOwnership === 'expo';
const TOKEN_KEY = 'tgh_push_token';
const TOKEN_FETCHED_AT_KEY = 'tgh_push_token_fetched_at';
const TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const CHANNEL_ID = 'tgh-default';

const DEVICE_UUID_KEY = 'tgh_device_uuid';

async function getStableDeviceId(): Promise<{ id: string; isGuaranteedUnique: boolean }> {
  const androidId = Platform.OS === 'android'
    ? (Application.getAndroidId?.() ?? null)
    : null;
  const model = (Device.modelName ?? 'unknown').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);

  if (androidId) {
    return { id: `${model}_${androidId}`, isGuaranteedUnique: true };
  }

  const cached = await AsyncStorage.getItem(DEVICE_UUID_KEY).catch(() => null);
  if (cached) {
    return { id: `${model}_${cached}`, isGuaranteedUnique: false };
  }

  const uuid = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(DEVICE_UUID_KEY, uuid).catch(() => {});
  return { id: `${model}_${uuid}`, isGuaranteedUnique: false };
}

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
    const errorMsg = String(error?.message ?? error ?? 'unknown');
    const errorCode = FATAL_ERROR_CODES.find(c => errorMsg.includes(c)) ?? 'UNKNOWN';
    const { id: deviceId, isGuaranteedUnique } = await getStableDeviceId();
    const now = Date.now();

    const docId = isGuaranteedUnique
      ? `${deviceId}_${step}_${errorCode}`
      : `${deviceId}_${step}_${errorCode}_${now}`;

    const ref = doc(db, 'tokenErrors', docId);

    if (isGuaranteedUnique) {
      await setDoc(ref, {
        step,
        error: errorMsg,
        model: Device.modelName ?? 'unknown',
        brand: Device.brand ?? 'unknown',
        osVersion: Device.osVersion ?? 'unknown',
        androidVersion: Device.platformApiLevel ?? 'unknown',
        osBuildId: Device.osBuildId ?? Device.osInternalBuildId ?? 'unknown',
        platform: Platform.OS,
        lastSeen: now,
        count: increment(1),
      }, { merge: true });
      await setDoc(ref, { firstSeen: now }, { merge: true });
    } else {
      await setDoc(ref, {
        step,
        error: errorMsg,
        model: Device.modelName ?? 'unknown',
        brand: Device.brand ?? 'unknown',
        osVersion: Device.osVersion ?? 'unknown',
        androidVersion: Device.platformApiLevel ?? 'unknown',
        osBuildId: Device.osBuildId ?? Device.osInternalBuildId ?? 'unknown',
        platform: Platform.OS,
        firstSeen: now,
        lastSeen: now,
        count: 1,
      });
    }
  } catch {}
}

async function saveTokenToFirestore(token: string) {
  const { id: deviceId, isGuaranteedUnique } = await getStableDeviceId();
  const docId = isGuaranteedUnique
    ? deviceId
    : `${deviceId}_${token.replace(/[^a-zA-Z0-9]/g, '').slice(-12)}`;
  await setDoc(
    doc(db, 'pushTokens', docId),
    {
      token,
      platform: Platform.OS,
      model: Device.modelName ?? 'unknown',
      brand: Device.brand ?? 'unknown',
      osVersion: Device.osVersion ?? 'unknown',
      osBuildId: Device.osBuildId ?? Device.osInternalBuildId ?? 'unknown',
      updatedAt: Date.now(),
    },
    { merge: true }
  );
}

async function saveToken(token: string) {
  if (!token.startsWith('ExponentPushToken')) return;
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    await AsyncStorage.setItem(TOKEN_FETCHED_AT_KEY, String(Date.now()));
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
  const fetchedAt = await AsyncStorage.getItem(TOKEN_FETCHED_AT_KEY).catch(() => null);
  const tokenAge = fetchedAt ? Date.now() - parseInt(fetchedAt) : Infinity;
  const isTokenFresh = cached && cached.startsWith('ExponentPushToken') && tokenAge < TOKEN_MAX_AGE_MS;

  if (isTokenFresh) {
    try {
      await saveTokenToFirestore(cached!);
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

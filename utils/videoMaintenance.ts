import { getAuth } from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// New, standalone "Site Maintenance" API for the Videos section — a separate
// collection from every existing video/registration/config collection, kept
// deliberately isolated so this feature can never affect them. A missing doc
// (e.g. before an admin ever opens Video Maintenance, or on a version that
// predates this feature) is treated as 'disabled', so the Videos tab keeps
// working exactly as before until an admin explicitly enables maintenance
// mode and saves.

const CONFIG_COLLECTION = 'siteMaintenance';
const VIDEOS_DOC_ID = 'videos';

export interface VideoMaintenanceConfig {
  enabled: boolean;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

const DEFAULT_CONFIG: VideoMaintenanceConfig = { enabled: false };

function parseConfig(data: Record<string, unknown>): VideoMaintenanceConfig {
  return {
    enabled: data.enabled === true,
    updatedAt: data.updatedAt as Timestamp | undefined,
    updatedBy: data.updatedBy as string | undefined,
  };
}

export async function fetchVideoMaintenanceConfig(): Promise<VideoMaintenanceConfig> {
  try {
    const snap = await getDoc(doc(db, CONFIG_COLLECTION, VIDEOS_DOC_ID));
    if (!snap.exists()) return { ...DEFAULT_CONFIG };
    return parseConfig(snap.data());
  } catch {
    // Fail open: an unreachable config must never take the Videos section
    // down for users.
    return { ...DEFAULT_CONFIG };
  }
}

// Live subscription so a saved change is reflected on the Videos tab
// immediately, without an app restart. Also fails open on listener errors.
export function subscribeVideoMaintenance(callback: (config: VideoMaintenanceConfig) => void): () => void {
  const ref = doc(db, CONFIG_COLLECTION, VIDEOS_DOC_ID);
  return onSnapshot(
    ref,
    snap => callback(snap.exists() ? parseConfig(snap.data()) : { ...DEFAULT_CONFIG }),
    () => callback({ ...DEFAULT_CONFIG })
  );
}

export async function saveVideoMaintenanceConfig(enabled: boolean): Promise<void> {
  const currentUser = getAuth().currentUser?.email ?? 'unknown';
  const ref = doc(db, CONFIG_COLLECTION, VIDEOS_DOC_ID);
  const existing = await getDoc(ref);

  const payload: Record<string, unknown> = {
    enabled,
    updatedAt: serverTimestamp(),
    updatedBy: currentUser,
  };
  if (!existing.exists()) {
    payload.createdAt = serverTimestamp();
    payload.createdBy = currentUser;
  }

  await setDoc(ref, payload, { merge: true });
}

import { getAuth } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface AppVersionConfigInput {
  latestVersion: string;
  minimumRequiredVersion: string;
  updateMessage: string;
  androidStoreUrl: string;
}

export interface AppVersionConfig extends AppVersionConfigInput {
  createdAt?: Timestamp;
  createdBy?: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

export type UpdateStatus = 'mandatory' | 'optional' | 'none';

const CONFIG_COLLECTION = 'appConfig';
const CONFIG_DOC_ID = 'version';

export const DEFAULT_UPDATE_MESSAGE = 'New features and bug fixes!';

export async function fetchVersionConfig(): Promise<AppVersionConfig | null> {
  try {
    const snap = await getDoc(doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (!data.latestVersion || !data.minimumRequiredVersion || !data.androidStoreUrl) return null;
    return {
      latestVersion: String(data.latestVersion),
      minimumRequiredVersion: String(data.minimumRequiredVersion),
      updateMessage: String(data.updateMessage ?? DEFAULT_UPDATE_MESSAGE),
      androidStoreUrl: String(data.androidStoreUrl),
      createdAt: data.createdAt,
      createdBy: data.createdBy,
      updatedAt: data.updatedAt,
      updatedBy: data.updatedBy,
    };
  } catch {
    return null;
  }
}

// Enforces the exact 'number.number.number' shape (e.g. '1.2.0') — no
// leading 'v', no pre-release/build suffixes, no missing segments.
const VERSION_FORMAT_REGEX = /^\d+\.\d+\.\d+$/;

export function isValidVersionFormat(version: string): boolean {
  return VERSION_FORMAT_REGEX.test(version.trim());
}

// Plain 'major.minor.patch' comparison — no semver library needed, this
// project's version strings are always simple dot-separated integers.
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

export function getUpdateStatus(installedVersion: string, config: AppVersionConfig): UpdateStatus {
  if (compareVersions(installedVersion, config.minimumRequiredVersion) < 0) return 'mandatory';
  if (compareVersions(installedVersion, config.latestVersion) < 0) return 'optional';
  return 'none';
}

export async function saveVersionConfig(config: AppVersionConfigInput): Promise<void> {
  const currentUser = getAuth().currentUser?.email ?? 'unknown';
  const ref = doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID);
  const existing = await getDoc(ref);

  const payload: Record<string, unknown> = {
    ...config,
    updatedAt: serverTimestamp(),
    updatedBy: currentUser,
  };
  // Only stamp createdAt/createdBy the first time this doc is written —
  // {merge: true} below then leaves them untouched on every later save.
  if (!existing.exists()) {
    payload.createdAt = serverTimestamp();
    payload.createdBy = currentUser;
  }

  await setDoc(ref, payload, { merge: true });
}

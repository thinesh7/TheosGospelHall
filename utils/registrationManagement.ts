import { getAuth } from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ProgramId, PROGRAMS } from './registrations';

// New, standalone "Registration Management" API — separate collection from
// the existing per-program registration collections (youthProgramRegistrations,
// academyRegistrations) in utils/registrations.ts, which this deliberately
// never touches. A program with no doc here (e.g. before an admin ever opens
// this screen, or on a version that predates this feature) is treated as
// 'open' with the default message, so existing registration flows keep
// working unchanged until an admin explicitly closes a program.

export type RegistrationAvailability = 'open' | 'closed';

export interface RegistrationManagementConfig {
  status: RegistrationAvailability;
  closedMessage: string;
  // Hides the program's entire card from the Home screen, independent of
  // status: a hidden program is inaccessible regardless of Open/Closed.
  hideProgram: boolean;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

export const DEFAULT_CLOSED_MESSAGE = 'Currently registrations are closed.';

const CONFIG_COLLECTION = 'registrationManagement';

const DEFAULT_CONFIG: RegistrationManagementConfig = {
  status: 'open',
  closedMessage: DEFAULT_CLOSED_MESSAGE,
  hideProgram: false,
};

function parseConfig(data: Record<string, unknown>): RegistrationManagementConfig {
  return {
    status: data.status === 'closed' ? 'closed' : 'open',
    closedMessage: typeof data.closedMessage === 'string' && data.closedMessage.trim()
      ? data.closedMessage
      : DEFAULT_CLOSED_MESSAGE,
    hideProgram: data.hideProgram === true,
    updatedAt: data.updatedAt as Timestamp | undefined,
    updatedBy: data.updatedBy as string | undefined,
  };
}

export async function fetchRegistrationManagementConfig(programId: ProgramId): Promise<RegistrationManagementConfig> {
  try {
    const snap = await getDoc(doc(db, CONFIG_COLLECTION, programId));
    if (!snap.exists()) return { ...DEFAULT_CONFIG };
    return parseConfig(snap.data());
  } catch {
    // Fail open: an unreachable config must never block a registration that
    // should otherwise be open.
    return { ...DEFAULT_CONFIG };
  }
}

export async function fetchAllRegistrationManagementConfigs(): Promise<Record<ProgramId, RegistrationManagementConfig>> {
  const programIds = Object.keys(PROGRAMS) as ProgramId[];
  const entries = await Promise.all(
    programIds.map(async id => [id, await fetchRegistrationManagementConfig(id)] as const)
  );
  return Object.fromEntries(entries) as Record<ProgramId, RegistrationManagementConfig>;
}

// Live subscription so a status/message change made by an admin is reflected
// on the user-facing registration buttons immediately, without an app
// restart. Also fails open on listener errors, for the same reason as above.
export function subscribeRegistrationManagement(
  programId: ProgramId,
  callback: (config: RegistrationManagementConfig) => void
): () => void {
  const ref = doc(db, CONFIG_COLLECTION, programId);
  const unsubscribe = onSnapshot(
    ref,
    snap => callback(snap.exists() ? parseConfig(snap.data()) : { ...DEFAULT_CONFIG }),
    () => callback({ ...DEFAULT_CONFIG })
  );
  return unsubscribe;
}

export async function saveRegistrationManagementConfig(
  programId: ProgramId,
  input: { status: RegistrationAvailability; closedMessage: string; hideProgram: boolean }
): Promise<void> {
  const currentUser = getAuth().currentUser?.email ?? 'unknown';
  const ref = doc(db, CONFIG_COLLECTION, programId);
  const existing = await getDoc(ref);

  const payload: Record<string, unknown> = {
    status: input.status,
    closedMessage: input.closedMessage.trim() || DEFAULT_CLOSED_MESSAGE,
    hideProgram: input.hideProgram,
    updatedAt: serverTimestamp(),
    updatedBy: currentUser,
  };
  if (!existing.exists()) {
    payload.createdAt = serverTimestamp();
    payload.createdBy = currentUser;
  }

  await setDoc(ref, payload, { merge: true });
}

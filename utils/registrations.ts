import { getAuth } from 'firebase/auth';
import {
  Timestamp,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
// Note: imported from 'libphonenumber-js/mobile' rather than the package
// root. The root export uses trimmed-down metadata that can only confirm a
// digit sequence matches *some* valid pattern for a country, without being
// able to classify its type — so numbers that aren't real mobile numbers
// (e.g. '+911234567890', '+911111111111') were incorrectly passing
// validation. The /mobile entry point carries the metadata needed to
// classify number type, so it correctly rejects those while still accepting
// genuine mobile numbers.
import { isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js/mobile';
import { db } from '../firebaseConfig';

export const PROGRAMS = {
  youth: {
    collection: 'youthProgramRegistrations',
    label: 'TGH Special Youth Discipleship Program',
    mode: '🌐 Online Program',
  },
  academy: {
    collection: 'academyRegistrations',
    label: 'TGH Academy',
    mode: '📍 Offline Classes – Tirupur',
  },
} as const;

export type ProgramId = keyof typeof PROGRAMS;
export type Gender = 'Male' | 'Female';
export type RegistrationStatus = 'registered' | 'followup' | 'accepted';

export const STATUS_LABELS: Record<RegistrationStatus, string> = {
  registered: 'Registered',
  followup: 'Follow-up',
  accepted: 'Accepted',
};

export interface Registration {
  id: string;
  name: string;
  dob: string; // ISO 'YYYY-MM-DD'
  gender: Gender;
  phone: string; // E.164, e.g. '+919876543210'
  place: string;
  churchDetails: string;
  status: RegistrationStatus;
  isDeleted: boolean;
  createdAt?: Timestamp;
  modifiedAt?: Timestamp;
  modifiedBy?: string;
}

export interface RegistrationInput {
  name: string;
  dob: string;
  gender: Gender;
  phone: string;
  place: string;
  churchDetails: string;
}

export class DuplicateRegistrationError extends Error {
  constructor() {
    super('This mobile number has already been registered for this program.');
    this.name = 'DuplicateRegistrationError';
  }
}

const MIN_AGE_YEARS = 0;
const MAX_AGE_YEARS = 120;

export function validateName(name: string): string | null {
  if (!name.trim()) return 'Please enter your name.';
  if (name.trim().length < 2) return 'Name must be at least 2 characters.';
  return null;
}

export function validateDob(dob: string): string | null {
  if (!dob) return 'Please select your date of birth.';
  const date = new Date(dob);
  if (isNaN(date.getTime())) return 'Please select a valid date of birth.';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date.getTime() > today.getTime()) return 'Date of birth cannot be in the future.';

  const minDate = new Date();
  minDate.setFullYear(today.getFullYear() - MAX_AGE_YEARS);
  if (date.getTime() < minDate.getTime()) return 'Please enter a valid date of birth.';

  return null;
}

export function validatePlace(place: string): string | null {
  if (!place.trim()) return 'Please enter your place.';
  return null;
}

export function validatePhone(phone: string): string | null {
  if (!phone.trim()) return 'Please enter your mobile number.';
  if (!isValidPhoneNumber(phone)) return 'Please enter a valid mobile number.';
  return null;
}

// For programs restricted to India: validates just the 10-digit national
// number (no country code), per India's standard mobile numbering (10
// digits, starting 6-9).
export function validateIndianMobile(nationalDigits: string): string | null {
  if (!nationalDigits.trim()) return 'Please enter your mobile number.';
  if (!/^[6-9]\d{9}$/.test(nationalDigits.trim())) return 'Please enter a valid 10-digit Indian mobile number.';
  return null;
}

export function computeAge(dob: string): number | null {
  const date = new Date(dob);
  if (isNaN(date.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age--;
  }
  return age >= MIN_AGE_YEARS ? age : null;
}

export function phoneToDocId(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

// Formats a stored E.164 number (e.g. '+918610940068') as '+91-8610940068' —
// country code separated from the subscriber number — for any country, not
// just India. Falls back to the raw stored value if parsing ever fails.
export function formatPhoneDisplay(phone: string): string {
  const parsed = parsePhoneNumberFromString(phone);
  if (!parsed) return phone;
  return `+${parsed.countryCallingCode}-${parsed.nationalNumber}`;
}

export function formatDateDisplay(isoDate: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

// Always renders in IST (Asia/Kolkata), regardless of the device's own timezone,
// as "28 Jul 2026, 10:45 AM" — built from formatToParts so the day-month-year
// order and AM/PM casing stay fixed no matter the device's locale settings.
export function formatTimestampIST(ts: any): string {
  if (!ts) return '—';
  const date = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts);
  if (isNaN(date.getTime())) return '—';

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${get('day')} ${get('month')} ${get('year')}, ${get('hour')}:${get('minute')} ${get('dayPeriod').toUpperCase()}`;
}

// Zero-padded 24-hour IST timestamp for filenames, e.g. "2026-07-28_10-45-30".
// Computed via a fixed +5:30 epoch shift (India has no DST) rather than Intl,
// to avoid ICU locale quirks like rendering midnight as "24" instead of "00".
export function formatISTFileTimestamp(date: Date = new Date()): string {
  const IST_OFFSET_MINUTES = 330;
  const shifted = new Date(date.getTime() + IST_OFFSET_MINUTES * 60000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = shifted.getUTCFullYear();
  const month = pad(shifted.getUTCMonth() + 1);
  const day = pad(shifted.getUTCDate());
  const hours = pad(shifted.getUTCHours());
  const minutes = pad(shifted.getUTCMinutes());
  const seconds = pad(shifted.getUTCSeconds());
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

export async function submitRegistration(
  programId: ProgramId,
  input: RegistrationInput
): Promise<void> {
  const collectionName = PROGRAMS[programId].collection;
  const docId = phoneToDocId(input.phone);
  const ref = doc(db, collectionName, docId);

  try {
    // No read-before-write here: registrants aren't authenticated, so Firestore
    // rules deny them any read access. A doc at this id (phone number) already
    // existing is what makes this a Firestore "update" instead of "create" —
    // and public "update" is denied by the rules — so a permission-denied here
    // means "already registered", not an actual auth problem.
    await setDoc(ref, {
      name: input.name.trim(),
      dob: input.dob,
      gender: input.gender,
      phone: input.phone,
      place: input.place.trim(),
      churchDetails: input.churchDetails.trim(),
      status: 'registered' as RegistrationStatus,
      isDeleted: false,
      createdAt: serverTimestamp(),
      modifiedAt: serverTimestamp(),
    });
  } catch (e: any) {
    if (e?.code === 'permission-denied') {
      throw new DuplicateRegistrationError();
    }
    throw e;
  }
}

export async function updateRegistrationStatus(
  programId: ProgramId,
  id: string,
  status: RegistrationStatus
): Promise<void> {
  const currentUser = getAuth().currentUser?.email ?? 'unknown';
  await updateDoc(doc(db, PROGRAMS[programId].collection, id), {
    status,
    modifiedAt: serverTimestamp(),
    modifiedBy: currentUser,
  });
}

export async function softDeleteRegistration(programId: ProgramId, id: string): Promise<void> {
  const currentUser = getAuth().currentUser?.email ?? 'unknown';
  await updateDoc(doc(db, PROGRAMS[programId].collection, id), {
    isDeleted: true,
    modifiedAt: serverTimestamp(),
    modifiedBy: currentUser,
  });
}

export async function restoreRegistration(
  programId: ProgramId,
  id: string,
  status: RegistrationStatus
): Promise<void> {
  const currentUser = getAuth().currentUser?.email ?? 'unknown';
  await updateDoc(doc(db, PROGRAMS[programId].collection, id), {
    isDeleted: false,
    status,
    modifiedAt: serverTimestamp(),
    modifiedBy: currentUser,
  });
}

export async function permanentlyDeleteRegistration(programId: ProgramId, id: string): Promise<void> {
  await deleteDoc(doc(db, PROGRAMS[programId].collection, id));
}

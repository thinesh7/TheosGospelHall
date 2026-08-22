import { getAuth } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export type Gender = 'MALE' | 'FEMALE';
export type MembershipType = 'FAMILY' | 'SINGLE';
export type MembershipStatus = 'ACTIVE' | 'INACTIVE';
export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'WIDOWED' | 'DIVORCED';
export type Relationship =
  | 'FAMILY_HEAD'
  | 'HUSBAND'
  | 'WIFE'
  | 'SON'
  | 'DAUGHTER'
  | 'MOTHER'
  | 'BROTHER'
  | 'SISTER'
  | 'GRANDFATHER'
  | 'GRANDMOTHER'
  | 'OTHER';
export type BranchStatus = 'ACTIVE' | 'INACTIVE';
export type FamilyStatus = 'ACTIVE' | 'INACTIVE';

export interface Address {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  mapLink: string;
}

export const EMPTY_ADDRESS: Address = { addressLine1: '', addressLine2: '', city: '', state: '', pincode: '', mapLink: '' };

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  phoneNumber: string;
  status: BranchStatus;
  createdAt?: Timestamp;
  createdBy?: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

export interface Family {
  id: string;
  branchId: string;
  familyName: string;
  familyPhone: string | null;
  address: Address | null;
  status: FamilyStatus;
  createdAt?: Timestamp;
  createdBy?: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

export interface Member {
  id: string;
  branchId: string;
  familyId: string | null;
  membershipType: MembershipType;
  name: string;
  gender: Gender;
  dateOfBirth: Timestamp | null;
  phoneNumber: string | null;
  baptismDate: Timestamp | null;
  memberSince: Timestamp | null;
  maritalStatus: MaritalStatus | null;
  marriageDate: Timestamp | null;
  relationship: Relationship | null;
  isFamilyHead: boolean;
  membershipStatus: MembershipStatus;
  address: Address | null;
  email: string | null;
  notes: string | null;
  createdAt?: Timestamp;
  createdBy?: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

export type AuditAction =
  | 'CREATE_MEMBER'
  | 'UPDATE_MEMBER'
  | 'STATUS_CHANGE'
  | 'DEACTIVATE_MEMBER'
  | 'CREATE_FAMILY'
  | 'UPDATE_FAMILY'
  | 'DEACTIVATE_FAMILY'
  | 'REACTIVATE_FAMILY'
  | 'ADD_FAMILY_MEMBER'
  | 'REMOVE_FAMILY_MEMBER'
  | 'PERMANENT_DELETE_MEMBER'
  | 'PERMANENT_DELETE_FAMILY';
export type AuditEntityType = 'MEMBER' | 'FAMILY';

// Form-facing shape: dates as JS Date (converted to Timestamp on write),
// enums as '' when unset so a picker/segmented control has a valid empty state.
export interface MemberFormInput {
  name: string;
  gender: Gender | '';
  dateOfBirth: Date | null;
  phoneNumber: string;
  baptismDate: Date | null;
  memberSince: Date | null;
  maritalStatus: MaritalStatus | '';
  marriageDate: Date | null;
  relationship: Relationship | '';
  membershipStatus: MembershipStatus;
  address: Address;
  email: string;
  notes: string;
}

export function emptyMemberForm(defaults?: Partial<MemberFormInput>): MemberFormInput {
  return {
    name: '',
    gender: '',
    dateOfBirth: null,
    phoneNumber: '',
    baptismDate: null,
    memberSince: null,
    maritalStatus: '',
    marriageDate: null,
    relationship: '',
    membershipStatus: 'ACTIVE',
    address: { ...EMPTY_ADDRESS },
    email: '',
    notes: '',
    ...defaults,
  };
}

export function memberToFormInput(m: Member): MemberFormInput {
  return {
    name: m.name,
    gender: m.gender,
    dateOfBirth: tsToDate(m.dateOfBirth),
    phoneNumber: m.phoneNumber ?? '',
    baptismDate: tsToDate(m.baptismDate),
    memberSince: tsToDate(m.memberSince),
    maritalStatus: m.maritalStatus ?? '',
    marriageDate: tsToDate(m.marriageDate),
    relationship: m.relationship ?? '',
    membershipStatus: m.membershipStatus,
    address: m.address ? { ...m.address } : { ...EMPTY_ADDRESS },
    email: m.email ?? '',
    notes: m.notes ?? '',
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Constants / labels
// ─────────────────────────────────────────────────────────────────────────

export const SEED_BRANCHES: { id: string; name: string; code: string }[] = [
  { id: 'tirupur', name: 'Tirupur', code: 'TIRUPUR' },
  { id: 'coimbatore', name: 'Coimbatore', code: 'COIMBATORE' },
  { id: 'udumalaipettai', name: 'Udumalaipettai', code: 'UDUMALAIPETTAI' },
  { id: 'kanyakumari', name: 'Kanyakumari', code: 'KANYAKUMARI' },
];

export const MEMBERSHIP_STATUS_LABELS: Record<MembershipStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
};

export const MEMBERSHIP_STATUS_COLORS: Record<MembershipStatus, string> = {
  ACTIVE: '#1e9e50',
  INACTIVE: '#e65100',
};

export const MEMBERSHIP_STATUS_BG: Record<MembershipStatus, string> = {
  ACTIVE: '#e6f7ec',
  INACTIVE: '#fff3e0',
};

export const MEMBERSHIP_STATUS_DOT: Record<MembershipStatus, string> = {
  ACTIVE: '🟢',
  INACTIVE: '🟠',
};

export const GENDER_LABELS: Record<Gender, string> = { MALE: 'Male', FEMALE: 'Female' };

// Honorific used only when *displaying* a member's name on view/details
// screens (e.g. "Bro. Daniel") — the Gender field/value itself stays
// Male/Female everywhere (form, exports, reports).
export const GENDER_HONORIFIC: Record<Gender, string> = { MALE: 'Bro.', FEMALE: 'Sis.' };

export function nameWithHonorific(name: string, gender: Gender): string {
  return `${GENDER_HONORIFIC[gender]} ${name}`;
}

// Display title for a family card/list, e.g. "Bro. Kumar Family" — built
// from the family head's honorific + name, not the raw stored familyName.
// Falls back to the stored familyName if the family has no head yet.
export function familyDisplayName(family: Family, head: Member | undefined): string {
  if (!head) return family.familyName;
  return `${nameWithHonorific(head.name, head.gender)} Family`;
}

export const MARITAL_STATUS_LABELS: Record<MaritalStatus, string> = {
  SINGLE: 'Single',
  MARRIED: 'Married',
  WIDOWED: 'Widowed',
  DIVORCED: 'Divorced',
};

export const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  FAMILY_HEAD: 'Head',
  HUSBAND: 'Husband',
  WIFE: 'Wife',
  SON: 'Son',
  DAUGHTER: 'Daughter',
  MOTHER: 'Mother',
  BROTHER: 'Brother',
  SISTER: 'Sister',
  GRANDFATHER: 'Grandfather',
  GRANDMOTHER: 'Grandmother',
  OTHER: 'Other',
};

// Relationship options offered when adding/editing a non-head family member
// (Family Head itself is assigned automatically, never picked manually).
export const FAMILY_MEMBER_RELATIONSHIPS: Relationship[] = [
  'HUSBAND', 'WIFE', 'SON', 'DAUGHTER', 'MOTHER', 'BROTHER', 'SISTER', 'GRANDFATHER', 'GRANDMOTHER', 'OTHER',
];

// ─────────────────────────────────────────────────────────────────────────
// Formatting / conversion helpers
// ─────────────────────────────────────────────────────────────────────────

export function tsToDate(ts: Timestamp | null | undefined): Date | null {
  if (!ts) return null;
  if (typeof (ts as any)?.toDate === 'function') return (ts as any).toDate();
  return null;
}

function dateToTimestamp(d: Date | null): Timestamp | null {
  return d ? Timestamp.fromDate(d) : null;
}

export function formatDateOnly(ts: Timestamp | null | undefined): string {
  const d = tsToDate(ts);
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateOnlyShort(ts: Timestamp | null | undefined): string {
  const d = tsToDate(ts);
  if (!d) return '';
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function computeAgeFromTimestamp(ts: Timestamp | null | undefined): number | null {
  const d = tsToDate(ts);
  if (!d) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const monthDiff = today.getMonth() - d.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d.getDate())) age--;
  return age >= 0 ? age : null;
}

export function toDigitsOnly(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}

// India-only mobile validation to match how numbers are captured in these
// forms (plain 10-digit, no country-code picker) — mirrors validateIndianMobile
// in utils/registrations.ts.
export function validatePhoneOptional(phone: string): string | null {
  if (!phone || !phone.trim()) return null;
  const digits = toDigitsOnly(phone);
  if (!/^[6-9]\d{9}$/.test(digits)) return 'Please enter a valid 10-digit Indian mobile number.';
  return null;
}

export function validateEmailOptional(email: string): string | null {
  if (!email || !email.trim()) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Please enter a valid email address.';
  return null;
}

export function formatPhoneDisplay(phone: string | null | undefined): string {
  const digits = toDigitsOnly(phone ?? '');
  if (digits.length !== 10) return phone ?? '';
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
}

// Builds the wa.me target: a bare 10-digit number is assumed local (India,
// +91) since these forms never collect a country code; anything already
// longer is trusted as-is rather than re-prefixed.
export function toWhatsAppNumber(phone: string): string {
  const digits = toDigitsOnly(phone);
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function hasAddress(addr?: Partial<Address> | null): addr is Address {
  if (!addr) return false;
  return !!(addr.addressLine1?.trim() || addr.addressLine2?.trim() || addr.city?.trim() || addr.state?.trim() || addr.pincode?.trim() || addr.mapLink?.trim());
}

export function formatAddressOneLine(addr: Address | null | undefined): string {
  if (!addr) return '';
  return [addr.addressLine1, addr.addressLine2, addr.city, addr.state, addr.pincode].filter(p => p && p.trim()).join(', ');
}

export function formatAddressMultiline(addr: Address | null | undefined): string {
  if (!addr) return '';
  const line2 = [addr.city, addr.state, addr.pincode].filter(p => p && p.trim()).join(', ');
  return [addr.addressLine1, addr.addressLine2, line2].filter(p => p && p.trim()).join('\n');
}

export function getCurrentAdminEmail(): string {
  return getAuth().currentUser?.email ?? 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────

export function validateMemberBasics(name: string, gender: string): string | null {
  if (!name || !name.trim()) return 'Please enter the member’s name.';
  if (name.trim().length < 2) return 'Name must be at least 2 characters.';
  if (gender !== 'MALE' && gender !== 'FEMALE') return 'Please select a gender.';
  return null;
}

export function validateMemberForm(input: MemberFormInput): string | null {
  const basics = validateMemberBasics(input.name, input.gender);
  if (basics) return basics;
  const phoneErr = validatePhoneOptional(input.phoneNumber);
  if (phoneErr) return phoneErr;
  const emailErr = validateEmailOptional(input.email);
  if (emailErr) return emailErr;
  return null;
}

export function validateFamilyName(name: string): string | null {
  if (!name || !name.trim()) return 'Please enter a family name.';
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// Audit log
// ─────────────────────────────────────────────────────────────────────────

export async function logAudit(
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: string,
  branchId: string,
  performedBy: string,
  details: Record<string, any> = {}
): Promise<void> {
  try {
    await addDoc(collection(db, 'adminAuditLogs'), {
      action,
      entityType,
      entityId,
      branchId,
      performedBy,
      performedAt: serverTimestamp(),
      details,
    });
  } catch (e) {
    // Audit logging must never block the primary admin action.
    console.error('Failed to write audit log', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Branches
// ─────────────────────────────────────────────────────────────────────────

// Fixed display order (Tirupur, Coimbatore, Udumalaipettai, Kanyakumari)
// rather than alphabetical — any future branch not in this list sorts
// alphabetically after the known ones.
const SEED_BRANCH_ORDER = new Map(SEED_BRANCHES.map((b, i) => [b.id, i]));

export function subscribeBranches(cb: (branches: Branch[]) => void, onError?: (e: any) => void) {
  return onSnapshot(
    collection(db, 'branches'),
    snap => {
      const list: Branch[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      list.sort((a, b) => {
        const orderA = SEED_BRANCH_ORDER.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const orderB = SEED_BRANCH_ORDER.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });
      cb(list);
    },
    onError
  );
}

// Idempotent: only creates branch docs that don't already exist. Safe to
// call every time the Church Members module mounts.
export async function ensureSeedBranches(actorEmail: string): Promise<void> {
  for (const b of SEED_BRANCHES) {
    const ref = doc(db, 'branches', b.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        name: b.name,
        code: b.code,
        address: '',
        phoneNumber: '',
        status: 'ACTIVE',
        createdAt: serverTimestamp(),
        createdBy: actorEmail,
        updatedAt: serverTimestamp(),
        updatedBy: actorEmail,
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Families / Members — live data
// ─────────────────────────────────────────────────────────────────────────

export function subscribeFamilies(cb: (families: Family[]) => void, onError?: (e: any) => void) {
  return onSnapshot(
    collection(db, 'families'),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))),
    onError
  );
}

export function subscribeMembers(cb: (members: Member[]) => void, onError?: (e: any) => void) {
  return onSnapshot(
    collection(db, 'members'),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))),
    onError
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Search / filter helpers (shared by dashboard, branch list, reports)
// ─────────────────────────────────────────────────────────────────────────

export function memberMatchesSearch(m: Member, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return m.name.toLowerCase().includes(needle) || toDigitsOnly(m.phoneNumber ?? '').includes(toDigitsOnly(needle) || needle);
}

export function familyMatchesSearch(f: Family, members: Member[], q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  if (f.familyName.toLowerCase().includes(needle)) return true;
  if (toDigitsOnly(f.familyPhone ?? '').includes(toDigitsOnly(needle) || needle)) return true;
  return members.some(m => m.familyId === f.id && memberMatchesSearch(m, q));
}

export function familyHead(familyId: string, members: Member[]): Member | undefined {
  return members.find(m => m.familyId === familyId && m.isFamilyHead);
}

export function membersOfFamily(familyId: string, members: Member[]): Member[] {
  return members.filter(m => m.familyId === familyId).sort((a, b) => (b.isFamilyHead ? 1 : 0) - (a.isFamilyHead ? 1 : 0));
}

// A family's overall status for badge/filter purposes: ACTIVE if any member
// is active, else INACTIVE.
export function familyDisplayStatus(familyId: string, members: Member[]): MembershipStatus {
  const list = members.filter(m => m.familyId === familyId);
  if (list.some(m => m.membershipStatus === 'ACTIVE')) return 'ACTIVE';
  return 'INACTIVE';
}

export type TypeFilter = 'families' | 'singles';

export interface ListFilterParams {
  branchScope?: string;
  // undefined = both families and singles included ("All").
  typeFilter?: TypeFilter;
  // undefined = every status included ("All").
  statusFilter?: MembershipStatus;
  search: string;
}

export interface FilteredResult {
  families: Family[];
  singleMembers: Member[];
}

// Single source of truth for "which families/singles match the current
// branch + type filter + status filter + search" — shared by the on-screen
// card list and the export flow so what's exported always matches what's
// displayed. Type and status are independent axes (e.g. "Inactive Families"
// is a valid combination).
export function filterFamiliesAndMembers(families: Family[], members: Member[], params: ListFilterParams): FilteredResult {
  const q = params.search.trim().toLowerCase();
  const scopedFamilies = params.branchScope ? families.filter(f => f.branchId === params.branchScope) : families;
  const scopedMembers = params.branchScope ? members.filter(m => m.branchId === params.branchScope) : members;
  const scopedSingles = scopedMembers.filter(m => m.membershipType === 'SINGLE');

  const includeFamilies = params.typeFilter !== 'singles';
  const includeSingles = params.typeFilter !== 'families';

  const filteredFamilies = includeFamilies
    ? scopedFamilies.filter(f => {
        if (!familyMatchesSearch(f, members, q)) return false;
        // A family matches a status filter if ANY of its members has that
        // status — not just the family's aggregate display status (which
        // always prefers ACTIVE). Otherwise a family with one Active and one
        // Inactive member could never be found under the Inactive filter.
        if (params.statusFilter) return members.some(m => m.familyId === f.id && m.membershipStatus === params.statusFilter);
        return true;
      })
    : [];

  const filteredSingles = includeSingles
    ? scopedSingles.filter(m => {
        if (!memberMatchesSearch(m, q)) return false;
        if (params.statusFilter) return m.membershipStatus === params.statusFilter;
        return true;
      })
    : [];

  return { families: filteredFamilies, singleMembers: filteredSingles };
}

// Expands a filtered families+singles result into the full flat list of
// individual Member records (every member of each matched family, plus the
// matched singles) — used for CSV/Excel/PDF export rows.
// Groups each matched family's members together (head first), since exports
// must always keep a family together rather than scattering its members in
// whatever order they happen to sit in the source array.
export function expandFamilyMembersGrouped(result: FilteredResult, allMembers: Member[]): Member[] {
  const membersByFamily = new Map<string, Member[]>();
  for (const m of allMembers) {
    if (!m.familyId) continue;
    const list = membersByFamily.get(m.familyId);
    if (list) list.push(m);
    else membersByFamily.set(m.familyId, [m]);
  }
  return result.families.flatMap(f => {
    const famMembers = membersByFamily.get(f.id) ?? [];
    return [...famMembers].sort((a, b) => (b.isFamilyHead ? 1 : 0) - (a.isFamilyHead ? 1 : 0));
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Member doc builder
// ─────────────────────────────────────────────────────────────────────────

interface BuildMemberDocParams extends MemberFormInput {
  branchId: string;
  familyId: string | null;
  membershipType: MembershipType;
  relationship: Relationship | '';
  isFamilyHead: boolean;
}

function buildMemberDoc(input: BuildMemberDocParams, actorEmail: string) {
  return {
    branchId: input.branchId,
    familyId: input.familyId,
    membershipType: input.membershipType,
    name: input.name.trim(),
    gender: input.gender,
    dateOfBirth: dateToTimestamp(input.dateOfBirth),
    phoneNumber: input.phoneNumber?.trim() || null,
    baptismDate: dateToTimestamp(input.baptismDate),
    memberSince: dateToTimestamp(input.memberSince),
    maritalStatus: input.maritalStatus || null,
    marriageDate: dateToTimestamp(input.marriageDate),
    relationship: input.membershipType === 'FAMILY' ? (input.relationship || null) : null,
    isFamilyHead: input.isFamilyHead,
    membershipStatus: input.membershipStatus || 'ACTIVE',
    address: input.membershipType === 'SINGLE' && hasAddress(input.address) ? input.address : null,
    email: input.email?.trim() || null,
    notes: input.notes?.trim() || null,
    createdAt: serverTimestamp(),
    createdBy: actorEmail,
    updatedAt: serverTimestamp(),
    updatedBy: actorEmail,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Create — Family (atomic: family + head + other members in one batch)
// ─────────────────────────────────────────────────────────────────────────

export interface CreateFamilyParams {
  branchId: string;
  familyPhone: string;
  address: Address;
  headInput: MemberFormInput;
  otherMembers: MemberFormInput[];
}

export async function createFamilyWithMembers(params: CreateFamilyParams, actorEmail: string): Promise<string> {
  if (!params.branchId) throw new Error('Please select a branch.');
  const phoneErr = validatePhoneOptional(params.familyPhone);
  if (phoneErr) throw new Error(phoneErr);

  const headErr = validateMemberForm(params.headInput);
  if (headErr) throw new Error(`Family Head: ${headErr}`);

  for (const m of params.otherMembers) {
    const err = validateMemberForm(m);
    if (err) throw new Error(`${m.name || 'Family member'}: ${err}`);
    if (!m.relationship) throw new Error(`${m.name}: Please select a relationship.`);
  }

  // Family name is derived from the head — e.g. "Bro. Kumar Family" — not
  // typed separately. validateMemberForm above already guarantees name/gender.
  const familyName = `${nameWithHonorific(params.headInput.name.trim(), params.headInput.gender as Gender)} Family`;

  const familyRef = doc(collection(db, 'families'));
  const batch = writeBatch(db);

  batch.set(familyRef, {
    branchId: params.branchId,
    familyName,
    familyPhone: params.familyPhone.trim() || null,
    address: hasAddress(params.address) ? params.address : null,
    status: 'ACTIVE',
    createdAt: serverTimestamp(),
    createdBy: actorEmail,
    updatedAt: serverTimestamp(),
    updatedBy: actorEmail,
  });

  const headRef = doc(collection(db, 'members'));
  batch.set(
    headRef,
    buildMemberDoc(
      { ...params.headInput, branchId: params.branchId, familyId: familyRef.id, membershipType: 'FAMILY', relationship: 'FAMILY_HEAD', isFamilyHead: true },
      actorEmail
    )
  );

  const otherRefs = params.otherMembers.map(m => doc(collection(db, 'members')));
  params.otherMembers.forEach((m, i) => {
    batch.set(
      otherRefs[i],
      buildMemberDoc(
        { ...m, branchId: params.branchId, familyId: familyRef.id, membershipType: 'FAMILY', isFamilyHead: false },
        actorEmail
      )
    );
  });

  await batch.commit();

  await logAudit('CREATE_FAMILY', 'FAMILY', familyRef.id, params.branchId, actorEmail, {
    familyName,
    memberCount: 1 + params.otherMembers.length,
  });
  await logAudit('CREATE_MEMBER', 'MEMBER', headRef.id, params.branchId, actorEmail, {
    name: params.headInput.name.trim(),
    isFamilyHead: true,
    familyId: familyRef.id,
  });
  for (let i = 0; i < otherRefs.length; i++) {
    await logAudit('CREATE_MEMBER', 'MEMBER', otherRefs[i].id, params.branchId, actorEmail, {
      name: params.otherMembers[i].name.trim(),
      relationship: params.otherMembers[i].relationship,
      familyId: familyRef.id,
    });
  }

  return familyRef.id;
}

// ─────────────────────────────────────────────────────────────────────────
// Create — Single member
// ─────────────────────────────────────────────────────────────────────────

export async function createSingleMember(branchId: string, input: MemberFormInput, actorEmail: string): Promise<string> {
  if (!branchId) throw new Error('Please select a branch.');
  const err = validateMemberForm(input);
  if (err) throw new Error(err);

  const ref = doc(collection(db, 'members'));
  await setDoc(
    ref,
    buildMemberDoc({ ...input, branchId, familyId: null, membershipType: 'SINGLE', relationship: '', isFamilyHead: false }, actorEmail)
  );
  await logAudit('CREATE_MEMBER', 'MEMBER', ref.id, branchId, actorEmail, { name: input.name.trim(), membershipType: 'SINGLE' });
  return ref.id;
}

// ─────────────────────────────────────────────────────────────────────────
// Add a member to an existing family
// ─────────────────────────────────────────────────────────────────────────

export async function addFamilyMember(family: Family, input: MemberFormInput, actorEmail: string): Promise<string> {
  const err = validateMemberForm(input);
  if (err) throw new Error(err);
  if (!input.relationship) throw new Error('Please select a relationship.');

  const ref = doc(collection(db, 'members'));
  await setDoc(
    ref,
    buildMemberDoc(
      { ...input, branchId: family.branchId, familyId: family.id, membershipType: 'FAMILY', isFamilyHead: false },
      actorEmail
    )
  );
  await logAudit('ADD_FAMILY_MEMBER', 'MEMBER', ref.id, family.branchId, actorEmail, {
    name: input.name.trim(),
    relationship: input.relationship,
    familyId: family.id,
  });
  return ref.id;
}

// ─────────────────────────────────────────────────────────────────────────
// Update member (full edit form)
// ─────────────────────────────────────────────────────────────────────────

export async function updateMemberFull(before: Member, input: MemberFormInput, actorEmail: string): Promise<void> {
  const err = validateMemberForm(input);
  if (err) throw new Error(err);
  if (before.membershipType === 'FAMILY' && !before.isFamilyHead && !input.relationship) {
    throw new Error('Please select a relationship.');
  }

  const payload: Record<string, any> = {
    name: input.name.trim(),
    gender: input.gender,
    dateOfBirth: dateToTimestamp(input.dateOfBirth),
    phoneNumber: input.phoneNumber.trim() || null,
    baptismDate: dateToTimestamp(input.baptismDate),
    memberSince: dateToTimestamp(input.memberSince),
    maritalStatus: input.maritalStatus || null,
    marriageDate: dateToTimestamp(input.marriageDate),
    membershipStatus: input.membershipStatus,
    email: input.email.trim() || null,
    notes: input.notes.trim() || null,
    updatedAt: serverTimestamp(),
    updatedBy: actorEmail,
  };

  if (before.membershipType === 'FAMILY' && !before.isFamilyHead) {
    payload.relationship = input.relationship || null;
  }
  if (before.membershipType === 'SINGLE') {
    payload.address = hasAddress(input.address) ? input.address : null;
  }

  await updateDoc(doc(db, 'members', before.id), payload);

  const statusChanged = input.membershipStatus !== before.membershipStatus;
  await logAudit('UPDATE_MEMBER', 'MEMBER', before.id, before.branchId, actorEmail, { name: input.name.trim() });
  if (statusChanged) {
    await logAudit('STATUS_CHANGE', 'MEMBER', before.id, before.branchId, actorEmail, {
      from: before.membershipStatus,
      to: input.membershipStatus,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Status-only changes
// ─────────────────────────────────────────────────────────────────────────

export async function updateMemberStatus(member: Member, status: MembershipStatus, actorEmail: string): Promise<void> {
  await updateDoc(doc(db, 'members', member.id), {
    membershipStatus: status,
    updatedAt: serverTimestamp(),
    updatedBy: actorEmail,
  });
  await logAudit('STATUS_CHANGE', 'MEMBER', member.id, member.branchId, actorEmail, {
    from: member.membershipStatus,
    to: status,
  });
}

// Soft-delete: member record is preserved, only its status changes.
export async function deactivateMember(
  member: Member,
  actorEmail: string,
  auditAction: 'DEACTIVATE_MEMBER' | 'REMOVE_FAMILY_MEMBER' = 'DEACTIVATE_MEMBER'
): Promise<void> {
  await updateDoc(doc(db, 'members', member.id), {
    membershipStatus: 'INACTIVE',
    updatedAt: serverTimestamp(),
    updatedBy: actorEmail,
  });
  await logAudit(auditAction, 'MEMBER', member.id, member.branchId, actorEmail, {
    name: member.name,
    previousStatus: member.membershipStatus,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Family — update / deactivate / reactivate
// ─────────────────────────────────────────────────────────────────────────

export interface FamilyEditInput {
  branchId: string;
  familyName: string;
  familyPhone: string;
  address: Address;
}

export async function updateFamily(before: Family, input: FamilyEditInput, actorEmail: string): Promise<void> {
  if (!input.branchId) throw new Error('Please select a branch.');
  const nameErr = validateFamilyName(input.familyName);
  if (nameErr) throw new Error(nameErr);
  const phoneErr = validatePhoneOptional(input.familyPhone);
  if (phoneErr) throw new Error(phoneErr);

  await updateDoc(doc(db, 'families', before.id), {
    branchId: input.branchId,
    familyName: input.familyName.trim(),
    familyPhone: input.familyPhone.trim() || null,
    address: hasAddress(input.address) ? input.address : null,
    updatedAt: serverTimestamp(),
    updatedBy: actorEmail,
  });

  await logAudit('UPDATE_FAMILY', 'FAMILY', before.id, input.branchId, actorEmail, { familyName: input.familyName.trim() });
}

// Deactivates the family and every currently-active member in it (soft —
// nothing is deleted). The caller is responsible for showing a confirmation
// that states this effect before calling.
export async function deactivateFamily(family: Family, members: Member[], actorEmail: string): Promise<number> {
  const affected = members.filter(m => m.familyId === family.id && m.membershipStatus === 'ACTIVE');
  const batch = writeBatch(db);
  batch.update(doc(db, 'families', family.id), {
    status: 'INACTIVE',
    updatedAt: serverTimestamp(),
    updatedBy: actorEmail,
  });
  for (const m of affected) {
    batch.update(doc(db, 'members', m.id), {
      membershipStatus: 'INACTIVE',
      updatedAt: serverTimestamp(),
      updatedBy: actorEmail,
    });
  }
  await batch.commit();

  await logAudit('DEACTIVATE_FAMILY', 'FAMILY', family.id, family.branchId, actorEmail, {
    familyName: family.familyName,
    membersDeactivated: affected.length,
  });
  return affected.length;
}

// Reactivates the family and every currently-inactive member in it, mirroring
// deactivateFamily's cascade so the family's members stay in sync with it.
export async function reactivateFamily(family: Family, members: Member[], actorEmail: string): Promise<number> {
  const affected = members.filter(m => m.familyId === family.id && m.membershipStatus === 'INACTIVE');
  const batch = writeBatch(db);
  batch.update(doc(db, 'families', family.id), {
    status: 'ACTIVE',
    updatedAt: serverTimestamp(),
    updatedBy: actorEmail,
  });
  for (const m of affected) {
    batch.update(doc(db, 'members', m.id), {
      membershipStatus: 'ACTIVE',
      updatedAt: serverTimestamp(),
      updatedBy: actorEmail,
    });
  }
  await batch.commit();

  await logAudit('REACTIVATE_FAMILY', 'FAMILY', family.id, family.branchId, actorEmail, {
    familyName: family.familyName,
    membersReactivated: affected.length,
  });
  return affected.length;
}

// ─────────────────────────────────────────────────────────────────────────
// Permanent delete — irreversible, hard-removes the Firestore document(s).
// This bypasses the "preserve for historical purposes" rule the rest of
// this module follows; callers must confirm with the admin before invoking.
// ─────────────────────────────────────────────────────────────────────────

export async function permanentlyDeleteMember(member: Member, actorEmail: string): Promise<void> {
  await deleteDoc(doc(db, 'members', member.id));
  await logAudit('PERMANENT_DELETE_MEMBER', 'MEMBER', member.id, member.branchId, actorEmail, {
    name: member.name,
    membershipType: member.membershipType,
    familyId: member.familyId,
    isFamilyHead: member.isFamilyHead,
    previousStatus: member.membershipStatus,
  });
}

// Cascades: permanently deletes the family document and every member that
// belongs to it (family head and other members alike) in one atomic batch.
export async function permanentlyDeleteFamily(family: Family, members: Member[], actorEmail: string): Promise<number> {
  const familyMembers = members.filter(m => m.familyId === family.id);
  const batch = writeBatch(db);
  batch.delete(doc(db, 'families', family.id));
  for (const m of familyMembers) {
    batch.delete(doc(db, 'members', m.id));
  }
  await batch.commit();

  await logAudit('PERMANENT_DELETE_FAMILY', 'FAMILY', family.id, family.branchId, actorEmail, {
    familyName: family.familyName,
    memberCount: familyMembers.length,
    memberNames: familyMembers.map(m => m.name),
  });
  return familyMembers.length;
}

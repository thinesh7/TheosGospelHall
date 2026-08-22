import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Linking, Modal, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../AppText';
import {
  formatPhoneDisplay,
  MembershipStatus,
  MEMBERSHIP_STATUS_BG,
  MEMBERSHIP_STATUS_COLORS,
  MEMBERSHIP_STATUS_DOT,
  MEMBERSHIP_STATUS_LABELS,
  toWhatsAppNumber,
} from '../../../utils/churchMembers';

// ─────────────────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────────────────

export function StatusBadge({ status, small }: { status: MembershipStatus; small?: boolean }) {
  return (
    <View style={[styles.badge, { backgroundColor: MEMBERSHIP_STATUS_BG[status] }, small && styles.badgeSmall]}>
      <Text style={[styles.badgeText, { color: MEMBERSHIP_STATUS_COLORS[status] }, small && styles.badgeTextSmall]}>
        {MEMBERSHIP_STATUS_DOT[status]} {MEMBERSHIP_STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Contact actions: Copy / Call / WhatsApp — hidden entirely if no phone
// ─────────────────────────────────────────────────────────────────────────

export function ContactActions({ phone, onCopied }: { phone: string | null | undefined; onCopied?: () => void }) {
  if (!phone || !phone.trim()) return null;
  const digits = phone.trim();
  return (
    <View style={styles.contactRow}>
      <TouchableOpacity
        style={[styles.contactBtn, { backgroundColor: '#e8f0fe' }]}
        onPress={async () => {
          await Clipboard.setStringAsync(digits);
          onCopied?.();
        }}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name="copy-outline" size={15} color="#0f3460" />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.contactBtn, { backgroundColor: '#e6f7ec' }]}
        onPress={() => Linking.openURL(`tel:${digits}`)}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name="call" size={15} color="#1e9e50" />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.contactBtn, { backgroundColor: '#e2f9ea' }]}
        onPress={() => Linking.openURL(`https://wa.me/${toWhatsAppNumber(digits)}`)}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name="logo-whatsapp" size={15} color="#25d366" />
      </TouchableOpacity>
    </View>
  );
}

export function PhoneRow({ label, phone, onCopied }: { label: string; phone: string | null | undefined; onCopied?: () => void }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.detailValueRow}>
        <Text style={styles.detailValue}>{phone ? formatPhoneDisplay(phone) : '—'}</Text>
        <ContactActions phone={phone} onCopied={onCopied} />
      </View>
    </View>
  );
}

export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Initial-letter avatar circle (Family/Member Details header)
// ─────────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#0f3460', '#6a4c93', '#c2185b', '#1565c0', '#e65100', '#1e9e50'];

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initial = (name.trim().charAt(0) || '?').toUpperCase();
  const colorIndex = name.trim().length ? name.trim().charCodeAt(0) % AVATAR_COLORS.length : 0;
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: AVATAR_COLORS[colorIndex] },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>{initial}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Date field (tap to open native picker)
// ─────────────────────────────────────────────────────────────────────────

interface DateFieldProps {
  label: string;
  value: Date | null;
  onChange: (d: Date | null) => void;
  maximumDate?: Date;
  minimumDate?: Date;
  clearable?: boolean;
}

export function DateField({ label, value, onChange, maximumDate, minimumDate, clearable = true }: DateFieldProps) {
  const [show, setShow] = useState(false);

  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <View style={styles.dateFieldRow}>
        <TouchableOpacity style={[styles.formInput, { flex: 1 }]} onPress={() => setShow(true)}>
          <Text style={{ color: value ? '#1a1a2e' : '#999', fontSize: 15 }}>
            {value ? value.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : `Select ${label.replace(' (Optional)', '').toLowerCase()}`}
          </Text>
        </TouchableOpacity>
        {clearable && value && (
          <TouchableOpacity style={styles.dateClearBtn} onPress={() => onChange(null)}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>
      {show && (
        <DateTimePicker
          value={value ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          onChange={(event, selected) => {
            if (Platform.OS === 'android') {
              setShow(false);
              if (event.type === 'set' && selected) onChange(selected);
            } else if (selected) {
              onChange(selected);
            }
          }}
        />
      )}
      {Platform.OS === 'ios' && show && (
        <TouchableOpacity style={styles.dateDoneBtn} onPress={() => setShow(false)}>
          <Text style={styles.dateDoneBtnText}>Done</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Segmented single-select — used only for tab-style filters (list screens),
// not for form fields (those use DropdownField below to match the reference
// UI's bordered picker look).
// ─────────────────────────────────────────────────────────────────────────

export function SegmentedField<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | '';
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <View style={styles.segmentWrap}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.segmentBtn, value === opt.value && styles.segmentBtnActive]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[styles.segmentBtnText, value === opt.value && styles.segmentBtnTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Compact inline dropdown (no label) — a rounded pill trigger for toolbars,
// e.g. the "All Branches ▾" scope selector on list/report screens.
// ─────────────────────────────────────────────────────────────────────────

export function CompactDropdown<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <>
      <TouchableOpacity style={styles.compactDropdown} onPress={() => setOpen(true)}>
        <Text style={styles.compactDropdownText} numberOfLines={1}>{selected?.label ?? title}</Text>
        <Ionicons name="chevron-down" size={16} color="#0f3460" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.dropdownBackdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.dropdownCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.dropdownCardTitle}>{title}</Text>
            {options.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={styles.dropdownOption}
                onPress={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <Text style={[styles.dropdownOptionText, value === opt.value && styles.dropdownOptionTextActive]}>{opt.label}</Text>
                {value === opt.value && <Ionicons name="checkmark" size={18} color="#0f3460" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.dropdownCancel} onPress={() => setOpen(false)}>
              <Text style={styles.dropdownCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Dropdown picker field — a bordered box showing the selected label with a
// chevron, opening a modal option list on tap. Used for Branch, Gender,
// Relationship, Marital Status and Membership Status everywhere.
// ─────────────────────────────────────────────────────────────────────────

export function DropdownField<T extends string>({
  label,
  placeholder = 'Select',
  options,
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  options: { value: T; label: string }[];
  value: T | '';
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <TouchableOpacity style={styles.dropdownField} onPress={() => setOpen(true)}>
        <Text style={{ color: selected ? '#1a1a2e' : '#999', fontSize: 15 }}>{selected ? selected.label : placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color="#888" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.dropdownBackdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.dropdownCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.dropdownCardTitle}>{label.replace(' *', '').replace(' (Optional)', '')}</Text>
            {options.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={styles.dropdownOption}
                onPress={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <Text style={[styles.dropdownOptionText, value === opt.value && styles.dropdownOptionTextActive]}>{opt.label}</Text>
                {value === opt.value && <Ionicons name="checkmark" size={18} color="#0f3460" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.dropdownCancel} onPress={() => setOpen(false)}>
              <Text style={styles.dropdownCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

export const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start' },
  badgeSmall: { paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgeTextSmall: { fontSize: 11 },
  contactRow: { flexDirection: 'row', gap: 6 },
  contactBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  detailRow: { marginBottom: 14 },
  detailLabel: { fontSize: 11, fontWeight: '600', color: '#888', textTransform: 'uppercase', marginBottom: 3 },
  detailValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailValue: { fontSize: 15, color: '#1a1a2e' },
  formField: { marginBottom: 14 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  formInput: { backgroundColor: '#fff', borderRadius: 10, padding: 12, fontSize: 15, elevation: 2, borderWidth: 1, borderColor: '#eee', color: '#1a1a2e' },
  formInputMulti: { minHeight: 70, textAlignVertical: 'top' },
  dateFieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateClearBtn: { padding: 4 },
  dateDoneBtn: { backgroundColor: '#0f3460', borderRadius: 10, padding: 10, alignItems: 'center', marginTop: 8 },
  dateDoneBtnText: { color: '#fff', fontWeight: '600' },
  segmentWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segmentBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee' },
  segmentBtnActive: { backgroundColor: '#0f3460', borderColor: '#0f3460' },
  segmentBtnText: { fontSize: 13, fontWeight: '600', color: '#555' },
  segmentBtnTextActive: { color: '#fff' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },
  compactDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#eee',
    elevation: 2,
  },
  compactDropdownText: { fontSize: 13, fontWeight: '700', color: '#0f3460' },
  dropdownField: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  dropdownCard: { backgroundColor: '#fff', borderRadius: 16, padding: 12, width: '100%', maxWidth: 340, maxHeight: '70%', elevation: 8 },
  dropdownCardTitle: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', paddingHorizontal: 10, paddingVertical: 10 },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#f2f2f2',
  },
  dropdownOptionText: { fontSize: 15, color: '#333' },
  dropdownOptionTextActive: { color: '#0f3460', fontWeight: '700' },
  dropdownCancel: { alignItems: 'center', paddingVertical: 13, marginTop: 4 },
  dropdownCancelText: { fontSize: 14, color: '#888', fontWeight: '600' },
});

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { collection, onSnapshot } from 'firebase/firestore';
import { forwardRef, ReactNode, useCallback, useImperativeHandle, useMemo, useState } from 'react';
import { Linking, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useAppDialog } from '../AppDialog';
import { Text } from '../AppText';
import { TextInput } from '../AppTextInput';
import { Toast, useToast } from '../Toast';
import { db } from '../../firebaseConfig';
import {
  countForStatus,
  ExportDataSets,
  ExportFormat,
  exportRegistrations,
  ExportStatusOption,
  STATUS_OPTION_LABELS,
} from '../../utils/exportRegistrations';
import {
  computeAge,
  formatDateDisplay,
  formatPhoneDisplay,
  formatTimestampIST,
  permanentlyDeleteRegistration,
  phoneToDocId,
  ProgramId,
  PROGRAMS,
  Registration,
  RegistrationStatus,
  restoreRegistration,
  softDeleteRegistration,
  STATUS_LABELS,
  updateRegistrationStatus,
} from '../../utils/registrations';
import { useTheme } from '../../utils/ThemeContext';
import { AdminScreenHandle } from './SpecialMeetingsAdmin';

type FilterMode = 'registered' | 'accepted' | 'deleted';

function bySearch(list: Registration[], q: string): Registration[] {
  return !q ? list : list.filter(r => r.name.toLowerCase().includes(q) || r.phone.toLowerCase().includes(q));
}

interface Props {
  programId: ProgramId;
}

const RegistrationsAdmin = forwardRef<AdminScreenHandle, Props>(({ programId }, ref) => {
  const dialog = useAppDialog();
  const { colors } = useTheme();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<FilterMode>('registered');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const { message, opacity, showToast } = useToast();

  useImperativeHandle(ref, () => ({
    goBack: () => {
      if (selectedId) { setSelectedId(null); return true; }
      return false;
    },
  }));

  // Focus-scoped rather than mount-scoped: the mobile admin Stack doesn't
  // force-unmount backgrounded routes, so a plain useEffect here would keep
  // this unbounded collection listener streaming updates to a screen the
  // admin has navigated away from (and could even stack two of them if
  // youth/academy are reached via repeated push). Subscribing only while
  // focused means exactly one screen ever holds this listener at a time.
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      const collectionName = programId === 'youth' ? 'youthProgramRegistrations' : 'academyRegistrations';
      const unsubscribe = onSnapshot(
        collection(db, collectionName),
        snapshot => {
          const list: Registration[] = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
          list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
          setRegistrations(list);
          setLoading(false);
        },
        () => setLoading(false)
      );
      return () => unsubscribe();
    }, [programId])
  );

  const selected = useMemo(
    () => registrations.find(r => r.id === selectedId) ?? null,
    [registrations, selectedId]
  );

  const registeredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bySearch(registrations.filter(r => !r.isDeleted && (r.status === 'registered' || r.status === 'followup')), q);
  }, [registrations, search]);
  const acceptedList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bySearch(registrations.filter(r => !r.isDeleted && r.status === 'accepted'), q);
  }, [registrations, search]);
  const deletedList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bySearch(registrations.filter(r => r.isDeleted), q);
  }, [registrations, search]);

  const currentList = filterMode === 'registered' ? registeredList : filterMode === 'accepted' ? acceptedList : deletedList;

  // Export always covers the full underlying data for the chosen status
  // (independent of the currently active tab/search), since the export
  // dialog lets the admin pick the status scope explicitly.
  const fullRegisteredList = useMemo(
    () => registrations.filter(r => !r.isDeleted && (r.status === 'registered' || r.status === 'followup')),
    [registrations]
  );
  const fullAcceptedList = useMemo(
    () => registrations.filter(r => !r.isDeleted && r.status === 'accepted'),
    [registrations]
  );
  const fullDeletedList = useMemo(() => registrations.filter(r => r.isDeleted), [registrations]);

  const exportDataSets: ExportDataSets = useMemo(
    () => ({ registered: fullRegisteredList, accepted: fullAcceptedList, deleted: fullDeletedList }),
    [fullRegisteredList, fullAcceptedList, fullDeletedList]
  );

  const handleExport = async (status: ExportStatusOption, format: ExportFormat) => {
    if (countForStatus(status, exportDataSets) === 0) {
      dialog.alert('No Records', 'No records available to export.');
      return;
    }
    setExporting(format);
    try {
      await exportRegistrations(format, programId, status, exportDataSets);
      showToast('✅ Export ready — choose where to save');
    } catch (e: any) {
      console.error('Export failed:', e);
      dialog.alert('Export Failed', `Could not generate the export file.\n\n${e?.message ?? String(e)}`);
    }
    setExporting(null);
  };

  const chooseFormat = (status: ExportStatusOption) => {
    setShowExportMenu(false);
    if (countForStatus(status, exportDataSets) === 0) {
      dialog.alert('No Records', 'No records available to export.');
      return;
    }
    dialog.alert(
      'Export Format',
      `Export ${STATUS_OPTION_LABELS[status]} registrations as:`,
      [
        { text: 'Excel (.xlsx)', onPress: () => handleExport(status, 'excel') },
        { text: 'PDF (.pdf)', onPress: () => handleExport(status, 'pdf') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleStatusChange = async (status: RegistrationStatus) => {
    if (!selected) return;
    setBusy(true);
    try {
      await updateRegistrationStatus(programId, selected.id, status);
      showToast(`✅ Status changed to ${STATUS_LABELS[status]}`);
    } catch {
      dialog.alert('Error', 'Could not update status. Check internet.');
    }
    setBusy(false);
  };

  const handleDelete = () => {
    if (!selected) return;
    dialog.alert('Reject Registration', `Reject registration for "${selected.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await softDeleteRegistration(programId, selected.id);
            setSelectedId(null);
            showToast('🚫 Registration rejected');
          } catch {
            dialog.alert('Error', 'Could not delete. Check internet.');
          }
          setBusy(false);
        },
      },
    ]);
  };

  const handleRestore = (status: RegistrationStatus) => {
    if (!selected) return;
    setBusy(true);
    restoreRegistration(programId, selected.id, status)
      .then(() => {
        setSelectedId(null);
        showToast(`♻️ Restored as ${STATUS_LABELS[status]}`);
      })
      .catch(() => dialog.alert('Error', 'Could not restore. Check internet.'))
      .finally(() => setBusy(false));
  };

  const handlePermanentDelete = () => {
    if (!selected) return;
    dialog.alert(
      'Permanently Delete',
      `Permanently delete the registration for "${selected.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await permanentlyDeleteRegistration(programId, selected.id);
              setSelectedId(null);
              showToast('🗑 Permanently deleted');
            } catch {
              dialog.alert('Error', 'Could not delete. Check internet.');
            }
            setBusy(false);
          },
        },
      ]
    );
  };

  const handleCopyDetails = async () => {
    if (!selected) return;
    const statusLabel = selected.isDeleted ? STATUS_OPTION_LABELS.deleted : STATUS_LABELS[selected.status];
    const age = computeAge(selected.dob);
    const lines = [
      `Program Name: ${PROGRAMS[programId].label}`,
      `Registration Date & Time: ${formatTimestampIST(selected.createdAt)}`,
      `Name: ${selected.name}`,
      `Age: ${age !== null ? `${age} years` : '—'}`,
      `Date of Birth: ${formatDateDisplay(selected.dob)}`,
      `Gender: ${selected.gender}`,
      `Mobile Number: ${formatPhoneDisplay(selected.phone)}`,
      `Place: ${selected.place}`,
      `Church Details: ${selected.churchDetails || '-'}`,
      `Registration Status: ${statusLabel}`,
    ];
    await Clipboard.setStringAsync(lines.join('\n'));
    showToast('📋 Registration details copied');
  };

  if (selected) {
    return (
      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <View style={styles.formHeader}>
          <TouchableOpacity onPress={() => setSelectedId(null)}>
            <Text style={[styles.formBackText, { color: colors.accent }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.formTitle, { color: colors.text, flex: 1 }]}>Registration Details</Text>
          <TouchableOpacity onPress={handleCopyDetails} style={[styles.copyBtn, { backgroundColor: colors.accent + '15' }]}>
            <Ionicons name="copy-outline" size={20} color={colors.accent} />
          </TouchableOpacity>
        </View>

        <View style={[styles.detailCard, { backgroundColor: colors.surface }]}>
          <DetailRow label="Name" value={selected.name} />
          <DetailRow label="Date of Birth" value={formatDateDisplay(selected.dob)} />
          <DetailRow label="Age" value={computeAge(selected.dob) !== null ? `${computeAge(selected.dob)} years` : '—'} />
          <DetailRow label="Gender" value={selected.gender} />
          <DetailRow
            label="Mobile Number"
            value={formatPhoneDisplay(selected.phone)}
            rightElement={
              <View style={styles.contactBtnRow}>
                <TouchableOpacity
                  style={[styles.contactBtn, { backgroundColor: '#25d366' }]}
                  onPress={() => Linking.openURL(`https://wa.me/${phoneToDocId(selected.phone)}`)}
                >
                  <Ionicons name="logo-whatsapp" size={16} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.contactBtn, { backgroundColor: '#22c55e' }]}
                  onPress={() => Linking.openURL(`tel:${selected.phone}`)}
                >
                  <Ionicons name="call" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            }
          />
          <DetailRow label="Place" value={selected.place} />
          <DetailRow label="Church Details" value={selected.churchDetails || '—'} />
          <DetailRow label="Registered Date" value={formatTimestampIST(selected.createdAt)} />
          {!!selected.modifiedBy && (
            <>
              <DetailRow label="Last Modified By" value={selected.modifiedBy} />
              <DetailRow label="Last Modified On" value={formatTimestampIST(selected.modifiedAt)} />
            </>
          )}
        </View>

        {!selected.isDeleted ? (
          <>
            <Text style={[styles.formLabel, { color: colors.subtext }]}>Status</Text>
            <View style={styles.segmentRow}>
              {(['registered', 'followup', 'accepted'] as RegistrationStatus[]).map(s => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.segmentBtn,
                    { backgroundColor: colors.surface, borderColor: colors.divider },
                    selected.status === s && { backgroundColor: colors.accent, borderColor: colors.accent },
                  ]}
                  disabled={busy}
                  onPress={() => handleStatusChange(s)}
                >
                  <Text style={[styles.segmentBtnText, { color: colors.subtext }, selected.status === s && styles.segmentBtnTextActive]}>
                    {STATUS_LABELS[s]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.deleteBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={handleDelete}>
              <Text style={styles.deleteBtnText}>🚫 Reject Registration</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={[styles.formLabel, { color: colors.subtext }]}>Restore As</Text>
            <View style={styles.segmentRow}>
              {(['registered', 'followup', 'accepted'] as RegistrationStatus[]).map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.segmentBtn, { backgroundColor: colors.surface, borderColor: colors.divider }]}
                  disabled={busy}
                  onPress={() => handleRestore(s)}
                >
                  <Text style={[styles.segmentBtnText, { color: colors.subtext }]}>{STATUS_LABELS[s]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.deleteBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={handlePermanentDelete}>
              <Text style={styles.deleteBtnText}>🗑 Permanently Delete</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
      <Toast message={message} opacity={opacity} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.toggleWrap, { backgroundColor: colors.bg }]}>
        <View style={styles.exportRow}>
          <TouchableOpacity
            style={[styles.exportBtn, { backgroundColor: colors.accent + '15' }, !!exporting && { opacity: 0.6 }]}
            disabled={!!exporting}
            onPress={() => setShowExportMenu(true)}
          >
            <Ionicons name={exporting ? 'hourglass-outline' : 'download-outline'} size={16} color={colors.accent} />
            <Text style={[styles.exportBtnText, { color: colors.accent }]}>{exporting ? 'Exporting...' : 'Export'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.segmentRow}>
          {(['registered', 'accepted', 'deleted'] as FilterMode[]).map(mode => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.segmentBtn,
                { backgroundColor: colors.surface, borderColor: colors.divider },
                filterMode === mode && { backgroundColor: colors.accent, borderColor: colors.accent },
              ]}
              onPress={() => { setFilterMode(mode); setSearch(''); }}
            >
              <Text style={[styles.segmentBtnText, { color: colors.subtext }, filterMode === mode && styles.segmentBtnTextActive]}>
                {mode === 'registered' ? 'Registered' : mode === 'accepted' ? 'Accepted' : 'Rejected'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
          <Ionicons name="search" size={18} color={colors.subtext} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search by name or mobile number..."
            placeholderTextColor={colors.subtext}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.subtext} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8 }}>
        {loading ? (
          <Text style={[styles.loadingText, { color: colors.subtext }]}>Loading registrations...</Text>
        ) : currentList.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.subtext }]}>No registrations here.</Text>
        ) : (
          currentList.map(r => (
            <TouchableOpacity key={r.id} style={[styles.card, { backgroundColor: colors.surface, borderLeftColor: colors.accent }]} onPress={() => setSelectedId(r.id)} activeOpacity={0.8}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{r.name}</Text>
                <Text style={[styles.cardMeta, { color: colors.subtext }]}>
                  {computeAge(r.dob) !== null ? `${computeAge(r.dob)} yrs` : '—'} • 📍 {r.place}
                </Text>
                <Text style={[styles.cardMeta, { color: colors.subtext }]}>🗓 Registered {formatTimestampIST(r.createdAt)}</Text>
                {filterMode === 'registered' && (
                  <View style={styles.cardStatusRow}>
                    <View style={[styles.statusDot, { backgroundColor: r.status === 'followup' ? '#f4a261' : colors.accent }]} />
                    <Text style={[styles.cardStatusText, { color: colors.subtext }]}>{STATUS_LABELS[r.status]}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.cardChevron, { color: colors.divider }]}>›</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal visible={showExportMenu} transparent animationType="fade" onRequestClose={() => setShowExportMenu(false)}>
        <TouchableOpacity
          style={styles.exportMenuBackdrop}
          activeOpacity={1}
          onPress={() => setShowExportMenu(false)}
        >
          <View style={[styles.exportMenuCard, { backgroundColor: colors.surface }]} onStartShouldSetResponder={() => true}>
            <Text style={[styles.exportMenuTitle, { color: colors.text }]}>Export Registrations</Text>
            <Text style={[styles.exportMenuSubtitle, { color: colors.subtext }]}>Choose which registrations to export</Text>
            {(['all', 'registered', 'accepted', 'deleted'] as ExportStatusOption[]).map(status => {
              const count = countForStatus(status, exportDataSets);
              return (
                <TouchableOpacity
                  key={status}
                  style={[styles.exportMenuOption, { borderBottomColor: colors.divider }, count === 0 && { opacity: 0.4 }]}
                  disabled={count === 0}
                  onPress={() => chooseFormat(status)}
                >
                  <Text style={[styles.exportMenuOptionText, { color: colors.accent }]}>{STATUS_OPTION_LABELS[status]}</Text>
                  <Text style={[styles.exportMenuOptionCount, { color: colors.subtext }]}>{count}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.exportMenuCancel} onPress={() => setShowExportMenu(false)}>
              <Text style={[styles.exportMenuCancelText, { color: colors.subtext }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Toast message={message} opacity={opacity} />
    </View>
  );
});

function DetailRow({ label, value, rightElement }: { label: string; value: string; rightElement?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.subtext }]}>{label}</Text>
      <View style={styles.detailValueRow}>
        <Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
        {rightElement}
      </View>
    </View>
  );
}

export default RegistrationsAdmin;

const styles = StyleSheet.create({
  toggleWrap: { padding: 16, paddingBottom: 8 },
  exportRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  exportBtnText: { fontWeight: '600', fontSize: 12 },
  exportMenuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  exportMenuCard: { borderRadius: 16, padding: 20, width: '100%', maxWidth: 340, elevation: 8 },
  exportMenuTitle: { fontSize: 17, fontWeight: 'bold', marginBottom: 4 },
  exportMenuSubtitle: { fontSize: 12, marginBottom: 16 },
  exportMenuOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  exportMenuOptionText: { fontSize: 15, fontWeight: '600' },
  exportMenuOptionCount: { fontSize: 13, fontWeight: '600' },
  exportMenuCancel: { alignItems: 'center', paddingVertical: 14, marginTop: 6 },
  exportMenuCancelText: { fontSize: 14, fontWeight: '600' },
  segmentRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  segmentBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  segmentBtnText: { fontSize: 13, fontWeight: '600' },
  segmentBtnTextActive: { color: '#fff' },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, elevation: 3, gap: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  loadingText: { textAlign: 'center', marginTop: 20 },
  emptyText: { textAlign: 'center', marginTop: 30, fontSize: 14, fontStyle: 'italic' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    elevation: 3,
    borderLeftWidth: 5,
  },
  cardTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  cardMeta: { fontSize: 12 },
  cardStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  cardStatusText: { fontSize: 12 },
  cardChevron: { fontSize: 26, marginLeft: 8, fontWeight: '300' },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  copyBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  formBackText: { fontWeight: '600', fontSize: 15 },
  formTitle: { fontSize: 17, fontWeight: 'bold' },
  detailCard: { borderRadius: 14, padding: 16, marginBottom: 20, elevation: 3 },
  detailRow: { marginBottom: 12 },
  detailLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  detailValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailValue: { fontSize: 15 },
  contactBtnRow: { flexDirection: 'row', gap: 8 },
  contactBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  formLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  deleteBtn: { backgroundColor: '#fdecea', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 4, marginBottom: 24 },
  deleteBtnText: { color: '#c62828', fontWeight: '600', fontSize: 14 },
});

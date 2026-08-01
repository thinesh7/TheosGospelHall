import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useAppDialog } from '../AppDialog';
import { Text } from '../AppText';
import { TextInput } from '../AppTextInput';
import {
  DEFAULT_CLOSED_MESSAGE,
  fetchRegistrationManagementConfig,
  RegistrationAvailability,
  saveRegistrationManagementConfig,
} from '../../utils/registrationManagement';
import { formatTimestampIST, ProgramId, PROGRAMS } from '../../utils/registrations';
import { useTheme } from '../../utils/ThemeContext';
import { AdminScreenHandle } from './SpecialMeetingsAdmin';

interface FormState {
  status: RegistrationAvailability;
  closedMessage: string;
  hideProgram: boolean;
  updatedAt?: any;
  updatedBy?: string;
  loading: boolean;
  saving: boolean;
}

const INITIAL_STATE: FormState = {
  status: 'open',
  closedMessage: DEFAULT_CLOSED_MESSAGE,
  hideProgram: false,
  loading: true,
  saving: false,
};

interface Props {
  programId: ProgramId;
}

const RegistrationManagementAdmin = forwardRef<AdminScreenHandle, Props>(({ programId }, ref) => {
  const dialog = useAppDialog();
  const { colors } = useTheme();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);

  useImperativeHandle(ref, () => ({
    goBack: () => false,
  }));

  const loadProgram = async () => {
    const config = await fetchRegistrationManagementConfig(programId);
    setForm({
      status: config.status,
      closedMessage: config.closedMessage,
      hideProgram: config.hideProgram,
      updatedAt: config.updatedAt,
      updatedBy: config.updatedBy,
      loading: false,
      saving: false,
    });
  };

  useEffect(() => {
    setForm(INITIAL_STATE);
    loadProgram();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId]);

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    const message = form.closedMessage.trim();
    // Only mandatory while Closed — the field is disabled (and can't be
    // edited) while the registration is Open, so there's nothing to validate
    // in that case.
    if (form.status === 'closed' && !message) {
      dialog.alert('Required', 'Please enter a closed message to show users while registration is closed.');
      return;
    }
    setField('saving', true);
    try {
      await saveRegistrationManagementConfig(programId, {
        status: form.status,
        closedMessage: message || DEFAULT_CLOSED_MESSAGE,
        hideProgram: form.hideProgram,
      });
      await loadProgram();
      dialog.alert('✅ Saved!', `${PROGRAMS[programId].label} registration settings have been saved.`);
    } catch {
      dialog.alert('Error', 'Could not save. Check internet.');
      setField('saving', false);
    }
  };

  // Home screen visibility only takes effect once Save Settings is pressed —
  // selecting Show/Hide here just stages the choice in local form state, so
  // the Home screen keeps showing today's saved state until a successful
  // save applies it. Only the destructive direction (Hide) is confirmed;
  // switching back to Show needs no confirmation.
  const handleShowProgram = () => setField('hideProgram', false);

  const handleHideProgram = () => {
    if (form.hideProgram) return;
    dialog.alert(
      'Warning',
      'This will hide the program from all users on the Home screen. Users will no longer be able to view or access this program.\n\nDo you want to continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Hide Program', style: 'destructive', onPress: () => setField('hideProgram', true) },
      ]
    );
  };

  if (form.loading) {
    return (
      <View style={styles.loadingBox}>
        <Text style={[styles.loadingText, { color: colors.subtext }]}>Loading...</Text>
      </View>
    );
  }

  const closedMessageInvalid = form.status === 'closed' && !form.closedMessage.trim();

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <View style={[styles.infoBox, { backgroundColor: colors.accent + '15' }]}>
        <Text style={[styles.infoText, { color: colors.text }]}>
          Set this registration to Open or Closed. When Closed, the registration option is grayed out for users and
          the message below is shown instead of the registration form. Hiding the program removes its card from the
          Home screen entirely, regardless of status.
        </Text>
      </View>

      <View style={[styles.programCard, { backgroundColor: colors.surface, borderLeftColor: colors.accent }]}>
        <Text style={[styles.programTitle, { color: colors.text }]}>{PROGRAMS[programId].label}</Text>

        {!!form.updatedAt && (
          <View style={[styles.auditBox, { backgroundColor: colors.raised, borderColor: colors.divider }]}>
            <Text style={[styles.auditText, { color: colors.subtext }]}>
              Last updated by <Text style={[styles.auditBold, { color: colors.text }]}>{form.updatedBy}</Text> on {formatTimestampIST(form.updatedAt)}
            </Text>
          </View>
        )}

        <View style={styles.formField}>
          <Text style={[styles.formLabel, { color: colors.subtext }]}>Registration Status</Text>
          <View style={styles.segmentRow}>
            {(['open', 'closed'] as RegistrationAvailability[]).map(status => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.segmentBtn,
                  { backgroundColor: colors.surfaceAlt, borderColor: colors.divider },
                  form.status === status && (status === 'open' ? styles.segmentBtnOpenActive : styles.segmentBtnClosedActive),
                ]}
                onPress={() => setField('status', status)}
              >
                <Text style={[styles.segmentBtnText, { color: colors.subtext }, form.status === status && styles.segmentBtnTextActive]}>
                  {status === 'open' ? 'Open' : 'Closed'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.formField}>
          <Text style={[styles.formLabel, { color: colors.subtext }]}>Closed Message (Shown to Users)</Text>
          <TextInput
            style={[
              styles.formInput,
              styles.formInputMulti,
              { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text },
              form.status === 'open' && [styles.formInputDisabled, { backgroundColor: colors.raised, color: colors.subtext }],
            ]}
            placeholder={DEFAULT_CLOSED_MESSAGE}
            placeholderTextColor={colors.subtext}
            value={form.closedMessage}
            onChangeText={v => setField('closedMessage', v)}
            multiline
            editable={form.status === 'closed'}
          />
          {closedMessageInvalid && (
            <Text style={styles.formErrorText}>Required while registration is Closed.</Text>
          )}
        </View>

        <View style={styles.formField}>
          <Text style={[styles.formLabel, { color: colors.subtext }]}>Home Screen Visibility</Text>
          <View style={styles.segmentRow}>
            <TouchableOpacity
              style={[styles.segmentBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider }, !form.hideProgram && styles.segmentBtnOpenActive]}
              onPress={handleShowProgram}
            >
              <Text style={[styles.segmentBtnText, { color: colors.subtext }, !form.hideProgram && styles.segmentBtnTextActive]}>Show</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentBtn, { backgroundColor: colors.surfaceAlt }, styles.hideBtn, form.hideProgram && styles.segmentBtnClosedActive]}
              onPress={handleHideProgram}
            >
              <Text style={[styles.segmentBtnText, styles.hideBtnText, form.hideProgram && styles.segmentBtnTextActive]}>Hide</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.hideHint, { color: colors.subtext }]}>
            Hiding removes this program&apos;s card from the Home screen for all users. Takes effect after you Save.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.accent }, (form.saving || closedMessageInvalid) && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={form.saving || closedMessageInvalid}
        >
          <Text style={styles.saveBtnText}>{form.saving ? 'Saving...' : '💾 Save Settings'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
});

export default RegistrationManagementAdmin;

const styles = StyleSheet.create({
  loadingBox: { padding: 40, alignItems: 'center' },
  loadingText: {},
  infoBox: { borderRadius: 12, padding: 14, marginBottom: 20 },
  infoText: { fontSize: 13, lineHeight: 19 },
  programCard: { borderRadius: 16, padding: 18, marginBottom: 20, elevation: 3, borderLeftWidth: 5 },
  programTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  auditBox: { borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1 },
  auditText: { fontSize: 12 },
  auditBold: { fontWeight: '700' },
  formField: { marginBottom: 16 },
  formLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  segmentRow: { flexDirection: 'row', gap: 10 },
  segmentBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  segmentBtnOpenActive: { backgroundColor: '#2d6a4f', borderColor: '#2d6a4f' },
  segmentBtnClosedActive: { backgroundColor: '#c0392b', borderColor: '#c0392b' },
  segmentBtnText: { fontSize: 13, fontWeight: '600' },
  segmentBtnTextActive: { color: '#fff' },
  hideBtn: { borderColor: '#c0392b' },
  hideBtnText: { color: '#c0392b' },
  formInput: { borderRadius: 10, padding: 12, fontSize: 15, elevation: 2, borderWidth: 1 },
  formInputMulti: { minHeight: 90, textAlignVertical: 'top' },
  formInputDisabled: { elevation: 0 },
  formErrorText: { color: '#c0392b', fontSize: 12, marginTop: 6 },
  hideHint: { fontSize: 12, marginTop: 8, lineHeight: 16 },
  saveBtn: { borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 4, elevation: 4 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});

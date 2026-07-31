import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../AppText';
import {
  fetchVideoMaintenanceConfig,
  saveVideoMaintenanceConfig,
} from '../../utils/videoMaintenance';
import { formatTimestampIST } from '../../utils/registrations';
import { AdminScreenHandle } from './SpecialMeetingsAdmin';

interface FormState {
  enabled: boolean;
  updatedAt?: any;
  updatedBy?: string;
  loading: boolean;
  saving: boolean;
}

const INITIAL_STATE: FormState = {
  enabled: false,
  loading: true,
  saving: false,
};

const VideoMaintenanceAdmin = forwardRef<AdminScreenHandle, {}>((_, ref) => {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);

  useImperativeHandle(ref, () => ({
    goBack: () => false,
  }));

  const loadConfig = async () => {
    const config = await fetchVideoMaintenanceConfig();
    setForm({
      enabled: config.enabled,
      updatedAt: config.updatedAt,
      updatedBy: config.updatedBy,
      loading: false,
      saving: false,
    });
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // Turning maintenance mode ON only stages the choice locally — it takes
  // effect only once Save Settings succeeds, matching the exact requirement
  // that a selected-but-unsaved change must not affect the Videos tab.
  const handleTurnOn = () => {
    if (form.enabled) return;
    Alert.alert(
      'Enable Maintenance Mode?',
      'Users will not be able to access the Videos section while maintenance mode is enabled. Instead, they will see a maintenance page.\n\nDo you want to continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Enable', style: 'destructive', onPress: () => setField('enabled', true) },
      ]
    );
  };

  const handleTurnOff = () => setField('enabled', false);

  const handleSave = async () => {
    setField('saving', true);
    try {
      await saveVideoMaintenanceConfig(form.enabled);
      await loadConfig();
      Alert.alert('✅ Saved!', 'Video maintenance settings have been saved.');
    } catch {
      Alert.alert('Error', 'Could not save. Check internet.');
      setField('saving', false);
    }
  };

  if (form.loading) {
    return (
      <View style={styles.loadingBox}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          When enabled, the Videos tab stays visible but shows a maintenance page to all users instead of its normal
          content. The change only takes effect after you press Save.
        </Text>
      </View>

      <View style={styles.programCard}>
        <Text style={styles.programTitle}>Video Maintenance Mode</Text>

        {!!form.updatedAt && (
          <View style={styles.auditBox}>
            <Text style={styles.auditText}>
              Last updated by <Text style={styles.auditBold}>{form.updatedBy}</Text> on {formatTimestampIST(form.updatedAt)}
            </Text>
          </View>
        )}

        <View style={styles.segmentRow}>
          <TouchableOpacity
            style={[styles.segmentBtn, !form.enabled && styles.segmentBtnOffActive]}
            onPress={handleTurnOff}
          >
            <Text style={[styles.segmentBtnText, !form.enabled && styles.segmentBtnTextActive]}>OFF</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, styles.onBtn, form.enabled && styles.segmentBtnOnActive]}
            onPress={handleTurnOn}
          >
            <Text style={[styles.segmentBtnText, styles.onBtnText, form.enabled && styles.segmentBtnTextActive]}>ON</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, form.saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={form.saving}
        >
          <Text style={styles.saveBtnText}>{form.saving ? 'Saving...' : '💾 Save Settings'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
});

export default VideoMaintenanceAdmin;

const styles = StyleSheet.create({
  loadingBox: { padding: 40, alignItems: 'center' },
  loadingText: { color: '#888' },
  infoBox: { backgroundColor: '#e8f0fe', borderRadius: 12, padding: 14, marginBottom: 20 },
  infoText: { fontSize: 13, color: '#333', lineHeight: 19 },
  programCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 20, elevation: 3, borderLeftWidth: 5, borderLeftColor: '#0f3460' },
  programTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 10 },
  auditBox: { backgroundColor: '#f5f5f5', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#eee' },
  auditText: { fontSize: 12, color: '#666' },
  auditBold: { fontWeight: '700', color: '#333' },
  segmentRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  segmentBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: '#eee', backgroundColor: '#fafafa', alignItems: 'center' },
  segmentBtnOffActive: { backgroundColor: '#2d6a4f', borderColor: '#2d6a4f' },
  segmentBtnOnActive: { backgroundColor: '#c0392b', borderColor: '#c0392b' },
  segmentBtnText: { fontSize: 14, fontWeight: '700', color: '#555' },
  segmentBtnTextActive: { color: '#fff' },
  onBtn: { borderColor: '#c0392b' },
  onBtnText: { color: '#c0392b' },
  saveBtn: { backgroundColor: '#0f3460', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 4, elevation: 4 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});

import Constants from 'expo-constants';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../AppText';
import { TextInput } from '../AppTextInput';
import {
  AppVersionConfig,
  compareVersions,
  DEFAULT_UPDATE_MESSAGE,
  fetchVersionConfig,
  isValidVersionFormat,
  saveVersionConfig,
} from '../../utils/appUpdate';
import { sendPushNotificationToAll } from '../../utils/pushNotify';
import { formatTimestampIST } from '../../utils/registrations';
import { AdminScreenHandle } from './SpecialMeetingsAdmin';

// Reads the version from app.json via the Expo config (not expo-application's
// nativeApplicationVersion): this project has no OTA update mechanism
// (no expo-updates dependency), so app.json's version always matches what's
// truly installed in a real build — and unlike nativeApplicationVersion,
// this also reads correctly when testing inside Expo Go, which otherwise
// reports the Expo Go host app's own version instead of this project's.
const INSTALLED_VERSION = Constants.expoConfig?.version ?? 'unknown';

const NOTIFY_TITLE = '📲 App Update Available';
const DEFAULT_NOTIFY_MESSAGE =
  '📲 🚀 A new update is available! ✨\n\n🌟 Update your TGH App from the Google Play Store and experience the latest enhancements.';

const AppUpdateAdmin = forwardRef<AdminScreenHandle, {}>((_, ref) => {
  const [latestVersion, setLatestVersion] = useState('');
  const [minimumRequiredVersion, setMinimumRequiredVersion] = useState('');
  // Tracks the version actually saved in Firestore (separate from the
  // editable `latestVersion` field above), so the summary banner keeps
  // showing what's currently live for users even while a draft edit is in
  // progress in the form below.
  const [configuredLatestVersion, setConfiguredLatestVersion] = useState('');
  const [updateMessage, setUpdateMessage] = useState(DEFAULT_UPDATE_MESSAGE);
  const [androidStoreUrl, setAndroidStoreUrl] = useState('');
  const [auditInfo, setAuditInfo] = useState<Pick<AppVersionConfig, 'updatedAt' | 'updatedBy'>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState(DEFAULT_NOTIFY_MESSAGE);
  const [sendingNotify, setSendingNotify] = useState(false);

  useImperativeHandle(ref, () => ({
    goBack: () => {
      if (showNotifyModal) { setShowNotifyModal(false); return true; }
      return false;
    },
  }));

  const loadConfig = async () => {
    const config = await fetchVersionConfig();
    setLatestVersion(config?.latestVersion ?? INSTALLED_VERSION);
    setConfiguredLatestVersion(config?.latestVersion ?? INSTALLED_VERSION);
    setMinimumRequiredVersion(config?.minimumRequiredVersion ?? INSTALLED_VERSION);
    setUpdateMessage(config?.updateMessage ?? DEFAULT_UPDATE_MESSAGE);
    setAndroidStoreUrl(config?.androidStoreUrl ?? 'https://play.google.com/store/apps/details?id=com.theosgospelhall.app');
    setAuditInfo({
      updatedAt: config?.updatedAt,
      updatedBy: config?.updatedBy,
    });
  };

  useEffect(() => {
    (async () => {
      await loadConfig();
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    const latest = latestVersion.trim();
    const minRequired = minimumRequiredVersion.trim();

    if (!latest || !minRequired) {
      Alert.alert('Required', 'Please enter both the latest and minimum required versions.');
      return;
    }
    if (!isValidVersionFormat(latest)) {
      Alert.alert('Invalid Format', 'Latest Version must be in the format number.number.number (e.g. 1.3.0).');
      return;
    }
    if (!isValidVersionFormat(minRequired)) {
      Alert.alert('Invalid Format', 'Minimum Required Version must be in the format number.number.number (e.g. 1.2.0).');
      return;
    }
    if (!androidStoreUrl.trim()) {
      Alert.alert('Required', 'Please enter the Play Store URL.');
      return;
    }
    if (compareVersions(minRequired, latest) > 0) {
      Alert.alert('Invalid Versions', 'Minimum Required Version cannot be higher than Latest Version.');
      return;
    }
    setSaving(true);
    try {
      await saveVersionConfig({
        latestVersion: latest,
        minimumRequiredVersion: minRequired,
        updateMessage: updateMessage.trim() || DEFAULT_UPDATE_MESSAGE,
        androidStoreUrl: androidStoreUrl.trim(),
      });
      await loadConfig();
      Alert.alert('✅ Saved!', 'App update settings have been saved.');
    } catch {
      Alert.alert('Error', 'Could not save. Check internet.');
    }
    setSaving(false);
  };

  const openNotifyModal = () => {
    setNotifyMessage(DEFAULT_NOTIFY_MESSAGE);
    setShowNotifyModal(true);
  };

  const handleSendNotify = async () => {
    const trimmed = notifyMessage.trim();
    if (!trimmed) {
      Alert.alert('Required', 'Please enter a notification message.');
      return;
    }
    setSendingNotify(true);
    try {
      const result = await sendPushNotificationToAll(NOTIFY_TITLE, trimmed);
      setShowNotifyModal(false);
      if (result.failedCount > 0) {
        Alert.alert(
          'Partially Sent',
          `✅ ${result.successCount} delivered\n❌ ${result.failedCount} failed\n\nCheck Firebase → notificationLogs for details.`
        );
      } else {
        Alert.alert('✅ Sent!', `Notification delivered to ${result.successCount} device${result.successCount === 1 ? '' : 's'}.`);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not send notification. Please try again.');
    }
    setSendingNotify(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const versionFormatError = 'Format must be number.number.number (e.g. 1.3.0)';
  const latestVersionInvalid = !!latestVersion.trim() && !isValidVersionFormat(latestVersion);
  const minimumVersionInvalid = !!minimumRequiredVersion.trim() && !isValidVersionFormat(minimumRequiredVersion);

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          Current Latest Version configured: <Text style={styles.infoBold}>{configuredLatestVersion}</Text>
        </Text>
        <Text style={styles.infoText}>
          Devices on a version below &quot;Minimum Required Version&quot; are forced to update before they can use the app.
          Devices below &quot;Latest Version&quot; (but at or above the minimum) see a dismissible update prompt.
        </Text>
      </View>

      <TouchableOpacity style={styles.notifyBtn} onPress={openNotifyModal}>
        <Text style={styles.notifyBtnText}>📲 Notify Users About Update</Text>
      </TouchableOpacity>

      {!!auditInfo.updatedAt && (
        <View style={styles.auditBox}>
          <Text style={styles.auditText}>
            Last updated by <Text style={styles.auditBold}>{auditInfo.updatedBy}</Text> on {formatTimestampIST(auditInfo.updatedAt)}
          </Text>
        </View>
      )}

      <View style={styles.formField}>
        <Text style={styles.formLabel}>Latest Version *</Text>
        <TextInput
          style={[styles.formInput, latestVersionInvalid && styles.formInputError]}
          placeholder="e.g. 1.3.0"
          placeholderTextColor="#999"
          value={latestVersion}
          onChangeText={setLatestVersion}
          autoCapitalize="none"
        />
        {latestVersionInvalid && <Text style={styles.formErrorText}>{versionFormatError}</Text>}
      </View>

      <View style={styles.formField}>
        <Text style={styles.formLabel}>Minimum Required Version *</Text>
        <TextInput
          style={[styles.formInput, minimumVersionInvalid && styles.formInputError]}
          placeholder="e.g. 1.2.0"
          placeholderTextColor="#999"
          value={minimumRequiredVersion}
          onChangeText={setMinimumRequiredVersion}
          autoCapitalize="none"
        />
        {minimumVersionInvalid && <Text style={styles.formErrorText}>{versionFormatError}</Text>}
      </View>

      <View style={styles.formField}>
        <Text style={styles.formLabel}>Update Message</Text>
        <TextInput
          style={[styles.formInput, styles.formInputMulti]}
          placeholder="New features and bug fixes!"
          placeholderTextColor="#999"
          value={updateMessage}
          onChangeText={setUpdateMessage}
          multiline
        />
      </View>

      <View style={styles.formField}>
        <Text style={styles.formLabel}>Play Store URL *</Text>
        <TextInput
          style={styles.formInput}
          placeholder="https://play.google.com/store/apps/details?id=..."
          placeholderTextColor="#999"
          value={androidStoreUrl}
          onChangeText={setAndroidStoreUrl}
          autoCapitalize="none"
        />
      </View>

      <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Saving...' : '💾 Save Settings'}</Text>
      </TouchableOpacity>

      <Modal visible={showNotifyModal} transparent animationType="fade" onRequestClose={() => setShowNotifyModal(false)}>
        <View style={styles.notifyBackdrop}>
          <View style={styles.notifyCard}>
            <Text style={styles.notifyTitle}>Notify Users About Update</Text>
            <Text style={styles.notifyHint}>This message will be sent as a push notification to every app user. Edit it below before sending.</Text>
            <TextInput
              style={[styles.formInput, styles.notifyInput]}
              placeholderTextColor="#999"
              value={notifyMessage}
              onChangeText={setNotifyMessage}
              multiline
              editable={!sendingNotify}
            />
            <TouchableOpacity
              style={[styles.saveBtn, (sendingNotify || !notifyMessage.trim()) && { opacity: 0.6 }]}
              onPress={handleSendNotify}
              disabled={sendingNotify || !notifyMessage.trim()}
            >
              <Text style={styles.saveBtnText}>{sendingNotify ? 'Sending...' : '📢 Send to All Users'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.notifyCancelBtn} onPress={() => setShowNotifyModal(false)} disabled={sendingNotify}>
              <Text style={styles.notifyCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
});

export default AppUpdateAdmin;

const styles = StyleSheet.create({
  loadingBox: { padding: 40, alignItems: 'center' },
  loadingText: { color: '#888' },
  infoBox: { backgroundColor: '#e8f0fe', borderRadius: 12, padding: 14, marginBottom: 20 },
  infoText: { fontSize: 13, color: '#333', marginBottom: 8, lineHeight: 19 },
  infoBold: { fontWeight: 'bold', color: '#0f3460' },
  auditBox: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: '#eee' },
  auditText: { fontSize: 12, color: '#666', marginBottom: 4 },
  auditBold: { fontWeight: '700', color: '#333' },
  notifyBtn: { backgroundColor: '#fff3e0', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 20 },
  notifyBtnText: { color: '#e65100', fontWeight: '700', fontSize: 14 },
  notifyBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  notifyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 380, elevation: 8 },
  notifyTitle: { fontSize: 17, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 6 },
  notifyHint: { fontSize: 12, color: '#888', marginBottom: 14, lineHeight: 17 },
  notifyInput: { minHeight: 110, marginBottom: 16 },
  notifyCancelBtn: { alignItems: 'center', padding: 12 },
  notifyCancelText: { color: '#888', fontSize: 14, fontWeight: '600' },
  formField: { marginBottom: 16 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  formInput: { backgroundColor: '#fff', borderRadius: 10, padding: 12, fontSize: 15, elevation: 2, borderWidth: 1, borderColor: '#eee', color: '#1a1a2e' },
  formInputError: { borderColor: '#d32f2f' },
  formErrorText: { color: '#d32f2f', fontSize: 12, marginTop: 6 },
  formInputMulti: { minHeight: 80, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: '#0f3460', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8, marginBottom: 24, elevation: 4 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

import Constants from 'expo-constants';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useAppDialog } from '../AppDialog';
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
import { useTheme } from '../../utils/ThemeContext';
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
  const dialog = useAppDialog();
  const { colors } = useTheme();
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
      dialog.alert('Required', 'Please enter both the latest and minimum required versions.');
      return;
    }
    if (!isValidVersionFormat(latest)) {
      dialog.alert('Invalid Format', 'Latest Version must be in the format number.number.number (e.g. 1.4.0).');
      return;
    }
    if (!isValidVersionFormat(minRequired)) {
      dialog.alert('Invalid Format', 'Minimum Required Version must be in the format number.number.number (e.g. 1.2.0).');
      return;
    }
    if (!androidStoreUrl.trim()) {
      dialog.alert('Required', 'Please enter the Play Store URL.');
      return;
    }
    if (compareVersions(minRequired, latest) > 0) {
      dialog.alert('Invalid Versions', 'Minimum Required Version cannot be higher than Latest Version.');
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
      dialog.alert('✅ Saved!', 'App update settings have been saved.');
    } catch {
      dialog.alert('Error', 'Could not save. Check internet.');
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
      dialog.alert('Required', 'Please enter a notification message.');
      return;
    }
    setSendingNotify(true);
    try {
      const result = await sendPushNotificationToAll(NOTIFY_TITLE, trimmed, {
        type: 'app_update',
        url: androidStoreUrl.trim(),
      });
      setShowNotifyModal(false);
      if (result.failedCount > 0) {
        dialog.alert(
          'Partially Sent',
          `✅ ${result.successCount} delivered\n❌ ${result.failedCount} failed\n\nCheck Firebase → notificationLogs for details.`
        );
      } else {
        dialog.alert('✅ Sent!', `Notification delivered to ${result.successCount} device${result.successCount === 1 ? '' : 's'}.`);
      }
    } catch (e: any) {
      dialog.alert('Error', e?.message || 'Could not send notification. Please try again.');
    }
    setSendingNotify(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <Text style={[styles.loadingText, { color: colors.subtext }]}>Loading...</Text>
      </View>
    );
  }

  const versionFormatError = 'Format must be number.number.number (e.g. 1.4.0)';
  const latestVersionInvalid = !!latestVersion.trim() && !isValidVersionFormat(latestVersion);
  const minimumVersionInvalid = !!minimumRequiredVersion.trim() && !isValidVersionFormat(minimumRequiredVersion);

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <View style={[styles.infoBox, { backgroundColor: colors.accent + '15' }]}>
        <Text style={[styles.infoText, { color: colors.text }]}>
          Current Latest Version configured: <Text style={[styles.infoBold, { color: colors.accent }]}>{configuredLatestVersion}</Text>
        </Text>
        <Text style={[styles.infoText, { color: colors.text }]}>
          Devices on a version below &quot;Minimum Required Version&quot; are forced to update before they can use the app.
          Devices below &quot;Latest Version&quot; (but at or above the minimum) see a dismissible update prompt.
        </Text>
      </View>

      <TouchableOpacity style={styles.notifyBtn} onPress={openNotifyModal}>
        <Text style={styles.notifyBtnText}>📲 Notify Users About Update</Text>
      </TouchableOpacity>

      {!!auditInfo.updatedAt && (
        <View style={[styles.auditBox, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
          <Text style={[styles.auditText, { color: colors.subtext }]}>
            Last updated by <Text style={[styles.auditBold, { color: colors.text }]}>{auditInfo.updatedBy}</Text> on {formatTimestampIST(auditInfo.updatedAt)}
          </Text>
        </View>
      )}

      <View style={styles.formField}>
        <Text style={[styles.formLabel, { color: colors.subtext }]}>Latest Version *</Text>
        <TextInput
          style={[
            styles.formInput,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text },
            latestVersionInvalid && styles.formInputError,
          ]}
          placeholder="e.g. 1.4.0"
          placeholderTextColor={colors.subtext}
          value={latestVersion}
          onChangeText={setLatestVersion}
          autoCapitalize="none"
        />
        {latestVersionInvalid && <Text style={styles.formErrorText}>{versionFormatError}</Text>}
      </View>

      <View style={styles.formField}>
        <Text style={[styles.formLabel, { color: colors.subtext }]}>Minimum Required Version *</Text>
        <TextInput
          style={[
            styles.formInput,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text },
            minimumVersionInvalid && styles.formInputError,
          ]}
          placeholder="e.g. 1.2.0"
          placeholderTextColor={colors.subtext}
          value={minimumRequiredVersion}
          onChangeText={setMinimumRequiredVersion}
          autoCapitalize="none"
        />
        {minimumVersionInvalid && <Text style={styles.formErrorText}>{versionFormatError}</Text>}
      </View>

      <View style={styles.formField}>
        <Text style={[styles.formLabel, { color: colors.subtext }]}>Update Message</Text>
        <TextInput
          style={[styles.formInput, styles.formInputMulti, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text }]}
          placeholder="New features and bug fixes!"
          placeholderTextColor={colors.subtext}
          value={updateMessage}
          onChangeText={setUpdateMessage}
          multiline
        />
      </View>

      <View style={styles.formField}>
        <Text style={[styles.formLabel, { color: colors.subtext }]}>Play Store URL *</Text>
        <TextInput
          style={[styles.formInput, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text }]}
          placeholder="https://play.google.com/store/apps/details?id=..."
          placeholderTextColor={colors.subtext}
          value={androidStoreUrl}
          onChangeText={setAndroidStoreUrl}
          autoCapitalize="none"
        />
      </View>

      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.accent }, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Saving...' : '💾 Save Settings'}</Text>
      </TouchableOpacity>

      <Modal visible={showNotifyModal} transparent animationType="fade" onRequestClose={() => setShowNotifyModal(false)}>
        <View style={styles.notifyBackdrop}>
          <View style={[styles.notifyCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.notifyTitle, { color: colors.text }]}>Notify Users About Update</Text>
            <Text style={[styles.notifyHint, { color: colors.subtext }]}>This message will be sent as a push notification to every app user. Edit it below before sending.</Text>
            <TextInput
              style={[styles.formInput, styles.notifyInput, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text }]}
              placeholderTextColor={colors.subtext}
              value={notifyMessage}
              onChangeText={setNotifyMessage}
              multiline
              editable={!sendingNotify}
            />
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.accent }, (sendingNotify || !notifyMessage.trim()) && { opacity: 0.6 }]}
              onPress={handleSendNotify}
              disabled={sendingNotify || !notifyMessage.trim()}
            >
              <Text style={styles.saveBtnText}>{sendingNotify ? 'Sending...' : '📢 Send to All Users'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.notifyCancelBtn} onPress={() => setShowNotifyModal(false)} disabled={sendingNotify}>
              <Text style={[styles.notifyCancelText, { color: colors.subtext }]}>Cancel</Text>
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
  loadingText: {},
  infoBox: { borderRadius: 12, padding: 14, marginBottom: 20 },
  infoText: { fontSize: 13, marginBottom: 8, lineHeight: 19 },
  infoBold: { fontWeight: 'bold' },
  auditBox: { borderRadius: 10, padding: 12, marginBottom: 20, borderWidth: 1 },
  auditText: { fontSize: 12, marginBottom: 4 },
  auditBold: { fontWeight: '700' },
  notifyBtn: { backgroundColor: '#fff3e0', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 20 },
  notifyBtnText: { color: '#e65100', fontWeight: '700', fontSize: 14 },
  notifyBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  notifyCard: { borderRadius: 16, padding: 20, width: '100%', maxWidth: 380, elevation: 8 },
  notifyTitle: { fontSize: 17, fontWeight: 'bold', marginBottom: 6 },
  notifyHint: { fontSize: 12, marginBottom: 14, lineHeight: 17 },
  notifyInput: { minHeight: 110, marginBottom: 16 },
  notifyCancelBtn: { alignItems: 'center', padding: 12 },
  notifyCancelText: { fontSize: 14, fontWeight: '600' },
  formField: { marginBottom: 16 },
  formLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  formInput: { borderRadius: 10, padding: 12, fontSize: 15, elevation: 2, borderWidth: 1 },
  formInputError: { borderColor: '#d32f2f' },
  formErrorText: { color: '#d32f2f', fontSize: 12, marginTop: 6 },
  formInputMulti: { minHeight: 80, textAlignVertical: 'top' },
  saveBtn: { borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8, marginBottom: 24, elevation: 4 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

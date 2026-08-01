import { forwardRef, useImperativeHandle, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Text } from '../AppText';
import { TextInput } from '../AppTextInput';
import { sendPushNotificationToAll } from '../../utils/pushNotify';
import { useTheme } from '../../utils/ThemeContext';
import { AdminScreenHandle } from './SpecialMeetingsAdmin';

const NotificationsAdmin = forwardRef<AdminScreenHandle, {}>((_props, ref) => {
  const { colors } = useTheme();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useImperativeHandle(ref, () => ({
    goBack: () => false,
  }));

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed) {
      Alert.alert('Required', 'Please enter a notification message.');
      return;
    }

    Alert.alert(
      'Send Notification',
      'This message will be sent to all app users. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', onPress: () => sendNow(trimmed) },
      ]
    );
  };

  const sendNow = async (body: string) => {
    setSending(true);
    try {
      const result = await sendPushNotificationToAll('📢 Theos Gospel Hall', body);
      setMessage('');
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
    setSending(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={[styles.label, { color: colors.subtext }]}>Notification Message *</Text>
      <Text style={[styles.hint, { color: colors.subtext }]}>This will be sent as a push notification to every app user.</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text }]}
        placeholder="e.g. Tomorrow's church meeting will begin at 6:30 PM. Please be on time."
        placeholderTextColor={colors.subtext}
        value={message}
        onChangeText={setMessage}
        multiline
        editable={!sending}
      />

      <TouchableOpacity
        style={[styles.sendBtn, { backgroundColor: colors.accent }, (sending || !message.trim()) && { opacity: 0.6 }]}
        onPress={handleSend}
        disabled={sending || !message.trim()}
      >
        {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>📢 Send to All Users</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
});

export default NotificationsAdmin;

const styles = StyleSheet.create({
  container: { padding: 16 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  hint: { fontSize: 11, marginBottom: 10, fontStyle: 'italic' },
  input: {
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    elevation: 2,
    borderWidth: 1,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  sendBtn: {
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
    elevation: 4,
  },
  sendBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

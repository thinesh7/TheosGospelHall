import { forwardRef, useImperativeHandle, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '../AppText';
import { TextInput } from '../AppTextInput';
import { addNotification, NotificationCategory } from '../../utils/notificationCenterSync';
import { sendPushNotificationToAll } from '../../utils/pushNotify';
import { AdminScreenHandle } from './SpecialMeetingsAdmin';

const CATEGORIES: { key: NotificationCategory; label: string }[] = [
  { key: 'bible_study', label: 'Bible Study' },
  { key: 'prayer_meeting', label: 'Prayer Meeting' },
  { key: 'youth_meeting', label: 'Youth Meeting' },
  { key: 'others', label: 'Others' },
];

const NotificationsAdmin = forwardRef<AdminScreenHandle, {}>((_props, ref) => {
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [category, setCategory] = useState<NotificationCategory>('bible_study');
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
      const result = await sendPushNotificationToAll('📢 Theos Gospel Hall', body, { type: 'admin' });
      try {
        await addNotification({ message: body, link: link.trim() || null, source: 'admin', category });
      } catch {}
      setMessage('');
      setLink('');
      setCategory('bible_study');
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
      <Text style={styles.label}>Notification Message *</Text>
      <Text style={styles.hint}>This will be sent as a push notification to every app user.</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Tomorrow's church meeting will begin at 6:30 PM. Please be on time."
        placeholderTextColor="#999"
        value={message}
        onChangeText={setMessage}
        multiline
        editable={!sending}
      />

      <Text style={[styles.label, { marginTop: 16 }]}>Category</Text>
      <View style={styles.categoryRow}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.key}
            style={[styles.categoryChip, category === cat.key && styles.categoryChipActive]}
            onPress={() => setCategory(cat.key)}
            disabled={sending}
          >
            <Text style={[styles.categoryChipText, category === cat.key && styles.categoryChipTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.label, { marginTop: 16 }]}>Optional Link (if any)</Text>
      <Text style={styles.hint}>Add a link if you want users to open a website, Google Meet, YouTube, or any page.</Text>
      <TextInput
        style={styles.input}
        placeholder="https://..."
        placeholderTextColor="#999"
        value={link}
        onChangeText={setLink}
        autoCapitalize="none"
        keyboardType="url"
        editable={!sending}
      />

      <TouchableOpacity
        style={[styles.sendBtn, (sending || !message.trim()) && { opacity: 0.6 }]}
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
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  hint: { fontSize: 11, color: '#999', marginBottom: 10, fontStyle: 'italic' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#eee',
    color: '#1a1a2e',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
  },
  categoryChipActive: { backgroundColor: '#0f3460', borderColor: '#0f3460' },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: '#555' },
  categoryChipTextActive: { color: '#fff' },
  sendBtn: {
    backgroundColor: '#0f3460',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
    elevation: 4,
  },
  sendBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

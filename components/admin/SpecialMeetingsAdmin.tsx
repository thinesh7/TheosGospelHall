import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '../../firebaseConfig';

type NumberOfDays = '' | '1' | 'multiple';

interface SpecialMeeting {
  id: string;
  title: string;
  description: string;
  date: string;
  endDate: string;
  numberOfDays: NumberOfDays;
  time: string;
  location: string;
  mapLink: string;
  youtubeLink: string;
  additionalInfo: string;
  isActive: boolean;
  order: number;
}

const EMPTY_MEETING: Omit<SpecialMeeting, 'id'> = {
  title: '',
  description: '',
  date: '',
  endDate: '',
  numberOfDays: '',
  time: '',
  location: '',
  mapLink: '',
  youtubeLink: '',
  additionalInfo: '',
  isActive: true,
  order: 1,
};

export interface AdminScreenHandle {
  goBack: () => boolean;
}

interface Props {
  onEventsUpdated: () => void;
}

const SpecialMeetingsAdmin = forwardRef<AdminScreenHandle, Props>(({ onEventsUpdated }, ref) => {
  const [adminMeetings, setAdminMeetings] = useState<SpecialMeeting[]>([]);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<SpecialMeeting, 'id'>>(EMPTY_MEETING);

  useImperativeHandle(ref, () => ({
    goBack: () => {
      if (showForm) { setShowForm(false); return true; }
      return false;
    },
  }));

  useEffect(() => { loadMeetings(); }, []);

  const loadMeetings = async () => {
    setLoadingAdmin(true);
    try {
      const q = query(collection(db, 'events'), orderBy('order', 'asc'));
      const snap = await getDocs(q);
      const list: SpecialMeeting[] = snap.docs.map(d => ({
        id: d.id,
        ...(EMPTY_MEETING as any),
        ...(d.data() as any),
      }));
      setAdminMeetings(list);
    } catch (e) {
      Alert.alert('Error', 'Could not load meetings. Check internet.');
    }
    setLoadingAdmin(false);
  };

  const refreshCache = async () => {
    try {
      const q = query(collection(db, 'events'), orderBy('order', 'asc'));
      const snap = await getDocs(q);
      const list: SpecialMeeting[] = snap.docs.map(d => ({
        id: d.id,
        ...(EMPTY_MEETING as any),
        ...(d.data() as any),
      }));
      setAdminMeetings(list);
      const active = list.filter(m => m.isActive);
      await AsyncStorage.setItem('tgh_special_meetings', JSON.stringify(active));
      onEventsUpdated();
    } catch (e) {}
  };

  const sendNotificationToAll = async (meeting: Omit<SpecialMeeting, 'id'>) => {
    try {
      const snap = await getDocs(collection(db, 'pushTokens'));
      const tokenDocs = snap.docs
        .map(d => ({ id: d.id, token: d.data().token, model: d.data().model ?? 'unknown' }))
        .filter(d => d.token && typeof d.token === 'string' && d.token.startsWith('ExponentPushToken'));

      if (tokenDocs.length === 0) {
        Alert.alert('No users', 'No registered devices found.');
        return;
      }

      const bodyParts: string[] = [];
      if (meeting.date) bodyParts.push(`📅 ${meeting.date}`);
      if (meeting.time) bodyParts.push(`🕐 ${meeting.time}`);
      if (meeting.location) bodyParts.push(`📍 ${meeting.location}`);
      const body = bodyParts.join('  •  ') || 'Tap to view details';

      const BATCH = 100;
      const allTickets: { token: string; model: string; ticketId?: string; error?: string }[] = [];

      for (let i = 0; i < tokenDocs.length; i += BATCH) {
        const batch = tokenDocs.slice(i, i + BATCH);
        const messages = batch.map(d => ({
          to: d.token,
          title: `📢 ${meeting.title}`,
          body,
          sound: 'default',
          channelId: 'tgh-default',
          priority: 'high',
          data: { screen: 'home' },
        }));

        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
          },
          body: JSON.stringify(messages),
        });

        const result = await res.json();
        const tickets = Array.isArray(result.data) ? result.data : [result.data];

        tickets.forEach((ticket: any, idx: number) => {
          const d = batch[idx];
          if (ticket?.status === 'ok') {
            allTickets.push({ token: d.token, model: d.model, ticketId: ticket.id });
          } else {
            allTickets.push({ token: d.token, model: d.model, error: ticket?.message ?? 'unknown error' });
          }
        });
      }

      const sentAt = Date.now();
      const successTickets = allTickets.filter(t => t.ticketId);
      const failedTickets = allTickets.filter(t => t.error);

      const _d = new Date(sentAt);
      const _months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
      const _month = _months[_d.getMonth()];
      const _year = _d.getFullYear();
      const _day = _d.getDate();
      const _h24 = _d.getHours();
      const _ampm = _h24 >= 12 ? 'PM' : 'AM';
      const _h12 = _h24 % 12 || 12;
      const _min = String(_d.getMinutes()).padStart(2, '0');
      const _sec = String(_d.getSeconds()).padStart(2, '0');
      const _rand = Math.random().toString(36).substring(2, 5).toUpperCase();
      const logDocId = `${_month}_${_year}_${_day}_${_h12}_${_min}_${_sec}_${_ampm}_${_rand}`;

      await setDoc(doc(db, 'notificationLogs', logDocId), {
        title: meeting.title,
        body,
        sentAt,
        sentBy: getAuth().currentUser?.email ?? 'unknown',
        totalDevices: tokenDocs.length,
        successCount: successTickets.length,
        failedCount: failedTickets.length,
        ticketIds: successTickets.map(t => t.ticketId),
        failures: failedTickets.map(t => ({ token: t.token.slice(-10), model: t.model, error: t.error })),
      });

      if (failedTickets.length > 0) {
        Alert.alert(
          'Partially Sent',
          `✅ ${successTickets.length} delivered\n❌ ${failedTickets.length} failed\n\nCheck Firebase → notificationLogs for details.`
        );
      }
    } catch (e: any) {
      Alert.alert('Error', `Could not send notifications.\n\n${e?.message ?? String(e)}`);
    }
  };

  const openAddForm = () => {
    setEditingId(null);
    const maxOrder = adminMeetings.length > 0
      ? Math.max(...adminMeetings.map(m => m.order)) + 1
      : 1;
    setForm({ ...EMPTY_MEETING, order: maxOrder });
    setShowForm(true);
  };

  const openEditForm = (meeting: SpecialMeeting) => {
    setEditingId(meeting.id);
    setForm({
      title: meeting.title,
      description: meeting.description,
      date: meeting.date,
      endDate: meeting.endDate || '',
      numberOfDays: meeting.numberOfDays || '',
      time: meeting.time,
      location: meeting.location,
      mapLink: meeting.mapLink,
      youtubeLink: meeting.youtubeLink || '',
      additionalInfo: meeting.additionalInfo,
      isActive: meeting.isActive,
      order: meeting.order,
    });
    setShowForm(true);
  };

  const saveMeeting = async () => {
    if (!form.title.trim()) { Alert.alert('Required', 'Please enter a title.'); return; }
    if (!form.date.trim()) { Alert.alert('Required', 'Please enter a start date.'); return; }
    if (form.numberOfDays === 'multiple' && !form.endDate.trim()) {
      Alert.alert('Required', 'Please enter an end date for multi-day events.');
      return;
    }

    setSaving(true);
    try {
      const isNew = !editingId;
      const payload = {
        ...form,
        endDate: form.numberOfDays === 'multiple' ? form.endDate.trim() : '',
      };
      if (editingId) {
        await updateDoc(doc(db, 'events', editingId), { ...payload });
      } else {
        await addDoc(collection(db, 'events'), { ...payload });
      }
      await refreshCache();
      setShowForm(false);
      if (form.isActive) {
        Alert.alert(
          '✅ Saved!',
          isNew ? 'Meeting added. Send notification to all users?' : 'Meeting updated. Send notification to all users?',
          [
            { text: 'No', style: 'cancel' },
            {
              text: '📢 Send Notification',
              onPress: async () => {
                await sendNotificationToAll(payload);
                Alert.alert('✅ Sent!', 'Notification sent to all users.');
              },
            },
          ]
        );
      } else {
        Alert.alert('✅ Saved!', editingId ? 'Meeting updated.' : 'Meeting added.');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not save. Check internet.');
    }
    setSaving(false);
  };

  const deleteMeeting = (meeting: SpecialMeeting) => {
    Alert.alert('Delete Meeting', `Delete "${meeting.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'events', meeting.id));
            await refreshCache();
            Alert.alert('Deleted', 'Meeting removed.');
          } catch (e) {
            Alert.alert('Error', 'Could not delete.');
          }
        },
      },
    ]);
  };

  const toggleActive = async (meeting: SpecialMeeting) => {
    try {
      await updateDoc(doc(db, 'events', meeting.id), { isActive: !meeting.isActive });
      await refreshCache();
    } catch (e) {
      Alert.alert('Error', 'Could not update.');
    }
  };

  const F = (field: keyof Omit<SpecialMeeting, 'id'>, val: string | boolean | number) =>
    setForm(prev => ({ ...prev, [field]: val }));

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      {!showForm ? (
        <>
          <TouchableOpacity style={styles.addBtn} onPress={openAddForm}>
            <Text style={styles.addBtnText}>＋ Add New Meeting</Text>
          </TouchableOpacity>
          {loadingAdmin ? (
            <Text style={styles.loadingText}>Loading meetings...</Text>
          ) : adminMeetings.length === 0 ? (
            <Text style={styles.emptyText}>No meetings yet. Tap above to add one.</Text>
          ) : (
            adminMeetings.map(meeting => (
              <View key={meeting.id} style={styles.adminMeetingCard}>
                <View style={styles.adminCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.adminMeetingTitle}>{meeting.title}</Text>
                    <Text style={styles.adminMeetingMeta}>
                      {meeting.date}
                      {meeting.numberOfDays === 'multiple' && meeting.endDate ? ` → ${meeting.endDate}` : ''}
                      {meeting.time ? ` • ${meeting.time}` : ''}
                    </Text>
                    {meeting.location ? <Text style={styles.adminMeetingMeta}>📍 {meeting.location}</Text> : null}
                    {meeting.youtubeLink ? <Text style={styles.adminMeetingMeta}>▶ YouTube link added</Text> : null}
                  </View>
                  <Switch
                    value={meeting.isActive}
                    onValueChange={() => toggleActive(meeting)}
                    trackColor={{ true: '#7209b7', false: '#ccc' }}
                  />
                </View>
                <View style={styles.adminCardStatus}>
                  <View style={[styles.statusDot, { backgroundColor: meeting.isActive ? '#25d366' : '#ccc' }]} />
                  <Text style={styles.statusText}>{meeting.isActive ? 'Visible to users' : 'Hidden'}</Text>
                </View>
                <View style={styles.adminCardActions}>
                  <TouchableOpacity style={styles.editBtn} onPress={() => openEditForm(meeting)}>
                    <Text style={styles.editBtnText}>✏️ Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.notifBtn, !meeting.isActive && { opacity: 0.4 }]}
                    disabled={!meeting.isActive}
                    onPress={() => {
                      Alert.alert('📢 Send Notification', `Notify all users about "${meeting.title}"?`, [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Send',
                          onPress: async () => {
                            await sendNotificationToAll(meeting);
                            Alert.alert('✅ Sent!', 'Notification sent to all users.');
                          },
                        },
                      ]);
                    }}
                  >
                    <Text style={styles.notifBtnText}>📢 Notify</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteMeeting(meeting)}>
                    <Text style={styles.deleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </>
      ) : (
        <>
          <View style={styles.formHeader}>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Text style={styles.formBackText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.formTitle}>{editingId ? 'Edit Meeting' : 'New Meeting'}</Text>
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Title *</Text>
            <TextInput style={styles.formInput} placeholder="e.g. TGH Special Meeting" placeholderTextColor="#999" value={form.title} onChangeText={v => F('title', v)} />
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Description</Text>
            <TextInput style={[styles.formInput, styles.formInputMulti]} placeholder="Brief description" placeholderTextColor="#999" value={form.description} onChangeText={v => F('description', v)} multiline />
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Start Date *</Text>
            <TextInput style={styles.formInput} placeholder="e.g. August 15, 2026" placeholderTextColor="#999" value={form.date} onChangeText={v => F('date', v)} />
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Number of Days</Text>
            <View style={styles.segmentRow}>
              <TouchableOpacity style={[styles.segmentBtn, form.numberOfDays === '1' && styles.segmentBtnActive]} onPress={() => F('numberOfDays', '1')}>
                <Text style={[styles.segmentBtnText, form.numberOfDays === '1' && styles.segmentBtnTextActive]}>1 Day</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.segmentBtn, form.numberOfDays === 'multiple' && styles.segmentBtnActive]} onPress={() => F('numberOfDays', 'multiple')}>
                <Text style={[styles.segmentBtnText, form.numberOfDays === 'multiple' && styles.segmentBtnTextActive]}>More Than One Day</Text>
              </TouchableOpacity>
            </View>
          </View>

          {form.numberOfDays === 'multiple' && (
            <View style={styles.formField}>
              <Text style={styles.formLabel}>End Date *</Text>
              <TextInput style={styles.formInput} placeholder="e.g. August 17, 2026" placeholderTextColor="#999" value={form.endDate} onChangeText={v => F('endDate', v)} />
            </View>
          )}

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Time</Text>
            <TextInput style={styles.formInput} placeholder="e.g. 6:30 PM" placeholderTextColor="#999" value={form.time} onChangeText={v => F('time', v)} />
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Location</Text>
            <TextInput style={styles.formInput} placeholder="Venue name & city" placeholderTextColor="#999" value={form.location} onChangeText={v => F('location', v)} />
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Google Maps Link</Text>
            <TextInput style={styles.formInput} placeholder="https://maps.app.goo.gl/..." placeholderTextColor="#999" value={form.mapLink} onChangeText={v => F('mapLink', v)} autoCapitalize="none" />
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>YouTube Link</Text>
            <TextInput style={styles.formInput} placeholder="https://youtube.com/watch?v=..." placeholderTextColor="#999" value={form.youtubeLink} onChangeText={v => F('youtubeLink', v)} autoCapitalize="none" />
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Additional Info</Text>
            <TextInput style={[styles.formInput, styles.formInputMulti]} placeholder="Any extra details" placeholderTextColor="#999" value={form.additionalInfo} onChangeText={v => F('additionalInfo', v)} multiline />
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Order (display sequence)</Text>
            <TextInput style={styles.formInput} placeholder="1" placeholderTextColor="#999" value={String(form.order)} onChangeText={v => F('order', parseInt(v) || 1)} keyboardType="number-pad" />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.formLabel}>Show to users</Text>
            <Switch value={form.isActive} onValueChange={v => F('isActive', v)} trackColor={{ true: '#7209b7', false: '#ccc' }} />
          </View>

          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={saveMeeting} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : editingId ? '💾 Update Meeting' : '💾 Add Meeting'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowForm(false)} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
});

export default SpecialMeetingsAdmin;

const styles = StyleSheet.create({
  addBtn: { backgroundColor: '#7209b7', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 16, elevation: 4 },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  loadingText: { textAlign: 'center', color: '#888', marginTop: 20 },
  emptyText: { textAlign: 'center', color: '#aaa', marginTop: 30, fontSize: 14, fontStyle: 'italic' },
  adminMeetingCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, elevation: 3, borderLeftWidth: 5, borderLeftColor: '#7209b7' },
  adminCardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  adminMeetingTitle: { fontSize: 15, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 4 },
  adminMeetingMeta: { fontSize: 12, color: '#666', marginBottom: 2 },
  adminCardStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, color: '#666' },
  adminCardActions: { flexDirection: 'row', gap: 8 },
  editBtn: { flex: 1, backgroundColor: '#e8f0fe', borderRadius: 10, padding: 10, alignItems: 'center' },
  editBtnText: { color: '#0f3460', fontWeight: '600', fontSize: 13 },
  notifBtn: { flex: 1, backgroundColor: '#fff3e0', borderRadius: 10, padding: 10, alignItems: 'center' },
  notifBtnText: { color: '#e65100', fontWeight: '600', fontSize: 13 },
  deleteBtn: { backgroundColor: '#fdecea', borderRadius: 10, padding: 10, alignItems: 'center', width: 44 },
  deleteBtnText: { color: '#c62828', fontWeight: '600', fontSize: 13 },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  formBackText: { color: '#0f3460', fontWeight: '600', fontSize: 15 },
  formTitle: { fontSize: 17, fontWeight: 'bold', color: '#1a1a2e' },
  formField: { marginBottom: 14 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  formInput: { backgroundColor: '#fff', borderRadius: 10, padding: 12, fontSize: 15, elevation: 2, borderWidth: 1, borderColor: '#eee', color: '#1a1a2e' },
  formInputMulti: { minHeight: 80, textAlignVertical: 'top' },
  segmentRow: { flexDirection: 'row', gap: 10 },
  segmentBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', alignItems: 'center' },
  segmentBtnActive: { backgroundColor: '#7209b7', borderColor: '#7209b7' },
  segmentBtnText: { fontSize: 13, fontWeight: '600', color: '#555' },
  segmentBtnTextActive: { color: '#fff' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 20, elevation: 2 },
  saveBtn: { backgroundColor: '#7209b7', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 12, elevation: 4 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelBtn: { alignItems: 'center', padding: 12, marginBottom: 20 },
  cancelBtnText: { color: '#888', fontSize: 14 },
});

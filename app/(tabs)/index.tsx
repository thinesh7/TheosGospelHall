import ChurchInfo from '@/components/ChurchInfo';
import UpcomingEvents from '@/components/UpcomingEvents';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '../../firebaseConfig';

const isExpoGo = Constants.appOwnership === 'expo';
if (!isExpoGo) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

interface SpecialMeeting {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  mapLink: string;
  additionalInfo: string;
  isActive: boolean;
  order: number;
}

const EMPTY_MEETING: Omit<SpecialMeeting, 'id'> = {
  title: '',
  description: '',
  date: '',
  time: '',
  location: '',
  mapLink: '',
  additionalInfo: '',
  isActive: true,
  order: 1,
};

export default function HomeScreen() {
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<any>(null);
  const appStateRef = useRef(AppState.currentState);
  const upcomingEventsRef = useRef<{ reload: () => void }>(null);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminMeetings, setAdminMeetings] = useState<SpecialMeeting[]>([]);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingNotif, setSendingNotif] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<SpecialMeeting, 'id'>>(EMPTY_MEETING);

  useEffect(() => {
    registerForPushNotifications();
    const sub = AppState.addEventListener('change', nextState => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        upcomingEventsRef.current?.reload();
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  // ── Android back button handler ──
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (showAdmin) {
          if (showForm) {
            setShowForm(false);
            return true;
          } else {
            setShowAdmin(false);
            return true;
          }
        }
        return false;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [showAdmin, showForm])
  );

  const registerForPushNotifications = async () => {
    if (!Device.isDevice) return;
    if (isExpoGo) return;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'TGH Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0f3460',
      });
    }

    try {
      const tokenData = await Notifications.getDevicePushTokenAsync();
      const token = tokenData.data;
      const safeId = token.replace(/[^a-zA-Z0-9]/g, '_');
      await setDoc(doc(db, 'pushTokens', safeId), {
        token,
        platform: Platform.OS,
        type: 'fcm',
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.log('Token registration error:', e);
    }
  };

  const sendNotificationToAll = async (meeting: Omit<SpecialMeeting, 'id'>) => {
    setSendingNotif(true);
    try {
      const snap = await getDocs(collection(db, 'pushTokens'));
      const tokens: string[] = snap.docs
        .map(d => d.data().token)
        .filter(t => t && t !== 'placeholder');

      if (tokens.length === 0) {
        Alert.alert('No users', 'No registered devices found.');
        setSendingNotif(false);
        return;
      }

      const bodyParts = [];
      if (meeting.date) bodyParts.push(`📅 ${meeting.date}`);
      if (meeting.time) bodyParts.push(`🕐 ${meeting.time}`);
      if (meeting.location) bodyParts.push(`📍 ${meeting.location}`);
      const body = bodyParts.join('  •  ') || 'Tap to view details';

      const BATCH = 100;
      for (let i = 0; i < tokens.length; i += BATCH) {
        const batch = tokens.slice(i, i + BATCH);
        const messages = batch.map(token => ({
          to: token,
          title: `📢 ${meeting.title}`,
          body,
          sound: 'default',
          channelId: 'default',
          data: { screen: 'home' },
        }));

        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
          },
          body: JSON.stringify(messages),
        });

        const result = await response.json();
        console.log('Push result:', JSON.stringify(result));
      }
    } catch (e) {
      console.log('Notification send error:', e);
      Alert.alert('Error', 'Could not send notifications.');
    }
    setSendingNotif(false);
  };

  const handlePastorTap = () => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 1500);
    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      clearTimeout(tapTimerRef.current);
      setShowPasswordModal(true);
    }
  };

  // ── Login — password fetched from Firestore ──
  const handleLogin = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'settings', 'admin'));
      const correctPassword = docSnap.exists() ? docSnap.data()?.password : null;

      if (!correctPassword) {
        Alert.alert('Error', 'Admin password not configured. Contact support.');
        return;
      }

      if (password === correctPassword) {
        setPassword('');
        setShowPasswordModal(false);
        openAdmin();
      } else {
        Alert.alert('Wrong Password', 'Please try again.');
        setPassword('');
      }
    } catch (e) {
      console.log('Login error:', e);
      Alert.alert('Error', 'Could not verify password. Check internet.');
    }
  };

  const openAdmin = async () => {
    setShowAdmin(true);
    setShowForm(false);
    setLoadingAdmin(true);
    try {
      const q = query(collection(db, 'events'), orderBy('order', 'asc'));
      const snap = await getDocs(q);
      const list: SpecialMeeting[] = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<SpecialMeeting, 'id'>),
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
        ...(d.data() as Omit<SpecialMeeting, 'id'>),
      }));
      setAdminMeetings(list);
      const active = list.filter(m => m.isActive);
      await AsyncStorage.setItem('tgh_special_meetings', JSON.stringify(active));
      upcomingEventsRef.current?.reload();
    } catch (e) {}
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
      time: meeting.time,
      location: meeting.location,
      mapLink: meeting.mapLink,
      additionalInfo: meeting.additionalInfo,
      isActive: meeting.isActive,
      order: meeting.order,
    });
    setShowForm(true);
  };

  const saveMeeting = async () => {
    if (!form.title.trim()) {
      Alert.alert('Required', 'Please enter a title.');
      return;
    }
    setSaving(true);
    try {
      const isNew = !editingId;
      if (editingId) {
        await updateDoc(doc(db, 'events', editingId), { ...form });
      } else {
        await addDoc(collection(db, 'events'), { ...form });
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
                await sendNotificationToAll(form);
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
    Alert.alert(
      'Delete Meeting',
      `Delete "${meeting.title}"?`,
      [
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
      ]
    );
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
    <ScrollView style={styles.container}>
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.header}>
        <Text style={styles.churchName}>Theos Gospel Hall</Text>
        <Text style={styles.tagline}>"The Word of God is Living and Active"</Text>
      </LinearGradient>

      <View style={styles.pastorCard}>
        <TouchableOpacity onPress={handlePastorTap} activeOpacity={1} style={styles.pastorAvatar}>
          <Image
            source={require('../../assets/images/pastor.png')}
            style={styles.pastorImage}
          />
        </TouchableOpacity>
        <Text style={styles.pastorName}>Bro. Salaman Tirupur</Text>
        <Text style={styles.pastorTitle}>Pastor & Founder</Text>
        <View style={styles.divider} />
        <Text style={styles.ministryText}>
          Theos Gospel Hall is a ministry dedicated to spreading the Word of God
          through Bible sermons, teachings, and worship. Founded with a heart for
          souls, we proclaim the Gospel of Jesus Christ to all nations.{'\n\n'}
          Pastor Bro. Salaman Tirupur leads the ministry with a passion for
          teaching the foundational truths of Scripture.
        </Text>
      </View>

      <UpcomingEvents ref={upcomingEventsRef} />
      <ChurchInfo />
      <View style={{ height: 40 }} />

      {/* ── Password Modal ── */}
      <Modal visible={showPasswordModal} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'android' ? 'height' : 'padding'}
          style={{ flex: 1 }}
        >
          <View style={styles.overlay}>
            <View style={styles.passwordCard}>
              <Text style={styles.passwordTitle}>🔐 Admin Access</Text>
              <Text style={styles.passwordSub}>Enter password to continue</Text>
              <TextInput
                style={styles.passwordInput}
                placeholder="Password"
                placeholderTextColor="#999"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={handleLogin}
                autoFocus
              />
              <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
                <Text style={styles.loginBtnText}>Login</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowPasswordModal(false); setPassword(''); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Admin Panel Modal ── */}
      <Modal visible={showAdmin} animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'android' ? 'height' : 'padding'}
          style={{ flex: 1 }}
        >
          <View style={styles.adminContainer}>
            <View style={styles.adminHeader}>
              <View>
                <Text style={styles.adminHeaderTitle}>⚙️ Admin Panel</Text>
                <Text style={styles.adminHeaderSub}>Special Meetings</Text>
              </View>
              {!showForm && (
                <TouchableOpacity onPress={() => setShowAdmin(false)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕ Close</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
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
                              {meeting.date} {meeting.time ? `• ${meeting.time}` : ''}
                            </Text>
                            {meeting.location ? (
                              <Text style={styles.adminMeetingMeta}>📍 {meeting.location}</Text>
                            ) : null}
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
                            onPress={async () => {
                              Alert.alert(
                                '📢 Send Notification',
                                `Notify all users about "${meeting.title}"?`,
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Send',
                                    onPress: async () => {
                                      await sendNotificationToAll(meeting);
                                      Alert.alert('✅ Sent!', 'Notification sent to all users.');
                                    },
                                  },
                                ]
                              );
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

                  {[
                    { label: 'Title *', field: 'title', placeholder: 'e.g. TGH Special Meeting' },
                    { label: 'Description', field: 'description', placeholder: 'Brief description', multi: true },
                    { label: 'Date', field: 'date', placeholder: 'e.g. June 20, 2025' },
                    { label: 'Time', field: 'time', placeholder: 'e.g. 6:30 PM' },
                    { label: 'Location', field: 'location', placeholder: 'Venue name & city' },
                    { label: 'Google Maps Link', field: 'mapLink', placeholder: 'https://maps.app.goo.gl/...' },
                    { label: 'Additional Info', field: 'additionalInfo', placeholder: 'Any extra details', multi: true },
                    { label: 'Order (display sequence)', field: 'order', placeholder: '1', numeric: true },
                  ].map(f => (
                    <View key={f.field} style={styles.formField}>
                      <Text style={styles.formLabel}>{f.label}</Text>
                      <TextInput
                        style={[styles.formInput, f.multi && styles.formInputMulti]}
                        placeholder={f.placeholder}
                        placeholderTextColor="#999"
                        value={String(form[f.field as keyof typeof form])}
                        onChangeText={v => F(f.field as any, f.numeric ? parseInt(v) || 1 : v)}
                        multiline={f.multi}
                        keyboardType={f.numeric ? 'number-pad' : 'default'}
                      />
                    </View>
                  ))}

                  <View style={styles.toggleRow}>
                    <Text style={styles.formLabel}>Show to users</Text>
                    <Switch
                      value={form.isActive}
                      onValueChange={v => F('isActive', v)}
                      trackColor={{ true: '#7209b7', false: '#ccc' }}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                    onPress={saveMeeting}
                    disabled={saving}
                  >
                    <Text style={styles.saveBtnText}>
                      {saving ? 'Saving...' : editingId ? '💾 Update Meeting' : '💾 Add Meeting'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => setShowForm(false)} style={styles.cancelBtn}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { padding: 40, alignItems: 'center', paddingTop: 60 },
  churchName: { fontSize: 26, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  tagline: { fontSize: 14, color: '#ffffff', marginTop: 8, fontStyle: 'italic', fontWeight: '600', letterSpacing: 0.5, textAlign: 'center' },
  pastorCard: { backgroundColor: '#fff', margin: 16, borderRadius: 16, padding: 20, alignItems: 'center', elevation: 4 },
  pastorAvatar: { marginBottom: 10 },
  pastorImage: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: '#0f3460' },
  pastorName: { fontSize: 20, fontWeight: 'bold', color: '#1a1a2e' },
  pastorTitle: { fontSize: 14, color: '#666', marginTop: 4 },
  divider: { height: 1, backgroundColor: '#eee', width: '100%', marginVertical: 14 },
  ministryText: { fontSize: 14, color: '#444', textAlign: 'center', lineHeight: 22 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  passwordCard: { backgroundColor: '#fff', borderRadius: 20, padding: 28, width: '100%', alignItems: 'center' },
  passwordTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 6 },
  passwordSub: { fontSize: 13, color: '#666', marginBottom: 20 },
  passwordInput: { width: '100%', borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 16, backgroundColor: '#f9f9f9', color: '#1a1a2e' },
  loginBtn: { backgroundColor: '#0f3460', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40, marginBottom: 12, width: '100%', alignItems: 'center' },
  loginBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelText: { color: '#888', fontSize: 14 },
  adminContainer: { flex: 1, backgroundColor: '#f5f5f5' },
  adminHeader: { backgroundColor: '#0f3460', paddingTop: 54, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  adminHeaderTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  adminHeaderSub: { fontSize: 12, color: '#a8c0e8', marginTop: 2 },
  closeBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  closeBtnText: { color: '#fff', fontWeight: '600' },
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
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 20, elevation: 2 },
  saveBtn: { backgroundColor: '#7209b7', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 12, elevation: 4 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelBtn: { alignItems: 'center', padding: 12, marginBottom: 20 },
  cancelBtnText: { color: '#888', fontSize: 14 },
});
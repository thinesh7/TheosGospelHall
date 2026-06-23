import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';
import { useTheme } from '../utils/ThemeContext';

const CACHE_KEY = 'tgh_special_meetings';

interface SpecialMeeting {
  id: string;
  title: string;
  description: string;
  date: string;
  endDate?: string;
  numberOfDays?: '' | '1' | 'multiple';
  time: string;
  location: string;
  mapLink?: string;
  youtubeLink?: string;
  additionalInfo?: string;
  isActive: boolean;
  order: number;
}

const EVENTS = [
  { id: '1', title: 'Sunday Morning Service', date: 'Every Sunday', time: 'Tirupur: 7:00 - 9:30 AM\nCoimbatore: 10:30 AM - 1:00 PM\nUdumalpet: 10:30 AM - 1:00 PM\nKanyakumari: 9:00 - 11:30 AM', location: 'All Branches', type: 'service' },
  { id: '2', title: 'Bible Study', date: 'Every Wednesday', time: '7:00 PM - 8:00 PM', location: 'YouTube Live', type: 'bible' },
  { id: '3', title: 'Prayer Meeting', date: 'Every Thursday', time: '8:30 PM - 9:30 PM', location: 'Tirupur & Google Meet', type: 'prayer' },
  { id: '4', title: "Children's Meeting", date: 'Every Saturday', time: '6:45 PM - 7:30 PM', location: 'Google Meet', type: 'children' },
];

const YOUTH_EVENTS = [
  { id: 'y1', title: 'Discipleship Program', date: 'Every Day', time: '6:00 AM & 10:00 PM (15 min)', location: 'Google Meet', icon: 'school-outline' },
  { id: 'y2', title: 'Youth Meeting', date: 'Every Friday', time: '9:00 PM - 10:00 PM', location: 'Zoom & YouTube', icon: 'people-outline' },
];

const EVENT_COLORS: any = { service: '#0f3460', bible: '#6d4c41', prayer: '#2a9d8f', children: '#f4a261' };
const EVENT_ICONS: any = { service: 'book-outline', bible: 'book-outline', prayer: 'hand-left-outline', children: 'happy-outline' };
const EVENT_LABELS: any = { service: 'Service', bible: 'Bible Study', prayer: 'Prayer', children: 'Children' };

const UpcomingEvents = forwardRef((props: {}, ref) => {
  const { colors } = useTheme();
  const [meetings, setMeetings] = useState<SpecialMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.08)).current;
  const shimmerAnim = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    const shake = () => {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
    };
    shake();
    const interval = setInterval(shake, 2400);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
    ])).start();
  }, []);

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 0.22, duration: 1400, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.08, duration: 1400, useNativeDriver: true }),
    ])).start();
  }, []);

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(shimmerAnim, { toValue: 1, duration: 1800, useNativeDriver: false }),
      Animated.timing(shimmerAnim, { toValue: -1, duration: 0, useNativeDriver: false }),
      Animated.delay(1200),
    ])).start();
  }, []);

  useImperativeHandle(ref, () => ({ reload: () => {} }));

  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY).then(cached => {
      if (cached) {
        const parsed: SpecialMeeting[] = JSON.parse(cached);
        setMeetings(parsed.filter(m => m.isActive));
      }
      setLoading(false);
    }).catch(() => setLoading(false));

    const q = query(collection(db, 'events'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const all: SpecialMeeting[] = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Omit<SpecialMeeting, 'id'>) }));
      const active = all.filter(m => m.isActive);
      setMeetings(active);
      setLoading(false);
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(all)).catch(() => {});
    }, (error) => {
      console.log('Firestore listener error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <View>
      {(loading || meetings.length > 0) && (
        <View style={styles.section}>
          <View style={styles.banner}>
            <Animated.View style={[styles.glowDot, { opacity: glowAnim }]} />
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Animated.View style={[styles.shimmerBar, { transform: [{ translateX: shimmerAnim.interpolate({ inputRange: [-1, 1], outputRange: [-180, 420] }) }, { rotate: '20deg' }] }]} />
            </View>
            <Animated.View style={[styles.micWrap, { transform: [{ translateX: shakeAnim }] }]}>
              <Ionicons name="megaphone" size={26} color="#fff" />
            </Animated.View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>📣 Announcements</Text>
              <Text style={styles.bannerSub}>Upcoming Special Meetings</Text>
            </View>
            {meetings.length > 0 && (
              <Animated.View style={[styles.countBadge, { transform: [{ scale: pulseAnim }] }]}>
                <Text style={styles.countText}>{meetings.length}</Text>
              </Animated.View>
            )}
            <Animated.View style={[styles.glowDot, { right: 10, left: undefined, opacity: glowAnim }]} />
          </View>

          {loading && meetings.length === 0 && (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#c0392b" size="large" />
              <Text style={styles.loadingText}>Loading announcements...</Text>
            </View>
          )}

          {meetings.map((meeting, index) => {
            const isMultiDay = meeting.numberOfDays === 'multiple' && !!meeting.endDate;
            return (
              <View key={meeting.id} style={[styles.meetingCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
                <View style={styles.cardTopBar}>
                  <View style={styles.eventNumBadge}>
                    <Text style={styles.eventNumText}>#{index + 1}</Text>
                  </View>
                  <View style={styles.specialTag}>
                    <Ionicons name="star" size={11} color="#fff" />
                    <Text style={styles.specialTagText}>SPECIAL MEETING</Text>
                  </View>
                  {isMultiDay && (
                    <View style={styles.multiDayTag}>
                      <Text style={styles.multiDayTagText}>MULTI-DAY</Text>
                    </View>
                  )}
                  {!isMultiDay && meeting.numberOfDays === '1' && (
                    <View style={styles.oneDayTag}>
                      <Text style={styles.oneDayTagText}>1 DAY</Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.meetingTitle, { color: colors.text }]}>{meeting.title}</Text>
                {!!meeting.description && <Text style={[styles.meetingDesc, { color: colors.subtext }]}>{meeting.description}</Text>}

                <View style={[styles.cardDivider, { backgroundColor: colors.divider }]} />

                <View style={styles.detailsGrid}>
                  {!!meeting.date && (
                    <View style={[styles.detailItem, { flex: 1 }]}>
                      <View style={[styles.detailIconBox, { backgroundColor: colors.raised }]}>
                        <Ionicons name="calendar" size={16} color="#c0392b" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.detailLabel, { color: colors.subtext }]}>{isMultiDay ? 'Start Date' : 'Date'}</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{meeting.date}</Text>
                      </View>
                    </View>
                  )}
                  {!!meeting.time && (
                    <View style={[styles.detailItem, { marginRight: 6 }]}>
                      <View style={[styles.detailIconBox, { backgroundColor: colors.raised }]}>
                        <Ionicons name="time" size={16} color="#c0392b" />
                      </View>
                      <View>
                        <Text style={[styles.detailLabel, { color: colors.subtext }]}>Time</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{meeting.time}</Text>
                      </View>
                    </View>
                  )}
                </View>

                {isMultiDay && (
                  <View style={styles.detailsGrid}>
                    <View style={[styles.detailItem, { flex: 1 }]}>
                      <View style={[styles.detailIconBox, { backgroundColor: colors.raised }]}>
                        <Ionicons name="calendar" size={16} color="#c0392b" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.detailLabel, { color: colors.subtext }]}>End Date</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{meeting.endDate}</Text>
                      </View>
                    </View>
                  </View>
                )}

                {!!meeting.location && (
                  <View style={styles.locationRow}>
                    <View style={[styles.detailIconBox, { backgroundColor: colors.raised }]}>
                      <Ionicons name="location" size={16} color="#c0392b" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.detailLabel, { color: colors.subtext }]}>Location</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>{meeting.location}</Text>
                    </View>
                  </View>
                )}

                {!!meeting.additionalInfo && (
                  <View style={[styles.infoBox, { backgroundColor: colors.raised, borderLeftColor: '#c0392b' }]}>
                    <Ionicons name="information-circle" size={16} color="#c0392b" />
                    <Text style={[styles.infoText, { color: colors.subtext }]}>{meeting.additionalInfo}</Text>
                  </View>
                )}

                <View style={[styles.noteRow, { backgroundColor: colors.raised }]}>
                  <Ionicons name="notifications" size={13} color="#c0392b" />
                  <Text style={styles.noteText}>Mark your calendar — Don't miss this!</Text>
                </View>

                {!!meeting.youtubeLink && (
                  <TouchableOpacity style={styles.youtubeBtn} onPress={() => Linking.openURL(meeting.youtubeLink!)}>
                    <Ionicons name="logo-youtube" size={16} color="#fff" />
                    <Text style={styles.youtubeBtnText}>▶ Watch on YouTube</Text>
                  </TouchableOpacity>
                )}

                {!!meeting.mapLink && (
                  <TouchableOpacity style={styles.mapBtn} onPress={() => Linking.openURL(meeting.mapLink!)}>
                    <Ionicons name="navigate" size={15} color="#fff" />
                    <Text style={styles.mapBtnText}>📍 Get Directions</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          {!loading && meetings.length === 0 && (
            <View style={styles.emptyBox}>
              <Ionicons name="calendar-outline" size={32} color="#e88" />
              <Text style={styles.emptyText}>No upcoming meetings at this time</Text>
            </View>
          )}
        </View>
      )}

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          <Ionicons name="calendar-outline" size={18} color={colors.accent} /> Events & Programs
        </Text>
        {EVENTS.map((event) => (
          <View key={event.id} style={styles.eventRow}>
            <View style={[styles.iconBox, { backgroundColor: EVENT_COLORS[event.type] }]}>
              <Ionicons name={EVENT_ICONS[event.type]} size={18} color="#fff" />
              <Text style={styles.iconLabel}>{EVENT_LABELS[event.type]}</Text>
            </View>
            <View style={styles.eventInfo}>
              <Text style={[styles.eventTitle, { color: colors.text }]}>{event.title}</Text>
              <View style={styles.row}>
                <Ionicons name="calendar-outline" size={12} color={colors.subtext} />
                <Text style={[styles.eventMeta, { color: colors.subtext }]}> {event.date}</Text>
              </View>
              <View style={styles.row}>
                <Ionicons name="time-outline" size={12} color={colors.subtext} />
                <Text style={[styles.eventMeta, { color: colors.subtext }]}> {event.time}</Text>
              </View>
              <View style={styles.row}>
                <Ionicons name="location-outline" size={12} color={colors.subtext} />
                <Text style={[styles.eventMeta, { color: colors.subtext }]}> {event.location}</Text>
              </View>
            </View>
          </View>
        ))}
        <Text style={[styles.meetingLinkNote, { color: colors.subtext }]}>
          📱 Meeting links will be shared in the appropriate church WhatsApp groups.
        </Text>
      </View>

      <View style={styles.youthCard}>
        <View style={styles.youthHeader}>
          <Ionicons name="flash" size={20} color="#fff" />
          <Text style={styles.youthHeaderText}>🔥 Special Youth Programs</Text>
        </View>
        <Text style={styles.youthSubtitle}>Exclusively for Youth — Don't Miss!</Text>
        {YOUTH_EVENTS.map((event) => (
          <View key={event.id} style={styles.youthEventRow}>
            <View style={styles.youthIconBox}>
              <Ionicons name={event.icon as any} size={22} color="#e63946" />
            </View>
            <View style={styles.eventInfo}>
              <Text style={styles.youthEventTitle}>{event.title}</Text>
              <View style={styles.row}>
                <Ionicons name="calendar-outline" size={12} color="#aaa" />
                <Text style={styles.youthEventMeta}> {event.date}</Text>
              </View>
              <View style={styles.row}>
                <Ionicons name="time-outline" size={12} color="#aaa" />
                <Text style={styles.youthEventMeta}> {event.time}</Text>
              </View>
              <View style={styles.row}>
                <Ionicons name="location-outline" size={12} color="#aaa" />
                <Text style={styles.youthEventMeta}> {event.location}</Text>
              </View>
            </View>
          </View>
        ))}
        <TouchableOpacity
          style={styles.youthRegisterBtn}
          onPress={() => Linking.openURL('https://wa.me/919363207478?text=Hi Brother, I am interested in registering for the Youth Program.')}
        >
          <Ionicons name="logo-whatsapp" size={18} color="#e63946" />
          <Text style={styles.youthRegisterBtnText}>Click Here to Register</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.academyCard}>
        <View style={styles.academyHeader}>
          <Ionicons name="school" size={24} color="#fff" />
          <Text style={styles.academyHeaderText}>TGH Bible Academy</Text>
        </View>
        <Text style={styles.academySubtitle}>📖 Deepen your understanding of God's Word</Text>
        <View style={styles.academyDivider} />
        <View style={styles.academyRow}>
          <Ionicons name="calendar-outline" size={16} color="#fff" />
          <Text style={styles.academyText}> Monthly 1 - 2 sessions</Text>
        </View>
        <View style={styles.academyRow}>
          <Ionicons name="time-outline" size={16} color="#fff" />
          <Text style={styles.academyText}> 5:00 PM - 8:00 PM</Text>
        </View>
        <View style={styles.academyRow}>
          <Ionicons name="location-outline" size={16} color="#fff" />
          <Text style={styles.academyText}> Tirupur (Offline Classes)</Text>
        </View>
        <View style={styles.academyRow}>
          <Ionicons name="information-circle-outline" size={16} color="#fff" />
          <Text style={styles.academyText}> Course currently in progress</Text>
        </View>
        <View style={styles.academyDivider} />
        <Text style={styles.academyNote}>📌 For registration & next batch details, contact directly</Text>
        <TouchableOpacity
          style={styles.whatsappBtn}
          onPress={() => Linking.openURL('https://wa.me/919363207478?text=Hi Brother, I am interested in TGH Bible Academy registration.')}
        >
          <Ionicons name="logo-whatsapp" size={18} color="#fff" />
          <Text style={styles.btnText}>Register via WhatsApp</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  section: { marginHorizontal: 16, marginTop: 8, marginBottom: 4 },
  banner: { backgroundColor: '#c0392b', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, elevation: 6, overflow: 'hidden', position: 'relative' },
  glowDot: { position: 'absolute', top: -20, left: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.3)' },
  shimmerBar: { position: 'absolute', top: -40, width: 60, height: 160, backgroundColor: 'rgba(255,255,255,0.18)' },
  micWrap: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  bannerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', letterSpacing: 0.3 },
  bannerSub: { fontSize: 12, color: '#ffcdd2', marginTop: 2 },
  countBadge: { backgroundColor: '#fff', borderRadius: 14, minWidth: 30, height: 30, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  countText: { color: '#c0392b', fontWeight: 'bold', fontSize: 15 },
  loadingBox: { padding: 24, alignItems: 'center', gap: 10 },
  loadingText: { color: '#c0392b', fontSize: 13, fontStyle: 'italic' },
  meetingCard: { borderRadius: 16, marginBottom: 12, overflow: 'hidden', elevation: 4, borderWidth: 1 },
  cardTopBar: { backgroundColor: '#c0392b', paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventNumBadge: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  eventNumText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  specialTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  specialTagText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  multiDayTag: { backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  multiDayTagText: { color: '#c0392b', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  oneDayTag: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  oneDayTagText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  meetingTitle: { fontSize: 17, fontWeight: 'bold', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4 },
  meetingDesc: { fontSize: 13, lineHeight: 20, paddingHorizontal: 14, paddingBottom: 8 },
  cardDivider: { height: 1, marginHorizontal: 14, marginBottom: 12 },
  detailsGrid: { flexDirection: 'row', paddingHorizontal: 14, gap: 16, marginBottom: 10 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailIconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  detailLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  detailValue: { fontSize: 13, fontWeight: '600', marginTop: 1 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, marginBottom: 10 },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 14, borderRadius: 10, padding: 10, marginBottom: 10, borderLeftWidth: 3 },
  infoText: { fontSize: 12, flex: 1, lineHeight: 18 },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, marginTop: 2 },
  noteText: { fontSize: 12, color: '#c0392b', fontStyle: 'italic', fontWeight: '500' },
  youtubeBtn: { backgroundColor: '#ff0000', marginHorizontal: 14, marginTop: 10, borderRadius: 10, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  youtubeBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  mapBtn: { backgroundColor: '#c0392b', margin: 14, marginTop: 10, borderRadius: 10, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  mapBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  emptyBox: { alignItems: 'center', padding: 24, gap: 8 },
  emptyText: { color: '#c0392b', fontSize: 13, fontStyle: 'italic' },
  card: { margin: 16, marginBottom: 0, borderRadius: 16, padding: 20, elevation: 4 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 16 },
  eventRow: { flexDirection: 'row', marginBottom: 18, alignItems: 'flex-start' },
  iconBox: { width: 56, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12, paddingVertical: 9 },
  iconLabel: { fontSize: 10, color: '#fff', marginTop: 3, fontWeight: 'bold', textAlign: 'center' },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  eventMeta: { fontSize: 14, flex: 1, lineHeight: 19 },
  youthCard: { backgroundColor: '#e63946', margin: 16, marginBottom: 0, borderRadius: 16, padding: 20, elevation: 6, borderWidth: 2, borderColor: '#ff6b35' },
  youthHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  youthHeaderText: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  youthSubtitle: { fontSize: 12, color: '#ffe0d6', marginBottom: 16, fontStyle: 'italic' },
  youthEventRow: { flexDirection: 'row', marginBottom: 18, alignItems: 'flex-start' },
  youthIconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  youthEventTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff', marginBottom: 6 },
  youthEventMeta: { fontSize: 14, color: '#ffe0d6', flex: 1, lineHeight: 19 },
  youthRegisterBtn: { backgroundColor: '#fff', borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  youthRegisterBtnText: { color: '#e63946', fontWeight: 'bold', fontSize: 15 },
  academyCard: { backgroundColor: '#2d6a4f', margin: 16, marginBottom: 0, borderRadius: 16, padding: 20, elevation: 6, borderWidth: 2, borderColor: '#52b788' },
  academyHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  academyHeaderText: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  academySubtitle: { fontSize: 13, color: '#d8f3dc', fontStyle: 'italic', marginBottom: 12 },
  academyDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 12 },
  academyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  academyText: { fontSize: 14, color: '#fff' },
  academyNote: { fontSize: 13, color: '#d8f3dc', marginBottom: 14, lineHeight: 20 },
  whatsappBtn: { backgroundColor: '#25d366', borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  meetingLinkNote: { fontSize: 13, fontStyle: 'italic', textAlign: 'center', lineHeight: 18 },
});

export default UpcomingEvents;

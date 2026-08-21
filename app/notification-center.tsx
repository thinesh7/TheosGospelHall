import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Linking, SectionList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../components/AppText';
import { useTheme } from '../utils/ThemeContext';
import {
  getCachedNotifications,
  getMemoryCachedNotifications,
  getReadIds,
  groupNotifications,
  markAllRead,
  markNotificationRead,
  NotificationItem,
  subscribeNotifications,
  subscribeReadIds,
} from '../utils/notificationCenterSync';

// Icon is resolved only from the notification's stored `source` (Special
// Meeting / App Update get a fixed icon of their own) or, for admin sends,
// the admin-selected `category` — never inferred from the message text.
function CategoryIcon({ item, color, size }: { item: NotificationItem; color: string; size: number }) {
  if (item.source === 'app_update') {
    // Matches the icon ForceUpdateScreen/OptionalUpdateModal already use.
    return <Ionicons name="cloud-download-outline" size={size} color={color} />;
  }
  if (item.source === 'special_meeting') {
    // Matches the "Announcements" banner icon UpcomingEvents.tsx uses for
    // this same special-meeting content.
    return <Ionicons name="megaphone" size={size} color={color} />;
  }
  switch (item.category) {
    case 'bible_study':
      return <Ionicons name="book" size={size} color={color} />;
    case 'prayer_meeting':
      return <MaterialCommunityIcons name="hands-pray" size={size} color={color} />;
    case 'youth_meeting':
      return <Ionicons name="flash" size={size} color={color} />;
    default:
      return <Ionicons name="notifications" size={size} color={color} />;
  }
}

function linkLabel(item: NotificationItem): string {
  if (item.source === 'app_update') return 'Update Now';
  if (item.source === 'special_meeting') return 'Join Meeting';
  if (item.category === 'youth_meeting' || item.category === 'prayer_meeting') return 'Join Meeting';
  return 'Open Link';
}

// A message may be authored as "title\nbody" (special-meeting sends already
// combine the two this way); splitting on the first newline just renders
// that structure, it never inspects or infers what the text means.
function splitMessage(message: string): { title: string; body: string } {
  const idx = message.indexOf('\n');
  if (idx === -1) return { title: message, body: '' };
  return { title: message.slice(0, idx), body: message.slice(idx + 1).trim() };
}

function formatItemTime(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return time;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return time;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function NotificationCenterScreen() {
  const router = useRouter();
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<NotificationItem[]>(() => getMemoryCachedNotifications());
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const glowAnim = useRef(new Animated.Value(0.15)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.35, duration: 1400, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.15, duration: 1400, useNativeDriver: true }),
      ])
    ).start();
  }, [glowAnim]);

  useEffect(() => {
    getCachedNotifications().then(setItems);
    const unsubItems = subscribeNotifications(setItems);
    getReadIds().then(setReadIds);
    const unsubRead = subscribeReadIds(setReadIds);
    return () => {
      unsubItems();
      unsubRead();
    };
  }, []);

  // Simply having the list on screen is what marks it read — not a tap on
  // each row — so the Home bell's badge/shake clears as soon as this screen
  // is opened, and stays cleared if a new item streams in while it's open.
  useEffect(() => {
    if (items.length) markAllRead(items.map(i => i.id));
  }, [items]);

  const handleOpen = (item: NotificationItem) => {
    markNotificationRead(item.id);
    if (item.link) {
      Linking.openURL(item.link).catch(() => {});
    }
  };

  const sections = groupNotifications(items);

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460']}
        style={[styles.header, { paddingTop: 16 + insets.top }]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.backBtn} />
      </LinearGradient>

      {sections.length === 0 ? (
        <View style={styles.emptyBox}>
          <Animated.View
            style={[styles.emptyGlow, { backgroundColor: c.accent, opacity: glowAnim }]}
          />
          <View style={[styles.emptyIconWrap, { backgroundColor: c.raised, borderColor: c.accent }]}>
            <Ionicons name="notifications-outline" size={40} color={c.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: c.text }]}>You&apos;re all caught up!</Text>
          <Text style={[styles.emptyText, { color: c.subtext }]}>
            New announcements, meeting reminders, and updates will show up here.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 + insets.bottom }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.sectionTitle, { color: c.subtext }]}>{section.title}</Text>
          )}
          renderItem={({ item }) => {
            const isUnread = !readIds.has(item.id);
            const { title, body } = splitMessage(item.message);
            return (
              <TouchableOpacity
                style={[styles.row, { backgroundColor: c.surface, borderColor: c.divider }]}
                onPress={() => handleOpen(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.dot, { backgroundColor: isUnread ? c.accent : c.divider }]} />

                <View style={[styles.iconWrap, { backgroundColor: c.raised }]}>
                  <CategoryIcon item={item} color={c.accent} size={20} />
                </View>

                <View style={styles.content}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
                      {title}
                    </Text>
                    <Text style={[styles.time, { color: c.subtext }]}>{formatItemTime(item.createdAt)}</Text>
                  </View>
                  {!!body && (
                    <Text style={[styles.body, { color: c.subtext }]} numberOfLines={3}>
                      {body}
                    </Text>
                  )}
                  {!!item.link && (
                    <View style={styles.linkRow}>
                      <Ionicons name="link" size={13} color={c.accent} />
                      <Text style={[styles.linkText, { color: c.accent }]}>{linkLabel(item)}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    elevation: 4,
  },
  backBtn: { width: 32 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: 'bold', textAlign: 'center', color: '#fff' },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyGlow: { position: 'absolute', width: 150, height: 150, borderRadius: 75 },
  emptyIconWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    marginBottom: 18,
    elevation: 3,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  emptyText: { fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 260 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    elevation: 3,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 16 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  time: { fontSize: 11, marginTop: 2 },
  body: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  linkText: { fontSize: 13, fontWeight: '700' },
});

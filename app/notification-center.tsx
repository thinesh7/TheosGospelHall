import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Animated, Linking, SectionList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../components/AppText';
import { checkIsOnline } from '../utils/connectivity';
import {
  getNotificationPermissionStatus,
  registerForPushNotifications,
} from '../utils/notifications';
import {
  getCachedNotifications,
  getMemoryCachedNotifications,
  getMemoryReadIds,
  getReadIds,
  groupNotifications,
  markAllRead,
  NotificationItem,
  subscribeNotifications,
  subscribeReadIds,
} from '../utils/notificationCenterSync';
import { useTheme } from '../utils/ThemeContext';
import { requestVideosTab } from '../utils/videoNavigation';

// Live/Songs notifications carry no link at all — their CTA always jumps to
// a fixed in-app section instead of opening a URL, so this identifies them
// independent of whether `item.link` happens to be set.
function isVideosNavCategory(item: NotificationItem): item is NotificationItem & { category: 'live' | 'songs' } {
  return item.category === 'live' || item.category === 'songs';
}

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
    case 'live':
      return <Ionicons name="radio" size={size} color={color} />;
    case 'songs':
      return <Ionicons name="musical-notes" size={size} color={color} />;
    default:
      return <Ionicons name="notifications" size={size} color={color} />;
  }
}

function linkLabel(item: NotificationItem): string {
  if (item.source === 'app_update') return 'Update Now';
  if (item.source === 'special_meeting') return 'Join Meeting';
  if (item.category === 'youth_meeting' || item.category === 'prayer_meeting') return 'Join Meeting';
  if (isVideosNavCategory(item)) return 'Click Here';
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

// Exact 3-line wrapping can't be measured without a layout pass, so this is
// a deliberately cheap proxy: explicit line breaks or a long run of text are
// the only ways a body actually exceeds the 3-line clamp in this row width.
function isBodyTruncated(body: string): boolean {
  if (!body) return false;
  return body.split('\n').length > 3 || body.length > 140;
}

// Same cheap proxy as isBodyTruncated, but for the title's 2-line clamp —
// the title never contains '\n' (splitMessage cuts it off there), and its
// row is narrower than the body's (it shares space with the timestamp) and
// bold, so it wraps at fewer characters per line.
function isTitleTruncated(title: string): boolean {
  return title.length > 60;
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
  const [readIds, setReadIds] = useState<Set<string>>(() => getMemoryReadIds());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [permStatus, setPermStatus] = useState<
    'granted' | 'denied' | 'undetermined' | 'unsupported' | null
  >(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const glowAnim = useRef(new Animated.Value(0.15)).current;
  const itemsRef = useRef(items);
  itemsRef.current = items;

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

  // Unread dots and the bell count stay visible for as long as this screen
  // is open; only leaving the screen marks everything read, in one shot,
  // via the current item list captured in itemsRef.
  useEffect(() => {
    return () => {
      if (itemsRef.current.length) markAllRead(itemsRef.current.map(i => i.id));
    };
  }, []);

  // Re-checked on foreground so the banner clears the moment the user
  // grants the permission from the OS settings screen and comes back. A
  // fresh grant also registers the push token right away, since the one at
  // app launch (app/_layout.tsx) only runs once per cold start and would
  // otherwise miss a permission flip that happens mid-session.
  useEffect(() => {
    getNotificationPermissionStatus().then(setPermStatus);
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') return;
      getNotificationPermissionStatus().then(status => {
        setPermStatus(prev => {
          if (status === 'granted' && prev !== 'granted') registerForPushNotifications();
          return status;
        });
      });
    });
    return () => sub.remove();
  }, []);

  // Re-checked on foreground for the same reason as the permission check
  // above: coming back from Settings (or just regaining signal) should
  // clear the offline message without requiring a manual retry tap.
  useEffect(() => {
    let cancelled = false;
    checkIsOnline().then(online => {
      if (!cancelled) setIsOffline(!online);
    });
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') return;
      checkIsOnline().then(online => {
        if (!cancelled) setIsOffline(!online);
      });
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  const handleRetryConnection = () => {
    setCheckingConnection(true);
    checkIsOnline()
      .then(online => setIsOffline(!online))
      .finally(() => setCheckingConnection(false));
  };

  // expo-notifications has no in-app "enable" action once a permission
  // decision has been made (Android silently no-ops a re-request after a
  // denial, iOS never re-prompts at all) — the OS notification settings
  // screen for this app is the only place left that can flip it back on.
  const handleEnableNotifications = () => {
    Linking.openSettings();
  };

  const handleCtaPress = (item: NotificationItem) => {
    if (isVideosNavCategory(item)) {
      // Fires while this screen is still on top of the stack — the tabs
      // layout underneath is already mounted and listening, so the Videos
      // sub-tab is switched before back() even reveals it.
      requestVideosTab(item.category);
      router.back();
      return;
    }
    if (item.link) {
      Linking.openURL(item.link).catch(() => {});
    }
  };

  const toggleExpand = (item: NotificationItem) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
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

      {permStatus && permStatus !== 'granted' && permStatus !== 'unsupported' && !bannerDismissed && (
        <View style={[styles.permBanner, { backgroundColor: c.surface, borderColor: c.divider }]}>
          <View style={[styles.permIconWrap, { backgroundColor: c.raised }]}>
            <Ionicons name="notifications-off-outline" size={20} color={c.accent} />
          </View>
          <View style={styles.permContent}>
            <Text style={[styles.permTitle, { color: c.text }]}>Don&apos;t miss new notifications</Text>
            <Text style={[styles.permText, { color: c.subtext }]}>
              Turn on notifications to get the latest announcements and updates.
            </Text>
            <TouchableOpacity
              style={[styles.permButton, { backgroundColor: c.raised, borderColor: c.accent }]}
              onPress={handleEnableNotifications}
            >
              <Text style={[styles.permButtonText, { color: c.accent }]}>Turn on Notifications</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => setBannerDismissed(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={18} color={c.subtext} />
          </TouchableOpacity>
        </View>
      )}

      {sections.length === 0 && isOffline ? (
        <View style={styles.emptyBox}>
          <View style={[styles.emptyIconWrap, { backgroundColor: c.raised, borderColor: c.accent }]}>
            <Ionicons name="cloud-offline-outline" size={40} color={c.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: c.text }]}>You&apos;re offline</Text>
          <Text style={[styles.emptyText, { color: c.subtext }]}>
            Turn on your internet connection to view notifications.
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: c.accent }]}
            onPress={handleRetryConnection}
            disabled={checkingConnection}
          >
            <Ionicons name="refresh" size={15} color="#fff" />
            <Text style={styles.retryBtnText}>{checkingConnection ? 'Checking…' : 'Try Again'}</Text>
          </TouchableOpacity>
        </View>
      ) : sections.length === 0 ? (
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
            const isExpanded = expandedIds.has(item.id);
            const { title, body } = splitMessage(item.message);
            return (
              <TouchableOpacity
                style={[styles.row, { backgroundColor: c.surface, borderColor: c.divider }]}
                onPress={() => toggleExpand(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.dot, { backgroundColor: isUnread ? c.accent : c.divider }]} />

                <View style={[styles.iconWrap, { backgroundColor: c.raised }]}>
                  <CategoryIcon item={item} color={c.accent} size={20} />
                </View>

                <View style={styles.content}>
                  <View style={styles.titleRow}>
                    <Text
                      style={[styles.title, { color: c.text }]}
                      numberOfLines={isExpanded ? undefined : 2}
                    >
                      {title}
                    </Text>
                    <Text style={[styles.time, { color: c.subtext }]}>{formatItemTime(item.createdAt)}</Text>
                  </View>
                  {!!body && (
                    <Text
                      style={[styles.body, { color: c.subtext }]}
                      numberOfLines={isExpanded ? undefined : 3}
                    >
                      {body}
                    </Text>
                  )}
                  {(isTitleTruncated(title) || isBodyTruncated(body)) && (
                    <View style={styles.readMoreRow}>
                      <Text style={[styles.readMoreText, { color: c.accent }]}>
                        {isExpanded ? 'Show less' : 'Read more'}
                      </Text>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={13}
                        color={c.accent}
                      />
                    </View>
                  )}
                  {(!!item.link || isVideosNavCategory(item)) && (
                    <TouchableOpacity
                      style={[styles.ctaButton, { backgroundColor: c.accent }]}
                      onPress={() => handleCtaPress(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.ctaText}>{linkLabel(item)}</Text>
                      <Ionicons name="arrow-forward" size={14} color="#fff" />
                    </TouchableOpacity>
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
  permBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    margin: 16,
    marginBottom: 0,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 2,
  },
  permIconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  permContent: { flex: 1 },
  permTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  permText: { fontSize: 12.5, lineHeight: 18, marginBottom: 10 },
  permButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  permButtonText: { fontSize: 13, fontWeight: '700' },
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
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 18,
  },
  retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
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
  readMoreRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  readMoreText: { fontSize: 12, fontWeight: '700' },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    elevation: 1,
  },
  ctaText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});

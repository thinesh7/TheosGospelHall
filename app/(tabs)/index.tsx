import NotificationBell from '@/components/NotificationBell';
import Paragraphs from '@/components/Paragraphs';
import UpcomingEvents from '@/components/UpcomingEvents';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  Image,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Text } from '../../components/AppText';
import { useTheme } from '../../utils/ThemeContext';
import { getCachedHomeContent, getMemoryCachedHomeContent, HomeContent, subscribeHomeContent } from '../../utils/homeContentSync';
import { THEME_ORDER, THEMES, ThemeName } from '../../utils/theme';

// Header top padding: clears the edge-to-edge Android status bar.
const HEADER_TOP = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 14 : 56;

// Width of the theme-button / bell slots either side of the header title.
const SIDE_SLOT = 40;
// Equal space reserved on both sides of the title for those icons (+ a gap).
const TITLE_SIDE_INSET = SIDE_SLOT + 6;
const HEADER_SIDE_PADDING = 16;
// "Theos Gospel Hall" in bold is roughly 10× its font size wide; size the
// title to fit its row on one line (max 30) instead of auto-shrinking, which
// can misplace centered text on Android.
const titleFontSizeFor = (windowWidth: number) =>
  Math.max(20, Math.min(30, Math.floor((windowWidth - 2 * (HEADER_SIDE_PADDING + TITLE_SIDE_INSET)) / 10)));

const THEME_LABELS: Record<ThemeName, string> = { light: 'Light', dark: 'Dark', sepia: 'Sepia' };

export default function HomeScreen() {
  const { theme, colors, setTheme } = useTheme();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const titleFontSize = titleFontSizeFor(windowWidth);
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  const appStateRef = useRef(AppState.currentState);
  const upcomingEventsRef = useRef<{ reload: () => void }>(null);
  const [content, setContent] = useState<HomeContent | null>(() => getMemoryCachedHomeContent());

  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        upcomingEventsRef.current?.reload();
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    getCachedHomeContent().then(cached => {
      if (cached) setContent(cached);
    });
    const unsubscribe = subscribeHomeContent(setContent);
    return unsubscribe;
  }, []);

  // On a cold app launch, the root layout's `<StatusBar style="auto" />`
  // (expo-status-bar) can briefly apply its own style right after this
  // mounts, stomping the one below — only visible on Home because its header
  // is the one screen with a fixed (always-blue) background instead of one
  // that tracks the in-app theme. A second pass after the initial startup
  // churn settles (splash/appearance listeners) wins that race deterministically,
  // matching what already happens naturally when switching tabs and back.
  useEffect(() => {
    const applyStatusBar = () => {
      StatusBar.setBarStyle('light-content', true);
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor('#0b1a3a', true);
      }
    };
    applyStatusBar();
    const timer = setTimeout(applyStatusBar, 400);
    return () => clearTimeout(timer);
  }, []);

  const pastorName = content?.pastorName?.trim();
  const pastorDesignation = content?.pastorDesignation?.trim();
  const aboutPastorEnglish = content?.aboutPastorEnglish?.trim();
  const aboutPastorTamil = content?.aboutPastorTamil?.trim();
  const hasAboutPastor = !!aboutPastorEnglish || !!aboutPastorTamil;

  const photoSource = content?.pastorPhotoUrl?.trim()
    ? { uri: content.pastorPhotoUrl.trim() }
    : require('../../assets/images/pastor.png');

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]}>
      <LinearGradient
        colors={['#0b1a3a', '#0f2752', '#163a6e']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.header}
      >
        {/* One row: theme button | title | bell. The title spans the full
            row and is centered on the screen itself; the two icons are pinned
            to the edges on top of the title's side padding, so their widths
            can never push the title off-center. */}
        <View style={styles.titleRow}>
          <View style={[styles.sideSlot, styles.sideSlotLeft]}>
            <TouchableOpacity
              onPress={() => setShowThemeMenu(true)}
              style={styles.iconPill}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel={`App theme: ${THEME_LABELS[theme]}`}
            >
              <Ionicons
                name={theme === 'dark' ? 'moon' : theme === 'light' ? 'sunny' : 'contrast'}
                size={20}
                color="#fff"
              />
            </TouchableOpacity>
          </View>

          <Text
            style={[styles.churchName, { fontSize: titleFontSize, lineHeight: Math.round(titleFontSize * 1.3) }]}
            numberOfLines={1}
            allowFontScaling={false}
          >
            Theos Gospel Hall
          </Text>

          <View style={[styles.sideSlot, styles.sideSlotRight]}>
            <NotificationBell color="#fff" onPress={() => router.push('/notification-center')} />
          </View>
        </View>

        <View style={styles.ornament}>
          <View style={styles.ornamentLine} />
          <Ionicons name="book" size={18} color="rgba(255,255,255,0.9)" style={styles.ornamentIcon} />
          <View style={styles.ornamentLine} />
        </View>

        <Text style={styles.tagline} maxFontSizeMultiplier={1.3}>{'"The Word of God is Living and Active"'}</Text>
      </LinearGradient>

      <Modal
        visible={showThemeMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowThemeMenu(false)}
      >
        <TouchableOpacity
          style={styles.themeMenuBackdrop}
          activeOpacity={1}
          onPress={() => setShowThemeMenu(false)}
        >
          <View style={[styles.themeMenuCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.themeMenuTitle, { color: colors.text }]}>App Theme</Text>
            {THEME_ORDER.map(t => {
              const isActive = theme === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.themeMenuRow, isActive && { backgroundColor: colors.raised }]}
                  onPress={() => {
                    setTheme(t);
                    setShowThemeMenu(false);
                  }}
                >
                  <View
                    style={[
                      styles.themeSwatch,
                      { backgroundColor: THEMES[t].bg, borderColor: THEMES[t].accent },
                    ]}
                  />
                  <Text style={[styles.themeMenuLabel, { color: colors.text }]}>{THEME_LABELS[t]}</Text>
                  {isActive && <Ionicons name="checkmark" size={18} color={colors.accent} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      <View style={[styles.pastorCard, { backgroundColor: colors.surface }]}>
        <View style={styles.pastorAvatar}>
          <Image source={photoSource} style={[styles.pastorImage, { borderColor: colors.accent }]} />
        </View>
        {!!pastorName && <Text style={[styles.pastorName, { color: colors.text }]} maxFontSizeMultiplier={1.5}>{pastorName}</Text>}
        {!!pastorDesignation && <Text style={[styles.pastorTitle, { color: colors.subtext }]} maxFontSizeMultiplier={1.5}>{pastorDesignation}</Text>}

        {hasAboutPastor && (
          <>
            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
            {!!aboutPastorEnglish && <Paragraphs text={aboutPastorEnglish} style={[styles.pastorAboutText, { color: colors.subtext }]} />}
            {!!aboutPastorEnglish && !!aboutPastorTamil && <View style={{ height: 10 }} />}
            {!!aboutPastorTamil && <Paragraphs text={aboutPastorTamil} style={[styles.pastorAboutText, { color: colors.subtext }]} />}
          </>
        )}
      </View>

      <UpcomingEvents ref={upcomingEventsRef} />
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    alignItems: 'center',
    paddingTop: HEADER_TOP,
    paddingBottom: 26,
    paddingHorizontal: HEADER_SIDE_PADDING,
  },
  titleRow: {
    width: '100%',
    minHeight: 40,
    justifyContent: 'center',
    marginTop: 6,
  },
  // Icons sit on top of the title's (equal) side padding, pinned to the edges.
  sideSlot: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: SIDE_SLOT,
    justifyContent: 'center',
    zIndex: 1,
  },
  sideSlotLeft: { left: 0, alignItems: 'flex-start' },
  sideSlotRight: { right: 0, alignItems: 'flex-end' },
  iconPill: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  churchName: {
    width: '100%',
    paddingHorizontal: TITLE_SIDE_INSET,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  ornament: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '80%',
    marginTop: 12,
    marginBottom: 10,
  },
  ornamentLine: { flex: 1, height: StyleSheet.hairlineWidth * 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  ornamentIcon: { marginHorizontal: 12 },
  tagline: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.92)',
    fontStyle: 'italic',
    fontWeight: '600',
    letterSpacing: 0.4,
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: 8,
  },
  pastorCard: { margin: 16, borderRadius: 16, padding: 20, alignItems: 'center', elevation: 4 },
  pastorAvatar: { marginBottom: 10 },
  pastorImage: { width: 120, height: 120, borderRadius: 60, borderWidth: 3 },
  pastorName: { fontSize: 20, fontWeight: 'bold', lineHeight: 26, textAlign: 'center' },
  pastorTitle: { fontSize: 14, marginTop: 4, lineHeight: 20, textAlign: 'center' },
  divider: { height: 1, width: '100%', marginVertical: 14 },
  pastorAboutText: { textAlign: 'center' },
  themeMenuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingTop: HEADER_TOP + 52,
    paddingLeft: 16,
  },
  themeMenuCard: {
    width: 200,
    borderRadius: 16,
    padding: 10,
    elevation: 8,
  },
  themeMenuTitle: { fontSize: 13, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 8 },
  themeMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
  },
  themeSwatch: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  themeMenuLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
});

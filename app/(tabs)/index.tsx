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
} from 'react-native';
import { Text } from '../../components/AppText';
import { useTheme } from '../../utils/ThemeContext';
import { getCachedHomeContent, getMemoryCachedHomeContent, HomeContent, subscribeHomeContent } from '../../utils/homeContentSync';
import { THEME_ORDER, THEMES, ThemeName } from '../../utils/theme';

const THEME_LABELS: Record<ThemeName, string> = { light: 'Light', dark: 'Dark', sepia: 'Sepia' };

export default function HomeScreen() {
  const { theme, colors, setTheme } = useTheme();
  const router = useRouter();
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
        StatusBar.setBackgroundColor('#1a1a2e', true);
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
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.header}>
        <View style={styles.settingsWrap}>
          <TouchableOpacity
            onPress={() => setShowThemeMenu(true)}
            style={styles.headerIconBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="settings-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.bellWrap}>
          <NotificationBell color="#fff" onPress={() => router.push('/notification-center')} />
        </View>
        <Text style={styles.churchName}>Theos Gospel Hall</Text>
        <Text style={styles.tagline}>"The Word of God is Living and Active"</Text>
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
  header: { padding: 40, alignItems: 'center', paddingTop: 60 },
  settingsWrap: { position: 'absolute', top: 56, left: 16, zIndex: 2 },
  bellWrap: { position: 'absolute', top: 56, right: 16, zIndex: 2 },
  headerIconBtn: { padding: 4 },
  churchName: { fontSize: 26, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  tagline: { fontSize: 14, color: '#ffffff', marginTop: 8, fontStyle: 'italic', fontWeight: '600', letterSpacing: 0.5, textAlign: 'center', width: '100%' },
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
    paddingTop: 102,
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

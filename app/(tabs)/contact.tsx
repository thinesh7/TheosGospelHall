import ChurchInfo from '@/components/ChurchInfo';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import Paragraphs from '../../components/Paragraphs';
import { Text } from '../../components/AppText';
import { Toast, useToast } from '../../components/Toast';
import { CONTENT_MAX_WIDTH } from '../../constants/layout';
import { useTheme } from '../../utils/ThemeContext';
import { getCachedHomeContent, getMemoryCachedHomeContent, HomeContent, subscribeHomeContent } from '../../utils/homeContentSync';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function AboutScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { message, opacity, showToast } = useToast();

  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<any>(null);
  const [homeContent, setHomeContent] = useState<HomeContent | null>(() => getMemoryCachedHomeContent());

  useEffect(() => {
    getCachedHomeContent().then(cached => {
      if (cached) setHomeContent(cached);
    });
    const unsubscribe = subscribeHomeContent(setHomeContent);
    return unsubscribe;
  }, []);

  // Hidden admin entry point — 5 taps within 1.5s on the footer. Auth state
  // is no longer tracked here: app/admin/_layout.tsx's own guard bounces an
  // already-signed-in admin straight to the dashboard and an anonymous one
  // to /admin/login, so this only ever needs to push one route.
  const handleFooterTap = () => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 1500);
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      clearTimeout(tapTimerRef.current);
      router.push('/admin/login' as never);
    }
  };

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Hero banner stays full-bleed edge-to-edge even on desktop — only
          the content below is capped/centered, matching the Home screen. */}
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.header}>
        <Text style={styles.churchName}>Theos Gospel Hall</Text>
        <Text style={styles.tagline}>"Proclaiming the Word of God"</Text>
      </LinearGradient>

      <View style={styles.contentWrap}>
        <ChurchInfo showToast={showToast} />

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            <Ionicons name="share-social-outline" size={18} color={colors.accent} /> Follow Us
          </Text>
          <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('https://www.youtube.com/@TheosGospelHall')}>
            <Ionicons name="logo-youtube" size={16} color="red" />
            <Text style={[styles.rowText, styles.link, { color: colors.accent }]}>YouTube Channel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('https://www.facebook.com/theosgospelhall.tirupur/')}>
            <Ionicons name="logo-facebook" size={16} color="#1877f2" />
            <Text style={[styles.rowText, styles.link, { color: colors.accent }]}>Facebook Page</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('https://www.instagram.com/theosgospelhall')}>
            <Ionicons name="logo-instagram" size={16} color="#e1306c" />
            <Text style={[styles.rowText, styles.link, { color: colors.accent }]}>Instagram</Text>
          </TouchableOpacity>
        </View>

        {(() => {
          const aboutMinistryEnglish = homeContent?.aboutMinistryEnglish?.trim();
          const aboutMinistryTamil = homeContent?.aboutMinistryTamil?.trim();
          const hasAboutMinistry = !!aboutMinistryEnglish || !!aboutMinistryTamil;
          if (!hasAboutMinistry) return null;
          return (
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                <Ionicons name="book-outline" size={18} color={colors.accent} /> About Ministry
              </Text>
              {!!aboutMinistryEnglish && <Paragraphs text={aboutMinistryEnglish} style={[styles.aboutText, { color: colors.subtext }]} />}
              {!!aboutMinistryEnglish && !!aboutMinistryTamil && <View style={{ height: 10 }} />}
              {!!aboutMinistryTamil && <Paragraphs text={aboutMinistryTamil} style={[styles.aboutText, { color: colors.subtext }]} />}
            </View>
          );
        })()}

        <TouchableOpacity activeOpacity={1} onPress={handleFooterTap}>
          <View style={[styles.footer, { borderTopColor: colors.divider }]}>
            <Text style={[styles.footerVersion, { color: colors.subtext }]}>Version {APP_VERSION}</Text>
            <Text style={[styles.footerCopy, { color: colors.subtext }]}>© {new Date().getFullYear()} Theos Gospel Hall</Text>
            <Text style={[styles.footerRights, { color: colors.subtext }]}>All rights reserved.</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
    <Toast message={message} opacity={opacity} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 40, alignItems: 'center', paddingTop: 60 },
  contentWrap: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  churchName: { fontSize: 26, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  tagline: { fontSize: 14, color: '#ffffff', marginTop: 8, fontStyle: 'italic', fontWeight: '600', letterSpacing: 0.5, textAlign: 'center', width: '100%' },
  card: { margin: 16, marginBottom: 0, borderRadius: 16, padding: 20, elevation: 4 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  rowText: { fontSize: 14, flex: 1 },
  link: { textDecorationLine: 'underline' },
  aboutText: { fontSize: 14, lineHeight: 24, textAlign: 'left' },
  footer: { alignItems: 'center', paddingVertical: 24, marginTop: 24, marginHorizontal: 16, borderTopWidth: 1 },
  footerVersion: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  footerCopy: { fontSize: 12, marginBottom: 2 },
  footerRights: { fontSize: 11 },
});

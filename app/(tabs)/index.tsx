import Paragraphs from '@/components/Paragraphs';
import UpcomingEvents from '@/components/UpcomingEvents';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  Image,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../../components/AppText';
import { CONTENT_MAX_WIDTH } from '../../constants/layout';
import { useTheme } from '../../utils/ThemeContext';
import { getCachedHomeContent, getMemoryCachedHomeContent, HomeContent, subscribeHomeContent } from '../../utils/homeContentSync';

export default function HomeScreen() {
  const { colors } = useTheme();

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
      {/* Hero banner stays full-bleed edge-to-edge even on desktop — only
          the content below is capped/centered, so it reads as an
          intentional wide banner rather than a stretched mobile layout. */}
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.header}>
        <Text style={styles.churchName}>Theos Gospel Hall</Text>
        <Text style={styles.tagline}>"The Word of God is Living and Active"</Text>
      </LinearGradient>

      <View style={styles.contentWrap}>
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
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 40, alignItems: 'center', paddingTop: 60 },
  contentWrap: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  churchName: { fontSize: 26, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  tagline: { fontSize: 14, color: '#ffffff', marginTop: 8, fontStyle: 'italic', fontWeight: '600', letterSpacing: 0.5, textAlign: 'center', width: '100%' },
  pastorCard: { margin: 16, borderRadius: 16, padding: 20, alignItems: 'center', elevation: 4 },
  pastorAvatar: { marginBottom: 10 },
  pastorImage: { width: 120, height: 120, borderRadius: 60, borderWidth: 3 },
  pastorName: { fontSize: 20, fontWeight: 'bold', lineHeight: 26, textAlign: 'center' },
  pastorTitle: { fontSize: 14, marginTop: 4, lineHeight: 20, textAlign: 'center' },
  divider: { height: 1, width: '100%', marginVertical: 14 },
  pastorAboutText: { textAlign: 'center' },
});

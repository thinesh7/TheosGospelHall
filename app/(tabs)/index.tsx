import Paragraphs from '@/components/Paragraphs';
import UpcomingEvents from '@/components/UpcomingEvents';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getCachedHomeContent, getMemoryCachedHomeContent, HomeContent, subscribeHomeContent } from '../../utils/homeContentSync';

export default function HomeScreen() {
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
    <ScrollView style={styles.container}>
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.header}>
        <Text style={styles.churchName}>Theos Gospel Hall</Text>
        <Text style={styles.tagline}>"The Word of God is Living and Active"</Text>
      </LinearGradient>

      <View style={styles.pastorCard}>
        <View style={styles.pastorAvatar}>
          <Image source={photoSource} style={styles.pastorImage} />
        </View>
        {!!pastorName && <Text style={styles.pastorName}>{pastorName}</Text>}
        {!!pastorDesignation && <Text style={styles.pastorTitle}>{pastorDesignation}</Text>}

        {hasAboutPastor && (
          <>
            <View style={styles.divider} />
            {!!aboutPastorEnglish && <Paragraphs text={aboutPastorEnglish} style={styles.pastorAboutText} />}
            {!!aboutPastorEnglish && !!aboutPastorTamil && <View style={{ height: 10 }} />}
            {!!aboutPastorTamil && <Paragraphs text={aboutPastorTamil} style={styles.pastorAboutText} />}
          </>
        )}
      </View>

      <UpcomingEvents ref={upcomingEventsRef} />
      <View style={{ height: 40 }} />
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
  pastorAboutText: { textAlign: 'center' },
});

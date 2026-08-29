import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { BackHandler, Image, ScrollView, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../components/AppText';
import ArticlesScreen, { getArticleHeaderIconGradient } from '../../components/reading/ArticlesScreen';
import ReadingSectionHeader from '../../components/reading/ReadingSectionHeader';
import { ThemeName } from '../../utils/theme';
import { useTheme } from '../../utils/ThemeContext';
import BibleScreen from './bible';

interface ReadingCardStyle {
  gradient: [string, string, string];
  glowGradient: [string, string, string];
  glowLocations: [number, number, number];
  cardBorder: string;
  shadowColor: string;
  iconGradient: [string, string];
  text: string;
  subtext: string;
  pillBg: string;
  pillText: string;
  chevronBg: string;
  chevronIcon: string;
}

// Same layered technique as the Bilingual Reading card in bible.tsx (base gradient + a
// second glow gradient concentrated toward one corner + a subtle border), so the hub cards
// feel like the same "premium" family as the screens they open into. The Bible card here
// deliberately reuses bible.tsx's BILINGUAL_STYLES colors per theme (royal blue for light,
// deep purple/burgundy with an orange glow for dark, gold/parchment for sepia) so tapping
// into it feels continuous; Articles gets a parallel orange-family treatment instead.
const BIBLE_CARD_STYLES: Record<ThemeName, ReadingCardStyle> = {
  light: {
    gradient: ['#152a6b', '#1e3fae', '#3b5bdb'],
    glowGradient: ['rgba(147,197,253,0)', 'rgba(147,197,253,0)', 'rgba(147,197,253,0.4)'],
    glowLocations: [0, 0.5, 1],
    cardBorder: 'rgba(255,255,255,0.18)',
    shadowColor: '#1e3fae',
    iconGradient: ['#3b5bdb', '#1e3fae'],
    text: '#ffffff',
    subtext: 'rgba(255,255,255,0.85)',
    pillBg: 'rgba(255,255,255,0.2)',
    pillText: '#ffffff',
    chevronBg: 'rgba(255,255,255,0.22)',
    chevronIcon: '#ffffff',
  },
  dark: {
    gradient: ['#1b0f2e', '#241132', '#2c1330'],
    glowGradient: ['rgba(255,90,45,0)', 'rgba(255,90,45,0)', 'rgba(255,74,58,0.45)'],
    glowLocations: [0, 0.5, 1],
    cardBorder: 'rgba(255,255,255,0.08)',
    shadowColor: '#ff6a2b',
    iconGradient: ['#7c3aed', '#c026d3'],
    text: '#ffffff',
    subtext: 'rgba(255,255,255,0.85)',
    pillBg: 'rgba(255,255,255,0.14)',
    pillText: '#ffffff',
    chevronBg: 'rgba(255,255,255,0.16)',
    chevronIcon: '#ffffff',
  },
  sepia: {
    // Refined palette: soft ivory-caramel card (not saturated gold/ochre), a muted
    // brown glow toward the CTA corner, and solid muted-bronze pills/chevron (not a
    // translucent overlay like the other themes) so they read as raised badges on
    // the parchment card — no blue, no green, nothing bright-orange or neon-gold.
    gradient: ['#f3e2c4', '#e8cda0', '#dab883'],
    glowGradient: ['rgba(138,90,50,0)', 'rgba(138,90,50,0)', 'rgba(138,90,50,0.28)'],
    glowLocations: [0, 0.5, 1],
    cardBorder: 'rgba(59,42,26,0.2)',
    shadowColor: '#8a6239',
    iconGradient: ['#c2955f', '#8a5a2e'],
    text: '#3b2a1a',
    subtext: '#7a6650',
    pillBg: '#c2955f',
    pillText: '#3b2a1a',
    chevronBg: '#c2955f',
    chevronIcon: '#3b2a1a',
  },
};

const ARTICLES_CARD_STYLES: Record<ThemeName, ReadingCardStyle> = {
  light: {
    gradient: ['#7c2d12', '#c2410c', '#fb923c'],
    glowGradient: ['rgba(254,215,170,0)', 'rgba(254,215,170,0)', 'rgba(254,215,170,0.45)'],
    glowLocations: [0, 0.5, 1],
    cardBorder: 'rgba(255,255,255,0.18)',
    shadowColor: '#c2410c',
    iconGradient: ['#fb923c', '#c2410c'],
    text: '#ffffff',
    subtext: 'rgba(255,255,255,0.85)',
    pillBg: 'rgba(255,255,255,0.2)',
    pillText: '#ffffff',
    chevronBg: 'rgba(255,255,255,0.22)',
    chevronIcon: '#ffffff',
  },
  dark: {
    gradient: ['#2b0f05', '#3d1508', '#4a1a0a'],
    glowGradient: ['rgba(255,140,60,0)', 'rgba(255,140,60,0)', 'rgba(255,140,60,0.45)'],
    glowLocations: [0, 0.5, 1],
    cardBorder: 'rgba(255,255,255,0.08)',
    shadowColor: '#ff8a3d',
    iconGradient: ['#fb923c', '#c2410c'],
    text: '#ffffff',
    subtext: 'rgba(255,255,255,0.85)',
    pillBg: 'rgba(255,255,255,0.14)',
    pillText: '#ffffff',
    chevronBg: 'rgba(255,255,255,0.16)',
    chevronIcon: '#ffffff',
  },
  sepia: {
    // A deeper muted tan-bronze than Bible's ivory-caramel, so the two cards still
    // read as separate sections under the same soft parchment treatment — without
    // reaching for terracotta/burnt-orange.
    gradient: ['#ecdab6', '#ddbf90', '#c9a06a'],
    glowGradient: ['rgba(138,90,50,0)', 'rgba(138,90,50,0)', 'rgba(138,90,50,0.28)'],
    glowLocations: [0, 0.5, 1],
    cardBorder: 'rgba(59,42,26,0.2)',
    shadowColor: '#8a5a32',
    iconGradient: ['#c99b5e', '#8a5a2e'],
    text: '#3b2a1a',
    subtext: '#7a6650',
    pillBg: '#c2955f',
    pillText: '#3b2a1a',
    chevronBg: '#c2955f',
    chevronIcon: '#3b2a1a',
  },
};

interface HeroStyle {
  bg: [string, string];
  title: string;
  underline: string;
  subtitle: string;
}

// A warm, literary "bookshelf" palette per theme for the hero banner — a soft
// cream gradient for light, a warm dark plum-brown for dark (rather than the
// flat card surface), and the existing sepia parchment tones — so the title
// and the Reading.png book illustration read as one deliberate design in
// every theme.
const HERO_STYLES: Record<ThemeName, HeroStyle> = {
  light: { bg: ['#f8f9fa', '#eef1f5'], title: '#16264f', underline: '#e2963d', subtitle: '#5f6b7a' },
  dark: { bg: ['#241a12', '#2c2013'], title: '#f5ede0', underline: '#f0b94a', subtitle: '#c9bda6' },
  sepia: { bg: ['#f8ecd9', '#f2e0c4'], title: '#3b2a1a', underline: '#a9713f', subtitle: '#7a6650' },
};

// Add a new reading category by adding one entry here (plus a themeStyles map above) and
// one branch in renderSection() below — nothing else about this screen needs to change.
interface ReadingSectionMeta {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  pillIcon: string;
  pillLabel: string;
  styles: Record<ThemeName, ReadingCardStyle>;
}

const READING_SECTIONS: ReadingSectionMeta[] = [
  {
    id: 'bible',
    icon: '📖',
    title: 'Bible',
    subtitle: 'Tamil & English versions, bilingual reading',
    pillIcon: 'book-outline',
    pillLabel: 'Multiple Versions',
    styles: BIBLE_CARD_STYLES,
  },
  {
    id: 'articles',
    icon: '📝',
    title: 'TGH Articles',
    subtitle: 'Read inspiring articles from TGH',
    pillIcon: 'document-text-outline',
    pillLabel: 'Latest Articles',
    styles: ARTICLES_CARD_STYLES,
  },
];

const MORE_SOON_ACCENT = '#7c3aed';

function renderSection(id: string, headerTitle: ReactNode) {
  switch (id) {
    case 'bible':
      return <BibleScreen headerTitle={headerTitle} />;
    case 'articles':
      return <ArticlesScreen headerTitle={headerTitle} />;
    default:
      return null;
  }
}

export default function ReadingScreen() {
  const { colors: c, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const activeSectionRef = useRef<string | null>(null);

  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

  // Registered once, on this screen's very first mount — i.e. before a user
  // can ever tap into a section, so this listener is always the oldest on
  // RN's hardware-back stack. Any section's own back handling (e.g. Bible's
  // book/chapter drill-down) registers later and is therefore invoked first;
  // this one only fires once a section has let the press fall through.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeSectionRef.current !== null) {
        setActiveSection(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  if (activeSection) {
    const section = READING_SECTIONS.find(s => s.id === activeSection);
    if (section) {
      const headerTitle = (
        <ReadingSectionHeader
          icon={section.icon}
          title={section.title}
          onBack={() => setActiveSection(null)}
          c={c}
          badgeGradient={section.id === 'articles' ? getArticleHeaderIconGradient(theme) : section.styles[theme].iconGradient}
        />
      );
      return <View style={{ flex: 1 }}>{renderSection(section.id, headerTitle)}</View>;
    }
  }

  const hs = HERO_STYLES[theme];

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <StatusBar barStyle={theme === 'light' ? 'dark-content' : 'light-content'} />
      <ScrollView contentContainerStyle={[styles.listContent, { paddingRight: 16 + insets.right }]}>
        <LinearGradient
          colors={hs.bg}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { marginTop: insets.top + 6 }]}
        >
          <View style={styles.heroRow}>
            <View style={styles.heroTextCol}>
              <Text style={[styles.heroTitle, { color: hs.title }]}>Reading</Text>
              <View style={[styles.heroUnderline, { backgroundColor: hs.underline }]} />
              <Text style={[styles.heroSubtitle, { color: hs.subtitle }]}>
                Nourish your mind, strengthen your spirit.
              </Text>
            </View>
            <Image
              source={require('../../assets/images/Reading.png')}
              style={styles.heroImage}
              resizeMode="contain"
            />
          </View>
        </LinearGradient>

        {READING_SECTIONS.map(section => {
          const cs = section.styles[theme];
          return (
            <TouchableOpacity
              key={section.id}
              onPress={() => setActiveSection(section.id)}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={cs.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.card, { shadowColor: cs.shadowColor, borderWidth: 1, borderColor: cs.cardBorder }]}
              >
                <LinearGradient
                  colors={cs.glowGradient}
                  locations={cs.glowLocations}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />

                <LinearGradient colors={cs.iconGradient} style={styles.cardIconBadge}>
                  <Text style={styles.cardIconText}>{section.icon}</Text>
                </LinearGradient>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: cs.text }]}>{section.title}</Text>
                  <Text style={[styles.cardSubtitle, { color: cs.subtext }]}>{section.subtitle}</Text>
                  <View style={[styles.pill, { backgroundColor: cs.pillBg }]}>
                    <Ionicons name={section.pillIcon as any} size={13} color={cs.pillText} />
                    <Text style={[styles.pillText, { color: cs.pillText }]}>{section.pillLabel}</Text>
                  </View>
                </View>

                <View style={[styles.chevronBadge, { backgroundColor: cs.chevronBg }]}>
                  <Ionicons name="chevron-forward" size={18} color={cs.chevronIcon} />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}

        <Text style={styles.comingSoonText}>
          <Text>✨ </Text>
          <Text style={{ color: MORE_SOON_ACCENT }}>More coming soon…!</Text>
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 32 },

  hero: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroTextCol: { flex: 1 },
  heroTitle: { fontSize: 32, fontWeight: '800', letterSpacing: 0.2, marginBottom: 10 },
  heroUnderline: { width: 56, height: 4, borderRadius: 2, marginBottom: 14 },
  heroSubtitle: { fontSize: 14, lineHeight: 20 },
  // Matches Reading.png's native 1536x1024 (3:2) aspect ratio so `contain`
  // never letterboxes or stretches it.
  heroImage: { width: 132, height: 88 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    overflow: 'hidden',
    gap: 14,
    elevation: 4,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  cardIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  cardIconText: { fontSize: 26 },
  cardTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  pillText: { fontSize: 12, fontWeight: '700' },
  chevronBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },

  comingSoonText: { textAlign: 'center', fontSize: 14, fontWeight: '700', fontStyle: 'italic', marginTop: 6 },
});

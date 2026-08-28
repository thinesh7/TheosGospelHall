import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { BackHandler, ScrollView, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../components/AppText';
import ArticlesScreen from '../../components/reading/ArticlesScreen';
import ReadingSectionHeader from '../../components/reading/ReadingSectionHeader';
import { useTheme } from '../../utils/ThemeContext';
import BibleScreen from './bible';

// Add a new reading category by adding one entry here and one branch in
// renderSection() below — nothing else about this screen needs to change.
// `solid`/`gradient` are fixed hex (not theme tokens) — each card tints
// itself by alpha-blending these over the current theme's own surface
// color, so the same values read correctly in light, dark, and sepia.
interface ReadingSectionMeta {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  solid: string;
  gradient: [string, string];
  pillIcon: string;
  pillLabel: string;
}

const READING_SECTIONS: ReadingSectionMeta[] = [
  {
    id: 'bible',
    icon: '📖',
    title: 'Bible',
    subtitle: 'Tamil & English versions, bilingual reading',
    solid: '#2563eb',
    gradient: ['#60a5fa', '#1d4ed8'],
    pillIcon: 'book-outline',
    pillLabel: 'Multiple Versions',
  },
  {
    id: 'articles',
    icon: '📝',
    title: 'TGH Articles',
    subtitle: 'Read inspiring articles from TGH',
    solid: '#ea580c',
    gradient: ['#fb923c', '#c2410c'],
    pillIcon: 'document-text-outline',
    pillLabel: 'Latest Articles',
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
        />
      );
      return <View style={{ flex: 1 }}>{renderSection(section.id, headerTitle)}</View>;
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <StatusBar barStyle={theme === 'light' ? 'dark-content' : 'light-content'} />
      <ScrollView contentContainerStyle={[styles.listContent, { paddingRight: 16 + insets.right }]}>
        <View style={[styles.hero, { backgroundColor: c.surface, marginTop: insets.top + 6 }]}>
          <LinearGradient
            colors={[`${READING_SECTIONS[0].solid}26`, `${READING_SECTIONS[1].solid}1f`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.heroDecorationBig}>📚</Text>
          <Text style={styles.heroDecorationSmall}>📖</Text>

          <View style={styles.heroTopRow}>
            <LinearGradient colors={READING_SECTIONS[0].gradient} style={styles.heroIconBadge}>
              <Text style={styles.heroIconText}>📖</Text>
            </LinearGradient>
            <Text style={[styles.heroTitle, { color: c.text }]}>Reading</Text>
          </View>
          <Text style={[styles.heroSubtitle, { color: c.subtext }]}>
            Nourish your mind, strengthen your spirit.
          </Text>
          <LinearGradient
            colors={[READING_SECTIONS[0].solid, READING_SECTIONS[1].solid]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.heroUnderline}
          />
        </View>

        {READING_SECTIONS.map(section => (
          <TouchableOpacity
            key={section.id}
            style={[styles.card, { backgroundColor: c.surface }]}
            onPress={() => setActiveSection(section.id)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[`${section.solid}24`, `${section.solid}00`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.cardBlob, { backgroundColor: `${section.solid}14` }]} />

            <LinearGradient colors={section.gradient} style={styles.cardIconBadge}>
              <Text style={styles.cardIconText}>{section.icon}</Text>
            </LinearGradient>

            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: c.text }]}>{section.title}</Text>
              <Text style={[styles.cardSubtitle, { color: c.subtext }]}>{section.subtitle}</Text>
              <View style={[styles.pill, { backgroundColor: `${section.solid}1c` }]}>
                <Ionicons name={section.pillIcon as any} size={13} color={section.solid} />
                <Text style={[styles.pillText, { color: section.solid }]}>{section.pillLabel}</Text>
              </View>
            </View>

            <View style={[styles.chevronBadge, { backgroundColor: `${section.solid}1c` }]}>
              <Ionicons name="chevron-forward" size={18} color={section.solid} />
            </View>
          </TouchableOpacity>
        ))}

        <View style={[styles.comingSoonCard, { backgroundColor: c.surface, borderColor: `${MORE_SOON_ACCENT}55` }]}>
          <LinearGradient
            colors={[`${MORE_SOON_ACCENT}1f`, `${MORE_SOON_ACCENT}0a`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.comingSoonIconWrap}>
            <Text style={styles.comingSoonIcon}>📚</Text>
            <Text style={styles.comingSoonSparkle}>✨</Text>
          </View>
          <View style={[styles.comingSoonDivider, { backgroundColor: `${MORE_SOON_ACCENT}33` }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.comingSoonTitle, { color: MORE_SOON_ACCENT }]}>More Coming Soon…!</Text>
            <Text style={[styles.comingSoonText, { color: c.subtext }]}>
              We're working on more amazing reading experiences for you.
            </Text>
          </View>
        </View>
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
  heroDecorationBig: {
    position: 'absolute',
    right: -14,
    top: 6,
    fontSize: 92,
    opacity: 0.16,
    transform: [{ rotate: '-8deg' }],
  },
  heroDecorationSmall: {
    position: 'absolute',
    right: 66,
    top: -10,
    fontSize: 44,
    opacity: 0.2,
    transform: [{ rotate: '10deg' }],
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  heroIconBadge: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heroIconText: { fontSize: 26 },
  heroTitle: { fontSize: 30, fontWeight: '800', letterSpacing: 0.2 },
  heroSubtitle: { fontSize: 14, lineHeight: 20, marginBottom: 14, maxWidth: '78%' },
  heroUnderline: { width: 44, height: 4, borderRadius: 2 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    overflow: 'hidden',
    gap: 14,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardBlob: { position: 'absolute', width: 140, height: 140, borderRadius: 70, right: -40, bottom: -50 },
  cardIconBadge: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
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
  },
  pillText: { fontSize: 12, fontWeight: '700' },
  chevronBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  comingSoonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    padding: 18,
    marginTop: 4,
    overflow: 'hidden',
    gap: 14,
  },
  comingSoonIconWrap: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  comingSoonIcon: { fontSize: 30 },
  comingSoonSparkle: { position: 'absolute', top: -6, right: -6, fontSize: 15 },
  comingSoonDivider: { width: 1, alignSelf: 'stretch', marginVertical: 2 },
  comingSoonTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  comingSoonText: { fontSize: 12, lineHeight: 17 },
});

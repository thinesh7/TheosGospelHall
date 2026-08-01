import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../AppText';
import { useTheme } from '../../utils/ThemeContext';

export type AdminModule = 'specialMeetings' | 'songsMenu' | 'homeContent' | 'registrations' | 'appManagement';

interface ModuleCard {
  id: AdminModule;
  icon: string;
  title: string;
  subtitle: string;
}

const MODULES: ModuleCard[] = [
  {
    id: 'songsMenu',
    icon: '🎵',
    title: 'Songs',
    subtitle: 'Manage Geethangalum Keerthanaigalum and Other Songs',
  },
  {
    id: 'registrations',
    icon: '📝',
    title: 'Discipleship & Academy Registrations',
    subtitle: 'View or manage Youth Program & Academy registrations',
  },
  {
    id: 'specialMeetings',
    icon: '📅',
    title: 'Upcoming Special Meetings',
    subtitle: 'Add, edit, and notify users about upcoming meetings',
  },
  {
    id: 'homeContent',
    icon: '🏠',
    title: 'Pastor & Ministry Content',
    subtitle: 'Manage Pastor info & About Ministry (English/Tamil)',
  },
];

interface Props {
  onSelect: (module: AdminModule) => void;
}

export default function AdminDashboard({ onSelect }: Props) {
  const { colors } = useTheme();

  const renderCard = (m: ModuleCard) => (
    <TouchableOpacity
      key={m.id}
      style={[styles.card, { backgroundColor: colors.surface, borderLeftColor: colors.accent }]}
      onPress={() => onSelect(m.id)}
      activeOpacity={0.8}
    >
      <Text style={styles.cardIcon}>{m.icon}</Text>
      <View style={styles.cardTextWrap}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{m.title}</Text>
        <Text style={[styles.cardSubtitle, { color: colors.subtext }]}>{m.subtitle}</Text>
      </View>
      <Text style={[styles.cardChevron, { color: colors.divider }]}>›</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {MODULES.map(renderCard)}

      {/* Kept last and visually distinct (amber/red) — everything inside
          takes effect on the live app immediately, unlike the content-only
          modules above. */}
      <TouchableOpacity
        style={styles.warningCard}
        onPress={() => onSelect('appManagement')}
        activeOpacity={0.8}
      >
        <View style={styles.warningCardHeader}>
          <Text style={styles.warningCardIcon}>⚠️</Text>
          <Text style={styles.warningCardTitle}>App Management</Text>
          <Text style={styles.warningCardChevron}>›</Text>
        </View>
        <Text style={styles.warningCardText}>
          Warning: Changes made in this section will immediately affect the application and its users.
        </Text>
      </TouchableOpacity>

      <Text style={[styles.footerNote, { color: colors.subtext }]}>More modules will appear here as the admin panel grows.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 32 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    elevation: 3,
    borderLeftWidth: 5,
  },
  cardIcon: { fontSize: 28, marginRight: 16 },
  cardTextWrap: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  cardSubtitle: { fontSize: 12, lineHeight: 17 },
  cardChevron: { fontSize: 26, marginLeft: 8, fontWeight: '300' },
  warningCard: {
    backgroundColor: '#fff3e0',
    borderRadius: 16,
    padding: 18,
    marginTop: 8,
    elevation: 3,
    borderWidth: 1.5,
    borderColor: '#e65100',
  },
  warningCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  warningCardIcon: { fontSize: 22, marginRight: 10 },
  warningCardTitle: { flex: 1, fontSize: 16, fontWeight: 'bold', color: '#e65100' },
  warningCardChevron: { fontSize: 22, color: '#e65100', fontWeight: '300' },
  warningCardText: { fontSize: 12, color: '#8a4b00', lineHeight: 17, fontWeight: '600' },
  footerNote: { textAlign: 'center', fontSize: 12, marginTop: 12, fontStyle: 'italic' },
});

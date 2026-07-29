import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../AppText';

export type AdminModule = 'specialMeetings' | 'songsMenu' | 'livePlaylists' | 'homeContent' | 'notifications' | 'apiKeys' | 'registrationsMenu' | 'appUpdate';

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
    id: 'registrationsMenu',
    icon: '📝',
    title: 'View Registrations',
    subtitle: 'Manage Youth Program & Academy registrations',
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

// Grouped under the "App Management" section, kept last in the dashboard, in
// this fixed order.
const APP_MANAGEMENT_MODULES: ModuleCard[] = [
  {
    id: 'appUpdate',
    icon: '⬆️',
    title: 'App Update Settings',
    subtitle: 'Set the latest version, minimum required version, and update message',
  },
  {
    id: 'notifications',
    icon: '🔔',
    title: 'Send Notifications',
    subtitle: 'Send push notifications to all app users',
  },
  {
    id: 'livePlaylists',
    icon: '🎬',
    title: 'Live Playlists',
    subtitle: 'Manage YouTube playlists shown in the Live tab',
  },
  {
    id: 'apiKeys',
    icon: '🔑',
    title: 'API Keys',
    subtitle: 'Manage backup YouTube API keys and check their status',
  },
];

interface Props {
  onSelect: (module: AdminModule) => void;
}

export default function AdminDashboard({ onSelect }: Props) {
  const renderCard = (m: ModuleCard) => (
    <TouchableOpacity key={m.id} style={styles.card} onPress={() => onSelect(m.id)} activeOpacity={0.8}>
      <Text style={styles.cardIcon}>{m.icon}</Text>
      <View style={styles.cardTextWrap}>
        <Text style={styles.cardTitle}>{m.title}</Text>
        <Text style={styles.cardSubtitle}>{m.subtitle}</Text>
      </View>
      <Text style={styles.cardChevron}>›</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {MODULES.map(renderCard)}

      <Text style={styles.sectionHeader}>App Management</Text>
      {APP_MANAGEMENT_MODULES.map(renderCard)}

      <Text style={styles.footerNote}>More modules will appear here as the admin panel grows.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 32 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    elevation: 3,
    borderLeftWidth: 5,
    borderLeftColor: '#0f3460',
  },
  cardIcon: { fontSize: 28, marginRight: 16 },
  cardTextWrap: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 4 },
  cardSubtitle: { fontSize: 12, color: '#777', lineHeight: 17 },
  cardChevron: { fontSize: 26, color: '#ccc', marginLeft: 8, fontWeight: '300' },
  footerNote: { textAlign: 'center', color: '#aaa', fontSize: 12, marginTop: 12, fontStyle: 'italic' },
});

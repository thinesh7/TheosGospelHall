import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type AdminModule = 'specialMeetings' | 'songsMenu' | 'livePlaylists' | 'homeContent';

interface ModuleCard {
  id: AdminModule;
  icon: string;
  title: string;
  subtitle: string;
}

const MODULES: ModuleCard[] = [
  {
    id: 'homeContent',
    icon: '🏠',
    title: 'Pastor & Ministry Content',
    subtitle: 'Manage Pastor info & About Ministry (English/Tamil)',
  },
  {
    id: 'specialMeetings',
    icon: '📅',
    title: 'Special Meetings',
    subtitle: 'Add, edit, and notify users about upcoming meetings',
  },
  {
    id: 'songsMenu',
    icon: '🎵',
    title: 'Songs',
    subtitle: 'Manage Geethangalum Keerthanaigalum and Other Songs',
  },
  {
    id: 'livePlaylists',
    icon: '🎬',
    title: 'Live Playlists',
    subtitle: 'Manage YouTube playlists shown in the Live tab',
  },
];

interface Props {
  onSelect: (module: AdminModule) => void;
}

export default function AdminDashboard({ onSelect }: Props) {
  return (
    <View style={styles.container}>
      {MODULES.map(m => (
        <TouchableOpacity key={m.id} style={styles.card} onPress={() => onSelect(m.id)} activeOpacity={0.8}>
          <Text style={styles.cardIcon}>{m.icon}</Text>
          <View style={styles.cardTextWrap}>
            <Text style={styles.cardTitle}>{m.title}</Text>
            <Text style={styles.cardSubtitle}>{m.subtitle}</Text>
          </View>
          <Text style={styles.cardChevron}>›</Text>
        </TouchableOpacity>
      ))}
      <Text style={styles.footerNote}>More modules will appear here as the admin panel grows.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
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

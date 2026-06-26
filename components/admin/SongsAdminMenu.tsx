import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type SongsModule = 'geethangalum' | 'otherSongs';

interface ModuleCard {
  id: SongsModule;
  icon: string;
  title: string;
  subtitle: string;
}

const MODULES: ModuleCard[] = [
  {
    id: 'geethangalum',
    icon: '📖',
    title: 'Geethangalum Keerthanaigalum',
    subtitle: 'Edit existing songs (720 songs - no add or delete)',
  },
  {
    id: 'otherSongs',
    icon: '🎶',
    title: 'Other Songs',
    subtitle: 'Add, edit, and show/hide songs',
  },
];

interface Props {
  onSelect: (module: SongsModule) => void;
}

export default function SongsAdminMenu({ onSelect }: Props) {
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
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 4 },
  cardSubtitle: { fontSize: 12, color: '#777', lineHeight: 17 },
  cardChevron: { fontSize: 26, color: '#ccc', marginLeft: 8, fontWeight: '300' },
});

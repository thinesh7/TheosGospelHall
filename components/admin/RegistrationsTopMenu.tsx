import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../AppText';
import { useTheme } from '../../utils/ThemeContext';

export type RegistrationsTopMenuOption = 'view' | 'manage';

interface ModuleCard {
  id: RegistrationsTopMenuOption;
  icon: string;
  title: string;
  subtitle: string;
}

const MODULES: ModuleCard[] = [
  {
    id: 'view',
    icon: '📋',
    title: 'View Registrations',
    subtitle: 'Browse and manage individual registrations',
  },
  {
    id: 'manage',
    icon: '⚙️',
    title: 'Manage Registrations',
    subtitle: 'Open/close registrations and set the closed message',
  },
];

interface Props {
  onSelect: (option: RegistrationsTopMenuOption) => void;
}

export default function RegistrationsTopMenu({ onSelect }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      {MODULES.map(m => (
        <TouchableOpacity key={m.id} style={[styles.card, { backgroundColor: colors.surface, borderLeftColor: colors.accent }]} onPress={() => onSelect(m.id)} activeOpacity={0.8}>
          <Text style={styles.cardIcon}>{m.icon}</Text>
          <View style={styles.cardTextWrap}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{m.title}</Text>
            <Text style={[styles.cardSubtitle, { color: colors.subtext }]}>{m.subtitle}</Text>
          </View>
          <Text style={[styles.cardChevron, { color: colors.divider }]}>›</Text>
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
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    elevation: 3,
    borderLeftWidth: 5,
  },
  cardIcon: { fontSize: 28, marginRight: 16 },
  cardTextWrap: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  cardSubtitle: { fontSize: 12, lineHeight: 17 },
  cardChevron: { fontSize: 26, marginLeft: 8, fontWeight: '300' },
});

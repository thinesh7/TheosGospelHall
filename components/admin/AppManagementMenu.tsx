import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../AppText';

export type AppManagementModule = 'appUpdate' | 'notifications' | 'livePlaylists' | 'apiKeys' | 'siteMaintenance';

interface ModuleCard {
  id: AppManagementModule;
  icon: string;
  title: string;
  subtitle: string;
}

// Kept in this fixed order, same as the original "App Management" section on
// the main dashboard.
const MODULES: ModuleCard[] = [
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
  {
    id: 'siteMaintenance',
    icon: '🚧',
    title: 'Site Maintenance',
    subtitle: 'Temporarily disable app sections for all users',
  },
];

interface Props {
  onSelect: (module: AppManagementModule) => void;
}

export default function AppManagementMenu({ onSelect }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.warningBanner}>
        <Text style={styles.warningBannerText}>
          ⚠️ Warning: Changes made in this section will immediately affect the application and its users.
        </Text>
      </View>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 32 },
  warningBanner: {
    backgroundColor: '#fff3e0',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e65100',
    padding: 14,
    marginBottom: 20,
  },
  warningBannerText: { fontSize: 13, color: '#8a4b00', lineHeight: 19, fontWeight: '600' },
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

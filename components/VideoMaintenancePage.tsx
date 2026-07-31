import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './AppText';
import { useTheme } from '../utils/ThemeContext';

export default function VideoMaintenancePage() {
  const { colors } = useTheme();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.iconCircle, { backgroundColor: colors.accent + '1A' }]}>
        <Ionicons name="construct" size={56} color={colors.accent} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>Videos are currently under maintenance</Text>
      <Text style={[styles.subtitle, { color: colors.subtext }]}>
        We&apos;re working to improve your experience. Please check back again shortly.
      </Text>
      <View style={[styles.divider, { backgroundColor: colors.divider }]} />
      <Text style={[styles.thanks, { color: colors.subtext }]}>Thank you for your patience.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  title: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 12, lineHeight: 28 },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  divider: { width: 48, height: 1, marginVertical: 20 },
  thanks: { fontSize: 13, textAlign: 'center', fontStyle: 'italic' },
});

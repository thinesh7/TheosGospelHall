import { Ionicons } from '@expo/vector-icons';
import { Linking, Modal, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from './AppText';
import { useTheme } from '../utils/ThemeContext';

interface Props {
  message: string;
  storeUrl: string;
}

export default function ForceUpdateScreen({ message, storeUrl }: Props) {
  const { colors } = useTheme();

  return (
    // onRequestClose is a no-op: this update is mandatory, so the Android
    // hardware back button must not be able to dismiss it.
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.surface, shadowColor: colors.accent }]}>
          <View style={[styles.iconCircle, { backgroundColor: colors.accent, shadowColor: colors.accent }]}>
            <Ionicons name="cloud-download-outline" size={34} color="#fff" />
          </View>

          <Text style={[styles.overline, { color: colors.accent }]}>APP UPDATE</Text>
          <Text style={[styles.title, { color: colors.text }]}>Update Required</Text>
          <Text style={[styles.message, { color: colors.subtext }]}>{message}</Text>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          <Text style={[styles.hint, { color: colors.subtext }]}>
            Please update to the latest version to continue using the app.
          </Text>

          <TouchableOpacity
            style={[styles.updateBtn, { backgroundColor: colors.accent, shadowColor: colors.accent }]}
            activeOpacity={0.85}
            onPress={() => Linking.openURL(storeUrl)}
          >
            <Ionicons name="arrow-up-circle" size={18} color="#fff" style={styles.updateBtnIcon} />
            <Text style={styles.updateBtnText}>Update Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 26,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
      android: { elevation: 12 },
    }),
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...Platform.select({
      ios: { shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 6 },
    }),
  },
  overline: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1.4, marginBottom: 6 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: 0.2, marginBottom: 10, textAlign: 'center' },
  message: { fontSize: 15.5, textAlign: 'center', lineHeight: 23, fontWeight: '400' },
  divider: { height: StyleSheet.hairlineWidth, width: '100%', marginVertical: 18 },
  hint: { fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 24, fontWeight: '500' },
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 15,
    width: '100%',
    ...Platform.select({
      ios: { shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
      android: { elevation: 4 },
    }),
  },
  updateBtnIcon: { marginRight: 8 },
  updateBtnText: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.3 },
});

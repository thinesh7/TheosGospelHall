import { Ionicons } from '@expo/vector-icons';
import { Linking, Modal, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from './AppText';
import { useTheme } from '../utils/ThemeContext';

interface Props {
  visible: boolean;
  message: string;
  storeUrl: string;
  onSkip: () => void;
}

export default function OptionalUpdateModal({ visible, message, storeUrl, onSkip }: Props) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onSkip}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.surface, shadowColor: colors.accent }]}>
          <View style={[styles.iconCircle, { backgroundColor: colors.accent, shadowColor: colors.accent }]}>
            <Ionicons name="cloud-download-outline" size={30} color="#fff" />
          </View>

          <Text style={[styles.overline, { color: colors.accent }]}>NEW VERSION</Text>
          <Text style={[styles.title, { color: colors.text }]}>Update Available</Text>
          <Text style={[styles.message, { color: colors.subtext }]}>{message}</Text>

          <TouchableOpacity
            style={[styles.updateBtn, { backgroundColor: colors.accent, shadowColor: colors.accent }]}
            activeOpacity={0.85}
            onPress={() => Linking.openURL(storeUrl)}
          >
            <Ionicons name="arrow-up-circle" size={17} color="#fff" style={styles.updateBtnIcon} />
            <Text style={styles.updateBtnText}>Update Now</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipBtn} activeOpacity={0.6} onPress={onSkip}>
            <Text style={[styles.skipBtnText, { color: colors.subtext }]}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 26 },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 22,
    paddingTop: 28,
    paddingBottom: 18,
    paddingHorizontal: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 10 },
    }),
  },
  iconCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    ...Platform.select({
      ios: { shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 5 },
    }),
  },
  overline: { fontSize: 11, fontWeight: '700', letterSpacing: 1.3, marginBottom: 5 },
  title: { fontSize: 19, fontWeight: '700', letterSpacing: 0.2, marginBottom: 10, textAlign: 'center' },
  message: { fontSize: 14.5, textAlign: 'center', lineHeight: 21, marginBottom: 22 },
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    paddingVertical: 14,
    width: '100%',
    marginBottom: 4,
    ...Platform.select({
      ios: { shadowOpacity: 0.28, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 3 },
    }),
  },
  updateBtnIcon: { marginRight: 7 },
  updateBtnText: { color: '#fff', fontWeight: '700', fontSize: 15.5, letterSpacing: 0.3 },
  skipBtn: { paddingVertical: 12 },
  skipBtnText: { fontSize: 14, fontWeight: '600', letterSpacing: 0.2 },
});

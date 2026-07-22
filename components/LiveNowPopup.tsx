import { Ionicons } from '@expo/vector-icons';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../utils/ThemeContext';

interface LiveNowPopupProps {
  visible: boolean;
  onWatch: () => void;
  onSkip: () => void;
}

export default function LiveNowPopup({ visible, onWatch, onSkip }: LiveNowPopupProps) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onSkip}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={onSkip} hitSlop={10}>
            <Ionicons name="close" size={20} color={colors.subtext} />
          </TouchableOpacity>

          <View style={styles.iconCircle}>
            <Ionicons name="radio" size={28} color="#fff" />
          </View>

          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>

          <Text style={[styles.title, { color: colors.text, marginBottom: 20 }]}>We're Live Now!</Text>

          <TouchableOpacity style={[styles.watchBtn, { backgroundColor: colors.accent }]} onPress={onWatch} activeOpacity={0.85}>
            <Ionicons name="play" size={18} color="#fff" />
            <Text style={styles.watchBtnText}>Watch Now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipBtn} onPress={onSkip} activeOpacity={0.7}>
            <Text style={[styles.skipBtnText, { color: colors.subtext }]}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 340, borderRadius: 20, padding: 24, alignItems: 'center' },
  closeBtn: { position: 'absolute', top: 12, right: 12, padding: 4 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#ff0000', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#ff0000', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 14 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  watchBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 28, marginBottom: 10, width: '100%', justifyContent: 'center' },
  watchBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  skipBtn: { paddingVertical: 8 },
  skipBtnText: { fontSize: 14, fontWeight: '600' },
});

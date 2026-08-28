import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../AppText';
import { ThemeColors } from '../../utils/theme';

interface Props {
  icon: string;
  title: string;
  onBack: () => void;
  c: ThemeColors;
}

// Rendered via the `headerTitle` slot every reading-section screen (Bible,
// TGH Articles, ...) already accepts, so tapping into a section from the
// Reading hub shows a back arrow instead of that screen's own standalone title.
export default function ReadingSectionHeader({ icon, title, onBack, c }: Props) {
  return (
    <View style={styles.row}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={8}>
        <Ionicons name="chevron-back" size={24} color={c.text} />
      </TouchableOpacity>
      <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
        {icon} {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  backBtn: { paddingRight: 10, paddingVertical: 4 },
  title: { fontSize: 18, fontWeight: 'bold', flexShrink: 1 },
});

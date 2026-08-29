import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../AppText';
import { ThemeColors } from '../../utils/theme';

interface Props {
  icon: string;
  title: string;
  onBack: () => void;
  c: ThemeColors;
  /** The section's own icon-badge gradient (e.g. BIBLE_CARD_STYLES[theme].iconGradient) so
   *  this header's icon box matches the section's own card colors. */
  badgeGradient: [string, string];
}

// Rendered via the `headerTitle` slot every reading-section screen (Bible,
// TGH Articles, ...) already accepts, so tapping into a section from the
// Reading hub shows a back button instead of that screen's own standalone title.
export default function ReadingSectionHeader({ icon, title, onBack, c, badgeGradient }: Props) {
  return (
    <View style={styles.row}>
      <TouchableOpacity onPress={onBack} style={[styles.backBtn, { backgroundColor: `${c.text}14` }]} hitSlop={8}>
        <Ionicons name="chevron-back" size={20} color={c.text} />
      </TouchableOpacity>
      <LinearGradient colors={badgeGradient} style={styles.iconBadge}>
        <Text style={styles.iconText}>{icon}</Text>
      </LinearGradient>
      <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconBadge: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 18 },
  title: { fontSize: 18, fontWeight: 'bold', flexShrink: 1 },
});

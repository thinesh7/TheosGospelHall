import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { Text } from '@/components/AppText';

interface AdminCloseButtonProps {
  onPress: () => void;
  tintColor: string;
  backgroundColor: string;
  style?: StyleProp<ViewStyle>;
}

// Shared "✕ Close" pill affordance for exiting the Admin Panel — used both
// in the mobile Stack header (screenOptions.headerRight, so it shows on
// every admin screen uniformly) and in the tablet/desktop pageTitleBar.
export function AdminCloseButton({ onPress, tintColor, backgroundColor, style }: AdminCloseButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Close Admin Panel"
      style={({ pressed }) => [styles.btn, { backgroundColor }, style, pressed && styles.pressed]}
    >
      <Text style={[styles.icon, { color: tintColor }]}>✕</Text>
      <Text style={[styles.label, { color: tintColor }]}>Close</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  icon: { fontSize: 14, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});

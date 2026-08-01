import { Ionicons } from '@expo/vector-icons';
import { ComponentProps, ReactNode } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/AppText';
import { radii, spacing, typography } from '@/constants/layout';
import { useTheme } from '@/utils/ThemeContext';

export interface SidebarItem {
  key: string;
  label: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
}

interface SidebarProps {
  items: SidebarItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  header?: ReactNode;
  footer?: ReactNode;
  width?: number;
}

// Persistent side navigation used on tablet/desktop by both the main tab bar
// shell (app/(tabs)/_layout.web.tsx) and the admin panel shell
// (app/admin/_layout.tsx) — one component, two call sites, different item
// lists.
export function Sidebar({ items, activeKey, onSelect, header, footer, width = 240 }: SidebarProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { width, backgroundColor: colors.surface, borderRightColor: colors.divider }]}>
      {header}
      <View style={styles.items}>
        {items.map(item => {
          const active = item.key === activeKey;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.item, active && { backgroundColor: colors.raised }]}
              onPress={() => onSelect(item.key)}
              activeOpacity={0.7}
            >
              {item.icon && (
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={active ? colors.accent : colors.subtext}
                  style={styles.itemIcon}
                />
              )}
              <Text
                style={[styles.itemLabel, { color: active ? colors.accent : colors.text }, active && styles.itemLabelActive]}
                numberOfLines={3}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: '100%', borderRightWidth: 1, paddingVertical: spacing.lg },
  items: { flex: 1, paddingHorizontal: spacing.md, gap: spacing.xs },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  itemIcon: { marginRight: spacing.sm, marginTop: 2 },
  itemLabel: { flex: 1, fontSize: typography.subtitle.fontSize, lineHeight: typography.subtitle.lineHeight, fontWeight: typography.subtitle.fontWeight },
  itemLabelActive: { fontWeight: '700' },
});

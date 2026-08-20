import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/AppText';
import { Sidebar } from '@/components/layout/Sidebar';
import AppBrandHeader from '@/components/navigation/AppBrandHeader';
import { TAB_META } from '@/constants/tabs';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { requestTabSwitchAfterReturn } from '@/utils/bibleWebNav';
import { useTheme } from '@/utils/ThemeContext';

const BIBLE_TAB_KEY = '2';

interface BibleWebNavChromeProps {
  children: ReactNode;
  // How many levels deep this screen sits below the (tabs) instance —
  // app/bible-books.tsx passes 1, app/bible-chapters.tsx passes 2 (pushed
  // from Books, which was pushed from tabs). Tapping a different tab calls
  // router.back() this many times to unwind back to the already-mounted
  // TabShell, reusing that instance rather than constructing a new one.
  depth: number;
}

// A second Sidebar/tab-bar instance — visually identical to
// TabShell.web.tsx's — rendered around app/bible-books.tsx and
// app/bible-chapters.tsx. Those are genuine sibling Stack routes (outside
// the (tabs) group), pushed on top of the already-mounted TabShell rather
// than raw-history "views" inside it (see app/(tabs)/bible.tsx's own
// comment: reusing the raw-history approach for these screens hit a
// resetRoot bug that made the whole app look like it refreshed). Since
// they're a different Stack screen, TabShell's own Sidebar is hidden
// underneath them, not visible — this recreates its look so browsing
// Books/Chapters doesn't feel like leaving the app, without needing to
// share a single mounted instance across two different navigator branches.
//
// "Bible" is always the active item here — you're already in the Bible
// tab's own sub-flow, so tapping it again is a no-op. Tapping a different
// tab hands off to the real TabShell instance via plain router.back() calls
// (see `depth` above) plus a sessionStorage flag (see utils/bibleWebNav.ts)
// — the only channel between these two separate Stack screens, since
// there's no direct way to reach TabShell's own activeTab state from here.
export default function BibleWebNavChrome({ children, depth }: BibleWebNavChromeProps) {
  const { colors } = useTheme();
  const { isDesktopUp } = useBreakpoint();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleSelect = (key: string) => {
    if (key === BIBLE_TAB_KEY) return;
    requestTabSwitchAfterReturn(Number(key));
    for (let i = 0; i < depth; i++) router.back();
  };

  if (isDesktopUp) {
    return (
      <View style={[styles.desktopRow, { backgroundColor: colors.bg }]}>
        <Sidebar items={TAB_META} activeKey={BIBLE_TAB_KEY} onSelect={handleSelect} width={260} header={<AppBrandHeader />} />
        <View style={styles.desktopContent}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.content}>{children}</View>
      <View
        style={[
          styles.tabBar,
          { backgroundColor: colors.surface, borderTopColor: colors.divider, paddingBottom: Math.max(insets.bottom, 8) },
        ]}
      >
        {TAB_META.map(tab => {
          const active = tab.key === BIBLE_TAB_KEY;
          return (
            <TouchableOpacity key={tab.key} style={styles.tab} onPress={() => handleSelect(tab.key)}>
              <Ionicons name={tab.icon} size={24} color={active ? colors.accent : colors.subtext} />
              <Text style={[styles.tabLabel, { color: active ? colors.accent : colors.subtext }, active && styles.tabLabelActive]} numberOfLines={1}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  desktopRow: { flex: 1, flexDirection: 'row' },
  desktopContent: { flex: 1, position: 'relative' },
  content: { flex: 1, position: 'relative' },
  tabBar: { flexDirection: 'row', borderTopWidth: 1 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  tabLabel: { fontSize: 10, marginTop: 2 },
  tabLabelActive: { fontWeight: 'bold' },
});

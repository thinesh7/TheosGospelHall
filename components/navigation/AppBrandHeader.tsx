import { Image, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { useTheme } from '@/utils/ThemeContext';

// The desktop Sidebar's header block — shared between TabShell.web.tsx (the
// real tab shell) and BibleWebNavChrome.tsx (a second Sidebar instance
// rendered around app/bible-books.tsx and app/bible-chapters.tsx) so the two
// stay visually identical without copy-pasted logo/brand markup.
export default function AppBrandHeader() {
  const { colors } = useTheme();
  return (
    <View style={[styles.sidebarHeader, { borderBottomColor: colors.divider }]}>
      <View style={styles.brandRow}>
        <Image source={require('../../assets/images/logo.png')} style={styles.brandLogo} resizeMode="contain" />
        <View style={styles.brandTextCol}>
          <Text style={[styles.brandTitle, { color: colors.text }]}>Theos Gospel Hall</Text>
          <Text style={[styles.brandSubtitle, { color: colors.subtext }]}>Proclaiming the Word of God</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebarHeader: { paddingHorizontal: 20, paddingBottom: 20, marginBottom: 12, borderBottomWidth: 1 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandLogo: { width: 36, height: 36, borderRadius: 8 },
  brandTextCol: { flex: 1 },
  brandTitle: { fontSize: 18, fontWeight: '700' },
  brandSubtitle: { fontSize: 12, marginTop: 4, fontStyle: 'italic' },
});

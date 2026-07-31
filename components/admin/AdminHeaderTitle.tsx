import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';

interface AdminHeaderTitleProps {
  title: string;
  subtitle: string;
}

// Two-line title+subtitle header, matching the old AdminPanel.tsx modal
// header — a plain Stack.Screen `options.title` only supports one line, so
// each leaf route passes this via `options.headerTitle`.
export function AdminHeaderTitle({ title, subtitle }: AdminHeaderTitleProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexShrink: 1 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 11, color: '#a8c0e8', marginTop: 2 },
});

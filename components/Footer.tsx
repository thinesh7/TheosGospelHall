import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from './AppText';
import { BRANCHES } from './ChurchInfo';
import { ResponsiveGrid } from './layout/ResponsiveGrid';
import { CONTENT_MAX_WIDTH } from '../constants/layout';

const SOCIAL_LINKS = [
  { icon: 'logo-youtube', color: '#ff4757', label: 'YouTube', url: 'https://www.youtube.com/@TheosGospelHall' },
  { icon: 'logo-facebook', color: '#4d94ff', label: 'Facebook', url: 'https://www.facebook.com/theosgospelhall.tirupur/' },
  { icon: 'logo-instagram', color: '#ff6fa5', label: 'Instagram', url: 'https://www.instagram.com/theosgospelhall' },
] as const;

const ACCENT = '#f4a261';

// Web-only (see app/(tabs)/index.tsx) — a marketing-style site footer reads
// as unusual UX inside the native app's Home tab, so this only ever mounts
// on web. Deliberately fixed-palette (like the Home hero header, which it
// mirrors gradient-for-gradient) rather than following the light/dark theme
// toggle — the two dark bands bookend the light page body between them.
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.wrap}>
      <View style={styles.inner}>
        <ResponsiveGrid columns={{ mobile: 1, tablet: 3, desktop: 3 }} gap="xxl">
          <View>
            <View style={styles.brandRow}>
              <Image source={require('../assets/images/logo.png')} style={styles.brandLogo} resizeMode="contain" />
              <Text style={styles.brandTitle}>Theos Gospel Hall</Text>
            </View>
            <Text style={styles.tagline}>"The Word of God is Living and Active"</Text>
            <View style={styles.socialRow}>
              {SOCIAL_LINKS.map(s => (
                <TouchableOpacity
                  key={s.label}
                  style={styles.socialIcon}
                  onPress={() => Linking.openURL(s.url)}
                  accessibilityRole="link"
                  accessibilityLabel={s.label}
                >
                  <Ionicons name={s.icon} size={17} color={s.color} />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View>
            <Text style={styles.heading}>Connect With Us</Text>
            <View style={styles.headingUnderline} />
            <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('mailto:theosgospelhall@gmail.com')}>
              <View style={styles.rowIconBox}>
                <Ionicons name="mail-outline" size={14} color={ACCENT} />
              </View>
              <Text style={styles.rowText}>theosgospelhall@gmail.com</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('https://wa.me/919363207478')}>
              <View style={styles.rowIconBox}>
                <Ionicons name="logo-whatsapp" size={14} color="#25d366" />
              </View>
              <Text style={styles.rowText}>WhatsApp Us</Text>
            </TouchableOpacity>
          </View>

          <View>
            <Text style={styles.heading}>Our Locations</Text>
            <View style={styles.headingUnderline} />
            {BRANCHES.map(branch => (
              <TouchableOpacity key={branch.city} style={styles.row} onPress={() => Linking.openURL(branch.mapLink)}>
                <View style={styles.rowIconBox}>
                  <Ionicons name="location-outline" size={14} color={ACCENT} />
                </View>
                <Text style={styles.rowText}>{branch.city}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ResponsiveGrid>

        <View style={styles.divider} />
        <View style={styles.copyrightRow}>
          <Ionicons name="heart" size={11} color="#e63946" />
          <Text style={styles.copyright}>© {year} Theos Gospel Hall. All rights reserved.</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', marginTop: 32 },
  inner: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 44 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  brandLogo: { width: 34, height: 34, borderRadius: 9 },
  brandTitle: { fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },
  tagline: { fontSize: 12, fontStyle: 'italic', lineHeight: 18, marginBottom: 18, color: '#a8c0e8' },
  socialRow: { flexDirection: 'row', gap: 10 },
  socialIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  heading: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, color: '#fff', marginBottom: 8 },
  headingUnderline: { width: 26, height: 3, borderRadius: 2, backgroundColor: ACCENT, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 13 },
  rowIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  rowText: { fontSize: 13, color: '#c9d6e8' },
  divider: { height: 1, marginTop: 12, marginBottom: 18, backgroundColor: 'rgba(255,255,255,0.12)' },
  copyrightRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  copyright: { fontSize: 12, textAlign: 'center', color: '#8ea3c7' },
});

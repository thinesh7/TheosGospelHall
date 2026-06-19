import ChurchInfo from '@/components/ChurchInfo';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function AboutScreen() {
  return (
    <ScrollView style={styles.container}>
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.header}>
        <Text style={styles.churchName}>Theos Gospel Hall</Text>
        <Text style={styles.tagline}>"Proclaiming the Word of God"</Text>
      </LinearGradient>

      <ChurchInfo />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          <Ionicons name="share-social-outline" size={18} color="#0f3460" /> Follow Us
        </Text>
        <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('https://www.youtube.com/@TheosGospelHall')}>
          <Ionicons name="logo-youtube" size={16} color="red" />
          <Text style={[styles.rowText, styles.link]}>YouTube Channel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('https://www.facebook.com/theosgospelhall.tirupur/')}>
          <Ionicons name="logo-facebook" size={16} color="#1877f2" />
          <Text style={[styles.rowText, styles.link]}>Facebook Page</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('https://www.instagram.com/theosgospelhall')}>
          <Ionicons name="logo-instagram" size={16} color="#e1306c" />
          <Text style={[styles.rowText, styles.link]}>Instagram</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          <Ionicons name="book-outline" size={18} color="#0f3460" /> About Ministry
        </Text>
        <Text style={styles.aboutText}>
          The primary purpose of the messages on this platform is solely for the spiritual growth of believers.
          {'\n\n'}
          In today's times, many places hold misconceptions about churches. Wrong sermons and doctrines are boldly and calmly addressed on this platform, revealing what the true Gospel really is.
          {'\n\n'}
          Pastor Salaman came to know God at the age of 24 and was led to salvation. He then received the divine calling for ministry, studied the Bible at a theological college, and has been faithfully teaching the foundational truths of Scripture ever since.
          {'\n\n'}
          A church congregation known as Theos Gospel Hall meets in Tirupur.
          {'\n\n'}
          We request your continued prayers for this brother and his team who serve tirelessly. 🙏 Amen.
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { padding: 40, alignItems: 'center', paddingTop: 60 },
  churchName: { fontSize: 26, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  tagline: { fontSize: 14, color: '#ffffff', marginTop: 8, fontStyle: 'italic', fontWeight: '600', letterSpacing: 0.5, textAlign: 'center' },
  card: { backgroundColor: '#fff', margin: 16, marginBottom: 0, borderRadius: 16, padding: 20, elevation: 4 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  rowText: { fontSize: 14, color: '#444', flex: 1 },
  link: { color: '#0f3460', textDecorationLine: 'underline' },
  aboutText: { fontSize: 14, color: '#444', lineHeight: 24, textAlign: 'justify' },
});
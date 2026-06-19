import { Ionicons } from '@expo/vector-icons';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const BRANCHES = [
  {
    city: 'Tirupur',
    time: '7:00 AM – 9:30 AM',
    address: '7/9, Mariyamman Layout, 1st Street, Kumaranandapuram, New Bus Stand Backside, Tirupur - 641602',
    phone: '9363207478',
    mapLink: 'https://maps.app.goo.gl/8rNGTbWvCnswApH56',
  },
  {
    city: 'Coimbatore',
    time: '10:30 AM – 1:00 PM',
    address: 'Horizon Complex, Opp CTC Bus Depot, Near Sebastian Church, Ukkadam, Coimbatore - 641008',
    phone: '9363207478',
    mapLink: 'https://maps.app.goo.gl/u5BdzDqmjmA8xP5d9',
  },
  {
    city: 'Udumalpet',
    time: '10:30 AM – 1:00 PM',
    address: '5/355 Indu Nagar, Gandhi Nagar (Post), Udumalpet - 642154',
    phone: '9363182424',
    mapLink: 'https://maps.app.goo.gl/3vhuv2xg2BnUXxQR7',
  },
  {
    city: 'Kanyakumari',
    time: '9:00 AM – 11:30 AM',
    address: '1st Floor, V.V. Textiles, Keezha Manakudi, Opp Siva Global School, Kanyakumari - 629702',
    phone: '9790124509',
    mapLink: 'https://maps.app.goo.gl/KTKYTDPxLTZgPF288',
  },
];

export default function ChurchInfo() {
  return (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          <Ionicons name="location-outline" size={18} color="#0f3460" /> Our Branches
        </Text>
        {BRANCHES.map((branch, index) => (
          <View key={index} style={styles.branch}>
            <View style={styles.branchHeader}>
              <Ionicons name="location" size={16} color="#0f3460" />
              <Text style={styles.branchCity}>{branch.city}</Text>
              <View style={styles.timeBadge}>
                <Text style={styles.timeBadgeText}>{branch.time}</Text>
              </View>
            </View>
            <Text style={styles.branchAddress}>{branch.address}</Text>
            <View style={styles.branchActions}>
              <TouchableOpacity
                style={styles.branchPhone}
                onPress={() => Linking.openURL(`tel:${branch.phone}`)}
              >
                <Ionicons name="call" size={14} color="#22c55e" />
                <Text style={styles.branchPhoneText}>{branch.phone}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.mapBtn}
                onPress={() => Linking.openURL(branch.mapLink)}
              >
                <Ionicons name="location" size={14} color="#fff" />
                <Text style={styles.mapBtnText}>Location</Text>
              </TouchableOpacity>
            </View>
            {index < BRANCHES.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          <Ionicons name="call-outline" size={18} color="#0f3460" /> Contact Us
        </Text>
        <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('tel:9363207478')}>
          <Ionicons name="call" size={16} color="#22c55e" />
          <Text style={[styles.rowText, styles.link]}>+91 93632 07478</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('mailto:theosgospelhall@gmail.com')}>
          <Ionicons name="mail" size={16} color="#0f3460" />
          <Text style={[styles.rowText, styles.link]}>theosgospelhall@gmail.com</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('https://wa.me/919363207478')}>
          <Ionicons name="logo-whatsapp" size={16} color="#22c55e" />
          <Text style={[styles.rowText, styles.link]}>WhatsApp Us</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', margin: 16, marginBottom: 0, borderRadius: 16, padding: 20, elevation: 4 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 14 },
  branch: { marginBottom: 8 },
  branchHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  branchCity: { fontSize: 15, fontWeight: 'bold', color: '#1a1a2e', flex: 1 },
  timeBadge: { backgroundColor: '#e8f0fe', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  timeBadgeText: { fontSize: 11, color: '#0f3460', fontWeight: '600' },
  branchAddress: { fontSize: 13, color: '#666', marginLeft: 22, lineHeight: 18 },
  branchActions: { flexDirection: 'row', alignItems: 'center', marginLeft: 22, marginTop: 6, gap: 10 },
  branchPhone: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  branchPhoneText: { fontSize: 13, color: '#22c55e' },
  mapBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0f3460', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  mapBtnText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  rowText: { fontSize: 14, color: '#444', flex: 1 },
  link: { color: '#0f3460', textDecorationLine: 'underline' },
});
import ChurchInfo from '@/components/ChurchInfo';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AdminPanel from '../../components/AdminPanel';
import Paragraphs from '../../components/Paragraphs';
import { auth } from '../../firebaseConfig';
import { getCachedHomeContent, getMemoryCachedHomeContent, HomeContent, subscribeHomeContent } from '../../utils/homeContentSync';

export default function AboutScreen() {
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<any>(null);

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [homeContent, setHomeContent] = useState<HomeContent | null>(() => getMemoryCachedHomeContent());

  useEffect(() => {
    getCachedHomeContent().then(cached => {
      if (cached) setHomeContent(cached);
    });
    const unsubscribe = subscribeHomeContent(setHomeContent);
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setIsAdminAuthenticated(!!user);
    });
    return () => unsubscribe();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (showLogin) {
          setShowLogin(false);
          setEmail('');
          setPassword('');
          return true;
        }
        if (showAdmin) {
          setShowAdmin(false);
          return true;
        }
        return false;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [showLogin, showAdmin])
  );

  const handleHeaderTap = () => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 1500);
    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      clearTimeout(tapTimerRef.current);
      if (isAdminAuthenticated) {
        setShowAdmin(true);
      } else {
        setShowLogin(true);
      }
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      alert('Please enter email and password.');
      return;
    }
    setLoggingIn(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setEmail('');
      setPassword('');
      setShowPassword(false);
      setShowLogin(false);
      setShowAdmin(true);
    } catch (e: any) {
      alert('Invalid email or password.');
      setPassword('');
    }
    setLoggingIn(false);
  };

  if (showLogin) {
    return (
      <KeyboardAvoidingView style={styles.loginScreen} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.loginScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.loginHeader}>
            <Text style={styles.loginHeaderTitle}>🔐 Admin Access</Text>
            <Text style={styles.loginHeaderSub}>Theos Gospel Hall</Text>
          </LinearGradient>
          <View style={styles.loginCard}>
            <Text style={styles.loginCardTitle}>Sign In</Text>
            <Text style={styles.loginCardSub}>Enter your admin credentials</Text>
            <Text style={styles.loginLabel}>Email</Text>
            <TextInput
              style={styles.loginInput}
              placeholder="admin@example.com"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              autoFocus
              returnKeyType="next"
            />
            <Text style={styles.loginLabel}>Password</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Password"
                placeholderTextColor="#999"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(p => !p)}>
                <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.loginSubmitBtn, loggingIn && { opacity: 0.6 }]}
              onPress={handleLogin}
              disabled={loggingIn}
            >
              <Text style={styles.loginSubmitText}>{loggingIn ? 'Signing in...' : 'Sign In'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.loginCancelBtn}
              onPress={() => { setShowLogin(false); setEmail(''); setPassword(''); setShowPassword(false); }}
            >
              <Text style={styles.loginCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity activeOpacity={1} onPress={handleHeaderTap}>
        <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.header}>
          <Text style={styles.churchName}>Theos Gospel Hall</Text>
          <Text style={styles.tagline}>"Proclaiming the Word of God"</Text>
        </LinearGradient>
      </TouchableOpacity>

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

      {(() => {
        const aboutMinistryEnglish = homeContent?.aboutMinistryEnglish?.trim();
        const aboutMinistryTamil = homeContent?.aboutMinistryTamil?.trim();
        const hasAboutMinistry = !!aboutMinistryEnglish || !!aboutMinistryTamil;
        if (!hasAboutMinistry) return null;
        return (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              <Ionicons name="book-outline" size={18} color="#0f3460" /> About Ministry
            </Text>
            {!!aboutMinistryEnglish && <Paragraphs text={aboutMinistryEnglish} style={styles.aboutText} />}
            {!!aboutMinistryEnglish && !!aboutMinistryTamil && <View style={{ height: 10 }} />}
            {!!aboutMinistryTamil && <Paragraphs text={aboutMinistryTamil} style={styles.aboutText} />}
          </View>
        );
      })()}

      <View style={{ height: 40 }} />

      <AdminPanel
        visible={showAdmin}
        onClose={() => setShowAdmin(false)}
        onEventsUpdated={() => {}}
      />
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
  aboutText: { fontSize: 14, color: '#444', lineHeight: 24, textAlign: 'left' },
  loginScreen: { flex: 1, backgroundColor: '#f5f5f5' },
  loginScroll: { flexGrow: 1 },
  loginHeader: { padding: 14, paddingTop: 20, alignItems: 'center' },
  loginHeaderTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 6 },
  loginHeaderSub: { fontSize: 14, color: '#a8c0e8' },
  loginCard: { backgroundColor: '#fff', margin: 20, borderRadius: 20, padding: 24, elevation: 4, marginBottom: 20 },
  loginCardTitle: { fontSize: 22, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 6 },
  loginCardSub: { fontSize: 13, color: '#888', marginBottom: 24 },
  loginLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  loginInput: { backgroundColor: '#f9f9f9', borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12, padding: 14, fontSize: 15, color: '#1a1a2e', marginBottom: 18 },
  passwordWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9f9f9', borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12, marginBottom: 18 },
  passwordInput: { flex: 1, padding: 14, fontSize: 15, color: '#1a1a2e' },
  eyeBtn: { paddingHorizontal: 14 },
  eyeText: { fontSize: 18 },
  loginSubmitBtn: { backgroundColor: '#0f3460', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8, marginBottom: 14 },
  loginSubmitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  loginCancelBtn: { alignItems: 'center', paddingVertical: 10 },
  loginCancelText: { color: '#888', fontSize: 14 },
});

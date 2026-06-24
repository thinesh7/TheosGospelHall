import ChurchInfo from '@/components/ChurchInfo';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import AdminPanel from '../../components/AdminPanel';
import Paragraphs from '../../components/Paragraphs';
import { auth } from '../../firebaseConfig';
import { useTheme } from '../../utils/ThemeContext';
import { getCachedHomeContent, getMemoryCachedHomeContent, HomeContent, subscribeHomeContent } from '../../utils/homeContentSync';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function AboutScreen() {
  const { colors } = useTheme();

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
    if (tapCountRef.current >= 5) {
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
      <KeyboardAvoidingView style={[styles.loginScreen, { backgroundColor: colors.bg }]} behavior="padding">
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
          <View style={[styles.loginCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.loginCardTitle, { color: colors.text }]}>Sign In</Text>
            <Text style={[styles.loginCardSub, { color: colors.subtext }]}>Enter your admin credentials</Text>
            <Text style={[styles.loginLabel, { color: colors.subtext }]}>Email</Text>
            <TextInput
              style={[styles.loginInput, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text }]}
              placeholder="admin@example.com"
              placeholderTextColor={colors.subtext}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              autoFocus
              returnKeyType="next"
            />
            <Text style={[styles.loginLabel, { color: colors.subtext }]}>Password</Text>
            <View style={[styles.passwordWrapper, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider }]}>
              <TextInput
                style={[styles.passwordInput, { color: colors.text }]}
                placeholder="Password"
                placeholderTextColor={colors.subtext}
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
              style={[styles.loginSubmitBtn, { backgroundColor: colors.accent }, loggingIn && { opacity: 0.6 }]}
              onPress={handleLogin}
              disabled={loggingIn}
            >
              <Text style={styles.loginSubmitText}>{loggingIn ? 'Signing in...' : 'Sign In'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.loginCancelBtn}
              onPress={() => { setShowLogin(false); setEmail(''); setPassword(''); setShowPassword(false); }}
            >
              <Text style={[styles.loginCancelText, { color: colors.subtext }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]}>
      <TouchableOpacity activeOpacity={1} onPress={handleHeaderTap}>
        <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.header}>
          <Text style={styles.churchName}>Theos Gospel Hall</Text>
          <Text style={styles.tagline}>"Proclaiming the Word of God"</Text>
        </LinearGradient>
      </TouchableOpacity>

      <ChurchInfo />

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          <Ionicons name="share-social-outline" size={18} color={colors.accent} /> Follow Us
        </Text>
        <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('https://www.youtube.com/@TheosGospelHall')}>
          <Ionicons name="logo-youtube" size={16} color="red" />
          <Text style={[styles.rowText, styles.link, { color: colors.accent }]}>YouTube Channel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('https://www.facebook.com/theosgospelhall.tirupur/')}>
          <Ionicons name="logo-facebook" size={16} color="#1877f2" />
          <Text style={[styles.rowText, styles.link, { color: colors.accent }]}>Facebook Page</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('https://www.instagram.com/theosgospelhall')}>
          <Ionicons name="logo-instagram" size={16} color="#e1306c" />
          <Text style={[styles.rowText, styles.link, { color: colors.accent }]}>Instagram</Text>
        </TouchableOpacity>
      </View>

      {(() => {
        const aboutMinistryEnglish = homeContent?.aboutMinistryEnglish?.trim();
        const aboutMinistryTamil = homeContent?.aboutMinistryTamil?.trim();
        const hasAboutMinistry = !!aboutMinistryEnglish || !!aboutMinistryTamil;
        if (!hasAboutMinistry) return null;
        return (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              <Ionicons name="book-outline" size={18} color={colors.accent} /> About Ministry
            </Text>
            {!!aboutMinistryEnglish && <Paragraphs text={aboutMinistryEnglish} style={[styles.aboutText, { color: colors.subtext }]} />}
            {!!aboutMinistryEnglish && !!aboutMinistryTamil && <View style={{ height: 10 }} />}
            {!!aboutMinistryTamil && <Paragraphs text={aboutMinistryTamil} style={[styles.aboutText, { color: colors.subtext }]} />}
          </View>
        );
      })()}

      <View style={[styles.footer, { borderTopColor: colors.divider }]}>
        <Text style={[styles.footerVersion, { color: colors.subtext }]}>Version {APP_VERSION}</Text>
        <Text style={[styles.footerCopy, { color: colors.subtext }]}>© {new Date().getFullYear()} Theos Gospel Hall</Text>
        <Text style={[styles.footerRights, { color: colors.subtext }]}>All rights reserved.</Text>
      </View>

      <AdminPanel
        visible={showAdmin}
        onClose={() => setShowAdmin(false)}
        onEventsUpdated={() => {}}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 40, alignItems: 'center', paddingTop: 60 },
  churchName: { fontSize: 26, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  tagline: { fontSize: 14, color: '#ffffff', marginTop: 8, fontStyle: 'italic', fontWeight: '600', letterSpacing: 0.5, textAlign: 'center', width: '100%' },
  card: { margin: 16, marginBottom: 0, borderRadius: 16, padding: 20, elevation: 4 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  rowText: { fontSize: 14, flex: 1 },
  link: { textDecorationLine: 'underline' },
  aboutText: { fontSize: 14, lineHeight: 24, textAlign: 'left' },
  footer: { alignItems: 'center', paddingVertical: 24, marginTop: 24, marginHorizontal: 16, borderTopWidth: 1 },
  footerVersion: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  footerCopy: { fontSize: 12, marginBottom: 2 },
  footerRights: { fontSize: 11 },
  loginScreen: { flex: 1 },
  loginScroll: { flexGrow: 1 },
  loginHeader: { padding: 14, paddingTop: 20, alignItems: 'center' },
  loginHeaderTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 6 },
  loginHeaderSub: { fontSize: 14, color: '#a8c0e8' },
  loginCard: { margin: 20, borderRadius: 20, padding: 24, elevation: 4, marginBottom: 20 },
  loginCardTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 6 },
  loginCardSub: { fontSize: 13, marginBottom: 24 },
  loginLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  loginInput: { borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 18 },
  passwordWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 12, marginBottom: 18 },
  passwordInput: { flex: 1, padding: 14, fontSize: 15 },
  eyeBtn: { paddingHorizontal: 14 },
  eyeText: { fontSize: 18 },
  loginSubmitBtn: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8, marginBottom: 14 },
  loginSubmitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  loginCancelBtn: { alignItems: 'center', paddingVertical: 10 },
  loginCancelText: { fontSize: 14 },
});

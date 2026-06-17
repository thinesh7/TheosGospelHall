import UpcomingEvents from '@/components/UpcomingEvents';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AdminPanel from '../../components/AdminPanel';
import { auth, db } from '../../firebaseConfig';

const isExpoGo = Constants.appOwnership === 'expo';
if (!isExpoGo) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export default function HomeScreen() {
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<any>(null);
  const appStateRef = useRef(AppState.currentState);
  const upcomingEventsRef = useRef<{ reload: () => void }>(null);

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    registerForPushNotifications();
    const sub = AppState.addEventListener('change', nextState => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        upcomingEventsRef.current?.reload();
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
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

  const registerForPushNotifications = async () => {
    if (!Device.isDevice) return;
    if (isExpoGo) return;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'TGH Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0f3460',
      });
    }

    try {
      const tokenData = await Notifications.getDevicePushTokenAsync();
      const token = tokenData.data;
      const safeId = token.replace(/[^a-zA-Z0-9]/g, '_');
      await setDoc(doc(db, 'pushTokens', safeId), {
        token,
        platform: Platform.OS,
        type: 'fcm',
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.log('Token registration error:', e);
    }
  };

  const handlePastorTap = () => {
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
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.header}>
        <Text style={styles.churchName}>Theos Gospel Hall</Text>
        <Text style={styles.tagline}>"The Word of God is Living and Active"</Text>
      </LinearGradient>

      <View style={styles.pastorCard}>
        <TouchableOpacity onPress={handlePastorTap} activeOpacity={1} style={styles.pastorAvatar}>
          <Image
            source={require('../../assets/images/pastor.png')}
            style={styles.pastorImage}
          />
        </TouchableOpacity>
        <Text style={styles.pastorName}>Bro. Salaman Tirupur</Text>
        <Text style={styles.pastorTitle}>Pastor & Founder</Text>
        <View style={styles.divider} />
        <Text style={styles.ministryText}>
          Theos Gospel Hall is a ministry dedicated to spreading the Word of God
          through Bible sermons, teachings, and worship. Founded with a heart for
          souls, we proclaim the Gospel of Jesus Christ to all nations.{'\n\n'}
          Pastor Bro. Salaman Tirupur leads the ministry with a passion for
          teaching the foundational truths of Scripture.
        </Text>
      </View>

      <UpcomingEvents ref={upcomingEventsRef} />
      <View style={{ height: 40 }} />

      <AdminPanel
        visible={showAdmin}
        onClose={() => setShowAdmin(false)}
        onEventsUpdated={() => upcomingEventsRef.current?.reload()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { padding: 40, alignItems: 'center', paddingTop: 60 },
  churchName: { fontSize: 26, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  tagline: { fontSize: 14, color: '#ffffff', marginTop: 8, fontStyle: 'italic', fontWeight: '600', letterSpacing: 0.5, textAlign: 'center' },
  pastorCard: { backgroundColor: '#fff', margin: 16, borderRadius: 16, padding: 20, alignItems: 'center', elevation: 4 },
  pastorAvatar: { marginBottom: 10 },
  pastorImage: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: '#0f3460' },
  pastorName: { fontSize: 20, fontWeight: 'bold', color: '#1a1a2e' },
  pastorTitle: { fontSize: 14, color: '#666', marginTop: 4 },
  divider: { height: 1, backgroundColor: '#eee', width: '100%', marginVertical: 14 },
  ministryText: { fontSize: 14, color: '#444', textAlign: 'center', lineHeight: 22 },
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
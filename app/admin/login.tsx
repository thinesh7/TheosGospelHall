import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDialog } from '@/components/AppDialog';
import { Text } from '@/components/AppText';
import { TextInput } from '@/components/AppTextInput';
import { auth } from '@/firebaseConfig';
import { useTheme } from '@/utils/ThemeContext';

// Moved out of app/(tabs)/contact.tsx's inline showLogin state — same
// signInWithEmailAndPassword call, now a real route so app/admin/_layout.tsx
// can gate the rest of /admin behind it uniformly (refresh, direct link, etc).
export default function AdminLoginScreen() {
  const { colors } = useTheme();
  const dialog = useAppDialog();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      dialog.alert('Missing Details', 'Please enter email and password.');
      return;
    }
    setLoggingIn(true);
    try {
      // No router.replace() here — app/admin/_layout.tsx's onAuthStateChanged
      // listener already redirects to /admin once auth state flips, and a
      // second manual navigation racing it is what caused the Android
      // "REPLACE ... was not handled by any navigator" crash.
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch {
      dialog.alert('Sign In Failed', 'Invalid email or password.');
      setPassword('');
    }
    setLoggingIn(false);
  };

  return (
    <KeyboardAvoidingView style={[styles.screen, { backgroundColor: colors.bg }]} behavior="padding">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.headerTitle}>🔐 Admin Access</Text>
          <Text style={styles.headerSub}>Theos Gospel Hall</Text>
        </LinearGradient>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Sign In</Text>
          <Text style={[styles.cardSub, { color: colors.subtext }]}>Enter your admin credentials</Text>
          <Text style={[styles.label, { color: colors.subtext }]}>Email</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text }]}
            placeholder="admin@example.com"
            placeholderTextColor={colors.subtext}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            autoFocus
            returnKeyType="next"
          />
          <Text style={[styles.label, { color: colors.subtext }]}>Password</Text>
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
            style={[styles.submitBtn, { backgroundColor: colors.accent }, loggingIn && { opacity: 0.6 }]}
            onPress={handleLogin}
            disabled={loggingIn}
          >
            <Text style={styles.submitText}>{loggingIn ? 'Signing in...' : 'Sign In'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
            <Text style={[styles.cancelText, { color: colors.subtext }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center' },
  header: { width: '100%', padding: 14, paddingTop: 20, alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 6 },
  headerSub: { fontSize: 14, color: '#a8c0e8' },
  card: { width: '100%', maxWidth: 420, margin: 20, borderRadius: 20, padding: 24, elevation: 4, marginBottom: 20 },
  cardTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 6 },
  cardSub: { fontSize: 13, marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 18 },
  passwordWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 12, marginBottom: 18 },
  passwordInput: { flex: 1, padding: 14, fontSize: 15 },
  eyeBtn: { paddingHorizontal: 14 },
  eyeText: { fontSize: 18 },
  submitBtn: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8, marginBottom: 14 },
  submitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelText: { fontSize: 14 },
});

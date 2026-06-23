import { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { loadBibleSettings } from '../utils/bibleSettings';
import { fetchHomeContentOnce } from '../utils/homeContentSync';

const MESSAGES = [
  'Getting things ready for you...',
  'Setting up your Bible library...',
  'Loading songs collection...',
  'Almost there...',
];

interface Props {
  onComplete: () => void;
}

export default function WelcomeSetupScreen({ onComplete }: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    const animateDot = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -10, duration: 350, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 350, useNativeDriver: true }),
          Animated.delay(700),
        ])
      );

    Animated.parallel([
      animateDot(dot1, 0),
      animateDot(dot2, 175),
      animateDot(dot3, 350),
    ]).start();

    const msgInterval = setInterval(() => {
      setMsgIndex(i => (i + 1) % MESSAGES.length);
    }, 1800);

    const minWait = new Promise<void>(r => setTimeout(r, 3000));

    Promise.all([
      fetchHomeContentOnce(),
      loadBibleSettings(),
      minWait,
    ]).finally(() => {
      clearInterval(msgInterval);
      onComplete();
    });

    return () => clearInterval(msgInterval);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fade }]}>
        <View style={styles.logoArea}>
          <Image
            source={require('../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.appName}>Theos Gospel Hall</Text>
        <Text style={styles.tagline}>"The Word of God is Living and Active"</Text>

        <View style={styles.divider} />

        <Text style={styles.welcome}>Welcome</Text>
        <Text style={styles.message}>
          We are getting everything ready for you.{'\n'}Please be patient...
        </Text>

        <View style={styles.dotsRow}>
          {[dot1, dot2, dot3].map((dot, i) => (
            <Animated.View
              key={i}
              style={[styles.dot, { transform: [{ translateY: dot }] }]}
            />
          ))}
        </View>

        <Text style={styles.status}>{MESSAGES[msgIndex]}</Text>

        <Text style={styles.note}>This setup happens only once.</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1a3a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  content: {
    alignItems: 'center',
    width: '100%',
  },
  logoArea: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  logo: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  appName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 20,
  },
  divider: {
    width: 40,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginVertical: 28,
  },
  welcome: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    letterSpacing: 1,
  },
  message: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 36,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4a9eff',
  },
  status: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginBottom: 40,
    minHeight: 20,
  },
  note: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 0.3,
  },
});

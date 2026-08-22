import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from './AppText';
import {
  getCachedNotifications,
  getMemoryCachedNotifications,
  getMemoryReadIds,
  getUnreadCount,
  NotificationItem,
  subscribeNotifications,
  subscribeReadIds,
} from '../utils/notificationCenterSync';

interface Props {
  color: string;
  onPress: () => void;
  size?: number;
}

export default function NotificationBell({ color, onPress, size = 24 }: Props) {
  const [items, setItems] = useState<NotificationItem[]>(() => getMemoryCachedNotifications());
  const [readIds, setReadIds] = useState<Set<string>>(() => getMemoryReadIds());
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    getCachedNotifications().then(setItems);
    const unsubItems = subscribeNotifications(setItems);
    const unsubRead = subscribeReadIds(setReadIds);
    return () => {
      unsubItems();
      unsubRead();
    };
  }, []);

  const unreadCount = getUnreadCount(items, readIds);
  const hasUnread = unreadCount > 0;

  useEffect(() => {
    if (!hasUnread) {
      shakeAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -1, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
        Animated.delay(2600),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [hasUnread, shakeAnim]);

  const rotate = shakeAnim.interpolate({ inputRange: [-1, 1], outputRange: ['-18deg', '18deg'] });

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.wrap}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Ionicons name="notifications" size={size} color={color} />
      </Animated.View>
      {hasUnread && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 4 },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#e53935',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
});

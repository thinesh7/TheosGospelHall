import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../../firebaseConfig';

const ADMIN_PASSWORD = 'tgh2026';

export default function ChatScreen() {
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userPlace, setUserPlace] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [allChats, setAllChats] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [registering, setRegistering] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const loadUser = async () => {
      const savedName = await AsyncStorage.getItem('userName');
      const savedPhone = await AsyncStorage.getItem('userPhone');
      const savedPlace = await AsyncStorage.getItem('userPlace');
      const savedAdmin = await AsyncStorage.getItem('isAdmin');
      if (savedName && savedPhone) {
        setUserName(savedName);
        setUserPhone(savedPhone);
        setUserPlace(savedPlace || '');
        setIsRegistered(true);
      }
      if (savedAdmin === 'true') {
        setIsAdmin(true);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (!isRegistered && !isAdmin) return;
    const chatId = isAdmin ? selectedUser?.phone : userPhone;
    if (!chatId) return;
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [isRegistered, isAdmin, selectedUser, userPhone]);

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = onSnapshot(collection(db, 'chats'), (snapshot) => {
      setAllChats(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [isAdmin]);

  const filteredChats = allChats.filter(chat =>
    chat.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.phone?.includes(searchQuery) ||
    chat.place?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    const chatId = isAdmin ? selectedUser?.phone : userPhone;
    if (!chatId) return;
    if (!isAdmin) {
      const chatDoc = await getDoc(doc(db, 'chats', chatId));
      if (chatDoc.exists() && chatDoc.data()?.blocked) {
        Alert.alert('Unable to Send', 'You are unable to send messages at this time.');
        return;
      }
    }
    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: newMessage.trim(),
        sender: isAdmin ? 'pastor' : 'user',
        senderName: isAdmin ? 'Pastor Salaman' : userName,
        createdAt: serverTimestamp(),
      });
      if (!isAdmin) {
        await setDoc(doc(db, 'chats', chatId), {
          phone: userPhone,
          name: userName,
          place: userPlace,
          lastMessage: newMessage.trim(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      setNewMessage('');
      setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
    } catch (e) {
      console.log('Error:', e);
    }
  };

  const handleBlockUser = (item: any) => {
    Alert.alert(
      item.blocked ? 'Unblock User' : 'Block User',
      item.blocked
        ? `Unblock ${item.name}? They can send messages again.`
        : `Block ${item.name}? They cannot send messages.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: item.blocked ? 'Unblock' : 'Block',
          style: item.blocked ? 'default' : 'destructive',
          onPress: async () => {
            await updateDoc(doc(db, 'chats', item.phone), {
              blocked: !item.blocked,
            });
          }
        }
      ]
    );
  };

  const handleRegister = async () => {
    if (!userName.trim()) {
      Alert.alert('Missing Name', 'Please enter your name.');
      return;
    }
    if (userName.trim().length < 2) {
      Alert.alert('Invalid Name', 'Name must be at least 2 characters.');
      return;
    }
    if (!userPhone.trim()) {
      Alert.alert('Missing Phone', 'Please enter your phone number.');
      return;
    }
    if (!/^[0-9]{10}$/.test(userPhone.trim())) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit phone number.');
      return;
    }
    if (!userPlace.trim()) {
      Alert.alert('Missing Place', 'Please enter your place/city.');
      return;
    }

    setRegistering(true);

    try {
      // Check if phone already exists
      const phoneDoc = await getDoc(doc(db, 'chats', userPhone.trim()));
      if (phoneDoc.exists()) {
        const existingData = phoneDoc.data();

        // If blocked, prevent registration
        if (existingData?.blocked) {
          Alert.alert(
            'Registration Blocked',
            'This phone number has been blocked. Please contact Pastor.'
          );
          setRegistering(false);
          return;
        }

        // Phone exists but not blocked — offer to restore old chat
        Alert.alert(
          '👋 Welcome Back!',
          `This number was registered before as "${existingData?.name}" from ${existingData?.place}.\n\nDo you want to continue with your old chat history?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setRegistering(false) },
            {
              text: 'Yes, Restore Chat',
              onPress: async () => {
                const restoredName = existingData?.name || userName.trim();
                const restoredPlace = existingData?.place || userPlace.trim();
                await AsyncStorage.setItem('userName', restoredName);
                await AsyncStorage.setItem('userPhone', userPhone.trim());
                await AsyncStorage.setItem('userPlace', restoredPlace);
                setUserName(restoredName);
                setUserPlace(restoredPlace);
                setIsRegistered(true);
                setRegistering(false);
              }
            }
          ]
        );
        return;
      }

      // Check if name already exists
      const allChatsSnap = await getDocs(collection(db, 'chats'));
      const nameExists = allChatsSnap.docs.some(
        d => d.data().name?.toLowerCase() === userName.trim().toLowerCase()
      );
      if (nameExists) {
        Alert.alert(
          'Name Already Taken',
          'This name is already in use. Please use a different name.'
        );
        setRegistering(false);
        return;
      }
    } catch (e) {
      console.log('Validation error:', e);
    }

    setRegistering(false);

    Alert.alert(
      '⚠️ Please Confirm',
      `Name: ${userName.trim()}\nPhone: ${userPhone.trim()}\nPlace: ${userPlace.trim()}\n\nOnce you start chat, you cannot change these details. Make sure everything is correct!`,
      [
        { text: 'Go Back', style: 'cancel' },
        {
          text: 'Confirm & Start Chat',
          onPress: async () => {
            await AsyncStorage.setItem('userName', userName.trim());
            await AsyncStorage.setItem('userPhone', userPhone.trim());
            await AsyncStorage.setItem('userPlace', userPlace.trim());
            setIsRegistered(true);
          }
        }
      ]
    );
  };

  const handleAdminLogin = () => {
    if (adminPassword === ADMIN_PASSWORD) {
      Alert.alert(
        '👨‍💼 Pastor Login',
        'You are logging in as Pastor. You can logout anytime from the dashboard.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Login as Pastor',
            onPress: async () => {
              await AsyncStorage.setItem('isAdmin', 'true');
              setIsAdmin(true);
              setShowAdminLogin(false);
            }
          }
        ]
      );
    } else {
      Alert.alert('Wrong Password', 'Please try again.');
    }
  };

  const handleAdminLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout from Pastor mode?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('isAdmin');
            setIsAdmin(false);
            setAdminPassword('');
          }
        }
      ]
    );
  };

  // Registration / Admin Login Screen
  if (!isRegistered && !isAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {showAdminLogin ? '🔐 Pastor Login' : '💬 Chat with Pastor'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {showAdminLogin ? 'Enter your password to continue' : 'Enter your details to start chatting'}
          </Text>
        </View>

        {!showAdminLogin ? (
          <View style={styles.formCard}>
            <TextInput
              style={styles.input}
              placeholder="Your Name *"
              value={userName}
              onChangeText={setUserName}
            />
            <TextInput
              style={styles.input}
              placeholder="Your Phone Number * (10 digits)"
              value={userPhone}
              onChangeText={setUserPhone}
              keyboardType="phone-pad"
              maxLength={10}
            />
            <TextInput
              style={styles.input}
              placeholder="Your Place / City *"
              value={userPlace}
              onChangeText={setUserPlace}
            />
            <Text style={styles.warningText}>
              ⚠️ These details cannot be changed after registration
            </Text>
            <TouchableOpacity
              style={[styles.button, registering && { opacity: 0.6 }]}
              onPress={handleRegister}
              disabled={registering}
            >
              <Text style={styles.buttonText}>
                {registering ? 'Checking...' : 'Start Chat'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.adminLink} onPress={() => setShowAdminLogin(true)}>
              <Text style={styles.adminLinkText}>Admin Login</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.formCard}>
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={adminPassword}
              onChangeText={setAdminPassword}
              secureTextEntry
            />
            <TouchableOpacity style={styles.button} onPress={handleAdminLogin}>
              <Text style={styles.buttonText}>Login as Pastor</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.adminLink} onPress={() => setShowAdminLogin(false)}>
              <Text style={styles.adminLinkText}>← Back</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // Admin: Pastor Dashboard
  if (isAdmin && !selectedUser) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>👨‍💼 Pastor Dashboard</Text>
          <Text style={styles.headerSubtitle}>{allChats.length} conversations</Text>
          <TouchableOpacity style={styles.logoutButton} onPress={handleAdminLogout}>
            <Ionicons name="log-out-outline" size={20} color="#fff" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, phone or place..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        {filteredChats.length === 0 ? (
          <Text style={styles.empty}>
            {searchQuery ? 'No results found' : 'No messages yet'}
          </Text>
        ) : (
          <FlatList
            data={filteredChats}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.userCard, item.blocked && styles.userCardBlocked]}
                onPress={() => !item.blocked && setSelectedUser(item)}
              >
                <Ionicons name="person-circle" size={48} color={item.blocked ? '#ccc' : '#0f3460'} />
                <View style={styles.userInfo}>
                  <View style={styles.userNameRow}>
                    <Text style={[styles.userName, item.blocked && styles.userNameBlocked]}>
                      {item.name}
                    </Text>
                    {item.blocked && (
                      <View style={styles.blockedBadge}>
                        <Text style={styles.blockedBadgeText}>Blocked</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.userPlace}>
                    <Ionicons name="location-outline" size={12} color="#888" /> {item.place || 'Unknown'}
                  </Text>
                  <Text style={styles.userPhone}>
                    <Ionicons name="call-outline" size={12} color="#888" /> {item.phone}
                  </Text>
                  <Text style={styles.lastMessage} numberOfLines={1}>
                    💬 {item.lastMessage}
                  </Text>
                </View>
                <TouchableOpacity style={styles.blockBtn} onPress={() => handleBlockUser(item)}>
                  <Ionicons
                    name={item.blocked ? 'checkmark-circle' : 'ban'}
                    size={26}
                    color={item.blocked ? '#22c55e' : '#e63946'}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  // Chat Screen
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.chatHeader}>
        {isAdmin && (
          <TouchableOpacity onPress={() => setSelectedUser(null)}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        )}
        <Ionicons name="person-circle" size={36} color="#fff" />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.chatHeaderName}>
            {isAdmin ? selectedUser?.name : 'Pastor Salaman'}
          </Text>
          <Text style={styles.chatHeaderSub}>
            {isAdmin ? `📞 ${selectedUser?.phone}` : 'Theos Gospel Hall'}
          </Text>
          {isAdmin && selectedUser?.place && (
            <Text style={styles.chatHeaderSub}>📍 {selectedUser?.place}</Text>
          )}
        </View>
      </View>

      {!isAdmin && (
        <View style={styles.userBanner}>
          <Ionicons name="person-circle" size={18} color="#0f3460" />
          <Text style={styles.userBannerText}>{userName} • {userPlace}</Text>
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Reset Profile',
                'This will clear your profile from this device. Your chat history will be saved and you can restore it by entering the same phone number again.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: async () => {
                      await AsyncStorage.removeItem('userName');
                      await AsyncStorage.removeItem('userPhone');
                      await AsyncStorage.removeItem('userPlace');
                      setIsRegistered(false);
                      setUserName('');
                      setUserPhone('');
                      setUserPlace('');
                    }
                  }
                ]
              );
            }}
          >
            <Ionicons name="settings-outline" size={18} color="#0f3460" />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        ListEmptyComponent={<Text style={styles.empty}>No messages yet. Say hello! 👋</Text>}
        renderItem={({ item }) => {
          const isMe = isAdmin ? item.sender === 'pastor' : item.sender === 'user';
          return (
            <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
              <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
                {item.text}
              </Text>
              <Text style={styles.bubbleTime}>
                {item.createdAt?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || ''}
              </Text>
            </View>
          );
        }}
      />
      <View style={styles.inputBar}>
        <TextInput
          style={styles.messageInput}
          placeholder="Type a message..."
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#0f3460', padding: 30, paddingTop: 60, alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: '#a8c0e8', marginTop: 4 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  logoutText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 12, marginBottom: 0, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, elevation: 3, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#333' },
  formCard: { backgroundColor: '#fff', margin: 16, borderRadius: 16, padding: 20, elevation: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 15 },
  warningText: { fontSize: 12, color: '#f59e0b', marginBottom: 12, textAlign: 'center' },
  button: { backgroundColor: '#0f3460', borderRadius: 10, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  adminLink: { alignItems: 'center', marginTop: 12 },
  adminLinkText: { color: '#999', fontSize: 13 },
  userCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 3 },
  userCardBlocked: { backgroundColor: '#fef2f2', opacity: 0.8 },
  userInfo: { flex: 1, marginLeft: 12 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  userName: { fontSize: 16, fontWeight: 'bold', color: '#1a1a2e' },
  userNameBlocked: { color: '#999' },
  blockedBadge: { backgroundColor: '#e63946', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  blockedBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  userPlace: { fontSize: 13, color: '#888', marginBottom: 2 },
  userPhone: { fontSize: 13, color: '#888', marginBottom: 4 },
  lastMessage: { fontSize: 13, color: '#555' },
  blockBtn: { padding: 8 },
  chatHeader: { backgroundColor: '#0f3460', padding: 16, paddingTop: 50, flexDirection: 'row', alignItems: 'center', gap: 8 },
  chatHeaderName: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  chatHeaderSub: { fontSize: 12, color: '#a8c0e8', marginTop: 2 },
  userBanner: { backgroundColor: '#e8f0fe', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  userBannerText: { fontSize: 13, color: '#0f3460', fontWeight: '600', flex: 1 },
  bubble: { maxWidth: '75%', padding: 12, borderRadius: 16, marginBottom: 8 },
  bubbleMe: { backgroundColor: '#0f3460', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: '#fff', alignSelf: 'flex-start', borderBottomLeftRadius: 4, elevation: 2 },
  bubbleText: { fontSize: 15 },
  bubbleTextMe: { color: '#fff' },
  bubbleTextThem: { color: '#1a1a2e' },
  bubbleTime: { fontSize: 10, color: '#aaa', marginTop: 4, alignSelf: 'flex-end' },
  inputBar: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', alignItems: 'center', elevation: 8 },
  messageInput: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, fontSize: 15, maxHeight: 100 },
  sendButton: { backgroundColor: '#0f3460', borderRadius: 50, padding: 12, marginLeft: 8 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
});
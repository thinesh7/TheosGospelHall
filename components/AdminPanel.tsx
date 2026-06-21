import { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AdminDashboard, { AdminModule } from './admin/AdminDashboard';
import GeethangalumAdmin from './admin/GeethangalumAdmin';
import HomeContentAdmin from './admin/HomeContentAdmin';
import LivePlaylistsAdmin from './admin/LivePlaylistsAdmin';
import OtherSongsAdmin from './admin/OtherSongsAdmin';
import SongsAdminMenu, { SongsModule } from './admin/SongsAdminMenu';
import SpecialMeetingsAdmin, { AdminScreenHandle } from './admin/SpecialMeetingsAdmin';

type ViewKey =
  | 'dashboard'
  | 'specialMeetings'
  | 'songsMenu'
  | 'songsGeethangalum'
  | 'songsOther'
  | 'livePlaylists'
  | 'homeContent';

interface ViewMeta {
  title: string;
  subtitle: string;
}

const VIEW_META: Record<ViewKey, ViewMeta> = {
  dashboard: { title: '⚙️ Admin Panel', subtitle: 'Theos Gospel Hall' },
  specialMeetings: { title: '📅 Special Meetings', subtitle: 'Manage upcoming meetings' },
  songsMenu: { title: '🎵 Songs', subtitle: 'Choose a collection to manage' },
  songsGeethangalum: { title: '📖 Geethangalum Keerthanaigalum', subtitle: 'Edit existing songs' },
  songsOther: { title: '🎶 Other Songs', subtitle: 'Add, edit, show/hide songs' },
  livePlaylists: { title: '🎬 Live Playlists', subtitle: 'Manage YouTube playlists' },
  homeContent: { title: '🏠 Home Screen Content', subtitle: 'Pastor & Ministry info' },
};

interface Props {
  visible: boolean;
  onClose: () => void;
  onEventsUpdated: () => void;
}

export default function AdminPanel({ visible, onClose, onEventsUpdated }: Props) {
  const [stack, setStack] = useState<ViewKey[]>(['dashboard']);
  const activeScreenRef = useRef<AdminScreenHandle>(null);

  const currentView = stack[stack.length - 1];

  useEffect(() => {
    if (!visible) {
      setStack(['dashboard']);
    }
  }, [visible]);

  useEffect(() => {
    const onBackPress = () => {
      if (!visible) return false;

      if (activeScreenRef.current?.goBack()) {
        return true;
      }

      if (stack.length > 1) {
        setStack(prev => prev.slice(0, -1));
        return true;
      }

      onClose();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [visible, stack]);

  const pushView = (view: ViewKey) => setStack(prev => [...prev, view]);
  const popView = () => setStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));

  const handleDashboardSelect = (module: AdminModule) => {
    if (module === 'specialMeetings') pushView('specialMeetings');
    else if (module === 'songsMenu') pushView('songsMenu');
    else if (module === 'livePlaylists') pushView('livePlaylists');
    else if (module === 'homeContent') pushView('homeContent');
  };

  const handleSongsMenuSelect = (module: SongsModule) => {
    pushView(module === 'geethangalum' ? 'songsGeethangalum' : 'songsOther');
  };

  const meta = VIEW_META[currentView];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => {
        if (activeScreenRef.current?.goBack()) return;
        if (stack.length > 1) { popView(); return; }
        onClose();
      }}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'android' ? 'height' : 'padding'} style={{ flex: 1 }}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {stack.length > 1 && (
                <TouchableOpacity onPress={popView} style={styles.backBtn}>
                  <Text style={styles.backBtnText}>←</Text>
                </TouchableOpacity>
              )}
              <View>
                <Text style={styles.headerTitle}>{meta.title}</Text>
                <Text style={styles.headerSub}>{meta.subtitle}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕ Close</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {currentView === 'dashboard' && (
              <AdminDashboard onSelect={handleDashboardSelect} />
            )}

            {currentView === 'specialMeetings' && (
              <SpecialMeetingsAdmin ref={activeScreenRef} onEventsUpdated={onEventsUpdated} />
            )}

            {currentView === 'songsMenu' && (
              <SongsAdminMenu onSelect={handleSongsMenuSelect} />
            )}

            {currentView === 'songsGeethangalum' && (
              <GeethangalumAdmin ref={activeScreenRef} />
            )}

            {currentView === 'songsOther' && (
              <OtherSongsAdmin ref={activeScreenRef} />
            )}

            {currentView === 'livePlaylists' && (
              <LivePlaylistsAdmin ref={activeScreenRef} />
            )}

            {currentView === 'homeContent' && (
              <HomeContentAdmin ref={activeScreenRef} />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#0f3460',
    paddingTop: 54,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { color: '#fff', fontSize: 20, fontWeight: '600' },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  headerSub: { fontSize: 11, color: '#a8c0e8', marginTop: 2 },
  closeBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  closeBtnText: { color: '#fff', fontWeight: '600' },
  content: { flex: 1 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  placeholderText: { textAlign: 'center', color: '#999', fontSize: 14 },
});

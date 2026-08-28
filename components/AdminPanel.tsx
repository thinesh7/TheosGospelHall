import { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './AppText';
import AdminDashboard, { AdminModule } from './admin/AdminDashboard';
import ApiKeysAdmin from './admin/ApiKeysAdmin';
import ArticlesAdmin from './admin/ArticlesAdmin';
import AppManagementMenu, { AppManagementModule } from './admin/AppManagementMenu';
import AppUpdateAdmin from './admin/AppUpdateAdmin';
import ChurchMembersAdmin from './admin/ChurchMembersAdmin';
import GeethangalumAdmin from './admin/GeethangalumAdmin';
import HomeContentAdmin from './admin/HomeContentAdmin';
import LivePlaylistsAdmin from './admin/LivePlaylistsAdmin';
import NotificationsAdmin from './admin/NotificationsAdmin';
import OtherSongsAdmin from './admin/OtherSongsAdmin';
import RegistrationManagementAdmin from './admin/RegistrationManagementAdmin';
import RegistrationManagementMenu from './admin/RegistrationManagementMenu';
import RegistrationsAdmin from './admin/RegistrationsAdmin';
import RegistrationsMenu from './admin/RegistrationsMenu';
import RegistrationsTopMenu, { RegistrationsTopMenuOption } from './admin/RegistrationsTopMenu';
import SiteMaintenanceMenu, { SiteMaintenanceTarget } from './admin/SiteMaintenanceMenu';
import SongsAdminMenu, { SongsModule } from './admin/SongsAdminMenu';
import SpecialMeetingsAdmin, { AdminScreenHandle } from './admin/SpecialMeetingsAdmin';
import VideoMaintenanceAdmin from './admin/VideoMaintenanceAdmin';
import { ProgramId } from '../utils/registrations';

type ViewKey =
  | 'dashboard'
  | 'specialMeetings'
  | 'songsMenu'
  | 'songsGeethangalum'
  | 'songsOther'
  | 'livePlaylists'
  | 'homeContent'
  | 'notifications'
  | 'apiKeys'
  | 'appManagementMenu'
  | 'siteMaintenanceMenu'
  | 'videoMaintenance'
  | 'registrationsTopMenu'
  | 'registrationsViewMenu'
  | 'registrationsYouth'
  | 'registrationsAcademy'
  | 'registrationsManageMenu'
  | 'registrationsManageYouth'
  | 'registrationsManageAcademy'
  | 'churchMembers'
  | 'tghArticles'
  | 'appUpdate';

interface ViewMeta {
  title: string;
  subtitle: string;
}

const VIEW_META: Record<ViewKey, ViewMeta> = {
  dashboard: { title: '⚙️ Admin Panel', subtitle: 'Theos Gospel Hall' },
  specialMeetings: { title: '📅 Upcoming Special Meetings', subtitle: 'Manage upcoming meetings' },
  songsMenu: { title: '🎵 Songs', subtitle: 'Choose a collection to manage' },
  songsGeethangalum: { title: '📖 Geethangalum Keerthanaigalum', subtitle: 'Edit existing songs' },
  songsOther: { title: '🎶 Special Songs', subtitle: 'Add, edit, show/hide songs' },
  livePlaylists: { title: '🎬 Live Playlists', subtitle: 'Manage YouTube playlists' },
  homeContent: { title: '🏠 Home Screen Content', subtitle: 'Pastor & Ministry info' },
  notifications: { title: '🔔 Send Notifications', subtitle: 'Send announcements to all users' },
  apiKeys: { title: '🔑 API Keys', subtitle: 'Manage backup YouTube API keys' },
  appManagementMenu: { title: '⚠️ App Management', subtitle: 'High-impact application settings' },
  siteMaintenanceMenu: { title: '🚧 Site Maintenance', subtitle: 'Choose a section to manage' },
  videoMaintenance: { title: '🎬 Video Maintenance', subtitle: 'Show a maintenance page for the Videos tab' },
  registrationsTopMenu: { title: '📝 Discipleship & Academy Registrations', subtitle: 'View or manage registrations' },
  registrationsViewMenu: { title: '📋 View Registrations', subtitle: 'Choose a program to manage' },
  registrationsYouth: { title: '🔥 Youth Program', subtitle: 'Discipleship Program registrations' },
  registrationsAcademy: { title: '🎓 TGH Academy', subtitle: 'Academy registrations' },
  registrationsManageMenu: { title: '⚙️ Manage Registrations', subtitle: 'Choose a registration type to manage' },
  registrationsManageYouth: { title: '🔥 Manage Youth Program', subtitle: 'Status, closed message & visibility' },
  registrationsManageAcademy: { title: '🎓 Manage TGH Academy', subtitle: 'Status, closed message & visibility' },
  churchMembers: { title: '👥 Church Members', subtitle: 'Manage church members and families across all branches' },
  tghArticles: { title: '📰 TGH Articles', subtitle: 'Add, edit, and publish TGH Articles' },
  appUpdate: { title: '⬆️ App Update Settings', subtitle: 'Manage force/optional update rollout' },
};

interface Props {
  visible: boolean;
  onClose: () => void;
  onEventsUpdated: () => void;
}

export default function AdminPanel({ visible, onClose, onEventsUpdated }: Props) {
  const insets = useSafeAreaInsets();
  const statusBarHeight = Platform.OS === 'android'
    ? (StatusBar.currentHeight ?? insets.top)
    : insets.top;
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
    else if (module === 'homeContent') pushView('homeContent');
    else if (module === 'registrations') pushView('registrationsTopMenu');
    else if (module === 'churchMembers') pushView('churchMembers');
    else if (module === 'tghArticles') pushView('tghArticles');
    else if (module === 'appManagement') pushView('appManagementMenu');
  };

  const handleSongsMenuSelect = (module: SongsModule) => {
    pushView(module === 'geethangalum' ? 'songsGeethangalum' : 'songsOther');
  };

  const handleAppManagementMenuSelect = (module: AppManagementModule) => {
    if (module === 'siteMaintenance') { pushView('siteMaintenanceMenu'); return; }
    pushView(module);
  };

  const handleSiteMaintenanceMenuSelect = (target: SiteMaintenanceTarget) => {
    if (target === 'videos') pushView('videoMaintenance');
  };

  const handleRegistrationsTopMenuSelect = (option: RegistrationsTopMenuOption) => {
    pushView(option === 'view' ? 'registrationsViewMenu' : 'registrationsManageMenu');
  };

  const handleRegistrationsMenuSelect = (programId: ProgramId) => {
    pushView(programId === 'youth' ? 'registrationsYouth' : 'registrationsAcademy');
  };

  const handleRegistrationsManageMenuSelect = (programId: ProgramId) => {
    pushView(programId === 'youth' ? 'registrationsManageYouth' : 'registrationsManageAcademy');
  };

  const meta = VIEW_META[currentView];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => {
        if (activeScreenRef.current?.goBack()) return;
        if (stack.length > 1) { popView(); return; }
        onClose();
      }}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'android' ? 'height' : 'padding'} style={{ flex: 1 }}>
        <View style={styles.container}>
          <View style={[styles.header, { paddingTop: statusBarHeight + 12 }]}>
            <View style={styles.headerLeft}>
              {stack.length > 1 && (
                <TouchableOpacity onPress={popView} style={styles.backBtn}>
                  <Text style={styles.backBtnText}>←</Text>
                </TouchableOpacity>
              )}
              <View style={styles.headerTextWrap}>
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

            {currentView === 'notifications' && (
              <NotificationsAdmin ref={activeScreenRef} />
            )}

            {currentView === 'apiKeys' && (
              <ApiKeysAdmin ref={activeScreenRef} />
            )}

            {currentView === 'appManagementMenu' && (
              <AppManagementMenu onSelect={handleAppManagementMenuSelect} />
            )}

            {currentView === 'siteMaintenanceMenu' && (
              <SiteMaintenanceMenu onSelect={handleSiteMaintenanceMenuSelect} />
            )}

            {currentView === 'videoMaintenance' && (
              <VideoMaintenanceAdmin ref={activeScreenRef} />
            )}

            {currentView === 'registrationsTopMenu' && (
              <RegistrationsTopMenu onSelect={handleRegistrationsTopMenuSelect} />
            )}

            {currentView === 'registrationsViewMenu' && (
              <RegistrationsMenu onSelect={handleRegistrationsMenuSelect} />
            )}

            {currentView === 'registrationsYouth' && (
              <RegistrationsAdmin ref={activeScreenRef} programId="youth" />
            )}

            {currentView === 'registrationsAcademy' && (
              <RegistrationsAdmin ref={activeScreenRef} programId="academy" />
            )}

            {currentView === 'registrationsManageMenu' && (
              <RegistrationManagementMenu onSelect={handleRegistrationsManageMenuSelect} />
            )}

            {currentView === 'registrationsManageYouth' && (
              <RegistrationManagementAdmin ref={activeScreenRef} programId="youth" />
            )}

            {currentView === 'registrationsManageAcademy' && (
              <RegistrationManagementAdmin ref={activeScreenRef} programId="academy" />
            )}

            {currentView === 'churchMembers' && (
              <ChurchMembersAdmin ref={activeScreenRef} />
            )}

            {currentView === 'tghArticles' && (
              <ArticlesAdmin ref={activeScreenRef} />
            )}

            {currentView === 'appUpdate' && (
              <AppUpdateAdmin ref={activeScreenRef} />
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
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  headerTextWrap: { flex: 1, flexShrink: 1 },
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

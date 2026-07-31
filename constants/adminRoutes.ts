import { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

// Single source of truth for admin route titles/subtitles — replaces
// AdminPanel.tsx's old VIEW_META map (deleted alongside the modal-stack it
// drove). Keyed by the route's pathname, used by each leaf route's own
// <Stack.Screen options={{ headerTitle: () => <AdminHeaderTitle ... /> }}/>
// so the mobile native header and this map never drift apart.
export interface AdminRouteMeta {
  title: string;
  subtitle: string;
}

export const ADMIN_ROUTE_META: Record<string, AdminRouteMeta> = {
  '/admin': { title: '⚙️ Admin Panel', subtitle: 'Theos Gospel Hall' },
  '/admin/special-meetings': { title: '📅 Upcoming Special Meetings', subtitle: 'Manage upcoming meetings' },
  '/admin/songs': { title: '🎵 Songs', subtitle: 'Choose a collection to manage' },
  '/admin/songs/geethangalum': { title: '📖 Geethangalum Keerthanaigalum', subtitle: 'Edit existing songs' },
  '/admin/songs/other': { title: '🎶 Special Songs', subtitle: 'Add, edit, show/hide songs' },
  '/admin/home-content': { title: '🏠 Home Screen Content', subtitle: 'Pastor & Ministry info' },
  '/admin/registrations': { title: '📝 Discipleship & Academy Registrations', subtitle: 'View or manage registrations' },
  '/admin/registrations/view': { title: '📋 View Registrations', subtitle: 'Choose a program to manage' },
  '/admin/registrations/view/youth': { title: '🔥 Youth Program', subtitle: 'Discipleship Program registrations' },
  '/admin/registrations/view/academy': { title: '🎓 TGH Academy', subtitle: 'Academy registrations' },
  '/admin/registrations/manage': { title: '⚙️ Manage Registrations', subtitle: 'Choose a registration type to manage' },
  '/admin/registrations/manage/youth': { title: '🔥 Manage Youth Program', subtitle: 'Status, closed message & visibility' },
  '/admin/registrations/manage/academy': { title: '🎓 Manage TGH Academy', subtitle: 'Status, closed message & visibility' },
  '/admin/app-management': { title: '⚠️ App Management', subtitle: 'High-impact application settings' },
  '/admin/app-management/app-update': { title: '⬆️ App Update Settings', subtitle: 'Manage force/optional update rollout' },
  '/admin/app-management/notifications': { title: '🔔 Send Notifications', subtitle: 'Send announcements to all users' },
  '/admin/app-management/live-playlists': { title: '🎬 Live Playlists', subtitle: 'Manage YouTube playlists' },
  '/admin/app-management/api-keys': { title: '🔑 API Keys', subtitle: 'Manage backup YouTube API keys' },
  '/admin/app-management/site-maintenance': { title: '🚧 Site Maintenance', subtitle: 'Choose a section to manage' },
  '/admin/app-management/site-maintenance/video-maintenance': { title: '🎬 Video Maintenance', subtitle: 'Show a maintenance page for the Videos tab' },
};

export interface AdminSidebarItem {
  key: string;
  label: string;
  href: string;
  icon: ComponentProps<typeof Ionicons>['name'];
}

// Desktop/tablet sidebar shows only the top-level destinations (matching
// AdminDashboard's own card grid) — deeper screens are reached via the same
// in-page menu components used on mobile (SongsAdminMenu, RegistrationsTopMenu,
// etc.), now navigating with router.push instead of local stack state.
export const ADMIN_SIDEBAR_ITEMS: AdminSidebarItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/admin', icon: 'grid-outline' },
  { key: 'special-meetings', label: 'Special Meetings', href: '/admin/special-meetings', icon: 'calendar-outline' },
  { key: 'songs', label: 'Songs', href: '/admin/songs', icon: 'musical-notes-outline' },
  { key: 'registrations', label: 'Registrations', href: '/admin/registrations', icon: 'document-text-outline' },
  { key: 'home-content', label: 'Home Content', href: '/admin/home-content', icon: 'home-outline' },
  { key: 'app-management', label: 'App Management', href: '/admin/app-management', icon: 'warning-outline' },
];

// Longest-prefix match so a nested route (e.g. /admin/songs/geethangalum)
// still highlights its top-level sidebar parent (Songs).
export function activeSidebarKey(pathname: string): string {
  let bestKey = ADMIN_SIDEBAR_ITEMS[0].key;
  let bestLength = -1;
  for (const item of ADMIN_SIDEBAR_ITEMS) {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      if (item.href.length > bestLength) {
        bestLength = item.href.length;
        bestKey = item.key;
      }
    }
  }
  return bestKey;
}

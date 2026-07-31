import { Stack, useRouter } from 'expo-router';
import { AdminHeaderTitle } from '@/components/admin/AdminHeaderTitle';
import AppManagementMenu, { AppManagementModule } from '@/components/admin/AppManagementMenu';
import { ADMIN_ROUTE_META } from '@/constants/adminRoutes';

const APP_MANAGEMENT_ROUTES: Record<AppManagementModule, string> = {
  appUpdate: '/admin/app-management/app-update',
  notifications: '/admin/app-management/notifications',
  livePlaylists: '/admin/app-management/live-playlists',
  apiKeys: '/admin/app-management/api-keys',
  siteMaintenance: '/admin/app-management/site-maintenance',
};

export default function AppManagementMenuRoute() {
  const router = useRouter();
  const meta = ADMIN_ROUTE_META['/admin/app-management'];

  return (
    <>
      <Stack.Screen options={{ headerTitle: () => <AdminHeaderTitle title={meta.title} subtitle={meta.subtitle} /> }} />
      <AppManagementMenu onSelect={module => router.push(APP_MANAGEMENT_ROUTES[module] as never)} />
    </>
  );
}

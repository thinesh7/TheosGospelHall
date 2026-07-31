import { Stack, useRouter } from 'expo-router';
import AdminDashboard, { AdminModule } from '@/components/admin/AdminDashboard';
import { AdminHeaderTitle } from '@/components/admin/AdminHeaderTitle';
import { ADMIN_ROUTE_META } from '@/constants/adminRoutes';

const DASHBOARD_ROUTES: Record<AdminModule, string> = {
  specialMeetings: '/admin/special-meetings',
  songsMenu: '/admin/songs',
  homeContent: '/admin/home-content',
  registrations: '/admin/registrations',
  appManagement: '/admin/app-management',
};

export default function AdminIndexRoute() {
  const router = useRouter();
  const meta = ADMIN_ROUTE_META['/admin'];

  return (
    <>
      <Stack.Screen options={{ headerTitle: () => <AdminHeaderTitle title={meta.title} subtitle={meta.subtitle} /> }} />
      <AdminDashboard onSelect={module => router.push(DASHBOARD_ROUTES[module] as never)} />
    </>
  );
}

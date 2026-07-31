import { Stack, useRouter } from 'expo-router';
import { AdminHeaderTitle } from '@/components/admin/AdminHeaderTitle';
import SiteMaintenanceMenu, { SiteMaintenanceTarget } from '@/components/admin/SiteMaintenanceMenu';
import { ADMIN_ROUTE_META } from '@/constants/adminRoutes';

const SITE_MAINTENANCE_ROUTES: Record<SiteMaintenanceTarget, string> = {
  videos: '/admin/app-management/site-maintenance/video-maintenance',
};

export default function SiteMaintenanceMenuRoute() {
  const router = useRouter();
  const meta = ADMIN_ROUTE_META['/admin/app-management/site-maintenance'];

  return (
    <>
      <Stack.Screen options={{ headerTitle: () => <AdminHeaderTitle title={meta.title} subtitle={meta.subtitle} /> }} />
      <SiteMaintenanceMenu onSelect={target => router.push(SITE_MAINTENANCE_ROUTES[target] as never)} />
    </>
  );
}

import { Stack } from 'expo-router';
import { AdminHeaderTitle } from '@/components/admin/AdminHeaderTitle';
import VideoMaintenanceAdmin from '@/components/admin/VideoMaintenanceAdmin';
import { ADMIN_ROUTE_META } from '@/constants/adminRoutes';
import { useAdminBackHandler } from '@/hooks/use-admin-back-handler';

export default function VideoMaintenanceRoute() {
  const ref = useAdminBackHandler();
  const meta = ADMIN_ROUTE_META['/admin/app-management/site-maintenance/video-maintenance'];

  return (
    <>
      <Stack.Screen options={{ headerTitle: () => <AdminHeaderTitle title={meta.title} subtitle={meta.subtitle} /> }} />
      <VideoMaintenanceAdmin ref={ref} />
    </>
  );
}

import { Stack } from 'expo-router';
import { AdminHeaderTitle } from '@/components/admin/AdminHeaderTitle';
import OtherSongsAdmin from '@/components/admin/OtherSongsAdmin';
import { ADMIN_ROUTE_META } from '@/constants/adminRoutes';
import { useAdminBackHandler } from '@/hooks/use-admin-back-handler';

export default function SongsOtherRoute() {
  const ref = useAdminBackHandler();
  const meta = ADMIN_ROUTE_META['/admin/songs/other'];

  return (
    <>
      <Stack.Screen options={{ headerTitle: () => <AdminHeaderTitle title={meta.title} subtitle={meta.subtitle} /> }} />
      <OtherSongsAdmin ref={ref} />
    </>
  );
}

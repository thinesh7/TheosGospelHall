import { Stack } from 'expo-router';
import { AdminHeaderTitle } from '@/components/admin/AdminHeaderTitle';
import ApiKeysAdmin from '@/components/admin/ApiKeysAdmin';
import { ADMIN_ROUTE_META } from '@/constants/adminRoutes';
import { useAdminBackHandler } from '@/hooks/use-admin-back-handler';

export default function ApiKeysRoute() {
  const ref = useAdminBackHandler();
  const meta = ADMIN_ROUTE_META['/admin/app-management/api-keys'];

  return (
    <>
      <Stack.Screen options={{ headerTitle: () => <AdminHeaderTitle title={meta.title} subtitle={meta.subtitle} /> }} />
      <ApiKeysAdmin ref={ref} />
    </>
  );
}

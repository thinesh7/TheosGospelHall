import { Stack } from 'expo-router';
import { AdminHeaderTitle } from '@/components/admin/AdminHeaderTitle';
import RegistrationManagementAdmin from '@/components/admin/RegistrationManagementAdmin';
import { ADMIN_ROUTE_META } from '@/constants/adminRoutes';
import { useAdminBackHandler } from '@/hooks/use-admin-back-handler';

export default function RegistrationsManageAcademyRoute() {
  const ref = useAdminBackHandler();
  const meta = ADMIN_ROUTE_META['/admin/registrations/manage/academy'];

  return (
    <>
      <Stack.Screen options={{ headerTitle: () => <AdminHeaderTitle title={meta.title} subtitle={meta.subtitle} /> }} />
      <RegistrationManagementAdmin ref={ref} programId="academy" />
    </>
  );
}

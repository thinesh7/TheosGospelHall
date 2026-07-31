import { Stack } from 'expo-router';
import { AdminHeaderTitle } from '@/components/admin/AdminHeaderTitle';
import RegistrationsAdmin from '@/components/admin/RegistrationsAdmin';
import { ADMIN_ROUTE_META } from '@/constants/adminRoutes';
import { useAdminBackHandler } from '@/hooks/use-admin-back-handler';

export default function RegistrationsViewAcademyRoute() {
  const ref = useAdminBackHandler();
  const meta = ADMIN_ROUTE_META['/admin/registrations/view/academy'];

  return (
    <>
      <Stack.Screen options={{ headerTitle: () => <AdminHeaderTitle title={meta.title} subtitle={meta.subtitle} /> }} />
      <RegistrationsAdmin ref={ref} programId="academy" />
    </>
  );
}

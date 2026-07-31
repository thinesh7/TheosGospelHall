import { Stack, useRouter } from 'expo-router';
import { AdminHeaderTitle } from '@/components/admin/AdminHeaderTitle';
import RegistrationManagementMenu from '@/components/admin/RegistrationManagementMenu';
import { ADMIN_ROUTE_META } from '@/constants/adminRoutes';
import { ProgramId } from '@/utils/registrations';

const MANAGE_ROUTES: Record<ProgramId, string> = {
  youth: '/admin/registrations/manage/youth',
  academy: '/admin/registrations/manage/academy',
};

export default function RegistrationsManageMenuRoute() {
  const router = useRouter();
  const meta = ADMIN_ROUTE_META['/admin/registrations/manage'];

  return (
    <>
      <Stack.Screen options={{ headerTitle: () => <AdminHeaderTitle title={meta.title} subtitle={meta.subtitle} /> }} />
      <RegistrationManagementMenu onSelect={programId => router.push(MANAGE_ROUTES[programId] as never)} />
    </>
  );
}

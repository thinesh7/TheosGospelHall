import { Stack, useRouter } from 'expo-router';
import { AdminHeaderTitle } from '@/components/admin/AdminHeaderTitle';
import RegistrationsMenu from '@/components/admin/RegistrationsMenu';
import { ADMIN_ROUTE_META } from '@/constants/adminRoutes';
import { ProgramId } from '@/utils/registrations';

const VIEW_ROUTES: Record<ProgramId, string> = {
  youth: '/admin/registrations/view/youth',
  academy: '/admin/registrations/view/academy',
};

export default function RegistrationsViewMenuRoute() {
  const router = useRouter();
  const meta = ADMIN_ROUTE_META['/admin/registrations/view'];

  return (
    <>
      <Stack.Screen options={{ headerTitle: () => <AdminHeaderTitle title={meta.title} subtitle={meta.subtitle} /> }} />
      <RegistrationsMenu onSelect={programId => router.push(VIEW_ROUTES[programId] as never)} />
    </>
  );
}

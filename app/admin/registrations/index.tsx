import { Stack, useRouter } from 'expo-router';
import { AdminHeaderTitle } from '@/components/admin/AdminHeaderTitle';
import RegistrationsTopMenu, { RegistrationsTopMenuOption } from '@/components/admin/RegistrationsTopMenu';
import { ADMIN_ROUTE_META } from '@/constants/adminRoutes';

const TOP_MENU_ROUTES: Record<RegistrationsTopMenuOption, string> = {
  view: '/admin/registrations/view',
  manage: '/admin/registrations/manage',
};

export default function RegistrationsTopMenuRoute() {
  const router = useRouter();
  const meta = ADMIN_ROUTE_META['/admin/registrations'];

  return (
    <>
      <Stack.Screen options={{ headerTitle: () => <AdminHeaderTitle title={meta.title} subtitle={meta.subtitle} /> }} />
      <RegistrationsTopMenu onSelect={option => router.push(TOP_MENU_ROUTES[option] as never)} />
    </>
  );
}

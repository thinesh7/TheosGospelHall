import { Stack, useRouter } from 'expo-router';
import { AdminHeaderTitle } from '@/components/admin/AdminHeaderTitle';
import SongsAdminMenu, { SongsModule } from '@/components/admin/SongsAdminMenu';
import { ADMIN_ROUTE_META } from '@/constants/adminRoutes';

const SONGS_ROUTES: Record<SongsModule, string> = {
  geethangalum: '/admin/songs/geethangalum',
  otherSongs: '/admin/songs/other',
};

export default function SongsMenuRoute() {
  const router = useRouter();
  const meta = ADMIN_ROUTE_META['/admin/songs'];

  return (
    <>
      <Stack.Screen options={{ headerTitle: () => <AdminHeaderTitle title={meta.title} subtitle={meta.subtitle} /> }} />
      <SongsAdminMenu onSelect={module => router.push(SONGS_ROUTES[module] as never)} />
    </>
  );
}

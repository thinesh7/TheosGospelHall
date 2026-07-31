import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { BackHandler } from 'react-native';
import { AdminScreenHandle } from '@/components/admin/SpecialMeetingsAdmin';

// Every ref-based admin screen (SpecialMeetingsAdmin, GeethangalumAdmin,
// RegistrationsAdmin, etc.) can intercept Android hardware back to close an
// in-screen sub-state (an open edit form, a detail view) before the route
// itself pops — this used to be wired once in AdminPanel.tsx; now each leaf
// route hosting one of these screens wires it via this hook instead.
export function useAdminBackHandler() {
  const ref = useRef<AdminScreenHandle>(null);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => ref.current?.goBack() ?? false);
      return () => subscription.remove();
    }, [])
  );

  return ref;
}

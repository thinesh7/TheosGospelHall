import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useAppDialog } from '@/components/AppDialog';
import { withRouterHistoryId } from '@/utils/webHistory';

// Mobile/desktop web only. A real website always has "whatever page opened
// this one" sitting right behind it in browser history, so a single
// accidental tap/swipe on the browser's own Back control exits the site
// outright with no warning — unlike this app's own in-app back navigation
// (moving between tabs/screens), which already works fine via expo-router's
// history integration and is left completely untouched here.
//
// The technique: pad history with entries marked with our own state, so
// landing back on one of them (via popstate) is unambiguously "the user is
// one back-press away from actually leaving," regardless of how many
// in-app screens they backed through to get there — those intermediate
// pops land on expo-router's own state, never on ours, so they're ignored.
// A popstate already in flight can't be cancelled the way preventDefault
// cancels most events; the only way to "undo" it is to immediately push
// forward again, which is what re-trapping below does.
//
// This is a mitigation, not a guarantee — browsers don't provide a true
// "block the back button" API, and treat attempts to fight it too
// aggressively as a hostile pattern. Two guard entries (not one) so the
// very first back press — even before any in-app navigation has happened —
// already lands on a marked entry instead of slipping through to the
// unmarked entry that existed before this component ever ran.
export default function WebBackGuard() {
  const dialog = useAppDialog();
  const dialogRef = useRef(dialog);
  dialogRef.current = dialog;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    let allowExit = false;
    let confirmOpen = false;

    const pushGuard = () => window.history.pushState(withRouterHistoryId({ tghBackGuard: true }), '', window.location.href);
    pushGuard();
    pushGuard();

    const onPopState = (event: PopStateEvent) => {
      if (allowExit) {
        allowExit = false;
        return;
      }
      if (!(event.state && (event.state as { tghBackGuard?: boolean }).tghBackGuard)) return;

      pushGuard();
      // A rapid second back-tap while the dialog is already up would try to
      // open a second one on top of it — ignore, the first is still live.
      if (confirmOpen) return;
      confirmOpen = true;
      dialogRef.current.alert(
        'Leave Theos Gospel Hall?',
        'Going back will take you out of the app.',
        [
          { text: 'Stay', style: 'cancel', onPress: () => { confirmOpen = false; } },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: () => {
              confirmOpen = false;
              allowExit = true;
              // -2 would only land back on this same app's own entry (the
              // page that was already loaded when this component first
              // mounted, two pushGuard() calls below whichever guard entry
              // was just popped to) — a pushState never unloads the
              // document, so that "landing" is invisible: the confirm
              // dialog just closes and the user is still looking at the
              // same screen. Genuinely leaving means stepping one further,
              // past that entry, to whatever real page (or blank tab state)
              // preceded this app in history. This offset is stable no
              // matter how many times the guard has already been triggered
              // — each trigger re-pads back up to exactly two guard entries
              // below the app's own entry (see pushGuard() above), so the
              // app's own entry is always exactly 2 back and the true exit
              // target is always exactly 3.
              window.history.go(-3);
            },
          },
        ]
      );
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return null;
}

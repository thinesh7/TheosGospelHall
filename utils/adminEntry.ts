// Lets the web half of app/admin/_layout.tsx's Close button return to the
// *exact* (tabs) instance the user was already looking at — same scroll
// position and all — instead of a fresh remount of it, matching how
// components/AdminPanel.tsx's plain <Modal> used to leave main's Android
// app exactly where the user tapped from.
//
// Native doesn't need any of this: router.dismissAll() there pops back to
// the (tabs) instance already mounted underneath admin in the root stack,
// preserving its state with no extra bookkeeping.
//
// Web is different, and needed two things layered on top of each other:
//
// 1. router.replace(<remembered path>) instead of dismissAll()/canDismiss():
//    those walk React Navigation's state tree, which on web gets reconciled
//    against the browser's own history/URL on every navigation — confirmed
//    via direct testing that this does not reliably preserve "admin was
//    pushed on top of an existing (tabs) instance", so dismissAll() landed
//    on Home. components/navigation/TabShell.web.tsx seeds its active tab
//    from the URL pathname at mount time, so replacing to the remembered
//    path at least lands on the right *tab*.
//
// 2. That still isn't enough on its own, though: router.replace() mints a
//    brand-new (tabs)/ContactScreen instance rather than reusing the one
//    already mounted underneath admin — right tab, but scrolled back to the
//    top instead of wherever the user actually was (e.g. the footer/
//    copyright area the 5-tap gesture lives in). Recording how many real
//    browser history entries existed right before pushing into admin, and
//    walking back exactly that many with window.history.go() on close,
//    reuses that original still-mounted instance instead — history.go()
//    triggers a popstate to an existing session-history entry, it doesn't
//    construct a new screen the way push/replace do. This works regardless
//    of how many levels deep into admin's own nested navigation the user
//    went before hitting Close, since every one of those pushes also grew
//    window.history.length by exactly one.
let entryTabPath = '/(tabs)';
let entryHistoryLength = 0;

export function setAdminEntryTab(path: string) {
  entryTabPath = path;
  if (typeof window !== 'undefined' && window.history) {
    entryHistoryLength = window.history.length;
  }
}

export function getAdminEntryTab(): string {
  return entryTabPath;
}

// Steps to walk back (a negative delta for window.history.go()) to land on
// the exact history entry that was current right before entering admin.
// Clamped to at least -1 so Close always does *something* even if nothing
// was recorded (e.g. a direct deep link straight into /admin).
export function getAdminEntryBackSteps(): number {
  if (typeof window === 'undefined' || !window.history) return -1;
  const steps = entryHistoryLength - window.history.length;
  return steps < 0 ? steps : -1;
}

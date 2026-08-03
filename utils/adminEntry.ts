// Remembers which tab the hidden admin-entry gesture was triggered from, so
// the Admin Panel's "Close" button can return there instead of always
// landing on Home — matching how components/AdminPanel.tsx used to behave
// on main (a plain <Modal>, whose onClose just hid it, leaving the user
// exactly where they tapped from). Now that Admin is a real pushed route
// sibling to (tabs) rather than a modal, its own internal navigation can
// grow several screens deep before Close is tapped, so a plain router.back()
// isn't reliable either — this is read once by the close action instead.
// A plain in-memory variable is enough: it only needs to survive the current
// app session, not a restart, and every entry point sets it right before
// navigating to /admin/login.
let entryTabPath = '/(tabs)';

export function setAdminEntryTab(path: string) {
  entryTabPath = path;
}

export function getAdminEntryTab(): string {
  return entryTabPath;
}

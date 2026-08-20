// Web only. Books/Chapters (app/bible-books.tsx, app/bible-chapters.tsx)
// are genuine sibling Stack routes pushed on top of the already-mounted
// (tabs) instance (see app/(tabs)/bible.tsx's own comment for why they have
// to be real routes, not raw-history "views", to avoid a resetRoot bug).
// Switching to a *different* tab from inside that sub-flow needs
// expo-router's own router.back() — called once per level of that sub-flow
// (BibleWebNavChrome's own `depth` prop) — rather than a raw
// window.history.go() jump: that would be exactly the same kind of
// untracked popstate that caused the resetRoot bug in the first place,
// just triggered from here instead (confirmed by hitting it while building
// this — router.back() doesn't have that problem because expo-router's own
// history listener treats calls through its own API as "caused by me,
// don't resync").
const PENDING_TAB_KEY = 'tgh_pending_tab_switch';

// BibleWebNavChrome's own Sidebar/tab-bar has no direct way to reach
// TabShell.web.tsx's activeTab state — they're different Stack screens, not
// parent/child. sessionStorage is the handoff: set here right before the
// router.back() calls above land back on the (tabs) instance, then read once
// by that instance's own popstate handler when it lands.
export function requestTabSwitchAfterReturn(tabIndex: number) {
  try {
    window.sessionStorage.setItem(PENDING_TAB_KEY, String(tabIndex));
  } catch {}
}

export function consumePendingTabSwitch(): number | null {
  try {
    const v = window.sessionStorage.getItem(PENDING_TAB_KEY);
    if (v === null) return null;
    window.sessionStorage.removeItem(PENDING_TAB_KEY);
    return Number(v);
  } catch {
    return null;
  }
}

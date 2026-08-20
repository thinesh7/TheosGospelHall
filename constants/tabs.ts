import { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

export interface TabMeta {
  key: string;
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
}

// Shared between components/navigation/TabShell.web.tsx (the real tab
// shell) and components/navigation/BibleWebNavChrome.tsx (a second,
// visually-identical Sidebar/tab-bar rendered around app/bible-books.tsx
// and app/bible-chapters.tsx — see that file's own comment for why those
// need their own chrome instance rather than reusing TabShell's). Kept in
// one place so the two never drift apart.
export const TAB_META: TabMeta[] = [
  { key: '0', label: 'Home', icon: 'home' },
  { key: '1', label: 'Videos', icon: 'play-circle' },
  { key: '2', label: 'Bible', icon: 'book' },
  { key: '3', label: 'Songs', icon: 'musical-notes' },
  { key: '4', label: 'Contact', icon: 'call' },
];

// Route each tab corresponds to — index must line up 1:1 with TAB_META
// above. Unlike the native shell (no URL concept), web needs this so a
// direct load, refresh, or browser back/forward on e.g. /videos lands on
// the Videos tab instead of always falling back to Home.
export const TAB_PATHS = ['/', '/videos', '/bible', '/songs-hub', '/contact'];

// Bible's own sub-routes (bible-books, bible-chapters, bible-reader — see
// their own comments) are siblings of the (tabs) group, not inside it, so
// they're deliberately absent from TAB_PATHS above. But whenever one of them
// is the actual current route with no prior in-app navigation behind it —
// a direct deep link, a manual refresh, or (during development) a dev-server
// live-reload while sitting on one of those screens — Expo Router still has
// to synthesize *some* (tabs) parent underneath it, and mounts a fresh
// TabShell instance to do it. That fresh instance seeds activeTab from this
// function; without this prefix check it fell through to the "unknown path"
// default of tab 0 (Home) instead of Bible, since none of those three exact
// paths match a TAB_PATHS entry. Invisible at first — the sub-route is still
// what's actually on screen — until the user presses Back and lands on that
// wrongly-seeded Home tab instead of Bible (confirmed by reproducing it: a
// fresh mount on '/bible-books' set activeTab to 0, not 2).
export function pathToTabIndex(pathname: string): number {
  if (pathname.startsWith('/bible-')) return TAB_PATHS.indexOf('/bible');
  const idx = TAB_PATHS.indexOf(pathname);
  return idx === -1 ? 0 : idx;
}

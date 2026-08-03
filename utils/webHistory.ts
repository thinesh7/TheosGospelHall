// Web only. Expo Router's own web history tracking
// (node_modules/expo-router/build/fork/createMemoryHistory.js) stores a
// generated `id` in `window.history.state` to know which of its own
// internally-tracked entries the browser is currently sitting on:
//
//   get index() {
//     const id = window.history.state?.id;
//     if (id) { ... }
//     return 0;
//   }
//
// A plain `window.history.pushState(myMarker, ...)` / `replaceState(...)`
// *replaces* window.history.state wholesale, wiping that `id` out. The next
// time Expo Router's own popstate/state-change listener runs (useLinking.js),
// it can't find a matching entry, falls back to treating the browser as
// being at history index 0, and calls `navigation.resetRoot()` to
// "recover" — which tears down and remounts the *entire* (tabs) screen
// (confirmed via testing: even the Sidebar gets destroyed and recreated).
// That full remount is what reads as "the whole page reloaded" — every
// mounted screen's Firestore listeners reconnect, scroll position and state
// reset — despite never being a real navigation or network request.
//
// Every raw history call this app makes to bypass expo-router's own
// same-tab-group remount bug (WebBackGuard's guard padding, TabShell's tab
// switches, Bible's internal book/chapter navigation, the video modal
// marker) must merge onto the *existing* state instead of replacing it, so
// Expo Router's own `id` survives every one of our own pushes/replaces.
export function withRouterHistoryId<T extends object>(marker: T): T {
  if (typeof window === 'undefined' || !window.history) return marker;
  return { ...(window.history.state || {}), ...marker };
}

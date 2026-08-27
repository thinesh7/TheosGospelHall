export type VideosSubTab = 'live' | 'songs';

const listeners = new Set<(tab: VideosSubTab) => void>();

// The Videos tab's active sub-tab is local state buried inside the tabs'
// PagerView (app/(tabs)/_layout.tsx -> videos.tsx), and the Notification
// Center is a separate stack route pushed on top of it with no prop/ref path
// down to that state. This lets a notification's CTA request a sub-tab
// without threading one through the stack boundary; the tabs layout is
// always mounted underneath by the time a request can fire, so a plain
// fire-and-forget pub-sub (no retained "last request") is enough.
export function requestVideosTab(tab: VideosSubTab) {
  listeners.forEach(l => l(tab));
}

export function subscribeVideosTabRequest(listener: (tab: VideosSubTab) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

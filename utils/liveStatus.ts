import { getCachedLivePlaylists, syncLivePlaylists } from './livePlaylistsSync';
import { ytFetch } from './youtubeProxy';

export interface LiveNowInfo {
  videoId: string;
  title: string;
  label: string;
}

export async function checkCurrentlyLive(): Promise<LiveNowInfo | null> {
  try {
    const fresh = await syncLivePlaylists();
    const activePlaylists = (fresh.length ? fresh : await getCachedLivePlaylists()).filter(p => p.isActive);
    if (!activePlaylists.length) return null;

    for (const playlist of activePlaylists) {
      const itemsData = await ytFetch('playlistItems', { playlistId: playlist.playlistId, part: 'snippet', maxResults: '5' });
      const items = (itemsData?.items || []).filter((i: any) => i?.snippet?.resourceId?.videoId);
      if (!items.length) continue;

      const ids = items.map((i: any) => i.snippet.resourceId.videoId).join(',');
      const videosData = await ytFetch('videos', { id: ids, part: 'snippet' });
      const liveVideo = (videosData?.items || []).find((v: any) => v?.snippet?.liveBroadcastContent === 'live');
      if (liveVideo) {
        return {
          videoId: liveVideo.id,
          title: liveVideo.snippet?.title || '',
          label: playlist.label || '',
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

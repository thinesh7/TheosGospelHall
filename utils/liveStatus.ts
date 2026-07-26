import { LivePlaylist, getCachedLivePlaylists, syncLivePlaylists } from './livePlaylistsSync';
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

    const playlistResults = await Promise.all(
      activePlaylists.map(async playlist => {
        const itemsData = await ytFetch('playlistItems', { playlistId: playlist.playlistId, part: 'snippet', maxResults: '5' });
        const items = (itemsData?.items || []).filter((i: any) => i?.snippet?.resourceId?.videoId);
        return { playlist, items };
      })
    );

    const sourcePlaylistByVideoId = new Map<string, LivePlaylist>();
    const allVideoIds: string[] = [];
    for (const { playlist, items } of playlistResults) {
      for (const item of items) {
        const videoId = item.snippet.resourceId.videoId;
        if (!sourcePlaylistByVideoId.has(videoId)) {
          sourcePlaylistByVideoId.set(videoId, playlist);
          allVideoIds.push(videoId);
        }
      }
    }
    if (!allVideoIds.length) return null;

    const chunks: string[][] = [];
    for (let i = 0; i < allVideoIds.length; i += 50) chunks.push(allVideoIds.slice(i, i + 50));

    for (const chunk of chunks) {
      const videosData = await ytFetch('videos', { id: chunk.join(','), part: 'snippet' });
      const liveVideo = (videosData?.items || []).find((v: any) => v?.snippet?.liveBroadcastContent === 'live');
      if (liveVideo) {
        const sourcePlaylist = sourcePlaylistByVideoId.get(liveVideo.id);
        return {
          videoId: liveVideo.id,
          title: liveVideo.snippet?.title || '',
          label: sourcePlaylist?.label || '',
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

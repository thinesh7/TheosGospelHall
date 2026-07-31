import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import SongListScreen from '../../components/SongListScreen';
import { getOtherSongsIndex, OtherSongIndexEntry, syncOtherSongs } from '../../utils/otherSongsSync';

const onlyVisible = (songs: OtherSongIndexEntry[]) => songs.filter(s => s.isVisible !== false);

export default function OtherSongsScreen({ headerTitle }: { headerTitle?: ReactNode } = {}) {
  const router = useRouter();

  return (
    <SongListScreen
      headerTitle={headerTitle}
      defaultHeaderText="Other Songs"
      favoritesStorageKey="tgh_other_song_favorites"
      getCachedIndex={async () => onlyVisible(await getOtherSongsIndex())}
      syncIndex={async () => {
        const result = await syncOtherSongs();
        return { index: onlyVisible(result.index) };
      }}
      numbersTabLabel={count => (count === 0 ? '0' : `1 to ${count}`)}
      onOpenSong={songNumber => router.push({ pathname: '/other-song-reader', params: { songNumber: String(songNumber) } })}
    />
  );
}

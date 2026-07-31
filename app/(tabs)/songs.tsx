import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import SongListScreen from '../../components/SongListScreen';
import { getSongsIndex, syncSongs } from '../../utils/songsSync';

export default function SongsScreen({ headerTitle }: { headerTitle?: ReactNode } = {}) {
  const router = useRouter();

  return (
    <SongListScreen
      headerTitle={headerTitle}
      defaultHeaderText="Geethangalum Keerthanaigalum"
      favoritesStorageKey="tgh_song_favorites"
      getCachedIndex={getSongsIndex}
      syncIndex={syncSongs}
      numbersTabLabel={() => '1 to 720'}
      showFirstTimeSetup
      onOpenSong={songNumber => router.push({ pathname: '/song-reader', params: { songNumber: String(songNumber) } })}
    />
  );
}

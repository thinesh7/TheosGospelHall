import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import SongListScreen from '../../components/SongListScreen';
import { getOtherSongsIndex, OtherSongIndexEntry, syncOtherSongs } from '../../utils/otherSongsSync';

const onlyVisible = (songs: OtherSongIndexEntry[]) => songs.filter(s => s.isVisible !== false);

// Hoisted to module scope so these stay referentially stable across
// re-renders — SongListScreen's initial-load effect depends on
// getCachedIndex/syncIndex, and inline arrow functions here would recreate
// on every parent render (e.g. every time the Geethangalum/Other Songs
// segmented toggle switches, which re-renders this whole screen), re-firing
// that effect and issuing a fresh Firestore sync on every single toggle tap.
const getVisibleOtherSongsIndex = async () => onlyVisible(await getOtherSongsIndex());
const syncVisibleOtherSongsIndex = async () => {
  const result = await syncOtherSongs();
  return { index: onlyVisible(result.index) };
};
const otherSongsNumbersTabLabel = (count: number) => (count === 0 ? '0' : `1 to ${count}`);

export default function OtherSongsScreen({ headerTitle }: { headerTitle?: ReactNode } = {}) {
  const router = useRouter();

  return (
    <SongListScreen
      headerTitle={headerTitle}
      defaultHeaderText="Other Songs"
      favoritesStorageKey="tgh_other_song_favorites"
      getCachedIndex={getVisibleOtherSongsIndex}
      syncIndex={syncVisibleOtherSongsIndex}
      numbersTabLabel={otherSongsNumbersTabLabel}
      onOpenSong={songNumber => router.push({ pathname: '/other-song-reader', params: { songNumber: String(songNumber) } })}
    />
  );
}

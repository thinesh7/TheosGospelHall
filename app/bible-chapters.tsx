import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import BibleChaptersView from '../components/bible/BibleChaptersView';
import BibleWebNavChrome from '../components/navigation/BibleWebNavChrome';
import { getMemBibleSettings } from '../utils/bibleSettings';

// Web-only route — see app/bible-books.tsx's own comment for why this is a
// genuine routed screen (not a raw-history "view") and why native keeps
// browsing Chapters via app/(tabs)/bible.tsx's own local state instead.
export default function BibleChaptersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookId: string; version: string; bilingual: string }>();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <BibleWebNavChrome depth={2}>
        <BibleChaptersView
          bookId={params.bookId}
          version={params.version}
          isBilingual={params.bilingual === '1'}
          onSelectChapter={(chapter) => router.push({
            pathname: '/bible-reader',
            params: {
              bookId: params.bookId,
              chapter: String(chapter),
              version: params.version,
              isBilingual: params.bilingual,
              secondaryVersion: getMemBibleSettings().secondaryVersion,
            },
          })}
          onClose={() => router.back()}
        />
      </BibleWebNavChrome>
    </>
  );
}

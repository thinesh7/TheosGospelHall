import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import BibleReaderView from '../components/bible/BibleReaderView';

// Shared route for both platforms — native reaches it from
// app/(tabs)/bible.tsx's own local nav state, web reaches it from
// app/bible-chapters.tsx's onSelectChapter (both a plain router.push with
// the same params). Either way this is a genuine routed Stack.Screen
// (registered in app/_layout.tsx), never a raw-history "view" — a real
// push/pop is the correct, simplest mechanism, and on web specifically it
// sidesteps a history-desync bug: mixing a genuine expo-router push (this
// route) with raw window.history.pushState calls (as Bible's home/books/
// chapters navigation briefly did, before those became real routes too —
// see app/bible-books.tsx's own comment) left two independent history
// bookkeeping systems interleaved in the same browser session-history
// timeline. Expo Router tracks its position via an `id` stamped into
// history.state (node_modules/expo-router/build/fork/createMemoryHistory.js);
// enough interleaved raw pushState calls in a short window (repeatedly
// opening/closing the reader) could trip Chrome's own history-spam
// throttle (silently drops pushState/replaceState calls past ~100/10s),
// desyncing that id from Expo Router's internal index. The next Back press
// then couldn't find a matching entry, fell back to index 0, and Expo
// Router "recovered" via navigation.resetRoot() — tearing down and
// remounting the entire (tabs) navigator, which read as the whole site
// refreshing. Reader being a genuine route, on both platforms, avoids that
// second, independently-tracked system entirely.
export default function BibleReaderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    bookId: string;
    chapter: string;
    version: string;
    isBilingual: string;
    secondaryVersion: string;
  }>();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <BibleReaderView
        bookId={params.bookId}
        chapter={params.chapter}
        version={params.version}
        isBilingual={params.isBilingual}
        secondaryVersion={params.secondaryVersion}
        onClose={() => router.back()}
      />
    </>
  );
}

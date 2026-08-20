import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import BibleBooksView from '../components/bible/BibleBooksView';
import BibleWebNavChrome from '../components/navigation/BibleWebNavChrome';

// Web-only route (native still browses Books via app/(tabs)/bible.tsx's own
// local nav state, matching how it always worked there — see that file's
// own comment for why native and web deliberately differ).
//
// This used to be a "view" inside app/(tabs)/bible.tsx on web, switched via
// raw window.history.pushState/back rather than expo-router's router.push,
// specifically to avoid remounting the whole (tabs) tab shell (routing to
// '/bible' — the Bible tab's own path — resolves right back to that same
// (tabs) screen). That raw-history approach turned out to have a much
// worse problem: Expo Router's own web history engine
// (node_modules/expo-router/build/fork/createMemoryHistory.js) listens for
// EVERY popstate event, including ones our own raw window.history.back()
// calls trigger — it has no way to tell those apart from the user's own
// browser back button. It doesn't just ignore the ones it didn't cause;
// it reacts by calling its own internal history.replace() to resync,
// which cascaded into remounting the entire (tabs) navigator (confirmed by
// instrumenting window.history directly: WebBackGuard's and BibleScreen's
// own mount-only effects fired again, immediately, on the very first Back
// press — not something that only showed up after repeated navigation).
//
// A genuinely different top-level route sidesteps both problems at once:
// pushing/popping *this* route never touches '/bible' at all, so the
// (tabs) instance underneath is never a match for it and stays mounted,
// exactly like app/bible-reader.tsx already proved before any of this —
// and since it's real expo-router navigation, expo-router's own listener
// is the one doing the pushing/popping, so there's nothing for it to
// "resync" against. BibleWebNavChrome recreates the sidebar/tab-bar around
// this screen (see its own comment) since the real one, rendered by the
// still-mounted TabShell underneath, is hidden behind this Stack screen.
export default function BibleBooksScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ version: string; bilingual: string }>();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <BibleWebNavChrome depth={1}>
        <BibleBooksView
          version={params.version}
          isBilingual={params.bilingual === '1'}
          onSelectBook={(book) => router.push({
            pathname: '/bible-chapters',
            params: { bookId: String(book.id), version: params.version, bilingual: params.bilingual },
          })}
          onClose={() => router.back()}
        />
      </BibleWebNavChrome>
    </>
  );
}

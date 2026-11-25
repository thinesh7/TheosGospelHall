import { RefObject, useEffect, useMemo, useRef } from 'react';
import type { FlatList } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';

// Song readers page horizontally between songs while each page's lyrics
// scroll vertically. Left to the native horizontal pager, a quick vertical
// flick with a little sideways drift gets claimed by the pager (Android's
// horizontal ScrollView intercepts on X movement alone, without comparing it
// to Y) and `pagingEnabled` then snaps to the next song.
//
// Instead the pager runs with `scrollEnabled={false}` and this pan gesture
// drives it: it only activates on a clearly horizontal swipe and fails as
// soon as the finger moves vertically first, leaving that touch entirely to
// the lyrics' own vertical scroll.

const ACTIVATE_X = 24; // horizontal px needed before a swipe starts paging
const FAIL_Y = 12; // vertical px that hands the touch to lyrics scrolling
const DISTANCE_RATIO = 0.25; // fraction of a page dragged that commits a change
const FLING_VELOCITY = 600; // px/s fling that commits a change
const FLING_MIN_DISTANCE = 40; // ...as long as it also travelled this far

interface Options {
  listRef: RefObject<FlatList<any> | null>;
  pageWidth: number;
  currentIndex: number;
  pageCount: number;
  onChangeIndex: (index: number) => void;
}

export function useSongPagerSwipe({ listRef, pageWidth, currentIndex, pageCount, onChangeIndex }: Options) {
  // Latest values for the gesture callbacks, without rebuilding the gesture
  // (and disturbing an in-progress swipe) on every render.
  const latest = useRef({ currentIndex, pageCount, onChangeIndex });
  useEffect(() => {
    latest.current = { currentIndex, pageCount, onChangeIndex };
  }, [currentIndex, pageCount, onChangeIndex]);

  return useMemo(() => {
    const maxOffset = () => Math.max(0, (latest.current.pageCount - 1) * pageWidth);

    return Gesture.Pan()
      .runOnJS(true)
      .activeOffsetX([-ACTIVATE_X, ACTIVATE_X])
      .failOffsetY([-FAIL_Y, FAIL_Y])
      // Gesture callbacks run on touch events, never during render — the
      // react-hooks/refs rule can't tell that for builder-style APIs.
      // eslint-disable-next-line react-hooks/refs
      .onUpdate(e => {
        // Follow the finger so the next/previous song slides in as before.
        const base = latest.current.currentIndex * pageWidth;
        const offset = Math.min(maxOffset(), Math.max(0, base - e.translationX));
        listRef.current?.scrollToOffset({ offset, animated: false });
      })
      // eslint-disable-next-line react-hooks/refs
      .onEnd((e, success) => {
        const { currentIndex: index, pageCount: count, onChangeIndex: change } = latest.current;
        let target = index;
        if (success) {
          const dragged = Math.abs(e.translationX);
          const committed =
            dragged > pageWidth * DISTANCE_RATIO ||
            (dragged > FLING_MIN_DISTANCE && Math.abs(e.velocityX) > FLING_VELOCITY);
          if (committed) target = e.translationX < 0 ? index + 1 : index - 1;
        }
        target = Math.min(count - 1, Math.max(0, target));
        listRef.current?.scrollToOffset({ offset: target * pageWidth, animated: true });
        if (target !== index) change(target);
      });
  }, [listRef, pageWidth]);
}

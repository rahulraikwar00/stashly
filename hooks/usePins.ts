// hooks/usePins.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { BookmarkQuery, Pin } from '@/types/bookmarks';
import { loadBookmarksPage, PAGE_SIZE } from '@/db/bookmarkService';
import { seedDatabaseIfEmpty } from '@/db/seed';
import { bookmarkToPin } from '@/utils/pin';

export function usePins(query: BookmarkQuery = {}) {
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const offsetRef = useRef(0);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const generationRef = useRef(0);

  const loadMore = useCallback(
    async (reset = false) => {
      if (!reset && (loadingRef.current || !hasMoreRef.current)) return;
      const gen = generationRef.current;
      loadingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const offset = reset ? 0 : offsetRef.current;
        let rows = await loadBookmarksPage(query, offset, PAGE_SIZE);

        if (__DEV__ && offset === 0 && rows.length === 0) {
          await seedDatabaseIfEmpty();
          rows = await loadBookmarksPage(query, 0, PAGE_SIZE);
        }

        if (gen !== generationRef.current) return;

        const next = rows.map(bookmarkToPin);

        if (next.length < PAGE_SIZE) hasMoreRef.current = false;
        setHasMore(hasMoreRef.current);

        // Replace the whole list on a reset (new query / pull-to-refresh) so
        // stale rows never linger; otherwise append for infinite scroll. The
        // previous pins stay on screen until the new page lands, so the grid
        // never blanks out while searching.
        setPins((prev) => (reset ? next : [...prev, ...next]));
        offsetRef.current = offset + next.length;
      } catch (err) {
        console.error('Failed to load page:', err);
        if (gen === generationRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (gen === generationRef.current) {
          loadingRef.current = false;
          setLoading(false);
        }
      }
    },
    [query]
  );

  const refresh = useCallback(async () => {
    if (loadingRef.current) return;
    offsetRef.current = 0;
    hasMoreRef.current = true;
    setError(null);
    setRefreshing(true);
    try {
      await loadMore(true);
    } finally {
      setRefreshing(false);
    }
  }, [loadMore]);

  // Fetch page 0 whenever the query changes. Stale responses are dropped by
  // the generation guard; the current pins stay rendered until the new page
  // arrives (stale-while-revalidate). `useDeferredValue` in the screen is the
  // only debounce — no extra timer here. loadMore(reset) resets the flags it
  // needs (loading/error/hasMore) itself.
  useEffect(() => {
    generationRef.current += 1;
    offsetRef.current = 0;
    hasMoreRef.current = true;
    void loadMore(true);
  }, [loadMore]);

  return { pins, setPins, loading, refreshing, hasMore, error, loadMore, refresh };
}

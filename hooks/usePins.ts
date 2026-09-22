// hooks/usePins.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { BookmarkQuery, Pin } from '@/types/bookmarks';
import { loadBookmarksPage, PAGE_SIZE } from '@/db/bookmarkService';
import { seedDatabaseIfEmpty } from '@/db/seed';
import { bookmarkToPin } from '@/utils/pin';

const DEBOUNCE_MS = 250;

function queryKey(query: BookmarkQuery) {
  return JSON.stringify([query.search, query.type, query.favorite, query.unread, query.archived]);
}

export function usePins(query: BookmarkQuery = {}) {
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [debouncedQuery, setDebouncedQuery] = useState<BookmarkQuery>(query);

  const offsetRef = useRef(0);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const generationRef = useRef(0);

  // Debounce query changes; ignore no-op re-renders (stable serialized value).
  const prevKeyRef = useRef(queryKey(query));
  useEffect(() => {
    const key = queryKey(query);
    if (key === prevKeyRef.current) return;
    const t = setTimeout(() => {
      prevKeyRef.current = key;
      setDebouncedQuery(query);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const loadMore = useCallback(
    async (reset = false) => {
      if (!reset && (loadingRef.current || !hasMoreRef.current)) return;
      const gen = generationRef.current;
      loadingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        let rows = await loadBookmarksPage(debouncedQuery, offsetRef.current, PAGE_SIZE);

        if (__DEV__ && offsetRef.current === 0 && rows.length === 0) {
          await seedDatabaseIfEmpty();
          rows = await loadBookmarksPage(debouncedQuery, 0, PAGE_SIZE);
        }

        if (gen !== generationRef.current) return;

        const next = rows.map(bookmarkToPin);

        if (next.length < PAGE_SIZE) hasMoreRef.current = false;
        setHasMore(hasMoreRef.current);

        setPins((prev) => [...prev, ...next]);
        offsetRef.current += next.length;
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
    [debouncedQuery]
  );

  const refresh = useCallback(async () => {
    if (loadingRef.current) return;
    offsetRef.current = 0;
    hasMoreRef.current = true;
    setPins([]);
    setError(null);
    setRefreshing(true);
    try {
      await loadMore(true);
    } finally {
      setRefreshing(false);
    }
  }, [loadMore]);

  // Reset and refetch page 0 whenever the (debounced) query changes.
  useEffect(() => {
    generationRef.current += 1;
    offsetRef.current = 0;
    hasMoreRef.current = true;
    const t = setTimeout(() => {
      setHasMore(true);
      setPins([]);
      setError(null);
      void loadMore(true);
    }, 0);
    return () => clearTimeout(t);
  }, [loadMore]);

  return { pins, setPins, loading, refreshing, hasMore, error, loadMore, refresh };
}

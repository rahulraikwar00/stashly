// hooks/usePins.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Pin } from '@/types/bookmarks';
import { loadBookmarksPage, PAGE_SIZE } from '@/db/bookmarkService';
import { seedDatabaseIfEmpty } from '@/db/seed';
import { bookmarkToPin } from '@/utils/pin';

export function usePins() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const offsetRef = useRef(0);
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      let rows = await loadBookmarksPage(offsetRef.current, PAGE_SIZE);

      if (__DEV__ && offsetRef.current === 0 && rows.length === 0) {
        await seedDatabaseIfEmpty();
        rows = await loadBookmarksPage(0, PAGE_SIZE);
      }

      const next = rows.map(bookmarkToPin);

      if (next.length < PAGE_SIZE) setHasMore(false);

      setPins((prev) => [...prev, ...next]);
      offsetRef.current += next.length;
    } catch (err) {
      console.error('Failed to load page:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [hasMore]);

  const refresh = useCallback(async () => {
    if (loadingRef.current) return;
    offsetRef.current = 0;
    loadingRef.current = false;
    setPins([]);
    setHasMore(true);
    setError(null);
    setRefreshing(true);
    try {
      await loadMore();
    } finally {
      setRefreshing(false);
    }
  }, [loadMore]);

  useEffect(() => {
    const t = setTimeout(loadMore, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { pins, loading, refreshing, hasMore, error, loadMore, refresh };
}

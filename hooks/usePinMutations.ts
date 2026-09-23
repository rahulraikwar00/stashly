// hooks/usePinMutations.ts
import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { BookmarkQuery, Pin } from '@/types/bookmarks';
import {
  deleteBookmark,
  setArchived,
  setFavorite,
  setRead,
  updateBookmark,
} from '@/db/bookmarkService';
import { pinMatchesFilters } from '@/utils/pin';

/** User-editable fields written to the bookmark row on edit. */
export type EditPinPatch = {
  customTitle: string;
  customDescription: string;
  notes: string;
  tags: string[];
};

/**
 * Optimistic mutation helpers for the Library grid. Each mutation updates
 * `pins` immediately, drops the pin from the view when the active filters no
 * longer match it (e.g. un-favoriting under "Favorites"), and rolls back on
 * failure. Calls `onMutated(id, null)` when the pin was removed so overlays
 * can stay in sync.
 */
export function usePinMutations(
  pins: Pin[],
  setPins: Dispatch<SetStateAction<Pin[]>>,
  query: BookmarkQuery,
  onMutated?: (id: number, updated: Pin | null) => void
) {
  const applyOptimistic = useCallback(
    (id: number, updater: (p: Pin) => Pin, run: () => Promise<unknown>) => {
      const snapshot = pins;
      setPins((current) => {
        const target = current.find((p) => p.id === id);
        if (!target) return current;
        const updated = updater(target);
        const keep = pinMatchesFilters(updated, query);
        onMutated?.(id, keep ? updated : null);
        return keep
          ? current.map((p) => (p.id === id ? updated : p))
          : current.filter((p) => p.id !== id);
      });
      run().catch((err: unknown) => {
        console.error('Optimistic update failed:', err);
        setPins(snapshot);
      });
    },
    [pins, query, setPins, onMutated]
  );

  const toggleFavorite = useCallback(
    (pin: Pin) =>
      applyOptimistic(
        pin.id,
        (p) => ({ ...p, isFavorite: !p.isFavorite }),
        () => setFavorite(pin.id, !pin.isFavorite)
      ),
    [applyOptimistic]
  );

  const toggleRead = useCallback(
    (pin: Pin) =>
      applyOptimistic(
        pin.id,
        (p) => ({ ...p, isRead: !p.isRead }),
        () => setRead(pin.id, !pin.isRead)
      ),
    [applyOptimistic]
  );

  const toggleArchive = useCallback(
    (pin: Pin) =>
      applyOptimistic(
        pin.id,
        (p) => ({ ...p, isArchived: !p.isArchived }),
        () => setArchived(pin.id, !pin.isArchived)
      ),
    [applyOptimistic]
  );

  const deletePin = useCallback(
    (pin: Pin) => {
      const snapshot = pins;
      setPins((current) => current.filter((p) => p.id !== pin.id));
      onMutated?.(pin.id, null);
      deleteBookmark(pin.id).catch((err: unknown) => {
        console.error('Delete failed:', err);
        setPins(snapshot);
      });
    },
    [pins, setPins, onMutated]
  );

  /**
   * Writes the user-editable fields (customTitle, customDescription, notes,
   * tags). The optimistic update resolves the effective display values from
   * the preserved auto values: an empty override falls back to the
   * auto-extracted one.
   */
  const editPin = useCallback(
    (pin: Pin, patch: EditPinPatch) => {
      const run = () =>
        updateBookmark(pin.id, {
          customTitle: patch.customTitle.trim(),
          customDescription: patch.customDescription.trim(),
          notes: patch.notes.trim(),
          tags: JSON.stringify(patch.tags),
        });
      applyOptimistic(
        pin.id,
        (p) => ({
          ...p,
          title: patch.customTitle.trim() || p.autoTitle,
          description: patch.customDescription.trim() || p.autoDescription,
          notes: patch.notes.trim(),
          tags: patch.tags,
        }),
        run
      );
    },
    [applyOptimistic]
  );

  return { toggleFavorite, toggleRead, toggleArchive, deletePin, editPin };
}

// hooks/pendingRefresh.ts
// Tiny module-level flag so the Library screen refetches after a bookmark is
// saved from the add-bookmark screen. Avoids refetching on every focus.

let pending = false;

export function markSavingComplete() {
  pending = true;
}

export function consumeSavingComplete(): boolean {
  const value = pending;
  pending = false;
  return value;
}

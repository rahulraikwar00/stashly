// utils/hash.ts
// Deterministic string -> hex hash used for the `url_hash` UNIQUE column.
// Stable across app restarts so the same URL always dedupes to one row.

export function djb2Hex(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

export function urlHashFor(url: string): string {
  return djb2Hex(url.trim().toLowerCase());
}

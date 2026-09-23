// db/backup.ts
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import type { Bookmark, NewBookmark } from './schema';
import { loadBookmarks, saveBookmarks } from './bookmarkService';
import { urlHashFor } from '@/utils/hash';
import { normalizeTags } from '@/utils/pin';
import { faviconForDomain } from '@/utils/metadata';

/**
 * Versioned, local-first export format. Bump on breaking shape changes; the
 * importer validates the app marker, version and `bookmarks` array.
 */
export const BACKUP_VERSION = 1;

type BackupExport = {
  app: 'bookmark-library';
  version: 1;
  exportedAt: string;
  count: number;
  bookmarks: Bookmark[];
};

export type ImportResult = { imported: number; skipped: number; total: number };

function validUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:' ? trimmed : null;
  } catch {
    return null;
  }
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const BOOKMARK_TYPES = new Set(['article', 'image', 'link', 'video']);

/**
 * Parses and normalizes raw backup JSON into insert-ready rows. Throws with a
 * user-facing message when the payload isn't a valid backup; rows with a
 * missing/non-http url are dropped (they can't be stored).
 */
function normalizeBackupRows(raw: string): NewBookmark[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('That does not look like a JSON backup file.');
  }

  if (typeof data !== 'object' || data === null) {
    throw new Error('Backup must be a JSON object.');
  }
  const obj = data as Record<string, unknown>;
  if (obj.app && obj.app !== 'bookmark-library') {
    throw new Error('This file was not exported from this app.');
  }
  if (!Array.isArray(obj.bookmarks)) {
    throw new Error('Backup is missing the "bookmarks" array.');
  }

  const now = Date.now();
  const rows: NewBookmark[] = [];

  for (const item of obj.bookmarks) {
    const record =
      typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {};
    const url = validUrl(record.url);
    if (!url) continue;

    let domain = asString(record.domain);
    let path = asString(record.path);
    try {
      const parsed = new URL(url);
      if (!domain) domain = parsed.hostname;
      if (!path) path = parsed.pathname;
    } catch {
      // keep '' fallbacks
    }

    const type = BOOKMARK_TYPES.has(asString(record.type)) ? asString(record.type) : 'link';
    const tags = Array.isArray(record.tags)
      ? normalizeTags(record.tags.map((t) => asString(t)).join(', '))
      : normalizeTags(asString(record.tags));

    rows.push({
      url,
      urlHash: urlHashFor(url),
      domain,
      path,
      title: asString(record.title) || domain,
      description: asString(record.description),
      image: asString(record.image),
      favicon: asString(record.favicon, faviconForDomain(domain)),
      siteName: asString(record.siteName),
      author: asString(record.author),
      publishedAt: typeof record.publishedAt === 'number' ? record.publishedAt : null,
      language: asString(record.language),
      type,
      tags: JSON.stringify(tags),
      notes: asString(record.notes),
      isFavorite: Boolean(record.isFavorite),
      isArchived: Boolean(record.isArchived),
      isRead: Boolean(record.isRead),
      customTitle: asString(record.customTitle),
      customDescription: asString(record.customDescription),
      createdAt: asNumber(record.createdAt, now),
      updatedAt: asNumber(record.updatedAt, now),
      lastViewedAt: typeof record.lastViewedAt === 'number' ? record.lastViewedAt : null,
      viewCount: asNumber(record.viewCount, 0),
    });
  }

  return rows;
}

/**
 * Serializes every bookmark (all types/statuses) into the backup JSON string.
 */
export async function exportBookmarksJson(): Promise<{ json: string; count: number }> {
  const bookmarks = await loadBookmarks({});
  const payload: BackupExport = {
    app: 'bookmark-library',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    count: bookmarks.length,
    bookmarks,
  };
  return { json: JSON.stringify(payload, null, 2), count: bookmarks.length };
}

/**
 * Writes the export to a local file and opens the native share sheet so the
 * user can save it to Files/Drive/… Returns null when sharing is unavailable.
 */
export async function shareBookmarksExport(): Promise<{ count: number } | null> {
  const { json, count } = await exportBookmarksJson();
  if (!(await Sharing.isAvailableAsync())) return null;
  const file = new File(Paths.cache, 'bookmarks-export.json');
  file.write(json);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Export bookmarks',
  });
  return { count };
}

/**
 * Restores bookmarks from raw backup JSON. Recomputes the dedup hash from the
 * url on import (never trusts the file's) and skips rows whose hash already
 * exists — the same paste re-applied is idempotent.
 */
export async function importBookmarksJson(raw: string): Promise<ImportResult> {
  const rows = normalizeBackupRows(raw);

  const existing = await loadBookmarks({});
  const existingHashes = new Set(existing.map((b) => b.urlHash));

  const toInsert: NewBookmark[] = [];
  let skipped = 0;
  for (const row of rows) {
    if (existingHashes.has(row.urlHash)) {
      skipped += 1;
      continue;
    }
    toInsert.push(row);
  }

  if (toInsert.length > 0) await saveBookmarks(toInsert);

  return { imported: toInsert.length, skipped, total: rows.length };
}

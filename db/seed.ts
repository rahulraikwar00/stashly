// db/seed.ts
import { sql } from 'drizzle-orm';
import { db } from './client';
import { bookmarks, type NewBookmark } from './schema';
import seedData from './seeddata.json';
import { normalizeTags } from '@/utils/pin';

export async function seedDatabaseIfEmpty() {
  const [row] = await db.select({ count: sql<number>`count(*)` }).from(bookmarks);

  if (Number(row?.count ?? 0) > 0) return;

  const items: NewBookmark[] = (seedData as any[]).map((pin) => ({
    url: pin.url,
    urlHash: pin.urlHash,
    domain: pin.domain ?? '',
    path: pin.path ?? '',
    title: pin.title,
    description: pin.description ?? '',
    image: pin.image,
    favicon: pin.favicon ?? '',
    siteName: pin.siteName ?? '',
    author: pin.author ?? '',
    publishedAt: pin.publishedAt ?? null,
    language: pin.language ?? '',
    type: pin.type ?? 'link',
    tags: JSON.stringify(normalizeTags(pin.tags)),
    notes: pin.notes ?? '',
    isFavorite: !!pin.isFavorite,
    isArchived: !!pin.isArchived,
    isRead: !!pin.isRead,
    customTitle: pin.customTitle ?? '',
    customDescription: pin.customDescription ?? '',
    createdAt: pin.createdAt ?? Date.now(),
    updatedAt: pin.updatedAt ?? Date.now(),
    lastViewedAt: pin.lastViewedAt ?? null,
    viewCount: pin.viewCount ?? 0,
  }));

  await db.insert(bookmarks).values(items);
  console.log(`Seeded ${items.length} bookmarks`);
}

/**
 * Dev-only: wipes every bookmark and re-seeds from `seeddata.json`, so the
 * library can be returned to a known-good state after a data-shape bug (tags
 * stored as `["[a","b]"]`, for example) has written bad rows.
 *
 * Deletes through the app's own open connection rather than by removing the
 * file, which would leave the module-scope handle in db/client.ts dangling and
 * strand the `-wal`/`-shm` sidecars. Re-seeding goes through
 * `seedDatabaseIfEmpty`, so it only inserts when the table really is empty.
 */
export async function resetBookmarksForDev(): Promise<number> {
  await db.delete(bookmarks);
  await seedDatabaseIfEmpty();

  const [row] = await db.select({ count: sql<number>`count(*)` }).from(bookmarks);
  const total = Number(row?.count ?? 0);
  console.log(`Reset library: ${total} bookmarks`);
  return total;
}

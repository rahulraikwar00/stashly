// db/seed.ts
import { sql } from 'drizzle-orm';
import { db } from './client';
import { bookmarks, type NewBookmark } from './schema';
import seedData from './seeddata.json';

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
    tags: JSON.stringify(pin.tags ?? []),
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

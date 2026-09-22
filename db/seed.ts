// db/seed.ts
import { sql } from 'drizzle-orm';
import { db } from './client';
import { bookmarks, type NewBookmark } from './schema';
import seedData from './seeddata.json';

export async function seedDatabaseIfEmpty() {
  const [row] = await db.select({ count: sql<number>`count(*)` }).from(bookmarks);

  if (Number(row?.count ?? 0) > 0) return;

  const items: NewBookmark[] = (seedData as any[]).map((pin) => ({
    title: pin.title,
    url: pin.image,
    description: pin.description,
    image: pin.image,
    favicon: pin.favicon,
    source: pin.source,
    tags: JSON.stringify(pin.tags),
    type: pin.type,
    height: pin.height, // ← now included
    createdAt: Date.now(),
  }));

  await db.insert(bookmarks).values(items);
  console.log(`Seeded ${items.length} bookmarks`);
}

seedDatabaseIfEmpty();

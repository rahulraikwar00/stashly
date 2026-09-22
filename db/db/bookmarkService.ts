// db/bookmarkService.ts
import { eq } from 'drizzle-orm';
import { db } from './client';
import { bookmarks, type Bookmark, type NewBookmark } from './schema';

/**
 * Saves a single bookmark.
 */
export async function saveBookmark(bookmark: NewBookmark): Promise<Bookmark> {
  const [saved] = await db.insert(bookmarks).values(bookmark).returning();
  return saved;
}

/**
 * Saves multiple bookmarks in one batch.
 */
export async function saveBookmarks(items: NewBookmark[]): Promise<Bookmark[]> {
  if (items.length === 0) return [];
  return db.insert(bookmarks).values(items).returning();
}

/**
 * Loads all bookmarks, newest first.
 */
export async function loadBookmarks(): Promise<Bookmark[]> {
  return db.select().from(bookmarks).orderBy(bookmarks.createdAt); // Add desc() if needed
}

/**
 * Loads a single bookmark by its ID.
 */
export async function loadBookmarkById(id: string): Promise<Bookmark | undefined> {
  const [result] = await db.select().from(bookmarks).where(eq(bookmarks.id, id)).limit(1);
  return result;
}

/**
 * Deletes a bookmark by ID.
 */
export async function deleteBookmark(id: string): Promise<void> {
  await db.delete(bookmarks).where(eq(bookmarks.id, id));
}

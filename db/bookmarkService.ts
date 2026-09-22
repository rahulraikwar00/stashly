// db/bookmarkService.ts
import { eq, desc, sql } from 'drizzle-orm';
import { db } from './client';
import { bookmarks, type Bookmark, type NewBookmark } from './schema';

/**
 * Default page size for paginated queries.
 * Change here to change it everywhere.
 */
export const PAGE_SIZE = 20;

// ─────────────────────────────────────────────
// WRITE
// ─────────────────────────────────────────────

/**
 * Saves a single bookmark.
 * Returns the inserted row (with generated id).
 */
export async function saveBookmark(bookmark: NewBookmark): Promise<Bookmark> {
  const [saved] = await db.insert(bookmarks).values(bookmark).returning();
  return saved;
}

/**
 * Saves multiple bookmarks in one batch.
 * Returns all inserted rows.
 */
export async function saveBookmarks(items: NewBookmark[]): Promise<Bookmark[]> {
  if (items.length === 0) return [];
  return db.insert(bookmarks).values(items).returning();
}

/**
 * Deletes a bookmark by ID.
 */
export async function deleteBookmark(id: number): Promise<void> {
  await db.delete(bookmarks).where(eq(bookmarks.id, id));
}

// ─────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────

/**
 * Loads ALL bookmarks, newest first.
 * Use only for small datasets. For large datasets, use loadBookmarksPage.
 */
export async function loadBookmarks(): Promise<Bookmark[]> {
  return db.select().from(bookmarks).orderBy(desc(bookmarks.createdAt));
}

/**
 * Loads a page of bookmarks, newest first.
 * Use with offset 0, 20, 40, ... for infinite scroll.
 */
export async function loadBookmarksPage(offset: number, limit = PAGE_SIZE): Promise<Bookmark[]> {
  return db.select().from(bookmarks).orderBy(desc(bookmarks.createdAt)).limit(limit).offset(offset);
}

/**
 * Loads a single bookmark by its ID.
 */
export async function loadBookmarkById(id: number): Promise<Bookmark | undefined> {
  const [result] = await db.select().from(bookmarks).where(eq(bookmarks.id, id)).limit(1);
  return result;
}

/**
 * Total number of bookmarks.
 * Useful for "showing 20 of 340" UIs or deciding if more pages exist.
 */
export async function countBookmarks(): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)` }).from(bookmarks);
  return Number(row?.count ?? 0);
}

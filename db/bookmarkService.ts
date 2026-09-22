// db/bookmarkService.ts
import { and, desc, eq, like, or, sql } from 'drizzle-orm';
import type { BookmarkQuery } from '@/types/bookmarks';
import { db } from './client';
import { bookmarks, type Bookmark, type NewBookmark } from './schema';
import {
  fetchExtractedMetadata,
  fetchPageMetadata,
  isEmptyMetadata,
  isWalledDomain,
} from '@/utils/metadata';
import { pushEvent } from '@/utils/debug';

/**
 * Default page size for paginated queries.
 * Change here to change it everywhere.
 */
export const PAGE_SIZE = 20;

// ─────────────────────────────────────────────
// FILTERS
// ─────────────────────────────────────────────

function buildWhere(query: BookmarkQuery) {
  const conditions = [];

  const search = query.search?.trim();
  if (search) {
    const term = `%${search}%`;
    conditions.push(
      or(
        like(bookmarks.title, term),
        like(bookmarks.customTitle, term),
        like(bookmarks.description, term),
        like(bookmarks.siteName, term),
        like(bookmarks.url, term),
        like(bookmarks.tags, term)
      )
    );
  }

  if (query.type) conditions.push(eq(bookmarks.type, query.type));
  if (query.favorite !== undefined) conditions.push(eq(bookmarks.isFavorite, query.favorite));
  if (query.unread !== undefined) conditions.push(eq(bookmarks.isRead, !query.unread));
  if (query.archived !== undefined) conditions.push(eq(bookmarks.isArchived, query.archived));

  return conditions;
}

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
 * Partial update of a bookmark. Always bumps updatedAt.
 * Returns the updated row (or undefined when the id does not exist).
 */
export async function updateBookmark(
  id: number,
  patch: Partial<NewBookmark>
): Promise<Bookmark | undefined> {
  const [row] = await db
    .update(bookmarks)
    .set({ ...patch, updatedAt: Date.now() })
    .where(eq(bookmarks.id, id))
    .returning();
  return row;
}

/**
 * Toggles the favorite flag.
 */
export async function setFavorite(id: number, isFavorite: boolean): Promise<void> {
  await updateBookmark(id, { isFavorite });
}

/**
 * Toggles the archived flag.
 */
export async function setArchived(id: number, isArchived: boolean): Promise<void> {
  await updateBookmark(id, { isArchived });
}

/**
 * Toggles the read flag.
 */
export async function setRead(id: number, isRead: boolean): Promise<void> {
  await updateBookmark(id, { isRead });
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
 * Loads ALL bookmarks matching the query, newest first.
 * Use only for small datasets. For large datasets, use loadBookmarksPage.
 */
export async function loadBookmarks(query: BookmarkQuery = {}): Promise<Bookmark[]> {
  const where = buildWhere(query);
  const base = db.select().from(bookmarks);
  const filtered = where.length ? base.where(and(...where)) : base;
  return filtered.orderBy(desc(bookmarks.createdAt));
}

/**
 * Loads a page of bookmarks matching the query, newest first.
 * Use with offset 0, 20, 40, ... for infinite scroll.
 */
export async function loadBookmarksPage(
  query: BookmarkQuery = {},
  offset: number,
  limit = PAGE_SIZE
): Promise<Bookmark[]> {
  const where = buildWhere(query);
  const base = db.select().from(bookmarks);
  const filtered = where.length ? base.where(and(...where)) : base;
  return filtered.orderBy(desc(bookmarks.createdAt)).limit(limit).offset(offset);
}

/**
 * Loads a single bookmark by its ID.
 */
export async function loadBookmarkById(id: number): Promise<Bookmark | undefined> {
  const [result] = await db.select().from(bookmarks).where(eq(bookmarks.id, id)).limit(1);
  return result;
}

/**
 * Loads a bookmark by its deduplication hash (same URL = same hash).
 * Used to detect "already saved" before insert.
 */
export async function getBookmarkByUrlHash(urlHash: string): Promise<Bookmark | undefined> {
  const [result] = await db.select().from(bookmarks).where(eq(bookmarks.urlHash, urlHash)).limit(1);
  return result;
}

export type EnrichmentSource = 'direct' | 'extractor-self-hosted' | 'extractor-interim';

export interface EnrichmentResult {
  patch: Partial<NewBookmark>;
  source: EnrichmentSource;
  durationMs: number;
}

/**
 * Enriches an already-saved bookmark with fetched page metadata.
 * Runs as a fire-and-forget async job (native fetch I/O, never blocks the UI).
 *
 * Two tiers:
 *  1. Direct device-side fetch (private, fast) for normal sites.
 *  2. When the direct result is empty, or the site is a "walled" platform that
 *     hides metadata from browser-like clients (Instagram/TikTok/...), falls
 *     back to the server-side extractor (backend/) which uses a crawler UA.
 *
 * Returns an EnrichmentResult (metadata patch + source + duration) on success,
 * or null when no metadata could be found.
 */
export async function enrichBookmark(id: number, url: string): Promise<EnrichmentResult | null> {
  const startedAt = Date.now();
  const tag = `bookmark#${id}`;
  let direct: Partial<NewBookmark> | undefined;

  try {
    direct = await fetchPageMetadata(url);
  } catch (err) {
    pushEvent('enrich', `${tag} direct-error ${err instanceof Error ? err.message : String(err)}`);
  }

  if (direct && !isEmptyMetadata(direct)) {
    await updateBookmark(id, direct);
    pushEvent('enrich', `${tag} direct loaded ${Date.now() - startedAt}ms`);
    return { patch: direct, source: 'direct', durationMs: Date.now() - startedAt };
  }

  let domain = '';
  try {
    domain = new URL(url).hostname;
  } catch {
    // keep ''
  }

  const needsExtractor = isWalledDomain(domain) || !direct || isEmptyMetadata(direct);
  pushEvent(
    'enrich',
    `${tag} tier=extractor host=${domain || '?'} reason=${isWalledDomain(domain) ? 'walled' : 'empty-direct'}`
  );
  if (needsExtractor) {
    const extracted = await fetchExtractedMetadata(url);
    if (extracted) {
      await updateBookmark(id, extracted.patch);
      const durationMs = Date.now() - startedAt;
      pushEvent(
        'enrich',
        `${tag} ${extracted.source === 'self-hosted' ? 'extractor-self-hosted' : 'extractor-interim'} loaded ${durationMs}ms`
      );
      return {
        patch: extracted.patch,
        source: extracted.source === 'self-hosted' ? 'extractor-self-hosted' : 'extractor-interim',
        durationMs,
      };
    }
  }

  pushEvent('enrich', `${tag} failed ${Date.now() - startedAt}ms`);
  return null;
}

/**
 * Number of bookmarks matching the query.
 * Useful for "showing 20 of 340" UIs or deciding if more pages exist.
 */
export async function countBookmarks(query: BookmarkQuery = {}): Promise<number> {
  const where = buildWhere(query);
  const base = db.select({ count: sql<number>`count(*)` }).from(bookmarks);
  const filtered = where.length ? base.where(and(...where)) : base;
  const rows = await filtered;
  return Number(rows[0]?.count ?? 0);
}

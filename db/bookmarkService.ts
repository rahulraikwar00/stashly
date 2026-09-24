// db/bookmarkService.ts
import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm';
import type { BookmarkQuery } from '@/types/bookmarks';
import type { IGBookmark } from '@/types/ig';
import { db } from './client';
import { bookmarks, type Bookmark, type NewBookmark } from './schema';
import {
  fetchExtractedMetadata,
  fetchPageMetadata,
  isEmptyMetadata,
  isWalledDomain,
} from '@/utils/metadata';
import { urlHashFor } from '@/utils/hash';
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
        like(bookmarks.customDescription, term),
        like(bookmarks.description, term),
        like(bookmarks.siteName, term),
        like(bookmarks.url, term),
        like(bookmarks.tags, term),
        like(bookmarks.notes, term)
      )
    );
  }

  if (query.type) conditions.push(eq(bookmarks.type, query.type));
  if (query.favorite !== undefined) conditions.push(eq(bookmarks.isFavorite, query.favorite));
  if (query.unread !== undefined) conditions.push(eq(bookmarks.isRead, !query.unread));
  if (query.archived !== undefined) conditions.push(eq(bookmarks.isArchived, query.archived));

  // Tags are stored as a JSON string array (`["tag1","tag2"]`). Matching the
  // JSON-encoded value (with quotes) makes the filter exact while staying a
  // plain LIKE — `%"ai"%` never matches `"aiart"`.
  if (query.tag) conditions.push(like(bookmarks.tags, `%${JSON.stringify(query.tag)}%`));

  return conditions;
}

/**
 * SQL ORDER BY for a sort key. `unread`/`favorites` are "inbox-first" sorts
 * that rank their flag first, then fall back to newest. `newest` (the default)
 * and `oldest` are pure date orders.
 */
function buildOrderBy(query: BookmarkQuery) {
  switch (query.sort ?? 'newest') {
    case 'newest':
      return [desc(bookmarks.createdAt)];
    case 'oldest':
      return [asc(bookmarks.createdAt)];
    case 'unread':
      return [asc(bookmarks.isRead), desc(bookmarks.createdAt)];
    case 'favorites':
      return [desc(bookmarks.isFavorite), desc(bookmarks.createdAt)];
  }
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

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Maps a backend DM bookmark (docs/03 §3.3 wire shape) to a `NewBookmark` row.
 * urlHash is recomputed client-side with the app's own djb2 (`urlHashFor`) so
 * dedup is guaranteed identical to the paste path regardless of the backend's
 * hash implementation. Sender order wins: createdAt = the DM timestamp.
 */
function mapDmToRow(res: IGBookmark, now: number): NewBookmark {
  return {
    url: res.url,
    urlHash: urlHashFor(res.url),
    domain: res.domain ?? '',
    path: res.path ?? '',
    title: res.title ?? '',
    description: res.description ?? '',
    image: res.image ?? '',
    favicon: res.favicon ?? '',
    siteName: res.siteName ?? '',
    author: res.author ?? '',
    publishedAt: res.publishedAt ?? null,
    language: res.language ?? '',
    type: res.type ?? 'link',
    tags: JSON.stringify(res.tags ?? []),
    notes: '',
    isFavorite: false,
    isArchived: false,
    isRead: false,
    customTitle: res.customTitle ?? '',
    customDescription: res.customDescription ?? '',
    createdAt: res.timestamp || now,
    updatedAt: now,
    lastViewedAt: null,
    viewCount: 0,
  };
}

/**
 * Inserts backend DM bookmarks through the same dedupe path as paste saves
 * (`onConflictDoNothing` on `urlHash`), so the same reel saved both ways is
 * one row. Items without a usable http(s) URL are counted as skipped and never
 * inserted.
 */
export async function insertDmBookmarks(
  items: IGBookmark[]
): Promise<{ inserted: number; skipped: number }> {
  const now = Date.now();
  const rows: NewBookmark[] = [];
  let skipped = 0;
  for (const res of items) {
    if (!res || !isHttpUrl(res.url)) {
      skipped += 1;
      continue;
    }
    rows.push(mapDmToRow(res, now));
  }
  if (rows.length === 0) return { inserted: 0, skipped };

  const saved = await db
    .insert(bookmarks)
    .values(rows)
    .onConflictDoNothing({ target: bookmarks.urlHash })
    .returning();

  const inserted = saved.length;
  pushEvent('sync', `dm inserted=${inserted} skipped=${skipped}`);
  return { inserted, skipped };
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
 * Loads ALL bookmarks matching the query, sorted per the query's sort key
 * (default newest). Use only for small datasets. For large datasets, use
 * loadBookmarksPage.
 */
export async function loadBookmarks(query: BookmarkQuery = {}): Promise<Bookmark[]> {
  const where = buildWhere(query);
  const base = db.select().from(bookmarks);
  const filtered = where.length ? base.where(and(...where)) : base;
  return filtered.orderBy(...buildOrderBy(query));
}

/**
 * Loads a page of bookmarks matching the query.
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
  return filtered
    .orderBy(...buildOrderBy(query))
    .limit(limit)
    .offset(offset);
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
 *  1. Walled platforms (Instagram/TikTok/...) ALWAYS use the server-side
 *     extractor (backend/), which fetches with a crawler UA and gets the full
 *     caption/likes/thumbnail — a device-side fetch can't.
 *  2. Everywhere else: direct device-side fetch (private, fast); when the
 *     direct result is empty or fails, falls back to the extractor.
 *
 * Returns an EnrichmentResult (metadata patch + source + duration) on success,
 * or null when no metadata could be found.
 */
export async function enrichBookmark(id: number, url: string): Promise<EnrichmentResult | null> {
  const startedAt = Date.now();
  const tag = `bookmark#${id}`;

  let domain = '';
  try {
    domain = new URL(url).hostname;
  } catch {
    // keep ''
  }

  if (isWalledDomain(domain)) {
    pushEvent('enrich', `${tag} tier=extractor host=${domain} reason=walled`);
    return extractorTier(id, url, domain, startedAt);
  }

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

  pushEvent('enrich', `${tag} tier=extractor host=${domain || '?'} reason=empty-direct`);
  return extractorTier(id, url, domain, startedAt);
}

async function extractorTier(
  id: number,
  url: string,
  domain: string,
  startedAt: number
): Promise<EnrichmentResult | null> {
  const tag = `bookmark#${id}`;
  const extracted = await fetchExtractedMetadata(url);
  if (extracted) {
    await updateBookmark(id, extracted.patch);
    const durationMs = Date.now() - startedAt;
    const source =
      extracted.source === 'self-hosted' ? 'extractor-self-hosted' : 'extractor-interim';
    pushEvent('enrich', `${tag} ${source} loaded ${durationMs}ms`);
    return { patch: extracted.patch, source, durationMs };
  }

  pushEvent('enrich', `${tag} failed ${domain || '?'} ${Date.now() - startedAt}ms`);
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

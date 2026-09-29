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
  isIncompleteBookmark,
  isWalledDomain,
  mergeAutoMetadata,
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
 * Shared insert used by paste and DM paths. Dedupes on `urlHash` via
 * `onConflictDoNothing` so the same URL saved both ways is one row.
 * Returns the inserted row, or `null` when the URL was already saved.
 */
export async function insertBookmark(bookmark: NewBookmark): Promise<Bookmark | null> {
  const [saved] = await db
    .insert(bookmarks)
    .values(bookmark)
    .onConflictDoNothing({ target: bookmarks.urlHash })
    .returning();
  return saved ?? null;
}

/**
 * Batch insert with the same `urlHash` dedupe as `insertBookmark`.
 * Returns only the rows that were actually inserted.
 */
export async function insertBookmarks(items: NewBookmark[]): Promise<Bookmark[]> {
  if (items.length === 0) return [];
  return db
    .insert(bookmarks)
    .values(items)
    .onConflictDoNothing({ target: bookmarks.urlHash })
    .returning();
}

/**
 * Force-insert a single bookmark (no conflict handling). Prefer
 * `insertBookmark` for user-facing save paths.
 */
export async function saveBookmark(bookmark: NewBookmark): Promise<Bookmark> {
  const [saved] = await db.insert(bookmarks).values(bookmark).returning();
  return saved;
}

/**
 * Force-insert multiple bookmarks (no conflict handling). Used by backup
 * restore after the caller has already filtered duplicates.
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
 * Backend-provided image/title/author/caption/tags are kept so the card can
 * paint without a second network hop.
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
 * Inserts backend DM bookmarks through the shared `insertBookmarks` dedupe
 * path. After insert, incomplete cards (missing usable title or image) are
 * enriched via self-hosted `/metadata` — never the public link-preview API
 * (D-017). Captions/tags from the backend are preserved on merge.
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

  const saved = await insertBookmarks(rows);
  const inserted = saved.length;
  pushEvent('sync', `dm inserted=${inserted} skipped=${skipped}`);

  // #region agent log
  fetch('http://127.0.0.1:7747/ingest/7c723dce-edfb-4530-91f2-8c703d63e5fd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1b207b'},body:JSON.stringify({sessionId:'1b207b',runId:'pre-fix',hypothesisId:'A',location:'bookmarkService.ts:insertDmBookmarks',message:'DM insert batch',data:{requested:rows.length,inserted,skipped,sample:rows.slice(0,2).map(r=>({urlHash:r.urlHash,title:r.title||'',hasImage:!!r.image,author:r.author||'',incomplete:isIncompleteBookmark(r)}))},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  const targets = await collectEnrichTargets(saved, rows);

  // #region agent log
  fetch('http://127.0.0.1:7747/ingest/7c723dce-edfb-4530-91f2-8c703d63e5fd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1b207b'},body:JSON.stringify({sessionId:'1b207b',runId:'pre-fix',hypothesisId:'A',location:'bookmarkService.ts:collectEnrichTargets',message:'DM enrich targets',data:{targetCount:targets.length,targetIds:targets.map(t=>t.id)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  await Promise.allSettled(
    targets.map((t) => enrichBookmark(t.id, t.url, { allowInterim: false }))
  );
  pushEvent('sync', `dm enriched=${targets.length}`);

  return { inserted, skipped };
}

/**
 * Rows to enrich after a DM insert: freshly-inserted incomplete bookmarks,
 * plus any conflicted existing row that is still incomplete (preview-only
 * title/image gaps).
 */
async function collectEnrichTargets(
  saved: Bookmark[],
  rows: NewBookmark[]
): Promise<Array<{ id: number; url: string }>> {
  const targets: Array<{ id: number; url: string }> = [];

  for (const s of saved) {
    if (isIncompleteBookmark(s)) targets.push({ id: s.id, url: s.url });
  }

  const insertedHashes = new Set(saved.map((s) => s.urlHash));
  for (const row of rows) {
    if (insertedHashes.has(row.urlHash)) continue;
    const existing = await getBookmarkByUrlHash(row.urlHash);
    if (existing && isIncompleteBookmark(existing)) {
      targets.push({ id: existing.id, url: existing.url });
    }
  }
  return targets;
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

export type EnrichOptions = {
  /** When false, never call the public link-preview API (DM path). Default true. */
  allowInterim?: boolean;
};

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
 * Pass `{ allowInterim: false }` on the DM path so enrichment never nests the
 * public link-preview API (docs/03 §3.4 / D-017).
 *
 * Auto fields are merged fill-empty-only so DM captions/tags and user customs
 * are never wiped.
 *
 * Returns an EnrichmentResult (metadata patch + source + duration) on success,
 * or null when no metadata could be found.
 */
export async function enrichBookmark(
  id: number,
  url: string,
  options?: EnrichOptions
): Promise<EnrichmentResult | null> {
  const allowInterim = options?.allowInterim !== false;
  const startedAt = Date.now();
  const tag = `bookmark#${id}`;

  // #region agent log
  fetch('http://127.0.0.1:7747/ingest/7c723dce-edfb-4530-91f2-8c703d63e5fd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1b207b'},body:JSON.stringify({sessionId:'1b207b',runId:'pre-fix',hypothesisId:'B',location:'bookmarkService.ts:enrichBookmark',message:'enrich start',data:{id,domainHint:(()=>{try{return new URL(url).hostname}catch{return ''}})(),allowInterim},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  let domain = '';
  try {
    domain = new URL(url).hostname;
  } catch {
    // keep ''
  }

  if (isWalledDomain(domain)) {
    pushEvent('enrich', `${tag} tier=extractor host=${domain} reason=walled`);
    return extractorTier(id, url, domain, startedAt, allowInterim);
  }

  let direct: Partial<NewBookmark> | undefined;
  try {
    direct = await fetchPageMetadata(url);
  } catch (err) {
    pushEvent('enrich', `${tag} direct-error ${err instanceof Error ? err.message : String(err)}`);
  }

  if (direct && !isEmptyMetadata(direct)) {
    const applied = await applyMergedEnrichment(id, direct);
    if (applied) {
      // #region agent log
      fetch('http://127.0.0.1:7747/ingest/7c723dce-edfb-4530-91f2-8c703d63e5fd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1b207b'},body:JSON.stringify({sessionId:'1b207b',runId:'pre-fix',hypothesisId:'C',location:'bookmarkService.ts:enrichBookmark',message:'enrich direct applied',data:{id,appliedKeys:Object.keys(applied),hasTitle:!!applied.title,hasImage:!!applied.image},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      pushEvent('enrich', `${tag} direct loaded ${Date.now() - startedAt}ms`);
      return { patch: applied, source: 'direct', durationMs: Date.now() - startedAt };
    }
  }

  pushEvent('enrich', `${tag} tier=extractor host=${domain || '?'} reason=empty-direct`);
  return extractorTier(id, url, domain, startedAt, allowInterim);
}

async function applyMergedEnrichment(
  id: number,
  patch: Partial<NewBookmark>
): Promise<Partial<NewBookmark> | null> {
  const existing = await loadBookmarkById(id);
  if (!existing) return null;
  const merged = mergeAutoMetadata(existing, patch);
  // #region agent log
  fetch('http://127.0.0.1:7747/ingest/7c723dce-edfb-4530-91f2-8c703d63e5fd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1b207b'},body:JSON.stringify({sessionId:'1b207b',runId:'pre-fix',hypothesisId:'C',location:'bookmarkService.ts:applyMergedEnrichment',message:'merge auto metadata',data:{id,existingTitle:existing.title||'',existingHasImage:!!existing.image,patchKeys:Object.keys(patch),mergedKeys:Object.keys(merged),mergedTitle:merged.title||'',mergedHasImage:!!merged.image},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (Object.keys(merged).length === 0) return null;
  await updateBookmark(id, merged);
  return merged;
}

async function extractorTier(
  id: number,
  url: string,
  domain: string,
  startedAt: number,
  allowInterim: boolean
): Promise<EnrichmentResult | null> {
  const tag = `bookmark#${id}`;
  const extracted = await fetchExtractedMetadata(url, { allowInterim });
  // #region agent log
  fetch('http://127.0.0.1:7747/ingest/7c723dce-edfb-4530-91f2-8c703d63e5fd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1b207b'},body:JSON.stringify({sessionId:'1b207b',runId:'pre-fix',hypothesisId:'B',location:'bookmarkService.ts:extractorTier',message:'extractor result',data:{id,domain,allowInterim,gotExtract:!!extracted,source:extracted?.source??null,patchTitle:extracted?.patch.title||'',patchHasImage:!!extracted?.patch.image},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (extracted) {
    const applied = await applyMergedEnrichment(id, extracted.patch);
    if (applied) {
      const durationMs = Date.now() - startedAt;
      const source =
        extracted.source === 'self-hosted' ? 'extractor-self-hosted' : 'extractor-interim';
      pushEvent('enrich', `${tag} ${source} loaded ${durationMs}ms`);
      return { patch: applied, source, durationMs };
    }
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

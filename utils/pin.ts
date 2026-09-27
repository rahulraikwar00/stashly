// utils/pin.ts
import type { Bookmark } from '@/db/schema';
import type { Pin, BookmarkType, BookmarkQuery } from '@/types/bookmarks';

export const DEFAULT_IMAGE_RATIO = 0.7;

export function bookmarkToPin(b: Bookmark): Pin {
  return {
    id: b.id,
    url: b.url,
    title: b.customTitle || b.title,
    description: b.customDescription || b.description,
    autoTitle: b.title,
    autoDescription: b.description,
    source: b.siteName || b.domain || '',
    favicon: b.favicon,
    image: b.image,
    imageRatio: getImageAspectRatio(b.image),
    tags: b.tags ? parseTags(b.tags) : [],
    type: (b.type ?? 'link') as BookmarkType,
    notes: b.notes,
    author: b.author,
    createdAt: b.createdAt,
    isFavorite: b.isFavorite,
    isArchived: b.isArchived,
    isRead: b.isRead,
  };
}

function asTagText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

/**
 * Splits a tags value into its raw entries. Three shapes reach this:
 *   - a real array (`string[]` from the wire or a backup file)
 *   - the stored column, a JSON array string (`["design","mindful"]`)
 *   - anything else, split on commas — user text-input (`cooking, travel`)
 *     and the legacy/mangled values that comma-splitting must still survive
 *     (`[design, mindful]`, a double-encoded `"[design, mindful]"`)
 */
function toTagEntries(value: string | string[] | null | undefined): string[] {
  if (Array.isArray(value)) return value.map(asTagText);

  const trimmed = (value ?? '').trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(asTagText);
    } catch {
      // Not JSON — fall through to comma splitting.
    }
  }

  return trimmed.split(',');
}

/**
 * Normalizes a tags value into a clean, de-duplicated list: lowercase, no
 * leading `#`, no quotes or brackets, empty entries dropped. Keeps the stored
 * value and the UI in agreement, which the JSON-substring tag filter relies on.
 *
 * An empty column (`[]`) and an empty value both yield `[]`, so a tagless
 * bookmark has no tags rather than one bogus `[]` tag.
 */
export function parseTags(value: string | string[] | null | undefined): string[] {
  const tags: string[] = [];
  const seen = new Set<string>();

  for (const entry of toTagEntries(value)) {
    const tag = entry
      .trim()
      .replace(/^["']|["']$/g, '')
      .replace(/["']/g, '')
      .replace(/^#/, '')
      .replace(/[[\]]/g, '')
      .trim()
      .toLowerCase();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }

  return tags;
}

export function normalizeTags(value: string | string[] | null | undefined): string[] {
  return parseTags(value);
}

function validRatio(w: number, h: number): number | null {
  return w > 0 && h > 0 && w < 8000 && h < 8000 ? h / w : null;
}

/**
 * Extracts the image aspect ratio (height / width) from a dimension-encoded
 * URL. Detection ladder:
 *   1. WordPress-style filename suffix `…-1024x683.jpg`
 *   2. Explicit query params `w=` / `h=` (Cloudinary, Imgix, …)
 *   3. `s{width}x{height}` hints in the query/params (Instagram `s640x640` …)
 *   4. Plain integer path segments (picsum `/400/600`)
 * Returns null when no dimensions can be reliably detected.
 */
export function getImageAspectRatio(image: string): number | null {
  if (!image) return null;

  const suffix = /-(\d+)x(\d+)\.(?:jpe?g|png|webp|gif|avif)$/i.exec(image);
  if (suffix) {
    const ratio = validRatio(Number(suffix[1]), Number(suffix[2]));
    if (ratio) return ratio;
  }

  try {
    const query = new URL(image).searchParams;
    const w = query.get('w');
    const h = query.get('h');
    if (w && h) {
      const ratio = validRatio(Number(w), Number(h));
      if (ratio) return ratio;
    }
  } catch {
    // ignore malformed URL
  }

  const dims = /(?:^|[^a-z0-9])s(\d+)x(\d+)(?:[^a-z0-9]|$)/i.exec(image);
  if (dims) {
    const ratio = validRatio(Number(dims[1]), Number(dims[2]));
    if (ratio) return ratio;
  }

  try {
    const parts = image.split('/').filter(Boolean);
    const nums = parts.map(Number).filter((n) => Number.isInteger(n) && n > 0 && n < 8000);
    if (nums.length >= 2) {
      const ratio = validRatio(nums[nums.length - 2], nums[nums.length - 1]);
      if (ratio) return ratio;
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Rendered height of a pin's image for a given column width, preserving the
 * image's real aspect ratio. Falls back to a nominal ratio when unknown.
 * Returns 0 for pins without an image so no blank slot is reserved.
 */
export function imageHeightFor(pin: Pin, columnWidth: number): number {
  if (!pin.image) return 0;
  const ratio = pin.imageRatio ?? DEFAULT_IMAGE_RATIO;
  return Math.round(columnWidth * ratio);
}

/**
 * Estimate a card's total rendered height (image + caption).
 * Used to balance the two masonry columns before a real layout pass.
 */
export function estimateCardHeight(pin: Pin): number {
  const imageH = pin.image ? (pin.imageRatio ?? DEFAULT_IMAGE_RATIO) : 0;
  const padding = 16; // py-2 (8 top + 8 bottom)
  const titleLines = pin.title.length > 28 ? 2 : 1;
  const titleH = titleLines * 16; // leading-4
  const sourceRow = 18; // favicon + mt-1.5
  const margin = 8; // mb-2
  return Math.round(imageH * 180) + padding + titleH + sourceRow + margin;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/**
 * Compact relative age, e.g. "2s · 10m · 5h · 10d · 3w · 9mo · 1y".
 */
export function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < MINUTE) return `${Math.max(0, Math.floor(diff / 1000))}s`;
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  if (diff < WEEK) return `${Math.floor(diff / DAY)}d`;
  if (diff < MONTH) return `${Math.floor(diff / WEEK)}w`;
  if (diff < YEAR) return `${Math.floor(diff / MONTH)}mo`;
  return `${Math.floor(diff / YEAR)}y`;
}

export function formatPinDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Whether a pin still belongs in the current filtered list after an optimistic
 * toggle (favorite/read/archive) or when a type/search filter is active.
 */
export function pinMatchesFilters(pin: Pin, query: BookmarkQuery): boolean {
  if (query.archived !== undefined && pin.isArchived !== query.archived) return false;
  if (query.type && pin.type !== query.type) return false;
  if (query.favorite !== undefined && pin.isFavorite !== query.favorite) return false;
  if (query.unread !== undefined && pin.isRead === query.unread) return false;
  if (query.tag && !pin.tags.includes(query.tag.toLowerCase())) return false;

  const search = query.search?.trim().toLowerCase();
  if (search) {
    const haystack = [pin.title, pin.description, pin.source, pin.notes, pin.url]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(search)) return false;
  }
  return true;
}

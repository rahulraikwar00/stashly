// utils/pin.ts
import type { Bookmark } from '@/db/schema';
import type { Pin, BookmarkType } from '@/types/bookmarks';

export const DEFAULT_IMAGE_RATIO = 0.7;

export function bookmarkToPin(b: Bookmark): Pin {
  return {
    id: String(b.id),
    title: b.title,
    description: b.description,
    source: b.siteName || b.domain || '',
    favicon: b.favicon,
    image: b.image,
    tags: b.tags ? JSON.parse(b.tags) : [],
    type: (b.type ?? 'link') as BookmarkType,
  };
}

/**
 * Extracts the image aspect ratio (height / width) from a dimension-encoded
 * URL, e.g. `https://picsum.photos/seed/a/400/600` -> 1.5.
 * Returns null when no dimensions can be reliably detected.
 */
export function getImageAspectRatio(image: string): number | null {
  if (!image) return null;

  try {
    const parts = image.split('/').filter(Boolean);
    const nums = parts.map(Number).filter((n) => Number.isInteger(n) && n > 0 && n < 8000);
    if (nums.length >= 2) {
      const [w, h] = [nums[nums.length - 2], nums[nums.length - 1]];
      if (w > 0 && h > 0) return h / w;
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Rendered height of a pin's image for a given column width, preserving the
 * image's real aspect ratio. Falls back to a nominal ratio when unknown.
 */
export function imageHeightFor(pin: Pin, columnWidth: number): number {
  const ratio = getImageAspectRatio(pin.image) ?? DEFAULT_IMAGE_RATIO;
  return Math.round(columnWidth * ratio);
}

/**
 * Splits pins into two height-balanced columns.
 * Balancing uses the image aspect ratio (width-independent), since both
 * columns render at the same width.
 */
export function splitColumns(items: Pin[]) {
  const left: Pin[] = [];
  const right: Pin[] = [];
  let leftH = 0;
  let rightH = 0;

  for (const pin of items) {
    const h = getImageAspectRatio(pin.image) ?? DEFAULT_IMAGE_RATIO;
    if (leftH <= rightH) {
      left.push(pin);
      leftH += h;
    } else {
      right.push(pin);
      rightH += h;
    }
  }
  return { left, right };
}

/**
 * Estimate a card's total rendered height (image + caption).
 * Used to balance the two masonry columns before a real layout pass.
 */
export function estimateCardHeight(pin: Pin): number {
  const imageH = getImageAspectRatio(pin.image) ?? DEFAULT_IMAGE_RATIO;
  const padding = 16; // py-2 (8 top + 8 bottom)
  const titleLines = pin.title.length > 28 ? 2 : 1;
  const titleH = titleLines * 16; // leading-4
  const sourceRow = 18; // favicon + mt-1.5
  const margin = 8; // mb-2
  return Math.round(imageH * 180) + padding + titleH + sourceRow + margin;
}

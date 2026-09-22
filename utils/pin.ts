// utils/pin.ts
import type { Bookmark } from '@/db/schema';
import type { Pin, BookmarkType } from '@/types/bookmarks';

export function bookmarkToPin(b: Bookmark): Pin {
  return {
    id: String(b.id),
    title: b.title,
    description: b.description ?? '',
    source: b.source ?? '',
    favicon: b.favicon ?? '',
    image: b.image ?? '',
    tags: b.tags ? JSON.parse(b.tags) : [],
    type: (b.type ?? 'link') as BookmarkType,
    height: b.height,
  };
}

export function splitColumns(items: Pin[]) {
  const left: Pin[] = [];
  const right: Pin[] = [];
  let leftH = 0;
  let rightH = 0;

  for (const pin of items) {
    if (leftH <= rightH) {
      left.push(pin);
      leftH += pin.height;
    } else {
      right.push(pin);
      rightH += pin.height;
    }
  }
  return { left, right };
}

// splitColumns / estimateCardHeight stay the same

/**
 * Estimate a card's total rendered height (image + caption).
 * Used to balance the two masonry columns.
 */
export function estimateCardHeight(pin: Pin): number {
  const imageH = pin.height;
  const padding = 16; // py-2 (8 top + 8 bottom)
  const titleLines = pin.title.length > 28 ? 2 : 1;
  const titleH = titleLines * 16; // leading-4
  const sourceRow = 18; // favicon + mt-1.5
  const margin = 8; // mb-2
  return imageH + padding + titleH + sourceRow + margin;
}

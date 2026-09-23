export type BookmarkType = 'article' | 'image' | 'link' | 'video';

export type SortKey = 'newest' | 'oldest' | 'unread' | 'favorites';

export type BookmarkQuery = {
  search?: string;
  type?: BookmarkType;
  favorite?: boolean;
  unread?: boolean;
  archived?: boolean;
  /** Exact tag match (stored as a JSON array in the row). */
  tag?: string;
  /** Defaults to 'newest' when omitted. */
  sort?: SortKey;
};

export type Pin = {
  id: number;
  url: string;
  title: string;
  description: string;
  source: string;
  favicon: string;
  image: string;
  imageRatio: number | null;
  tags: string[];
  type: BookmarkType;
  notes: string;
  author: string;
  createdAt: number;
  isFavorite: boolean;
  isArchived: boolean;
  isRead: boolean;
  /** Auto-extracted title; user override is `customTitle` (empty = use this). */
  autoTitle: string;
  /** Auto-extracted description; user override is `customDescription`. */
  autoDescription: string;
};

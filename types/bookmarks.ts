export type BookmarkType = 'article' | 'image' | 'link' | 'video';

export type BookmarkQuery = {
  search?: string;
  type?: BookmarkType;
  favorite?: boolean;
  unread?: boolean;
  archived?: boolean;
};

export type Pin = {
  id: number;
  url: string;
  title: string;
  description: string;
  source: string;
  favicon: string;
  image: string;
  tags: string[];
  type: BookmarkType;
  notes: string;
  author: string;
  createdAt: number;
  isFavorite: boolean;
  isArchived: boolean;
  isRead: boolean;
};

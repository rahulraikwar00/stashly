export type BookmarkType = 'article' | 'image' | 'link' | 'video';

export type Pin = {
  id: string;
  title: string;
  description: string;
  source: string;
  favicon: string;
  image: string;
  tags: string[];
  type: BookmarkType;
};

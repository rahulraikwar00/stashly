export type BookmarkType = "article" | "video" | "image" | "link";

export type Pin = {
  id: string;
  title: string;
  description: string;
  source: string;
  favicon: string;
  image: string;
  tags: string[];
  type: BookmarkType;
  height: number;
};

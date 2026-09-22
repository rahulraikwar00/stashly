import type { AppTheme } from '@/constants/theme';
import type { BookmarkType } from '@/types/bookmarks';

export function typeColor(type: BookmarkType, theme: AppTheme): string {
  switch (type) {
    case 'article':
      return theme.colors.article;
    case 'video':
      return theme.colors.video;
    case 'image':
      return theme.colors.image;
    case 'link':
    default:
      return theme.colors.link;
  }
}

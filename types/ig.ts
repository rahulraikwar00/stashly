// types/ig.ts
// Wire shape returned by the backend's GET /messages/links (docs/03-API-Contract.md §3.3).
// Fields mirror the app's Bookmark row so synced items slot straight into
// NewBookmark with no divergence. `type` is already app-aligned by the backend.

import type { BookmarkType } from './bookmarks';

export type IGMediaType = 'reel' | 'igtv' | 'post' | 'link' | 'text' | (string & {});

/**
 * One ready-to-save bookmark from the backend DM relay. Text-only DMs are
 * dropped by the backend on /messages/links, so every item here carries a URL.
 */
export interface IGBookmark {
  /** Backend DM message id — kept for traceability, not stored. */
  id: string;
  url: string;
  urlHash: string;
  domain: string;
  path: string;
  shortcode: string;
  title: string;
  description: string;
  image: string;
  favicon: string;
  siteName: string;
  author: string;
  publishedAt: number | null;
  language: string;
  type: BookmarkType;
  /** Raw platform media type ('reel' | 'igtv' | 'post' | …). */
  mediaType: IGMediaType;
  tags: string[];
  notes: string;
  isFavorite: boolean;
  isArchived: boolean;
  isRead: boolean;
  customTitle: string;
  /** The sender's merged caption (words, not auto metadata). */
  customDescription: string;
  /** DM sender username. */
  username: string;
  /** Epoch ms. */
  timestamp: number;
}

/**
 * Auth/status result of a link code (GET /auth/status). `status` is
 * 'pending' | 'linked' | 'expired'.
 */
export interface IGCodeStatus {
  code: string;
  status: string;
  linked: boolean;
  username: string;
  threadId: string;
  expiresAt: number | null;
}

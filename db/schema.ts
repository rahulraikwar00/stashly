import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const bookmarks = sqliteTable('bookmarks', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  // ─────────────────────────────────────────────
  // IDENTITY — from the URL
  // ─────────────────────────────────────────────
  url: text('url').notNull(),
  urlHash: text('url_hash').notNull().unique(), // dedup: same URL = same hash
  domain: text('domain').notNull().default(''), // "kinfolk.com"
  path: text('path').notNull().default(''), // "/post/slowness"

  // ─────────────────────────────────────────────
  // METADATA — auto-extracted from the page
  // ─────────────────────────────────────────────
  title: text('title').notNull().default(''),
  description: text('description').notNull().default(''),
  image: text('image').notNull().default(''), // og:image
  favicon: text('favicon').notNull().default(''),
  siteName: text('site_name').notNull().default(''),
  author: text('author').notNull().default(''),
  publishedAt: integer('published_at'), // ms timestamp, nullable
  language: text('language').notNull().default(''),
  type: text('type').notNull().default('link'), // "article" | "image" | "link"

  // ─────────────────────────────────────────────
  // USER INPUT — typed by the user
  // ─────────────────────────────────────────────
  tags: text('tags').notNull().default('[]'), // JSON string
  notes: text('notes').notNull().default(''),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
  isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),

  // User overrides (empty = use auto value)
  customTitle: text('custom_title').notNull().default(''),
  customDescription: text('custom_description').notNull().default(''),

  // ─────────────────────────────────────────────
  // TIMESTAMPS
  // ─────────────────────────────────────────────
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  lastViewedAt: integer('last_viewed_at'), // nullable
  viewCount: integer('view_count').notNull().default(0),
});

// Type inference for your app
export type Bookmark = typeof bookmarks.$inferSelect; // For reading
export type NewBookmark = typeof bookmarks.$inferInsert; // For inserting

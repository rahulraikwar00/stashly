import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const bookmarks = sqliteTable(
  'bookmarks',
  {
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
  },
  (table) => [
    index('bookmarks_created_at_idx').on(table.createdAt),
    index('bookmarks_type_idx').on(table.type),
    index('bookmarks_is_favorite_idx').on(table.isFavorite),
    index('bookmarks_is_archived_idx').on(table.isArchived),
    index('bookmarks_is_read_idx').on(table.isRead),
  ]
);

// ─────────────────────────────────────────────
// SETTINGS — single-row app configuration + profile
// ─────────────────────────────────────────────
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(), // always 1 (get-or-create in the service)

  // ─────────────────────────────────────────────
  // PROFILE
  // ─────────────────────────────────────────────
  displayName: text('display_name').notNull().default(''),
  username: text('username').notNull().default(''),
  email: text('email').notNull().default(''),
  avatarUri: text('avatar_uri').notNull().default(''), // '' = initials circle

  // ─────────────────────────────────────────────
  // PREFERENCES
  // ─────────────────────────────────────────────
  theme: text('theme').notNull().default('system'), // "system" | "light" | "dark"
  defaultStatus: text('default_status').notNull().default('all'), // "all" | "favorites" | "unread" | "archived"

  // ─────────────────────────────────────────────
  // SERVER — reserved for a self-hosted backend (not connected yet)
  // ─────────────────────────────────────────────
  serverUrl: text('server_url').notNull().default(''),
  apiKey: text('api_key').notNull().default(''),

  // ─────────────────────────────────────────────
  // INSTAGRAM SYNC — the 6-digit DM link code bound to this device's thread
  // ─────────────────────────────────────────────
  igCode: text('ig_code').notNull().default(''),

  updatedAt: integer('updated_at').notNull().default(0),
});

export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;

// Type inference for your app
export type Bookmark = typeof bookmarks.$inferSelect; // For reading
export type NewBookmark = typeof bookmarks.$inferInsert; // For inserting

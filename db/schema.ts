import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const bookmarks = sqliteTable('bookmarks', {
  id: integer('id').primaryKey({ autoIncrement: true }), // ← number
  title: text('title').notNull(),
  url: text('url').notNull(),
  description: text('description'),
  image: text('image'),
  favicon: text('favicon'),
  source: text('source'),
  tags: text('tags'), // JSON string
  type: text('type'), // "article" | "video" | ...
  createdAt: integer('created_at').notNull(),
  height: integer('height').notNull().default(220), // ← ADD
});

// Type inference for your app
export type Bookmark = typeof bookmarks.$inferSelect; // For reading
export type NewBookmark = typeof bookmarks.$inferInsert; // For inserting

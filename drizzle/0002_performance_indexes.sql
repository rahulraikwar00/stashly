CREATE INDEX `bookmarks_created_at_idx` ON `bookmarks` (`created_at`);--> statement-breakpoint
CREATE INDEX `bookmarks_type_idx` ON `bookmarks` (`type`);--> statement-breakpoint
CREATE INDEX `bookmarks_is_favorite_idx` ON `bookmarks` (`is_favorite`);--> statement-breakpoint
CREATE INDEX `bookmarks_is_archived_idx` ON `bookmarks` (`is_archived`);--> statement-breakpoint
CREATE INDEX `bookmarks_is_read_idx` ON `bookmarks` (`is_read`);
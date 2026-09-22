DROP TABLE IF EXISTS `bookmarks`;
--> statement-breakpoint
CREATE TABLE `bookmarks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`url` text NOT NULL,
	`url_hash` text NOT NULL,
	`domain` text DEFAULT '' NOT NULL,
	`path` text DEFAULT '' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`image` text DEFAULT '' NOT NULL,
	`favicon` text DEFAULT '' NOT NULL,
	`site_name` text DEFAULT '' NOT NULL,
	`author` text DEFAULT '' NOT NULL,
	`published_at` integer,
	`language` text DEFAULT '' NOT NULL,
	`type` text DEFAULT 'link' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`is_favorite` integer DEFAULT false NOT NULL,
	`is_archived` integer DEFAULT false NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`custom_title` text DEFAULT '' NOT NULL,
	`custom_description` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_viewed_at` integer,
	`view_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookmarks_url_hash_unique` ON `bookmarks` (`url_hash`);
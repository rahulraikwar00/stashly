CREATE TABLE `bookmarks` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`description` text,
	`image` text,
	`favicon` text,
	`source` text,
	`tags` text,
	`type` text,
	`created_at` integer NOT NULL
);

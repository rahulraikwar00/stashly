CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`username` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`avatar_uri` text DEFAULT '' NOT NULL,
	`theme` text DEFAULT 'system' NOT NULL,
	`default_status` text DEFAULT 'all' NOT NULL,
	`server_url` text DEFAULT '' NOT NULL,
	`api_key` text DEFAULT '' NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);

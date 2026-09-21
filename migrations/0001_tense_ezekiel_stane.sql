CREATE TABLE `gmail_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`refresh_token` text NOT NULL,
	`scope` text,
	`connected_at` integer NOT NULL,
	`last_synced_at` integer,
	`last_error` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gmail_connections_by_user_id` ON `gmail_connections` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `gmail_connections_by_email` ON `gmail_connections` (`email`);
CREATE TABLE `recurring_payment_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`recurring_payment_id` text NOT NULL,
	`month` text NOT NULL,
	`amount` real NOT NULL,
	`paid_at` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recurring_payment_checks_by_payment_and_month` ON `recurring_payment_checks` (`recurring_payment_id`,`month`);--> statement-breakpoint
CREATE INDEX `recurring_payment_checks_by_user_and_month` ON `recurring_payment_checks` (`user_id`,`month`);
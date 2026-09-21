CREATE TABLE `auth_account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `auth_account_by_user_id` ON `auth_account` (`user_id`);--> statement-breakpoint
CREATE TABLE `auth_session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_session_by_token` ON `auth_session` (`token`);--> statement-breakpoint
CREATE INDEX `auth_session_by_user_id` ON `auth_session` (`user_id`);--> statement-breakpoint
CREATE TABLE `auth_user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `auth_verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `auth_verification_by_identifier` ON `auth_verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `debt_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`debt_id` text NOT NULL,
	`plan_version` integer NOT NULL,
	`installment_number` integer NOT NULL,
	`amount_paid` real NOT NULL,
	`paid_at` text NOT NULL,
	`request_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `debt_payments_by_debt_id` ON `debt_payments` (`debt_id`);--> statement-breakpoint
CREATE INDEX `debt_payments_by_request_id` ON `debt_payments` (`request_id`);--> statement-breakpoint
CREATE INDEX `debt_payments_by_debt_id_and_plan_version_and_installment` ON `debt_payments` (`debt_id`,`plan_version`,`installment_number`);--> statement-breakpoint
CREATE INDEX `debt_payments_by_debt_id_and_paid_at` ON `debt_payments` (`debt_id`,`paid_at`);--> statement-breakpoint
CREATE TABLE `debt_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`debt_id` text NOT NULL,
	`version` integer NOT NULL,
	`principal_at_start` real NOT NULL,
	`installments_total` integer NOT NULL,
	`installment_amount` real NOT NULL,
	`start_month` text NOT NULL,
	`next_installment_number` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `debt_plans_by_debt_id` ON `debt_plans` (`debt_id`);--> statement-breakpoint
CREATE INDEX `debt_plans_by_debt_id_and_version` ON `debt_plans` (`debt_id`,`version`);--> statement-breakpoint
CREATE INDEX `debt_plans_by_debt_id_and_status` ON `debt_plans` (`debt_id`,`status`);--> statement-breakpoint
CREATE TABLE `debts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`lender` text NOT NULL,
	`type` text NOT NULL,
	`currency` text NOT NULL,
	`balance` real NOT NULL,
	`rate` real NOT NULL,
	`payments` integer NOT NULL,
	`payment_mode` text,
	`remaining_installments` integer,
	`minimum_payment` real,
	`target_payment` real,
	`due_day` integer,
	`due_date` text NOT NULL,
	`original_balance` real,
	`current_plan_version` integer,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `debts_by_user_id` ON `debts` (`user_id`);--> statement-breakpoint
CREATE INDEX `debts_by_user_id_and_status` ON `debts` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `debts_by_user_id_and_due_date` ON `debts` (`user_id`,`due_date`);--> statement-breakpoint
CREATE TABLE `email_expense_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`user_email` text NOT NULL,
	`provider` text NOT NULL,
	`email_id` text NOT NULL,
	`message_id` text,
	`from_address` text,
	`to_addresses` text NOT NULL,
	`subject` text,
	`text_snippet` text,
	`html_snippet` text,
	`merchant` text,
	`amount` real,
	`currency` text,
	`spent_at` text,
	`occurred_at` text,
	`source` text,
	`category` text,
	`dedupe_key` text,
	`status` text NOT NULL,
	`error` text,
	`confirmed_expense_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `email_imports_by_email_id` ON `email_expense_imports` (`email_id`);--> statement-breakpoint
CREATE INDEX `email_imports_by_message_id` ON `email_expense_imports` (`message_id`);--> statement-breakpoint
CREATE INDEX `email_imports_by_dedupe_key` ON `email_expense_imports` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `email_imports_by_user_id_and_status` ON `email_expense_imports` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `email_imports_by_user_email_and_status` ON `email_expense_imports` (`user_email`,`status`);--> statement-breakpoint
CREATE INDEX `email_imports_by_user_id_and_created_at` ON `email_expense_imports` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`merchant` text,
	`spent_at` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `expenses_by_user_id` ON `expenses` (`user_id`);--> statement-breakpoint
CREATE INDEX `expenses_by_user_id_and_spent_at` ON `expenses` (`user_id`,`spent_at`);--> statement-breakpoint
CREATE INDEX `expenses_by_user_id_and_category` ON `expenses` (`user_id`,`category`);--> statement-breakpoint
CREATE TABLE `gmail_sync_states` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`history_id` text,
	`watch_expiration` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gmail_sync_states_by_user_email` ON `gmail_sync_states` (`user_email`);--> statement-breakpoint
CREATE TABLE `recurring_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`currency` text NOT NULL,
	`amount` real NOT NULL,
	`cadence` text NOT NULL,
	`due_day` integer NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `recurring_payments_by_user_id` ON `recurring_payments` (`user_id`);--> statement-breakpoint
CREATE INDEX `recurring_payments_by_user_id_and_status` ON `recurring_payments` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `recurring_payments_by_user_id_and_due_day` ON `recurring_payments` (`user_id`,`due_day`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`currency` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_by_email` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_by_created_at` ON `users` (`created_at`);
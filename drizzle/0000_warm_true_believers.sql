CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`account_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`scope` text,
	`token_type` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `app_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_users_email_unique` ON `app_users` (`email`);--> statement-breakpoint
CREATE TABLE `audit_trail` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`old_value` text,
	`new_value` text,
	`ip_address` text,
	`user_agent` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_user` ON `audit_trail` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_entity` ON `audit_trail` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_time` ON `audit_trail` (`created_at`);--> statement-breakpoint
CREATE TABLE `credit_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`type` text NOT NULL,
	`description` text,
	`metadata` text,
	`expires_at` integer,
	`consumed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_credit_transactions_user_expires` ON `credit_transactions` (`user_id`,`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_credit_transactions_user_created` ON `credit_transactions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `daily_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`usage_date` integer NOT NULL,
	`credits_consumed` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_daily_usage_user_date` ON `daily_usage` (`user_id`,`usage_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_user_date` ON `daily_usage` (`user_id`,`usage_date`);--> statement-breakpoint
CREATE TABLE `flow_run_step_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`step_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`status` text DEFAULT 'done' NOT NULL,
	`temperature` integer,
	`model` text,
	`prompt` text,
	`meta` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `flow_run_steps` (
	`run_id` text NOT NULL,
	`step_id` text NOT NULL,
	`r2_key` text,
	`duration_ms` integer,
	`model` text,
	`prompt` text,
	`temperature` integer,
	`error` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `flow_runs` (
	`run_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`slug` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`error` text,
	`public` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `generations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`self_original_key` text,
	`character_original_key` text,
	`intermediate_key` text,
	`final_key` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invite_code_redemptions` (
	`id` text PRIMARY KEY NOT NULL,
	`code_id` text NOT NULL,
	`user_id` text NOT NULL,
	`redeemed_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`metadata` text,
	FOREIGN KEY (`code_id`) REFERENCES `invite_codes`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_redemptions_user` ON `invite_code_redemptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_redemptions_code` ON `invite_code_redemptions` (`code_id`);--> statement-breakpoint
CREATE INDEX `idx_redemptions_date` ON `invite_code_redemptions` (`redeemed_at`);--> statement-breakpoint
CREATE TABLE `invite_codes` (
	`code` text PRIMARY KEY NOT NULL,
	`created_by_admin_id` text NOT NULL,
	`credits_value` integer NOT NULL,
	`credits_expires_at` integer,
	`max_uses` integer DEFAULT 1 NOT NULL,
	`current_uses` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`metadata` text,
	`used_by_user_id` text,
	`used_at` integer,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by_admin_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_invite_codes_expires` ON `invite_codes` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_invite_codes_admin` ON `invite_codes` (`created_by_admin_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text,
	`token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`credits` integer DEFAULT 0 NOT NULL,
	`has_google_api_key` integer DEFAULT false NOT NULL,
	`daily_limit` integer DEFAULT 100 NOT NULL,
	`signup_bonus_claimed` integer DEFAULT false NOT NULL,
	`role` text DEFAULT 'free_user' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `verification_identifier_unique` ON `verification` (`identifier`);
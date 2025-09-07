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
CREATE TABLE `credit_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`type` text NOT NULL,
	`description` text,
	`metadata` text,
	`expires_at` integer,
	`consumed_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `daily_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`usage_date` integer NOT NULL,
	`credits_consumed` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE `invite_codes` (
	`code` text PRIMARY KEY NOT NULL,
	`created_by_admin_id` text NOT NULL,
	`credits_value` integer NOT NULL,
	`credits_expires_at` integer,
	`used_by_user_id` text,
	`used_at` integer,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
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
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`credits` integer DEFAULT 0 NOT NULL,
	`has_google_api_key` integer DEFAULT false NOT NULL,
	`daily_limit` integer DEFAULT 100 NOT NULL,
	`signup_bonus_claimed` integer DEFAULT false NOT NULL,
	`role` text DEFAULT 'free_user' NOT NULL
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
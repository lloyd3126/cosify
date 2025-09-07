PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_daily_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`usage_date` text NOT NULL,
	`credits_consumed` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_daily_usage`("id", "user_id", "usage_date", "credits_consumed", "created_at") SELECT "id", "user_id", "usage_date", "credits_consumed", "created_at" FROM `daily_usage`;--> statement-breakpoint
DROP TABLE `daily_usage`;--> statement-breakpoint
ALTER TABLE `__new_daily_usage` RENAME TO `daily_usage`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `credit_transactions` DROP COLUMN `consumed_at`;
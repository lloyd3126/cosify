import { sqliteTable, text, integer, index, unique, foreignKey, check } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Rename legacy users table to avoid collision with Better Auth tables
export const appUsers = sqliteTable("app_users", {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name"),
    image: text("image"),
    createdAt: integer("created_at", { mode: "timestamp" })
        .$defaultFn(() => new Date())
        .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
        .$defaultFn(() => new Date())
        .$onUpdate(() => new Date())
        .notNull(),
}, (table) => {
    return {
        // Index for efficient email lookups
        emailIdx: index("idx_app_users_email").on(table.email),
        // Index for time-based queries
        createdAtIdx: index("idx_app_users_created").on(table.createdAt),
    };
});

export const generations = sqliteTable("generations", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    selfOriginalKey: text("self_original_key"),
    characterOriginalKey: text("character_original_key"),
    intermediateKey: text("intermediate_key"),
    finalKey: text("final_key"),
    status: text("status").notNull().default("pending"),
    error: text("error"),
    createdAt: integer("created_at", { mode: "timestamp" })
        .$defaultFn(() => new Date())
        .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
        .$defaultFn(() => new Date())
        .$onUpdate(() => new Date())
        .notNull(),
}, (table) => {
    return {
        // Foreign key constraint to users table
        userFK: foreignKey({
            columns: [table.userId],
            foreignColumns: [users.id],
            name: "fk_generations_user_id"
        }).onDelete("cascade"),
        // Index for user-based queries
        userIdIdx: index("idx_generations_user_id").on(table.userId),
        // Index for status-based queries
        statusIdx: index("idx_generations_status").on(table.status),
        // Index for time-based queries
        createdAtIdx: index("idx_generations_created").on(table.createdAt),
        // Compound index for user + status queries
        userStatusIdx: index("idx_generations_user_status").on(table.userId, table.status),
    };
});

export type AppUser = typeof appUsers.$inferSelect;
export type Generation = typeof generations.$inferSelect;

// Better Auth required tables (SQLite)
// names must be exactly: users, accounts, sessions, verification

export const users = sqliteTable("users", {
    id: text("id").primaryKey(),
    name: text("name"),
    email: text("email").notNull().unique(),
    emailVerified: integer("email_verified", { mode: "boolean" })
        .notNull()
        .default(false),
    image: text("image"),
    // Plan 8: Credit system fields
    credits: integer("credits").notNull().default(0),
    hasGoogleApiKey: integer("has_google_api_key", { mode: "boolean" })
        .notNull()
        .default(false),
    dailyLimit: integer("daily_limit").notNull().default(100),
    signupBonusClaimed: integer("signup_bonus_claimed", { mode: "boolean" })
        .notNull()
        .default(false),
    role: text("role").notNull().default("free_user").$type<'super_admin' | 'admin' | 'free_user'>(), // Typed role enum
    createdAt: integer("created_at", { mode: "timestamp" })
        .$defaultFn(() => new Date())
        .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
        .$defaultFn(() => new Date())
        .$onUpdate(() => new Date())
        .notNull(),
}, (table) => {
    return {
        // Index for efficient email lookups (critical for authentication)
        emailIdx: index("idx_users_email").on(table.email),
        // Index for role-based queries
        roleIdx: index("idx_users_role").on(table.role),
        // Index for credit balance queries
        creditsIdx: index("idx_users_credits").on(table.credits),
        // Index for time-based queries
        createdAtIdx: index("idx_users_created").on(table.createdAt),
        // Check constraint for valid role values
        roleCheck: check("chk_users_role", sql`role IN ('super_admin', 'admin', 'free_user')`),
        // Check constraint for non-negative credits
        creditsCheck: check("chk_users_credits", sql`credits >= 0`),
        // Check constraint for positive daily limit
        dailyLimitCheck: check("chk_users_daily_limit", sql`daily_limit > 0`),
    };
});

export const accounts = sqliteTable("accounts", {
    id: text("id").primaryKey(),
    providerId: text("provider_id").notNull(),
    accountId: text("account_id").notNull(),
    userId: text("user_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
        mode: "timestamp",
    }),
    scope: text("scope"),
    tokenType: text("token_type"),
    createdAt: integer("created_at", { mode: "timestamp" })
        .$defaultFn(() => new Date())
        .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
        .$defaultFn(() => new Date())
        .$onUpdate(() => new Date())
        .notNull(),
}, (table) => {
    return {
        // Foreign key constraint to users table
        userFK: foreignKey({
            columns: [table.userId],
            foreignColumns: [users.id],
            name: "fk_accounts_user_id"
        }).onDelete("cascade"),
        // Index for user-based account queries
        userIdIdx: index("idx_accounts_user_id").on(table.userId),
        // Index for provider-based queries
        providerIdx: index("idx_accounts_provider").on(table.providerId),
        // Compound index for provider + account lookup
        providerAccountIdx: index("idx_accounts_provider_account").on(table.providerId, table.accountId),
        // Unique constraint for provider + account combination
        providerAccountUnique: unique("unique_provider_account").on(table.providerId, table.accountId),
    };
});

export const sessions = sqliteTable("sessions", {
    // Better Auth expects an `id` field present on the session model
    id: text("id"),
    token: text("token").primaryKey(),
    userId: text("user_id").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp" })
        .$defaultFn(() => new Date())
        .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
        .$defaultFn(() => new Date())
        .$onUpdate(() => new Date())
        .notNull(),
}, (table) => {
    return {
        // Foreign key constraint to users table
        userFK: foreignKey({
            columns: [table.userId],
            foreignColumns: [users.id],
            name: "fk_sessions_user_id"
        }).onDelete("cascade"),
        // Index for user-based session queries
        userIdIdx: index("idx_sessions_user_id").on(table.userId),
        // Index for expiry-based cleanup queries
        expiresAtIdx: index("idx_sessions_expires").on(table.expiresAt),
        // Compound index for active session queries
        userExpiryIdx: index("idx_sessions_user_expires").on(table.userId, table.expiresAt),
    };
});

export const verification = sqliteTable("verification", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull().unique(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
        .$defaultFn(() => new Date())
        .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
        .$defaultFn(() => new Date())
        .$onUpdate(() => new Date())
        .notNull(),
}, (table) => {
    return {
        // Index for identifier-based lookups
        identifierIdx: index("idx_verification_identifier").on(table.identifier),
        // Index for expiry-based cleanup queries
        expiresAtIdx: index("idx_verification_expires").on(table.expiresAt),
    };
});

export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Verification = typeof verification.$inferSelect;

// Flows 歷史：run 與 step
export const flowRuns = sqliteTable("flow_runs", {
    runId: text("run_id").primaryKey(),
    userId: text("user_id").notNull(),
    slug: text("slug").notNull(),
    status: text("status").notNull().default("active"),
    error: text("error"),
    public: integer("public", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
        .$defaultFn(() => new Date())
        .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
        .$defaultFn(() => new Date())
        .$onUpdate(() => new Date())
        .notNull(),
}, (table) => {
    return {
        // Foreign key constraint to users table
        userFK: foreignKey({
            columns: [table.userId],
            foreignColumns: [users.id],
            name: "fk_flow_runs_user_id"
        }).onDelete("cascade"),
        // Index for user-based flow queries
        userIdIdx: index("idx_flow_runs_user_id").on(table.userId),
        // Index for slug-based queries
        slugIdx: index("idx_flow_runs_slug").on(table.slug),
        // Index for status-based queries
        statusIdx: index("idx_flow_runs_status").on(table.status),
        // Index for public flow queries
        publicIdx: index("idx_flow_runs_public").on(table.public),
        // Compound index for user + status queries
        userStatusIdx: index("idx_flow_runs_user_status").on(table.userId, table.status),
        // Index for time-based queries
        createdAtIdx: index("idx_flow_runs_created").on(table.createdAt),
        // Check constraint for valid status values
        statusCheck: check("chk_flow_runs_status", sql`status IN ('active', 'completed', 'failed', 'cancelled')`),
    };
});

export const flowRunSteps = sqliteTable("flow_run_steps", {
    // 複合主鍵以 runId+stepId 表示一次執行的單步結果
    runId: text("run_id").notNull(),
    stepId: text("step_id").notNull(),
    r2Key: text("r2_key"),
    durationMs: integer("duration_ms"),
    model: text("model"),
    prompt: text("prompt"),
    temperature: integer("temperature"),
    error: text("error"),
    createdAt: integer("created_at", { mode: "timestamp" })
        .$defaultFn(() => new Date())
        .notNull(),
}, (table) => {
    return {
        // Composite primary key
        pk: unique("pk_flow_run_steps").on(table.runId, table.stepId),
        // Foreign key constraint to flowRuns table
        runFK: foreignKey({
            columns: [table.runId],
            foreignColumns: [flowRuns.runId],
            name: "fk_flow_run_steps_run_id"
        }).onDelete("cascade"),
        // Index for run-based step queries
        runIdIdx: index("idx_flow_run_steps_run_id").on(table.runId),
        // Index for time-based queries
        createdAtIdx: index("idx_flow_run_steps_created").on(table.createdAt),
        // Index for duration-based performance queries
        durationIdx: index("idx_flow_run_steps_duration").on(table.durationMs),
        // Check constraint for non-negative duration
        durationCheck: check("chk_flow_run_steps_duration", sql`duration_ms IS NULL OR duration_ms >= 0`),
        // Check constraint for valid temperature range
        temperatureCheck: check("chk_flow_run_steps_temperature", sql`temperature IS NULL OR (temperature >= 0 AND temperature <= 100)`),
    };
});

export type FlowRun = typeof flowRuns.$inferSelect;
export type FlowRunStep = typeof flowRunSteps.$inferSelect;

// 歷史候選資產（每張變體一列）
export const flowRunStepAssets = sqliteTable("flow_run_step_assets", {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    stepId: text("step_id").notNull(),
    r2Key: text("r2_key").notNull(),
    status: text("status").notNull().default("done"), // 'done' | 'error'（目前僅 done 落庫）
    temperature: integer("temperature"),
    model: text("model"),
    prompt: text("prompt"),
    meta: text("meta"), // JSON 字串（可選）
    createdAt: integer("created_at", { mode: "timestamp" })
        .$defaultFn(() => new Date())
        .notNull(),
}, (table) => {
    return {
        // Foreign key constraint to flowRuns table
        runFK: foreignKey({
            columns: [table.runId],
            foreignColumns: [flowRuns.runId],
            name: "fk_flow_run_step_assets_run_id"
        }).onDelete("cascade"),
        // Index for run + step based queries
        runStepIdx: index("idx_flow_run_step_assets_run_step").on(table.runId, table.stepId),
        // Index for status-based queries
        statusIdx: index("idx_flow_run_step_assets_status").on(table.status),
        // Index for time-based queries
        createdAtIdx: index("idx_flow_run_step_assets_created").on(table.createdAt),
        // Check constraint for valid status values
        statusCheck: check("chk_flow_run_step_assets_status", sql`status IN ('done', 'error')`),
        // Check constraint for valid temperature range
        temperatureCheck: check("chk_flow_run_step_assets_temperature", sql`temperature IS NULL OR (temperature >= 0 AND temperature <= 100)`),
    };
});

export type FlowRunStepAsset = typeof flowRunStepAssets.$inferSelect;

// Plan 8: Credit System Tables
// These tables extend the existing schema to support the credit system

// Credit transactions for tracking all credit operations
export const creditTransactions = sqliteTable("credit_transactions", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    amount: integer("amount").notNull(),
    type: text("type").notNull().$type<'purchase' | 'signup_bonus' | 'invite_code' | 'consumption' | 'admin_adjustment'>(),
    description: text("description"),
    metadata: text("metadata"), // JSON string for additional data
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    consumedAt: integer("consumed_at", { mode: "timestamp" }), // Track when credits were consumed
    createdAt: integer("created_at", { mode: "timestamp" })
        .$defaultFn(() => new Date())
        .notNull(),
}, (table) => {
    return {
        // Foreign key constraint with cascade delete
        userFK: foreignKey({
            columns: [table.userId],
            foreignColumns: [users.id],
            name: "fk_credit_transactions_user_id"
        }).onDelete("cascade"),
        // Index for FIFO credit consumption queries (critical for performance)
        userExpiryIdx: index("idx_credit_transactions_user_expires").on(table.userId, table.expiresAt),
        // Index for user transaction history
        userCreatedIdx: index("idx_credit_transactions_user_created").on(table.userId, table.createdAt),
        // Index for type-based queries
        typeIdx: index("idx_credit_transactions_type").on(table.type),
        // Index for consumed credits tracking
        consumedAtIdx: index("idx_credit_transactions_consumed").on(table.consumedAt),
        // Compound index for active credit queries
        userActiveIdx: index("idx_credit_transactions_user_active").on(table.userId, table.consumedAt, table.expiresAt),
        // Check constraint for transaction amount rules
        amountCheck: check("chk_credit_transactions_amount",
            sql`(type IN ('purchase', 'signup_bonus', 'invite_code', 'admin_adjustment') AND amount > 0) OR 
                (type = 'consumption' AND amount < 0)`),
        // Check constraint for valid transaction types
        typeCheck: check("chk_credit_transactions_type",
            sql`type IN ('purchase', 'signup_bonus', 'invite_code', 'consumption', 'admin_adjustment')`),
        // Check constraint for expiry logic
        expiryCheck: check("chk_credit_transactions_expiry",
            sql`(type = 'consumption' AND expires_at IS NULL) OR 
                (type != 'consumption' AND expires_at IS NOT NULL)`),
    };
});

// Daily usage tracking for enforcing daily limits
export const dailyUsage = sqliteTable("daily_usage", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    usageDate: integer("usage_date", { mode: "timestamp" }).notNull(),
    creditsConsumed: integer("credits_consumed").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
        .$defaultFn(() => new Date())
        .notNull(),
}, (table) => {
    return {
        // Foreign key constraint with cascade delete
        userFK: foreignKey({
            columns: [table.userId],
            foreignColumns: [users.id],
            name: "fk_daily_usage_user_id"
        }).onDelete("cascade"),
        // Ensure one record per user per day (critical business constraint)
        userDateUnique: unique("unique_user_date").on(table.userId, table.usageDate),
        // Index for efficient daily usage queries (hot path)
        userDateIdx: index("idx_daily_usage_user_date").on(table.userId, table.usageDate),
        // Index for date-based cleanup queries
        dateIdx: index("idx_daily_usage_date").on(table.usageDate),
        // Check constraint for non-negative credits consumed
        creditsConsumedCheck: check("chk_daily_usage_credits", sql`credits_consumed >= 0`),
    }
});

// Invite codes for admin-generated credit distribution
export const inviteCodes = sqliteTable("invite_codes", {
    code: text("code").primaryKey(), // 保持原有的主鍵結構
    createdByAdminId: text("created_by_admin_id").notNull().references(() => users.id),
    creditsValue: integer("credits_value").notNull(),
    creditsExpiresAt: integer("credits_expires_at", { mode: "timestamp" }),
    maxUses: integer("max_uses").notNull().default(1),
    currentUses: integer("current_uses").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    metadata: text("metadata"), // JSON string for additional data
    usedByUserId: text("used_by_user_id"), // 保持與現有架構的兼容性
    usedAt: integer("used_at", { mode: "timestamp" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
        .$defaultFn(() => new Date())
        .notNull(),
}, (table) => {
    return {
        // Foreign key constraint to admin users (restrict delete)
        adminFK: foreignKey({
            columns: [table.createdByAdminId],
            foreignColumns: [users.id],
            name: "fk_invite_codes_admin_id"
        }).onDelete("restrict"), // Don't allow admin deletion if they have invite codes
        // Foreign key constraint for used by user (set null on delete)
        usedByFK: foreignKey({
            columns: [table.usedByUserId],
            foreignColumns: [users.id],
            name: "fk_invite_codes_used_by_user_id"
        }).onDelete("set null"),
        // Index for expired codes cleanup (critical for maintenance)
        expiryIdx: index("idx_invite_codes_expires").on(table.expiresAt),
        // Index for admin management queries
        adminIdx: index("idx_invite_codes_admin").on(table.createdByAdminId),
        // Index for active codes queries
        activeIdx: index("idx_invite_codes_active").on(table.isActive),
        // Index for usage tracking
        usageIdx: index("idx_invite_codes_usage").on(table.currentUses, table.maxUses),
        // Check constraint for positive credits value
        creditsValueCheck: check("chk_invite_codes_credits", sql`credits_value > 0`),
        // Check constraint for valid usage counts
        usageCheck: check("chk_invite_codes_usage", sql`current_uses >= 0 AND current_uses <= max_uses`),
        // Check constraint for positive max uses
        maxUsesCheck: check("chk_invite_codes_max_uses", sql`max_uses > 0`),
        // Check constraint for used logic consistency
        usedLogicCheck: check("chk_invite_codes_used_logic",
            sql`(used_by_user_id IS NULL AND used_at IS NULL) OR 
                (used_by_user_id IS NOT NULL AND used_at IS NOT NULL)`),
    }
});

// Invite code redemptions for tracking usage
export const inviteCodeRedemptions = sqliteTable("invite_code_redemptions", {
    id: text("id").primaryKey(),
    codeId: text("code_id").notNull().references(() => inviteCodes.code), // 引用 code 而不是 id
    userId: text("user_id").notNull().references(() => users.id),
    redeemedAt: integer("redeemed_at", { mode: "timestamp" })
        .$defaultFn(() => new Date())
        .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    metadata: text("metadata"), // JSON string for additional redemption data
}, (table) => {
    return {
        // Foreign key constraint to invite codes (restrict delete)
        codeFK: foreignKey({
            columns: [table.codeId],
            foreignColumns: [inviteCodes.code],
            name: "fk_invite_code_redemptions_code_id"
        }).onDelete("restrict"), // Preserve redemption history
        // Foreign key constraint to users (cascade delete)
        userFK: foreignKey({
            columns: [table.userId],
            foreignColumns: [users.id],
            name: "fk_invite_code_redemptions_user_id"
        }).onDelete("cascade"),
        // Index for user redemption history
        userIdx: index("idx_redemptions_user").on(table.userId),
        // Index for code usage tracking
        codeIdx: index("idx_redemptions_code").on(table.codeId),
        // Index for cleanup and analytics queries
        dateIdx: index("idx_redemptions_date").on(table.redeemedAt),
        // Compound index for code + user uniqueness checks
        codeUserIdx: index("idx_redemptions_code_user").on(table.codeId, table.userId),
        // Ensure a user can only redeem the same code once
        codeUserUnique: unique("unique_code_user_redemption").on(table.codeId, table.userId),
    }
});

// System audit trail for AdminService
export const auditTrail = sqliteTable("audit_trail", {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id), // Who performed the action
    action: text("action").notNull(), // What action was performed
    entityType: text("entity_type").notNull(), // What type of entity was affected
    entityId: text("entity_id"), // ID of the affected entity
    oldValue: text("old_value"), // JSON string of old values
    newValue: text("new_value"), // JSON string of new values
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    metadata: text("metadata"), // JSON string for additional context
    createdAt: integer("created_at", { mode: "timestamp" })
        .$defaultFn(() => new Date())
        .notNull(),
}, (table) => {
    return {
        // Foreign key constraint to users (set null on delete to preserve audit history)
        userFK: foreignKey({
            columns: [table.userId],
            foreignColumns: [users.id],
            name: "fk_audit_trail_user_id"
        }).onDelete("set null"), // Preserve audit history even if user is deleted
        // Index for user activity tracking
        userIdx: index("idx_audit_user").on(table.userId),
        // Index for entity tracking (critical for compliance)
        entityIdx: index("idx_audit_entity").on(table.entityType, table.entityId),
        // Index for time-based queries (for compliance and reporting)
        timeIdx: index("idx_audit_time").on(table.createdAt),
        // Index for action-based queries
        actionIdx: index("idx_audit_action").on(table.action),
        // Compound index for entity change tracking
        entityTimeIdx: index("idx_audit_entity_time").on(table.entityType, table.entityId, table.createdAt),
        // Compound index for user activity analysis
        userTimeIdx: index("idx_audit_user_time").on(table.userId, table.createdAt),
        // Check constraint for required fields
        requiredFieldsCheck: check("chk_audit_required",
            sql`action IS NOT NULL AND entity_type IS NOT NULL`),
    }
});

export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type DailyUsage = typeof dailyUsage.$inferSelect;
export type InviteCode = typeof inviteCodes.$inferSelect;
export type InviteCodeRedemption = typeof inviteCodeRedemptions.$inferSelect;
export type AuditTrail = typeof auditTrail.$inferSelect;

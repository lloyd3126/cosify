import { sqliteTable, text, integer, index, unique } from "drizzle-orm/sqlite-core";

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
        // Index for FIFO credit consumption queries
        userExpiryIdx: index("idx_credit_transactions_user_expires").on(table.userId, table.expiresAt),
        // Index for user transaction history
        userCreatedIdx: index("idx_credit_transactions_user_created").on(table.userId, table.createdAt),
    }
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
        // Ensure one record per user per day
        userDateUnique: unique("unique_user_date").on(table.userId, table.usageDate),
        // Index for efficient daily usage queries
        userDateIdx: index("idx_daily_usage_user_date").on(table.userId, table.usageDate),
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
        // Index for expired codes cleanup
        expiryIdx: index("idx_invite_codes_expires").on(table.expiresAt),
        // Index for admin management queries
        adminIdx: index("idx_invite_codes_admin").on(table.createdByAdminId),
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
        // Index for user redemption history
        userIdx: index("idx_redemptions_user").on(table.userId),
        // Index for code usage tracking
        codeIdx: index("idx_redemptions_code").on(table.codeId),
        // Index for cleanup queries
        dateIdx: index("idx_redemptions_date").on(table.redeemedAt),
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
        // Index for user activity tracking
        userIdx: index("idx_audit_user").on(table.userId),
        // Index for entity tracking
        entityIdx: index("idx_audit_entity").on(table.entityType, table.entityId),
        // Index for time-based queries
        timeIdx: index("idx_audit_time").on(table.createdAt),
    }
});

export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type DailyUsage = typeof dailyUsage.$inferSelect;
export type InviteCode = typeof inviteCodes.$inferSelect;
export type InviteCodeRedemption = typeof inviteCodeRedemptions.$inferSelect;
export type AuditTrail = typeof auditTrail.$inferSelect;

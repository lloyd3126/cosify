import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

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
    createdAt: integer("created_at", { mode: "timestamp" })
        .$defaultFn(() => new Date())
        .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
        .$defaultFn(() => new Date())
        .$onUpdate(() => new Date())
        .notNull(),
    // Plan 8: 點數系統欄位
    credits: integer("credits").default(0).notNull(),
    hasGoogleApiKey: integer("has_google_api_key", { mode: "boolean" }).default(false).notNull(),
    dailyLimit: integer("daily_limit").default(100).notNull(),
    signupBonusClaimed: integer("signup_bonus_claimed", { mode: "boolean" }).default(false).notNull(),
    role: text("role", { enum: ["super_admin", "admin", "free_user"] }).default("free_user").notNull(),
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

// Plan 8: 點數系統表格

// 點數交易記錄
export const creditTransactions = sqliteTable("credit_transactions", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    amount: integer("amount").notNull(),
    type: text("type", { 
        enum: ["purchase", "signup_bonus", "invite_code", "consumption", "admin_adjustment"] 
    }).notNull(),
    description: text("description"),
    metadata: text("metadata"), // JSON 字串
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
        .$defaultFn(() => new Date())
        .notNull(),
});

// 每日使用追蹤
export const dailyUsage = sqliteTable("daily_usage", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    usageDate: text("usage_date").notNull(), // YYYY-MM-DD 格式
    creditsConsumed: integer("credits_consumed").default(0).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
        .$defaultFn(() => new Date())
        .notNull(),
});

// 邀請碼管理
export const inviteCodes = sqliteTable("invite_codes", {
    code: text("code").primaryKey(),
    createdByAdminId: text("created_by_admin_id").notNull(),
    creditsValue: integer("credits_value").notNull(),
    creditsExpiresAt: integer("credits_expires_at", { mode: "timestamp" }),
    usedByUserId: text("used_by_user_id"),
    usedAt: integer("used_at", { mode: "timestamp" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
        .$defaultFn(() => new Date())
        .notNull(),
});

export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type DailyUsage = typeof dailyUsage.$inferSelect;
export type InviteCode = typeof inviteCodes.$inferSelect;

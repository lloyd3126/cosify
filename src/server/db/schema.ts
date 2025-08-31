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

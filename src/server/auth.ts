import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, schema } from "./db";
// no direct provider factory import needed; configure via socialProviders options

export const auth = betterAuth({
    // Database adapter (SQLite via Drizzle)
    database: drizzleAdapter(db, {
        provider: "sqlite",
        // Better Auth expects singular model keys in the schema object
        schema: {
            user: schema.users,
            account: schema.accounts,
            session: schema.sessions,
            verification: schema.verification,
        },
    }),

    // Only Google login
    emailAndPassword: { enabled: false },
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            // 使用預設 scope: openid email profile；不啟用 refresh token
        },
    },

    // Session and cookies
    session: {
        // 設定 session 期限（秒）。此為最大有效期；
        // 若搭配 updateAge，會在靠近到期時自動 refresh。
        // 近似需求：idle 7d + absolute 30d
        // - expiresIn: 30d
        // - updateAge: 7d（在 7 天後觸發刷新）
        // 注意：目前 better-auth 無「硬性 absolute 上限」設定，若要嚴格 30 天上限需自訂檢查。
        expiresIn: 60 * 60 * 24 * 30,
        updateAge: 60 * 60 * 24 * 7,
        // 可選：快取 cookie 以減少讀取
        // cookieCache: { enabled: true },
    },

    // Cookies policy
    advanced: {
        cookiePrefix: "cosify_",
        useSecureCookies: process.env.NODE_ENV === "production",
        defaultCookieAttributes: {
            sameSite: "lax",
        },
    },

    // Base URL（用於建構 OAuth callback 等）與錯誤頁
    urls: {
        // Must point to the auth router mount (e.g. https://host/api/auth)
        baseURL:
            process.env.BETTER_AUTH_URL ||
            (process.env.VERCEL_URL
                ? `https://${process.env.VERCEL_URL}/api/auth`
                : `http://localhost:3000/api/auth`),
    },
    onAPIError: {
        errorURL: "/auth/error",
    },
});

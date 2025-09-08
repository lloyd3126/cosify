/**
 * 測試資料庫配置
 * 確保測試環境與正式環境完全隔離
 * 
 * 🛡️ 安全原則：
 * - 永遠不要在測試中使用正式資料庫
 * - 為每個測試套件建立獨立的測試資料庫
 * - 測試結束後自動清理測試資料
 */

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import * as schema from '../../src/server/db/schema'

export interface TestDbConfig {
    testName: string
    migrationsPath?: string
}

/**
 * 建立測試資料庫
 */
export function createTestDatabase(config: TestDbConfig) {
    const testDbPath = join('.data', `test-${config.testName}-${Date.now()}.sqlite`)

    // 確保測試不會意外使用正式資料庫
    if (testDbPath.includes('app.sqlite')) {
        throw new Error('🚨 SECURITY: 禁止在測試中使用正式資料庫！')
    }

    const sqliteDb = new Database(testDbPath)
    const db = drizzle(sqliteDb, { schema })

    // 執行遷移
    if (config.migrationsPath) {
        migrate(db, { migrationsFolder: config.migrationsPath })
    }

    return {
        db,
        sqliteDb,
        testDbPath,
        cleanup: () => {
            try {
                sqliteDb.close()
                if (existsSync(testDbPath)) {
                    unlinkSync(testDbPath)
                }
            } catch (error) {
                console.warn(`清理測試資料庫失敗: ${testDbPath}`, error)
            }
        }
    }
}

/**
 * 記憶體測試資料庫（更快，適合單元測試）
 */
export function createInMemoryTestDatabase() {
    const sqliteDb = new Database(':memory:')
    const db = drizzle(sqliteDb, { schema })

    return {
        db,
        sqliteDb,
        cleanup: () => {
            try {
                sqliteDb.close()
            } catch (error) {
                console.warn('清理記憶體資料庫失敗', error)
            }
        }
    }
}

/**
 * 測試資料工廠
 */
export const TestDataFactory = {
    createUser: (overrides?: Partial<typeof schema.users.$inferInsert>) => ({
        id: `test-user-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        email: `test-${Date.now()}@example.com`,
        name: 'Test User',
        role: 'free_user' as const,
        credits: 100,
        dailyLimit: 50,
        ...overrides
    }),

    createAdmin: (overrides?: Partial<typeof schema.users.$inferInsert>) => ({
        id: `test-admin-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        email: `admin-${Date.now()}@example.com`,
        name: 'Test Admin',
        role: 'admin' as const,
        credits: 1000,
        dailyLimit: 500,
        ...overrides
    }),

    createInviteCode: (adminId: string, overrides?: Partial<typeof schema.inviteCodes.$inferInsert>) => ({
        code: `TEST-${Date.now().toString(36).toUpperCase()}`,
        createdByAdminId: adminId,
        creditsValue: 50,
        creditsExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        ...overrides
    }),

    createCreditTransaction: (userId: string, overrides?: Partial<typeof schema.creditTransactions.$inferInsert>) => ({
        id: `test-tx-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        userId,
        amount: 25,
        type: 'signup_bonus' as const,
        description: 'Test transaction',
        metadata: JSON.stringify({ test: true }),
        ...overrides
    })
}

/**
 * 測試環境驗證
 */
export function validateTestEnvironment() {
    // 確保不在生產環境
    if (process.env.NODE_ENV === 'production') {
        throw new Error('🚨 禁止在生產環境執行測試！')
    }

    // 檢查是否有測試標記
    if (!process.env.NODE_ENV?.includes('test') && !global.test && !global.jest) {
        console.warn('⚠️  警告：可能不在測試環境中執行測試')
    }
}

/**
 * 自動清理過期的測試資料庫
 */
export function cleanupOldTestDatabases() {
    try {
        const fs = require('fs')
        const path = require('path')
        const dataDir = '.data'

        if (!fs.existsSync(dataDir)) return

        const files = fs.readdirSync(dataDir)
        const testDbFiles = files.filter((file: string) => file.startsWith('test-') && file.endsWith('.sqlite'))

        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000)

        testDbFiles.forEach((file: string) => {
            const filePath = path.join(dataDir, file)
            const stat = fs.statSync(filePath)

            if (stat.mtimeMs < oneDayAgo) {
                fs.unlinkSync(filePath)
                console.log(`🧹 清理過期測試資料庫: ${file}`)
            }
        })
    } catch (error) {
        console.warn('清理過期測試資料庫時出錯:', error)
    }
}

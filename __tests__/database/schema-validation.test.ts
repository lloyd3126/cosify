import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { eq, asc } from 'drizzle-orm'
import * as schema from '../../src/server/db/schema'

/**
 * Database Schema Validation Tests - TDD for Database Migration
 * 
 * This test suite validates our database schema meets all service requirements
 * Following TDD principles: RED -> GREEN -> REFACTOR
 */

describe('Database Schema Validation', () => {
    let db: ReturnType<typeof drizzle>
    let sqliteDb: Database.Database

    beforeAll(async () => {
        // 🛡️ 使用測試專用的資料庫，避免污染正式資料
        const testDbPath = '.data/test.sqlite'

        // 刪除舊的測試資料庫（如果存在）
        try {
            require('fs').unlinkSync(testDbPath)
        } catch (error) {
            // 文件不存在時忽略錯誤
        }

        sqliteDb = new Database(testDbPath)
        db = drizzle(sqliteDb, { schema })

        // 執行遷移來建立測試資料庫結構
        migrate(db, { migrationsFolder: './drizzle' })

        // 清理任何殘留的測試資料（雖然使用新資料庫應該不需要）
        try {
            await db.delete(schema.users).where(eq(schema.users.email, 'test@example.com'))
            await db.delete(schema.users).where(eq(schema.users.email, 'admin@test.com'))
        } catch (error) {
            // 忽略清理錯誤，因為表格可能還不存在
        }
    })

    afterAll(() => {
        sqliteDb.close()

        // 🧹 測試結束後清理測試資料庫
        try {
            require('fs').unlinkSync('.data/test.sqlite')
        } catch (error) {
            // 忽略清理錯誤
        }
    })

    describe('Core Authentication Tables', () => {
        it('should have users table with required fields for AuthService', async () => {
            // Test users table structure for Better Auth + our role system
            const userResult = await db.insert(schema.users).values({
                id: 'test-user-1',
                email: 'test@example.com',
                name: 'Test User',
                role: 'free_user',
                credits: 100,
                dailyLimit: 50
            }).returning()

            expect(userResult).toHaveLength(1)
            expect(userResult[0].id).toBe('test-user-1')
            expect(userResult[0].role).toBe('free_user')
            expect(userResult[0].credits).toBe(100)
        })

        it('should have sessions table compatible with AuthService validation', async () => {
            // Create user first
            const user = await db.insert(schema.users).values({
                id: 'session-user',
                email: 'session@example.com',
                role: 'admin'
            }).returning()

            // Test session creation
            const sessionResult = await db.insert(schema.sessions).values({
                id: 'session-1',
                token: 'test-token-123',
                userId: user[0].id,
                expiresAt: new Date(Date.now() + 3600000),
                ipAddress: '127.0.0.1',
                userAgent: 'test-agent'
            }).returning()

            expect(sessionResult).toHaveLength(1)
            expect(sessionResult[0].userId).toBe(user[0].id)
        })
    })

    describe('Credit System Tables', () => {
        it('should have creditTransactions table for CreditService operations', async () => {
            // Create user for credit operations
            const user = await db.insert(schema.users).values({
                id: 'credit-user',
                email: 'credit@example.com',
                role: 'free_user'
            }).returning()

            // Test credit transaction creation
            const transactionResult = await db.insert(schema.creditTransactions).values({
                id: 'tx-1',
                userId: user[0].id,
                amount: 25,
                type: 'signup_bonus',
                description: 'Welcome bonus',
                metadata: JSON.stringify({ source: 'auto' }),
                expiresAt: new Date(Date.now() + 86400000) // 24 hours
            }).returning()

            expect(transactionResult).toHaveLength(1)
            expect(transactionResult[0].amount).toBe(25)
            expect(transactionResult[0].type).toBe('signup_bonus')
        })

        it('should have dailyUsage table for daily limit tracking', async () => {
            // Create user for daily usage tracking
            const user = await db.insert(schema.users).values({
                id: 'usage-user',
                email: 'usage@example.com',
                role: 'free_user'
            }).returning()

            // Test daily usage record creation
            const usageResult = await db.insert(schema.dailyUsage).values({
                id: 'usage-1',
                userId: user[0].id,
                usageDate: new Date('2024-01-01'),
                creditsConsumed: 15
            }).returning()

            expect(usageResult).toHaveLength(1)
            expect(usageResult[0].creditsConsumed).toBe(15)
        })
    })

    describe('Invite Code System Tables', () => {
        it('should have inviteCodes table for InviteCodeService operations', async () => {
            // Create admin user for invite code creation
            const admin = await db.insert(schema.users).values({
                id: 'admin-user',
                email: 'admin@example.com',
                role: 'admin'
            }).returning()

            // Test invite code creation
            const inviteResult = await db.insert(schema.inviteCodes).values({
                code: 'WELCOME2024',
                createdByAdminId: admin[0].id,
                creditsValue: 50,
                creditsExpiresAt: new Date(Date.now() + 86400000),
                expiresAt: new Date(Date.now() + 2592000000) // 30 days
            }).returning()

            expect(inviteResult).toHaveLength(1)
            expect(inviteResult[0].code).toBe('WELCOME2024')
            expect(inviteResult[0].creditsValue).toBe(50)
        })
    })

    describe('Database Indexes and Constraints', () => {
        it('should enforce unique constraints', async () => {
            // Test email uniqueness
            await db.insert(schema.users).values({
                id: 'unique-user-1',
                email: 'unique@example.com',
                role: 'free_user'
            })

            // Attempting to insert duplicate email should fail
            await expect(async () => {
                await db.insert(schema.users).values({
                    id: 'unique-user-2',
                    email: 'unique@example.com', // Same email
                    role: 'free_user'
                })
            }).rejects.toThrow()
        })

        it('should support efficient queries for credit FIFO consumption', async () => {
            // Create user and multiple credit transactions
            const user = await db.insert(schema.users).values({
                id: 'fifo-user',
                email: 'fifo@example.com',
                role: 'free_user'
            }).returning()

            // Insert credits with different expiry dates
            await db.insert(schema.creditTransactions).values([
                {
                    id: 'fifo-tx-1',
                    userId: user[0].id,
                    amount: 10,
                    type: 'purchase',
                    expiresAt: new Date('2024-01-15'),
                    description: 'Expires first'
                },
                {
                    id: 'fifo-tx-2',
                    userId: user[0].id,
                    amount: 20,
                    type: 'purchase',
                    expiresAt: new Date('2024-01-30'),
                    description: 'Expires later'
                }
            ])

            // Query should return credits ordered by expiry (FIFO)
            const credits = await db.select()
                .from(schema.creditTransactions)
                .where(eq(schema.creditTransactions.userId, user[0].id))
                .orderBy(asc(schema.creditTransactions.expiresAt))

            expect(credits).toHaveLength(2)
            expect(credits[0].description).toBe('Expires first')
            expect(credits[1].description).toBe('Expires later')
        })
    })

    describe('Cross-Table Relationships', () => {
        it('should support AdminService user management queries', async () => {
            // Create admin and regular users
            const admin = await db.insert(schema.users).values({
                id: 'admin-mgmt',
                email: 'admin-mgmt@example.com',
                role: 'admin'
                // Don't set credits - let it use default and then update
            }).returning()

            const regularUser = await db.insert(schema.users).values({
                id: 'regular-mgmt',
                email: 'regular-mgmt@example.com',
                role: 'free_user'
                // Don't set credits - let it use default
            }).returning()

            // Update admin credits separately
            await db.update(schema.users)
                .set({ credits: 1000 })
                .where(eq(schema.users.id, 'admin-mgmt'))

            // Admin should be able to query all users
            const allUsers = await db.select()
                .from(schema.users)
                .orderBy(asc(schema.users.createdAt))

            const adminUser = allUsers.find(u => u.role === 'admin' && u.id === 'admin-mgmt')
            const freeUser = allUsers.find(u => u.role === 'free_user' && u.id === 'regular-mgmt')

            expect(adminUser).toBeDefined()
            expect(freeUser).toBeDefined()
            expect(adminUser?.id).toBe('admin-mgmt')
            expect(freeUser?.id).toBe('regular-mgmt')
        })

        it('should support invite code redemption workflow', async () => {
            // Create admin and invite code
            const admin = await db.insert(schema.users).values({
                id: 'redeem-admin',
                email: 'redeem-admin@example.com',
                role: 'admin'
            }).returning()

            const invite = await db.insert(schema.inviteCodes).values({
                code: 'REDEEM2024',
                createdByAdminId: admin[0].id,
                creditsValue: 100,
                expiresAt: new Date(Date.now() + 86400000)
            }).returning()

            // Create user who will redeem the code
            const user = await db.insert(schema.users).values({
                id: 'redeem-user',
                email: 'redeem-user@example.com',
                role: 'free_user',
                credits: 0
            }).returning()

            // Simulate redemption by updating invite code
            await db.update(schema.inviteCodes)
                .set({
                    usedByUserId: user[0].id,
                    usedAt: new Date()
                })
                .where(eq(schema.inviteCodes.code, 'REDEEM2024'))

            // Add credits to user
            await db.insert(schema.creditTransactions).values({
                id: 'redeem-tx',
                userId: user[0].id,
                amount: 100,
                type: 'invite_code',
                description: 'Redeemed REDEEM2024'
            })

            // Verify the workflow
            const updatedInvite = await db.select()
                .from(schema.inviteCodes)
                .where(eq(schema.inviteCodes.code, 'REDEEM2024'))

            expect(updatedInvite[0].usedByUserId).toBe(user[0].id)
            expect(updatedInvite[0].usedAt).toBeDefined()
        })
    })
})

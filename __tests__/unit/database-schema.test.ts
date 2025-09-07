/**
 * TDD Test for Credit System Database Schema
 * 
 * 🔴 RED PHASE: This test defines the expected behavior of our credit system
 * database schema before implementation. Tests will fail initially.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import {
    users,
    creditTransactions,
    dailyUsage,
    inviteCodes
} from '@/server/db/schema'
import { eq, and, desc, sum } from 'drizzle-orm'

// Test database instance
let testDb: ReturnType<typeof drizzle>
let sqlite: Database.Database

describe('🔴 RED: Credit System Schema Tests', () => {
    beforeEach(async () => {
        // Create in-memory test database
        sqlite = new Database(':memory:')
        testDb = drizzle(sqlite)

        // Run migrations
        await migrate(testDb, { migrationsFolder: './drizzle' })
    })

    afterEach(() => {
        sqlite.close()
    })

    describe('Users table extensions', () => {
        test('should have credit-related fields in users table', async () => {
            // 🔴 RED: Test expects users table to have new credit fields
            const user = {
                id: 'test-user-1',
                email: 'test@example.com',
                name: 'Test User',
                emailVerified: false,
                credits: 100,
                hasGoogleApiKey: false,
                dailyLimit: 100,
                signupBonusClaimed: false,
                role: 'free_user' as const
            }

            // This should work after GREEN phase implementation
            const [inserted] = await testDb.insert(users).values(user).returning()

            expect(inserted.credits).toBe(100)
            expect(inserted.hasGoogleApiKey).toBe(false)
            expect(inserted.dailyLimit).toBe(100)
            expect(inserted.signupBonusClaimed).toBe(false)
            expect(inserted.role).toBe('free_user')
        })

        test('should enforce role enum constraints', async () => {
            // 🔴 RED: Test role validation
            const invalidUser = {
                id: 'test-user-2',
                email: 'test2@example.com',
                name: 'Test User 2',
                emailVerified: false,
                role: 'invalid_role' // Should fail validation
            }

            // This should throw an error for invalid role
            await expect(async () => {
                await testDb.insert(users).values(invalidUser as any)
            }).rejects.toThrow()
        })
    })

    describe('Credit Transactions table', () => {
        test('should create credit transaction records', async () => {
            // 🔴 RED: Test credit transaction creation
            const transaction = {
                id: 'txn-1',
                userId: 'user-1',
                amount: 100,
                type: 'signup_bonus' as const,
                description: 'New user signup bonus',
                metadata: JSON.stringify({ source: 'registration' }),
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
                createdAt: new Date()
            }

            const [inserted] = await testDb.insert(creditTransactions).values(transaction).returning()

            expect(inserted.amount).toBe(100)
            expect(inserted.type).toBe('signup_bonus')
            expect(inserted.userId).toBe('user-1')
            expect(inserted.expiresAt).toBeInstanceOf(Date)
        })

        test('should enforce transaction type constraints', async () => {
            // 🔴 RED: Test transaction type validation
            const invalidTransaction = {
                id: 'txn-2',
                userId: 'user-1',
                amount: 50,
                type: 'invalid_type', // Should fail validation
                createdAt: new Date()
            }

            await expect(async () => {
                await testDb.insert(creditTransactions).values(invalidTransaction as any)
            }).rejects.toThrow()
        })

        test('should support FIFO credit consumption queries', async () => {
            // 🔴 RED: Test FIFO logic query structure
            // Insert multiple credit transactions with different expiry dates
            const transactions = [
                {
                    id: 'txn-old',
                    userId: 'user-1',
                    amount: 50,
                    type: 'purchase' as const,
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
                },
                {
                    id: 'txn-new',
                    userId: 'user-1',
                    amount: 100,
                    type: 'purchase' as const,
                    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
                    createdAt: new Date() // now
                }
            ]

            await testDb.insert(creditTransactions).values(transactions)

            // Query should return oldest expiring credits first (FIFO)
            const validCredits = await testDb
                .select()
                .from(creditTransactions)
                .where(
                    and(
                        eq(creditTransactions.userId, 'user-1'),
                        eq(creditTransactions.type, 'purchase')
                    )
                )
                .orderBy(creditTransactions.expiresAt) // FIFO order

            expect(validCredits).toHaveLength(2)
            expect(validCredits[0].id).toBe('txn-old') // Should come first
            expect(validCredits[1].id).toBe('txn-new')
        })
    })

    describe('Daily Usage table', () => {
        test('should track daily credit consumption', async () => {
            // 🔴 RED: Test daily usage tracking
            const usage = {
                id: 'usage-1',
                userId: 'user-1',
                usageDate: new Date('2025-09-07'),
                creditsConsumed: 25,
                createdAt: new Date()
            }

            const [inserted] = await testDb.insert(dailyUsage).values(usage).returning()

            expect(inserted.creditsConsumed).toBe(25)
            expect(inserted.userId).toBe('user-1')
            expect(inserted.usageDate).toBeInstanceOf(Date)
        })

        test('should enforce unique constraint on user_id and usage_date', async () => {
            // 🔴 RED: Test unique constraint
            const usage1 = {
                id: 'usage-1',
                userId: 'user-1',
                usageDate: new Date('2025-09-07'),
                creditsConsumed: 10,
                createdAt: new Date()
            }

            const usage2 = {
                id: 'usage-2',
                userId: 'user-1',
                usageDate: new Date('2025-09-07'), // Same date
                creditsConsumed: 20,
                createdAt: new Date()
            }

            await testDb.insert(dailyUsage).values(usage1)

            // Second insert should fail due to unique constraint
            await expect(async () => {
                await testDb.insert(dailyUsage).values(usage2)
            }).rejects.toThrow()
        })
    })

    describe('Invite Codes table', () => {
        test('should create invite code records', async () => {
            // 🔴 RED: Test invite code creation
            const inviteCode = {
                code: 'WELCOME100',
                createdByAdminId: 'admin-1',
                creditsValue: 100,
                creditsExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                createdAt: new Date()
            }

            const [inserted] = await testDb.insert(inviteCodes).values(inviteCode).returning()

            expect(inserted.code).toBe('WELCOME100')
            expect(inserted.creditsValue).toBe(100)
            expect(inserted.createdByAdminId).toBe('admin-1')
        })

        test('should support invite code redemption tracking', async () => {
            // 🔴 RED: Test redemption tracking
            const inviteCode = {
                code: 'REDEEM50',
                createdByAdminId: 'admin-1',
                creditsValue: 50,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                createdAt: new Date()
            }

            await testDb.insert(inviteCodes).values(inviteCode)

            // Simulate redemption
            await testDb
                .update(inviteCodes)
                .set({
                    usedByUserId: 'user-1',
                    usedAt: new Date()
                })
                .where(eq(inviteCodes.code, 'REDEEM50'))

            const redeemed = await testDb
                .select()
                .from(inviteCodes)
                .where(eq(inviteCodes.code, 'REDEEM50'))
                .limit(1)

            expect(redeemed[0].usedByUserId).toBe('user-1')
            expect(redeemed[0].usedAt).toBeInstanceOf(Date)
        })
    })

    describe('Database indexes and performance', () => {
        test('should have proper indexes for credit queries', async () => {
            // 🔴 RED: Test index existence (implementation will be in migration)
            // This test ensures our schema includes performance-critical indexes

            // Test credit transaction index on user_id and expires_at
            const indexQuery = `
        SELECT name FROM sqlite_master 
        WHERE type='index' 
        AND sql LIKE '%credit_transactions%user_id%expires_at%'
      `

            const indexes = sqlite.prepare(indexQuery).all()
            expect(indexes.length).toBeGreaterThan(0)
        })

        test('should have daily usage index for date queries', async () => {
            // 🔴 RED: Test daily usage index
            const indexQuery = `
        SELECT name FROM sqlite_master 
        WHERE type='index' 
        AND sql LIKE '%daily_usage%user_id%usage_date%'
      `

            const indexes = sqlite.prepare(indexQuery).all()
            expect(indexes.length).toBeGreaterThan(0)
        })
    })
})

// Helper function for testing credit balance calculation
export async function calculateUserCredits(db: typeof testDb, userId: string): Promise<number> {
    // 🔴 RED: This function will be implemented in GREEN phase
    const validCredits = await db
        .select({ total: sum(creditTransactions.amount) })
        .from(creditTransactions)
        .where(
            and(
                eq(creditTransactions.userId, userId),
                // Only count non-expired, non-consumed credits
                // Implementation details will be added in GREEN phase
            )
        )

    return validCredits[0]?.total ?? 0
}

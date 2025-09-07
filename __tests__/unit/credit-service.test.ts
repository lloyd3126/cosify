/**
 * TDD Test for CreditService Core Logic
 * 
 * 🔴 RED PHASE: Define expected behavior for credit system business logic
 * Tests will fail initially until GREEN phase implementation
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { CreditService } from '@/server/services/credit-service'
import { TestUtils, TestDataFactory } from '../helpers/test-utils'

// Mock database instance
let mockDb: any
let creditService: CreditService

describe('🔴 RED: CreditService Core Logic Tests', () => {
    beforeEach(async () => {
        // Setup test database and service
        mockDb = TestUtils.createMockDatabase()
        creditService = new CreditService(mockDb)

        // Clean state for each test
        await TestUtils.cleanDatabase(mockDb)
    })

    afterEach(async () => {
        jest.clearAllMocks()
    })

    describe('FIFO Credit Consumption Logic', () => {
        test('should consume oldest expiring credits first', async () => {
            // 🔴 RED: Define FIFO consumption behavior
            const user = TestDataFactory.createUser({ id: 'user-1' })

            // Create credits with different expiry dates
            const oldCredit = TestDataFactory.createCreditTransaction({
                userId: 'user-1',
                amount: 50,  // Reduced from 100 to 50
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)  // 10 days ago
            })

            const newCredit = TestDataFactory.createCreditTransaction({
                userId: 'user-1',
                amount: 50,
                expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
                createdAt: new Date() // now
            })

            await TestUtils.insertTestData(mockDb, [user, oldCredit, newCredit])

            // Consume 75 credits - should take all 50 from old, then 25 from new
            const result = await creditService.consumeCredits('user-1', 75)

            expect(result.success).toBe(true)
            expect(result.consumed).toBe(75)
            expect(result.transactions).toHaveLength(2)
            expect(result.transactions[0].transactionId).toBe(oldCredit.id)
            expect(result.transactions[0].amountUsed).toBe(50) // Consume all old credit
            expect(result.transactions[1].transactionId).toBe(newCredit.id)
            expect(result.transactions[1].amountUsed).toBe(25)  // Consume part of new credit
        })

        test('should skip expired credits during consumption', async () => {
            // 🔴 RED: Test expired credit handling
            const user = TestDataFactory.createUser({ id: 'user-1' })

            const expiredCredit = TestDataFactory.createCreditTransaction({
                userId: 'user-1',
                amount: 100,
                expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday (expired)
            })

            const validCredit = TestDataFactory.createCreditTransaction({
                userId: 'user-1',
                amount: 50,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            })

            await TestUtils.insertTestData(mockDb, [user, expiredCredit, validCredit])

            const result = await creditService.consumeCredits('user-1', 30)

            expect(result.success).toBe(true)
            expect(result.consumed).toBe(30)
            expect(result.transactions).toHaveLength(1)
            expect(result.transactions[0].transactionId).toBe(validCredit.id)
        })

        test('should fail consumption when insufficient valid credits', async () => {
            // 🔴 RED: Test insufficient credits scenario
            const user = TestDataFactory.createUser({ id: 'user-1' })

            const insufficientCredit = TestDataFactory.createCreditTransaction({
                userId: 'user-1',
                amount: 20,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            })

            await TestUtils.insertTestData(mockDb, [user, insufficientCredit])

            const result = await creditService.consumeCredits('user-1', 50)

            expect(result.success).toBe(false)
            expect(result.error).toBe('INSUFFICIENT_CREDITS')
            expect(result.available).toBe(20)
            expect(result.requested).toBe(50)
        })
    })

    describe('Daily Limit Enforcement', () => {
        test('should enforce daily consumption limits', async () => {
            // 🔴 RED: Test daily limit checking
            const user = TestDataFactory.createUser({
                id: 'user-1',
                dailyLimit: 100
            })

            const credits = TestDataFactory.createCreditTransaction({
                userId: 'user-1',
                amount: 1000, // Plenty of credits
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            })

            // Simulate 80 credits already consumed today
            const todayUsage = TestDataFactory.createDailyUsage({
                userId: 'user-1',
                usageDate: new Date(),
                creditsConsumed: 80
            })

            await TestUtils.insertTestData(mockDb, [user, credits, todayUsage])

            // Try to consume 30 more (would exceed daily limit of 100)
            const result = await creditService.consumeCredits('user-1', 30)

            expect(result.success).toBe(false)
            expect(result.error).toBe('DAILY_LIMIT_EXCEEDED')
            expect(result.dailyUsed).toBe(80)
            expect(result.dailyLimit).toBe(100)
            expect(result.dailyRemaining).toBe(20)
        })

        test('should allow consumption within daily limits', async () => {
            // 🔴 RED: Test successful consumption within limits
            const user = TestDataFactory.createUser({
                id: 'user-1',
                dailyLimit: 100
            })

            const credits = TestDataFactory.createCreditTransaction({
                userId: 'user-1',
                amount: 1000,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            })

            const todayUsage = TestDataFactory.createDailyUsage({
                userId: 'user-1',
                usageDate: new Date(),
                creditsConsumed: 70
            })

            await TestUtils.insertTestData(mockDb, [user, credits, todayUsage])

            // Consume 20 more (total 90, within limit of 100)
            const result = await creditService.consumeCredits('user-1', 20)

            expect(result.success).toBe(true)
            expect(result.consumed).toBe(20)
            expect(result.newDailyTotal).toBe(90)
        })

        test('should handle timezone-aware daily limit reset', async () => {
            // 🔴 RED: Test timezone handling for daily limits
            const taipeiTime = new Date()
            taipeiTime.setHours(1, 0, 0, 0) // 1 AM Taipei time

            const yesterdayUsage = TestDataFactory.createDailyUsage({
                userId: 'user-1',
                usageDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
                creditsConsumed: 100 // Was at limit yesterday
            })

            await TestUtils.insertTestData(mockDb, [yesterdayUsage])

            // Should be able to consume today (new day in Taipei timezone)
            const result = await creditService.checkDailyLimit('user-1', 50)

            expect(result.canConsume).toBe(true)
            expect(result.dailyUsed).toBe(0) // Fresh day
        })
    })

    describe('Credit Balance Calculation', () => {
        test('should calculate valid credits excluding expired', async () => {
            // 🔴 RED: Test balance calculation logic
            const validCredit1 = TestDataFactory.createCreditTransaction({
                userId: 'user-1',
                amount: 100,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            })

            const validCredit2 = TestDataFactory.createCreditTransaction({
                userId: 'user-1',
                amount: 50,
                expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            })

            const expiredCredit = TestDataFactory.createCreditTransaction({
                userId: 'user-1',
                amount: 200,
                expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired
            })

            await TestUtils.insertTestData(mockDb, [validCredit1, validCredit2, expiredCredit])

            const balance = await creditService.getValidCredits('user-1')

            expect(balance.totalValid).toBe(150) // Only valid credits
            expect(balance.expiringCredits).toHaveLength(1) // Credits expiring within 7 days
            expect(balance.expiringCredits[0].amount).toBe(100)
        })

        test('should exclude consumed credits from balance', async () => {
            // 🔴 RED: Test consumed credit exclusion
            const credit = TestDataFactory.createCreditTransaction({
                userId: 'user-1',
                amount: 100,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            })

            const consumedCredit = TestDataFactory.createCreditTransaction({
                userId: 'user-1',
                amount: 50,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                consumedAt: new Date(), // Already consumed
            })

            await TestUtils.insertTestData(mockDb, [credit, consumedCredit])

            const balance = await creditService.getValidCredits('user-1')

            expect(balance.totalValid).toBe(100) // Only unconsumed credit
        })
    })

    describe('Credit Management Operations', () => {
        test('should add credits with proper expiry tracking', async () => {
            // 🔴 RED: Test credit addition
            const expiryDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)

            const result = await creditService.addCredits(
                'user-1',
                100,
                'purchase',
                'Credit purchase via payment',
                expiryDate
            )

            expect(result.success).toBe(true)
            expect(result.transactionId).toBeDefined()
            expect(result.amount).toBe(100)
            expect(result.expiresAt).toEqual(expiryDate)

            // Verify credit was actually added to database
            const balance = await creditService.getValidCredits('user-1')
            expect(balance.totalValid).toBe(100)
        })

        test('should handle signup bonus with claim tracking', async () => {
            // 🔴 RED: Test signup bonus logic
            const user = TestDataFactory.createUser({
                id: 'user-1',
                signupBonusClaimed: false
            })

            await TestUtils.insertTestData(mockDb, [user])

            const result = await creditService.grantSignupBonus('user-1')

            expect(result.success).toBe(true)
            expect(result.amount).toBe(100) // Default signup bonus
            expect(result.bonusClaimed).toBe(true)

            // Should fail on second attempt
            const secondAttempt = await creditService.grantSignupBonus('user-1')
            expect(secondAttempt.success).toBe(false)
            expect(secondAttempt.error).toBe('BONUS_ALREADY_CLAIMED')
        })
    })

    describe('Expired Credit Cleanup', () => {
        test('should clean up expired credits efficiently', async () => {
            // 🔴 RED: Test cleanup operation
            const expiredCredits = [
                TestDataFactory.createCreditTransaction({
                    userId: 'user-1',
                    amount: 100,
                    expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
                }),
                TestDataFactory.createCreditTransaction({
                    userId: 'user-2',
                    amount: 50,
                    expiresAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
                })
            ]

            const validCredit = TestDataFactory.createCreditTransaction({
                userId: 'user-1',
                amount: 200,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            })

            await TestUtils.insertTestData(mockDb, [...expiredCredits, validCredit])

            const result = await creditService.cleanupExpiredCredits()

            expect(result.cleanedCount).toBe(2)
            expect(result.freedSpace).toBeGreaterThan(0)

            // Verify expired credits are marked as consumed
            const remainingExpired = await creditService.getExpiredCredits()
            expect(remainingExpired).toHaveLength(0)
        })
    })

    describe('Error Handling and Edge Cases', () => {
        test('should handle concurrent consumption attempts', async () => {
            // 🔴 RED: Test race condition handling
            const user = TestDataFactory.createUser({
                id: 'user-1',
                dailyLimit: 200  // Increase daily limit to avoid daily limit issues
            })

            const credit = TestDataFactory.createCreditTransaction({
                userId: 'user-1',
                amount: 100,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            })

            await TestUtils.insertTestData(mockDb, [user, credit])            // Simulate concurrent consumption
            const promises = [
                creditService.consumeCredits('user-1', 60),
                creditService.consumeCredits('user-1', 60)
            ]

            const results = await Promise.all(promises)

            // One should succeed, one should fail
            const successes = results.filter(r => r.success)
            const failures = results.filter(r => !r.success)

            expect(successes).toHaveLength(1)
            expect(failures).toHaveLength(1)
            expect(failures[0].error).toBe('INSUFFICIENT_CREDITS')
        })

        test('should validate user existence before operations', async () => {
            // 🔴 RED: Test user validation
            const result = await creditService.consumeCredits('nonexistent-user', 50)

            expect(result.success).toBe(false)
            expect(result.error).toBe('USER_NOT_FOUND')
        })

        test('should handle database connection errors gracefully', async () => {
            // 🔴 RED: Test error resilience
            // Create a broken database that throws on select operations
            const brokenDb = {
                select: () => ({
                    from: () => ({
                        where: () => Promise.reject(new Error('Database connection failed'))
                    })
                }),
                insert: jest.fn(),
                update: jest.fn(),
                delete: jest.fn()
            }

            const brokenService = new CreditService(brokenDb as any)

            const result = await brokenService.getValidCredits('user-1')

            expect(result.success).toBe(false)
            expect(result.error).toBe('DATABASE_ERROR')
        })
    })
})

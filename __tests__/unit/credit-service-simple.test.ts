/**
 * CreditService TDD Tests - GREEN Phase Validation
 * 
 * Minimal test suite to validate GREEN phase implementation
 */

import { CreditService } from '../../src/server/services/credit-service'

// Simple mock database for testing
const createMockDatabase = () => {
    const mockData = {
        users: [
            { id: 'test-user-1', email: 'test@example.com', dailyLimit: 100, signupBonusClaimed: false },
            { id: 'test-user-2', email: 'test2@example.com', dailyLimit: 50, signupBonusClaimed: true },
        ],
        creditTransactions: [
            {
                id: 'credit-1',
                userId: 'test-user-1',
                amount: 200,
                type: 'purchase',
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                consumedAt: null,
                createdAt: new Date()
            },
            {
                id: 'credit-2',
                userId: 'test-user-1',
                amount: 100,
                type: 'purchase',
                expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
                consumedAt: null,
                createdAt: new Date()
            }
        ],
        dailyUsage: []
    }

    return { mockData }
}

describe('CreditService - GREEN Phase Tests', () => {
    let creditService: CreditService
    let mockDb: any

    beforeEach(() => {
        mockDb = createMockDatabase()
        creditService = new CreditService(mockDb)
    })

    describe('consumeCredits', () => {
        test('should successfully consume credits using FIFO logic', async () => {
            const result = await creditService.consumeCredits('test-user-1', 150)

            expect(result.success).toBe(true)
            expect(result.consumed).toBe(150)
            expect(result.transactions).toHaveLength(1)
            expect(result.transactions![0].transactionId).toBe('credit-1')
            expect(result.transactions![0].amountUsed).toBe(150)
        })

        test('should return error for insufficient credits', async () => {
            const result = await creditService.consumeCredits('test-user-1', 500)

            expect(result.success).toBe(false)
            expect(result.error).toBe('INSUFFICIENT_CREDITS')
            expect(result.available).toBe(300)
            expect(result.requested).toBe(500)
        })

        test('should return error for non-existent user', async () => {
            const result = await creditService.consumeCredits('non-existent', 50)

            expect(result.success).toBe(false)
            expect(result.error).toBe('USER_NOT_FOUND')
        })
    })

    describe('getValidCredits', () => {
        test('should return total valid credits', async () => {
            const result = await creditService.getValidCredits('test-user-1')

            expect(result.success).toBe(true)
            expect(result.totalValid).toBe(300)
            expect(result.expiringCredits).toHaveLength(1)
            expect(result.expiringCredits[0].amount).toBe(200)
        })

        test('should return zero for user with no credits', async () => {
            const result = await creditService.getValidCredits('test-user-2')

            expect(result.success).toBe(true)
            expect(result.totalValid).toBe(0)
            expect(result.expiringCredits).toHaveLength(0)
        })
    })

    describe('addCredits', () => {
        test('should successfully add credits to user account', async () => {
            const result = await creditService.addCredits('test-user-1', 100, 'purchase', 'Test purchase')

            expect(result.success).toBe(true)
            expect(result.amount).toBe(100)
            expect(result.transactionId).toBeDefined()
            expect(result.expiresAt).toBeInstanceOf(Date)
        })
    })

    describe('grantSignupBonus', () => {
        test('should grant signup bonus to new user', async () => {
            const result = await creditService.grantSignupBonus('test-user-1')

            expect(result.success).toBe(true)
            expect(result.amount).toBe(100)
            expect(result.bonusClaimed).toBe(true)
        })

        test('should reject bonus for user who already claimed', async () => {
            const result = await creditService.grantSignupBonus('test-user-2')

            expect(result.success).toBe(false)
            expect(result.error).toBe('BONUS_ALREADY_CLAIMED')
        })

        test('should reject bonus for non-existent user', async () => {
            const result = await creditService.grantSignupBonus('non-existent')

            expect(result.success).toBe(false)
            expect(result.error).toBe('USER_NOT_FOUND')
        })
    })

    describe('cleanupExpiredCredits', () => {
        test('should clean up expired credits', async () => {
            // Add expired credit to mock data
            mockDb.mockData.creditTransactions.push({
                id: 'expired-credit',
                userId: 'test-user-1',
                amount: 50,
                type: 'purchase',
                expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // expired yesterday
                consumedAt: null,
                createdAt: new Date()
            })

            const result = await creditService.cleanupExpiredCredits()

            expect(result.cleanedCount).toBe(1)
            expect(result.freedSpace).toBe(100)
        })
    })

    describe('checkDailyLimit', () => {
        test('should allow consumption within daily limit', async () => {
            const result = await creditService.checkDailyLimit('test-user-1', 50)

            expect(result.canConsume).toBe(true)
            expect(result.dailyUsed).toBe(0)
            expect(result.dailyLimit).toBe(100)
            expect(result.dailyRemaining).toBe(100)
        })

        test('should reject consumption exceeding daily limit', async () => {
            const result = await creditService.checkDailyLimit('test-user-1', 150)

            expect(result.canConsume).toBe(false)
            expect(result.dailyLimit).toBe(100)
        })
    })
})

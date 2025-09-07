/**
 * 🔴 RED Phase: Credit API Endpoints Tests
 * 
 * Testing REST API endpoints for CreditService operations
 * Following TDD principles: RED -> GREEN -> REFACTOR
 */

import { NextRequest } from 'next/server'
import { POST as addCreditsHandler } from '../../app/api/credits/add/route'
import { GET as balanceHandler } from '../../app/api/credits/balance/route'
import { POST as consumeCreditsHandler } from '../../app/api/credits/consume/route'
import { GET as historyHandler } from '../../app/api/credits/history/route'

describe('🔴 RED: Credit API Endpoints', () => {

    describe('POST /api/credits/add', () => {
        it('should add credits to user account', async () => {
            const request = new NextRequest('https://localhost:3000/api/credits/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid-token'
                },
                body: JSON.stringify({
                    userId: 'user-1',
                    amount: 100,
                    type: 'purchase',
                    description: 'Credit purchase'
                })
            })

            const response = await addCreditsHandler(request)

            expect(response.status).toBe(200)
            const data = await response.json()
            expect(data.success).toBe(true)
            expect(data.transaction).toBeDefined()
            expect(data.transactionId).toBeDefined()
        })

        it('should validate required fields', async () => {
            const request = new NextRequest('https://localhost:3000/api/credits/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid-token'
                },
                body: JSON.stringify({
                    // Missing required fields
                    description: 'Test'
                })
            })

            const response = await addCreditsHandler(request)

            expect(response.status).toBe(400)
            const data = await response.json()
            expect(data.success).toBe(false)
            expect(data.error).toContain('validation')
        })

        it('should require authentication', async () => {
            const request = new NextRequest('https://localhost:3000/api/credits/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: 'user-1',
                    amount: 100,
                    type: 'purchase'
                })
            })

            const response = await addCreditsHandler(request)

            expect(response.status).toBe(401)
            const data = await response.json()
            expect(data.success).toBe(false)
            expect(data.error).toBe('UNAUTHORIZED')
        })
    })

    describe('POST /api/credits/consume', () => {
        it('should consume credits using FIFO logic', async () => {
            const request = new NextRequest('https://localhost:3000/api/credits/consume', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid-token'
                },
                body: JSON.stringify({
                    userId: 'user-1',
                    amount: 50,
                    description: 'API usage'
                })
            })

            const response = await consumeCreditsHandler(request)

            expect(response.status).toBe(200)
            const data = await response.json()
            expect(data.success).toBe(true)
            expect(data.consumed).toBe(50)
            expect(data.remainingCredits).toBeGreaterThanOrEqual(0)
        })

        it('should check daily limits', async () => {
            const request = new NextRequest('https://localhost:3000/api/credits/consume', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid-token'
                },
                body: JSON.stringify({
                    userId: 'user-1',
                    amount: 10000,  // Exceeds daily limit
                    description: 'Large consumption'
                })
            })

            const response = await consumeCreditsHandler(request)

            expect(response.status).toBe(429) // Too Many Requests
            const data = await response.json()
            expect(data.success).toBe(false)
            expect(data.error).toBe('DAILY_LIMIT_EXCEEDED')
        })
    })

    describe('GET /api/credits/balance', () => {
        it('should return user credit balance', async () => {
            const request = new NextRequest('https://localhost:3000/api/credits/balance?userId=user-1', {
                headers: { 'Authorization': 'Bearer valid-token' }
            })

            const response = await balanceHandler(request)

            expect(response.status).toBe(200)
            const data = await response.json()
            expect(data.success).toBe(true)
            expect(data.balance).toBeGreaterThanOrEqual(0)
            expect(Array.isArray(data.validCredits)).toBe(true)
        })
    })

    describe('GET /api/credits/history', () => {
        it('should return credit transaction history', async () => {
            const request = new NextRequest('https://localhost:3000/api/credits/history?userId=user-1', {
                headers: { 'Authorization': 'Bearer valid-token' }
            })

            const response = await historyHandler(request)

            expect(response.status).toBe(200)
            const data = await response.json()
            expect(data.success).toBe(true)
            expect(Array.isArray(data.transactions)).toBe(true)
            expect(data.pagination).toBeDefined()
        })
    })
})

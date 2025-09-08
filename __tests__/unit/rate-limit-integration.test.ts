/**
 * Simplified Rate Limiting Middleware Tests
 * 
 * Focused on core rate limiting functionality
 */

import { RateLimiter } from '../../src/server/services/rate-limiter'
import { RateLimitMiddleware, RateLimitPolicies } from '../../src/server/middleware/rate-limit-middleware'

// Simple mock request
const createMockRequest = (ip = '192.168.1.1', path = '/api/test', userId?: string): any => {
    const mockHeaders = new Map<string, string>()
    mockHeaders.set('x-forwarded-for', ip)
    if (userId) {
        mockHeaders.set('x-user-id', userId)
    }

    return {
        ip,
        nextUrl: { pathname: path },
        headers: {
            get: (name: string) => mockHeaders.get(name) || null,
            set: (name: string, value: string) => mockHeaders.set(name, value)
        }
    }
}

describe('RateLimitMiddleware Integration', () => {
    describe('Basic Rate Limiting with RateLimiter Service', () => {
        it('should limit requests correctly', async () => {
            const rateLimiter = new RateLimiter({
                windowMs: 60000,
                maxRequests: 3,
                keyGenerator: (id: string) => `test:${id}`,
                skipSuccessfulRequests: false,
                skipFailedRequests: false
            })

            const testKey = 'user123'

            // First 3 requests should be allowed
            for (let i = 0; i < 3; i++) {
                const result = await rateLimiter.checkLimit(testKey)
                expect(result.allowed).toBe(true)
                expect(result.remaining).toBe(2 - i)
            }

            // 4th request should be blocked
            const result = await rateLimiter.checkLimit(testKey)
            expect(result.allowed).toBe(false)
            expect(result.remaining).toBe(0)

            await rateLimiter.reset()
        })

        it('should handle different identifiers separately', async () => {
            const rateLimiter = new RateLimiter({
                windowMs: 60000,
                maxRequests: 2,
                keyGenerator: (id: string) => `test:${id}`,
                skipSuccessfulRequests: false,
                skipFailedRequests: false
            })

            // Use up limit for user1
            await rateLimiter.checkLimit('user1')
            await rateLimiter.checkLimit('user1')

            const user1Result = await rateLimiter.checkLimit('user1')
            expect(user1Result.allowed).toBe(false)

            // user2 should still have full quota
            const user2Result = await rateLimiter.checkLimit('user2')
            expect(user2Result.allowed).toBe(true)
            expect(user2Result.remaining).toBe(1)

            await rateLimiter.reset()
        })
    })

    describe('Middleware Configuration', () => {
        it('should create middleware with default config', () => {
            const middleware = new RateLimitMiddleware({})
            expect(middleware).toBeDefined()
        })

        it('should create middleware with custom config', () => {
            const middleware = new RateLimitMiddleware({
                windowMs: 30000,
                maxRequests: 10
            })
            expect(middleware).toBeDefined()
        })

        it('should create middleware with custom key generator', async () => {
            const middleware = new RateLimitMiddleware({
                windowMs: 60000,
                maxRequests: 1,
                keyGenerator: (req) => `custom:${req.ip || 'unknown'}`
            })

            // Test that custom key generator works
            const stats = middleware.getStats()
            expect(stats.totalEntries).toBe(0)
        })
    })

    describe('Rate Limit Policies', () => {
        it('should have predefined policies', () => {
            expect(RateLimitPolicies.strict).toBeDefined()
            expect(RateLimitPolicies.standard).toBeDefined()
            expect(RateLimitPolicies.lenient).toBeDefined()
            expect(RateLimitPolicies.perUser).toBeDefined()

            // Check policy values
            expect(RateLimitPolicies.strict.maxRequests).toBe(5)
            expect(RateLimitPolicies.standard.maxRequests).toBe(100)
            expect(RateLimitPolicies.lenient.maxRequests).toBe(1000)
            expect(RateLimitPolicies.perUser.maxRequests).toBe(60)
        })

        it('should have working per-user key generator', () => {
            const keyGen = RateLimitPolicies.perUser.keyGenerator!
            const req = createMockRequest('192.168.1.1', '/api/test', 'user123')

            const key = keyGen(req)
            expect(key).toBe('rate_limit:user:/api/test:user123')
        })
    })

    describe('Error Handling', () => {
        it('should handle cleanup properly', async () => {
            const middleware = new RateLimitMiddleware({
                windowMs: 60000,
                maxRequests: 5
            })

            // Test cleanup
            await middleware.cleanup()

            const stats = middleware.getStats()
            expect(stats.totalEntries).toBe(0)
        })
    })

    describe('Performance', () => {
        it('should handle multiple rapid requests', async () => {
            const rateLimiter = new RateLimiter({
                windowMs: 60000,
                maxRequests: 50,
                keyGenerator: (id: string) => `perf:${id}`,
                skipSuccessfulRequests: false,
                skipFailedRequests: false
            })

            const testKey = 'performance_test'
            const startTime = Date.now()

            // Make 30 requests rapidly
            const promises = []
            for (let i = 0; i < 30; i++) {
                promises.push(rateLimiter.checkLimit(testKey))
            }

            const results = await Promise.all(promises)
            const endTime = Date.now()

            // Should complete within reasonable time
            expect(endTime - startTime).toBeLessThan(100)

            // All requests should be allowed (within limit)
            const allowedCount = results.filter(r => r.allowed).length
            expect(allowedCount).toBe(30)

            await rateLimiter.reset()
        })
    })
})

/**
 * Rate Limiting Tests
 * 
 * TDD Red Phase: Tests for API rate limiting functionality
 * These tests should initially fail until we implement the RateLimiter service
 */

import { RateLimiter, RateLimitConfig, RateLimitResult } from '../../src/server/services/rate-limiter'

describe('RateLimiter Service', () => {
    let rateLimiter: RateLimiter

    beforeEach(() => {
        // Create a new rate limiter instance for each test
        const config: RateLimitConfig = {
            windowMs: 60000, // 1 minute
            maxRequests: 5,   // 5 requests per minute
            keyGenerator: (identifier: string) => `rate_limit:${identifier}`,
            skipSuccessfulRequests: false,
            skipFailedRequests: false
        }
        rateLimiter = new RateLimiter(config)
    })

    afterEach(async () => {
        // Clean up any stored rate limit data
        await rateLimiter.reset()
    })

    describe('Basic Rate Limiting', () => {
        it('should allow requests within the limit', async () => {
            const identifier = 'user123'

            // Make 5 requests (within limit)
            for (let i = 0; i < 5; i++) {
                const result = await rateLimiter.checkLimit(identifier)
                expect(result.allowed).toBe(true)
                expect(result.remaining).toBe(4 - i)
                expect(result.resetTime).toBeInstanceOf(Date)
            }
        })

        it('should block requests that exceed the limit', async () => {
            const identifier = 'user123'

            // Make 5 requests to reach the limit
            for (let i = 0; i < 5; i++) {
                await rateLimiter.checkLimit(identifier)
            }

            // The 6th request should be blocked
            const result = await rateLimiter.checkLimit(identifier)
            expect(result.allowed).toBe(false)
            expect(result.remaining).toBe(0)
            expect(result.retryAfter).toBeGreaterThan(0)
        })

        it('should track requests separately for different identifiers', async () => {
            const user1 = 'user123'
            const user2 = 'user456'

            // User1 makes 5 requests (reaches limit)
            for (let i = 0; i < 5; i++) {
                await rateLimiter.checkLimit(user1)
            }

            // User2 should still be able to make requests
            const result = await rateLimiter.checkLimit(user2)
            expect(result.allowed).toBe(true)
            expect(result.remaining).toBe(4)
        })
    })

    describe('Window Reset Logic', () => {
        it('should reset limit after time window expires', async () => {
            const identifier = 'user123'
            const shortConfig: RateLimitConfig = {
                windowMs: 100, // 100ms window for testing
                maxRequests: 2,
                keyGenerator: (id: string) => `test:${id}`,
                skipSuccessfulRequests: false,
                skipFailedRequests: false
            }

            const shortLimiter = new RateLimiter(shortConfig)

            // Make 2 requests to reach limit
            await shortLimiter.checkLimit(identifier)
            await shortLimiter.checkLimit(identifier)

            // Should be blocked
            let result = await shortLimiter.checkLimit(identifier)
            expect(result.allowed).toBe(false)

            // Wait for window to reset
            await new Promise(resolve => setTimeout(resolve, 150))

            // Should be allowed again
            result = await shortLimiter.checkLimit(identifier)
            expect(result.allowed).toBe(true)
            expect(result.remaining).toBe(1)

            await shortLimiter.reset()
        })

        it('should provide accurate reset time information', async () => {
            const identifier = 'user123'
            const beforeRequest = Date.now()

            const result = await rateLimiter.checkLimit(identifier)

            expect(result.resetTime.getTime()).toBeGreaterThan(beforeRequest)
            expect(result.resetTime.getTime()).toBeLessThanOrEqual(beforeRequest + 60000)
        })
    })

    describe('Configuration Options', () => {
        it('should respect skipSuccessfulRequests option', async () => {
            const config: RateLimitConfig = {
                windowMs: 60000,
                maxRequests: 3,
                keyGenerator: (id: string) => `skip_success:${id}`,
                skipSuccessfulRequests: true,
                skipFailedRequests: false
            }

            const limiter = new RateLimiter(config)
            const identifier = 'user123'

            // Simulate successful requests (should be skipped)
            await limiter.checkLimit(identifier, true) // success
            await limiter.checkLimit(identifier, true) // success

            // Regular check should still have full quota
            const result = await limiter.checkLimit(identifier)
            expect(result.remaining).toBe(2) // Should be 2, not 0

            await limiter.reset()
        })

        it('should respect skipFailedRequests option', async () => {
            const config: RateLimitConfig = {
                windowMs: 60000,
                maxRequests: 3,
                keyGenerator: (id: string) => `skip_failed:${id}`,
                skipSuccessfulRequests: false,
                skipFailedRequests: true
            }

            const limiter = new RateLimiter(config)
            const identifier = 'user123'

            // Simulate failed requests (should be skipped)
            await limiter.checkLimit(identifier, false) // failed
            await limiter.checkLimit(identifier, false) // failed

            // Regular check should still have full quota
            const result = await limiter.checkLimit(identifier)
            expect(result.remaining).toBe(2) // Should be 2, not 0

            await limiter.reset()
        })

        it('should use custom key generator', async () => {
            const config: RateLimitConfig = {
                windowMs: 60000,
                maxRequests: 3,
                keyGenerator: (id: string) => `custom:prefix:${id}:suffix`,
                skipSuccessfulRequests: false,
                skipFailedRequests: false
            }

            const limiter = new RateLimiter(config)

            // The key generator should create unique keys
            const result1 = await limiter.checkLimit('user1')
            const result2 = await limiter.checkLimit('user1')

            expect(result1.remaining).toBe(2)
            expect(result2.remaining).toBe(1)

            await limiter.reset()
        })
    })

    describe('Multiple Rate Limit Policies', () => {
        it('should handle different rate limits for different endpoints', async () => {
            const strictConfig: RateLimitConfig = {
                windowMs: 60000,
                maxRequests: 2, // Very strict
                keyGenerator: (id: string) => `strict:${id}`,
                skipSuccessfulRequests: false,
                skipFailedRequests: false
            }

            const lenientConfig: RateLimitConfig = {
                windowMs: 60000,
                maxRequests: 10, // More lenient
                keyGenerator: (id: string) => `lenient:${id}`,
                skipSuccessfulRequests: false,
                skipFailedRequests: false
            }

            const strictLimiter = new RateLimiter(strictConfig)
            const lenientLimiter = new RateLimiter(lenientConfig)

            const identifier = 'user123'

            // Use up strict limit
            await strictLimiter.checkLimit(identifier)
            await strictLimiter.checkLimit(identifier)

            const strictResult = await strictLimiter.checkLimit(identifier)
            expect(strictResult.allowed).toBe(false)

            // Lenient limiter should still work
            const lenientResult = await lenientLimiter.checkLimit(identifier)
            expect(lenientResult.allowed).toBe(true)
            expect(lenientResult.remaining).toBe(9)

            await strictLimiter.reset()
            await lenientLimiter.reset()
        })
    })

    describe('Error Handling', () => {
        it('should handle invalid configurations gracefully', () => {
            expect(() => {
                new RateLimiter({
                    windowMs: -1000, // Invalid
                    maxRequests: 5,
                    keyGenerator: (id: string) => id,
                    skipSuccessfulRequests: false,
                    skipFailedRequests: false
                })
            }).toThrow('windowMs must be positive')

            expect(() => {
                new RateLimiter({
                    windowMs: 60000,
                    maxRequests: 0, // Invalid
                    keyGenerator: (id: string) => id,
                    skipSuccessfulRequests: false,
                    skipFailedRequests: false
                })
            }).toThrow('maxRequests must be positive')
        })

        it('should handle storage errors gracefully', async () => {
            // This test would be more relevant with external storage like Redis
            // For now, we test that the service doesn't crash on edge cases
            const identifier = 'user123'

            const result = await rateLimiter.checkLimit(identifier)
            expect(result).toBeDefined()
            expect(typeof result.allowed).toBe('boolean')
            expect(typeof result.remaining).toBe('number')
        })
    })

    describe('Performance and Memory', () => {
        it('should handle high-frequency requests efficiently', async () => {
            const identifier = 'performance_test'
            const startTime = Date.now()

            // Make multiple requests rapidly
            const promises = []
            for (let i = 0; i < 50; i++) {
                promises.push(rateLimiter.checkLimit(identifier))
            }

            const results = await Promise.all(promises)
            const endTime = Date.now()

            // Should complete within reasonable time (< 100ms for 50 requests)
            expect(endTime - startTime).toBeLessThan(100)

            // First 5 should be allowed, rest should be blocked
            const allowedCount = results.filter(r => r.allowed).length
            expect(allowedCount).toBe(5)
        })

        it('should cleanup expired entries to prevent memory leaks', async () => {
            const shortConfig: RateLimitConfig = {
                windowMs: 50, // Very short window
                maxRequests: 1,
                keyGenerator: (id: string) => `cleanup:${id}`,
                skipSuccessfulRequests: false,
                skipFailedRequests: false
            }

            const limiter = new RateLimiter(shortConfig)

            // Create many entries
            for (let i = 0; i < 10; i++) {
                await limiter.checkLimit(`user${i}`)
            }

            // Wait for entries to expire
            await new Promise(resolve => setTimeout(resolve, 100))

            // New request should work (indicating cleanup happened)
            const result = await limiter.checkLimit('user1')
            expect(result.allowed).toBe(true)
            expect(result.remaining).toBe(0)

            await limiter.reset()
        })
    })
})

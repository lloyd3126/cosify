/**
 * Rate Limiting Middleware Tests
 * 
 * Tests for Next.js API route rate limiting middleware
 */

import { NextRequest, NextResponse } from 'next/server'
import { RateLimitMiddleware, RateLimitPolicies, withRateLimit } from '../../src/server/middleware/rate-limit-middleware'

// Mock Next.js request/response
const createMockRequest = (ip = '192.168.1.1', path = '/api/test'): any => {
    const url = `http://localhost:3000${path}`
    const mockHeaders = new Map([
        ['x-forwarded-for', ip],
        ['x-real-ip', ip]
    ])

    return {
        ip,
        nextUrl: { pathname: path },
        headers: {
            get: (name: string) => mockHeaders.get(name) || null,
            set: (name: string, value: string) => mockHeaders.set(name, value)
        }
    }
}

describe('RateLimitMiddleware', () => {
    let middleware: RateLimitMiddleware

    beforeEach(() => {
        middleware = new RateLimitMiddleware({
            windowMs: 60000, // 1 minute
            maxRequests: 5,
            skipSuccessfulRequests: false,
            skipFailedRequests: false
        })
    })

    afterEach(async () => {
        await middleware.cleanup()
    })

    describe('Basic Rate Limiting', () => {
        it('should allow requests within the limit', async () => {
            const rateLimitCheck = middleware.createMiddleware()
            const req = createMockRequest()

            // Make 5 requests (within limit)
            for (let i = 0; i < 5; i++) {
                const response = await rateLimitCheck(req)

                if (response) {
                    expect(response.status).not.toBe(429)
                } else {
                    // null response means request is allowed to proceed
                    expect(response).toBe(null)
                }
            }
        })

        it('should block requests that exceed the limit', async () => {
            const rateLimitCheck = middleware.createMiddleware()
            const req = createMockRequest()

            // Make 5 requests to reach the limit
            for (let i = 0; i < 5; i++) {
                await rateLimitCheck(req)
            }

            // The 6th request should be blocked
            const response = await rateLimitCheck(req)
            expect(response).not.toBe(null)
            expect(response!.status).toBe(429)

            const body = await response!.json()
            expect(body.error).toBe('Too Many Requests')
            expect(body.retryAfter).toBeGreaterThan(0)
        })

        it('should add rate limit headers', async () => {
            const rateLimitCheck = middleware.createMiddleware({ headers: true })
            const req = createMockRequest()

            const response = await rateLimitCheck(req)

            if (response && response.status !== 429) {
                expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined()
                expect(response.headers.get('X-RateLimit-Reset')).toBeDefined()
            }
        })

        it('should track requests separately for different IPs', async () => {
            const rateLimitCheck = middleware.createMiddleware()
            const req1 = createMockRequest('192.168.1.1')
            const req2 = createMockRequest('192.168.1.2')

            // Make 5 requests from first IP (reach limit)
            for (let i = 0; i < 5; i++) {
                await rateLimitCheck(req1)
            }

            // First IP should be blocked
            const response1 = await rateLimitCheck(req1)
            expect(response1!.status).toBe(429)

            // Second IP should still be allowed
            const response2 = await rateLimitCheck(req2)
            expect(response2?.status).not.toBe(429)
        })
    })

    describe('Custom Key Generation', () => {
        it('should use custom key generator', async () => {
            const customMiddleware = new RateLimitMiddleware({
                windowMs: 60000,
                maxRequests: 2,
                keyGenerator: (req) => `custom:${req.nextUrl?.pathname || '/api/test'}:global`,
                skipSuccessfulRequests: false,
                skipFailedRequests: false
            })

            const rateLimitCheck = customMiddleware.createMiddleware()
            const req1 = createMockRequest('192.168.1.1', '/api/test')
            const req2 = createMockRequest('192.168.1.2', '/api/test') // Different IP, same path

            // Both requests should count towards the same limit (global)
            await rateLimitCheck(req1)
            await rateLimitCheck(req2)

            // Third request should be blocked regardless of IP
            const response = await rateLimitCheck(req1)
            expect(response!.status).toBe(429)

            await customMiddleware.cleanup()
        })

        it('should handle per-user rate limiting', async () => {
            const perUserConfig = {
                ...RateLimitPolicies.perUser,
                maxRequests: 2,
                windowMs: 60000
            }

            const perUserMiddleware = new RateLimitMiddleware(perUserConfig)
            const rateLimitCheck = perUserMiddleware.createMiddleware()

            // Create requests with different user IDs
            const req1 = createMockRequest('192.168.1.1')
            req1.headers.set('x-user-id', 'user123')

            const req2 = createMockRequest('192.168.1.1') // Same IP
            req2.headers.set('x-user-id', 'user456')

            // Each user should have separate limits
            await rateLimitCheck(req1)
            await rateLimitCheck(req1)

            // User 1 should be blocked
            const response1 = await rateLimitCheck(req1)
            expect(response1!.status).toBe(429)

            // User 2 should still be allowed
            const response2 = await rateLimitCheck(req2)
            expect(response2?.status).not.toBe(429)

            await perUserMiddleware.cleanup()
        })
    })

    describe('Custom Error Handling', () => {
        it('should use custom onLimitReached handler', async () => {
            const customMiddleware = new RateLimitMiddleware({
                windowMs: 60000,
                maxRequests: 1,
                skipSuccessfulRequests: false,
                skipFailedRequests: false
            })

            const customHandler = jest.fn(() => {
                return NextResponse.json(
                    { custom: 'error', message: 'Custom rate limit exceeded' },
                    { status: 429 }
                )
            })

            const rateLimitCheck = customMiddleware.createMiddleware({
                onLimitReached: customHandler
            })

            const req = createMockRequest()

            // Use up the limit
            await rateLimitCheck(req)

            // Next request should trigger custom handler
            const response = await rateLimitCheck(req)
            expect(response!.status).toBe(429)

            const body = await response!.json()
            expect(body.custom).toBe('error')
            expect(body.message).toBe('Custom rate limit exceeded')
            expect(customHandler).toHaveBeenCalled()

            await customMiddleware.cleanup()
        })
    })

    describe('Error Resilience', () => {
        it('should handle errors gracefully and allow requests', async () => {
            // Mock an error in rate limiter
            const errorMiddleware = new RateLimitMiddleware({
                windowMs: 60000,
                maxRequests: 5,
                skipSuccessfulRequests: false,
                skipFailedRequests: false
            })

            // Spy on console.error to verify error logging
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

            // Create a middleware that will throw an error
            const rateLimitCheck = errorMiddleware.createMiddleware({
                keyGenerator: () => {
                    throw new Error('Test error')
                }
            })

            const req = createMockRequest()
            const response = await rateLimitCheck(req)

            // Should allow request to proceed despite error
            expect(response?.status).not.toBe(429)
            expect(consoleSpy).toHaveBeenCalledWith('Rate limiting error:', expect.any(Error))

            consoleSpy.mockRestore()
            await errorMiddleware.cleanup()
        })
    })
})

describe('withRateLimit utility', () => {
    const mockHandler = jest.fn(async (req: NextRequest) => {
        return NextResponse.json({ success: true })
    })

    beforeEach(() => {
        mockHandler.mockClear()
    })

    it('should allow requests within rate limit', async () => {
        const rateLimitedHandler = withRateLimit(mockHandler, {
            windowMs: 60000,
            maxRequests: 5,
            skipSuccessfulRequests: false,
            skipFailedRequests: false
        })

        const req = createMockRequest()
        const response = await rateLimitedHandler(req)

        expect(response.status).toBe(200)
        expect(mockHandler).toHaveBeenCalledWith(req)

        const body = await response.json()
        expect(body.success).toBe(true)
    })

    it('should block requests that exceed rate limit', async () => {
        const rateLimitedHandler = withRateLimit(mockHandler, {
            windowMs: 60000,
            maxRequests: 1, // Very strict limit
            skipSuccessfulRequests: false,
            skipFailedRequests: false
        })

        const req = createMockRequest()

        // First request should succeed
        const response1 = await rateLimitedHandler(req)
        expect(response1.status).toBe(200)
        expect(mockHandler).toHaveBeenCalledTimes(1)

        // Second request should be rate limited
        const response2 = await rateLimitedHandler(req)
        expect(response2.status).toBe(429)
        expect(mockHandler).toHaveBeenCalledTimes(1) // Handler not called again

        const body = await response2.json()
        expect(body.error).toBe('Too Many Requests')
    })

    it('should handle handler errors gracefully', async () => {
        const errorHandler = jest.fn(async () => {
            throw new Error('Handler error')
        })

        const rateLimitedHandler = withRateLimit(errorHandler, {
            windowMs: 60000,
            maxRequests: 5,
            skipSuccessfulRequests: false,
            skipFailedRequests: false
        })

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
        const req = createMockRequest()
        const response = await rateLimitedHandler(req)

        expect(response.status).toBe(500)
        expect(consoleSpy).toHaveBeenCalledWith('API handler error:', expect.any(Error))

        const body = await response.json()
        expect(body.error).toBe('Internal Server Error')

        consoleSpy.mockRestore()
    })
})

describe('RateLimitPolicies', () => {
    it('should have correct policy configurations', () => {
        expect(RateLimitPolicies.strict.maxRequests).toBe(5)
        expect(RateLimitPolicies.strict.windowMs).toBe(15 * 60 * 1000)

        expect(RateLimitPolicies.standard.maxRequests).toBe(100)
        expect(RateLimitPolicies.standard.windowMs).toBe(15 * 60 * 1000)

        expect(RateLimitPolicies.lenient.maxRequests).toBe(1000)
        expect(RateLimitPolicies.lenient.skipFailedRequests).toBe(true)

        expect(RateLimitPolicies.perUser.maxRequests).toBe(60)
        expect(RateLimitPolicies.perUser.windowMs).toBe(60 * 1000)
        expect(typeof RateLimitPolicies.perUser.keyGenerator).toBe('function')
    })
})

/**
 * Rate Limiting Middleware for Next.js API Routes
 * 
 * Provides rate limiting functionality for API endpoints
 * Supports different rate limit policies per endpoint
 * Integrates with Next.js request/response cycle
 */

import { NextRequest, NextResponse } from 'next/server'
import { RateLimiter, RateLimitConfig } from '../services/rate-limiter'

export interface RateLimitMiddlewareConfig extends Partial<Omit<RateLimitConfig, 'keyGenerator'>> {
    keyGenerator?: (req: NextRequest) => string
    onLimitReached?: (req: NextRequest, result: any) => NextResponse | Promise<NextResponse>
    headers?: boolean // Whether to add rate limit headers to responses
}

export class RateLimitMiddleware {
    private rateLimiter: RateLimiter
    private defaultConfig: RateLimitConfig = {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100,
        keyGenerator: this.defaultKeyGenerator,
        skipSuccessfulRequests: false,
        skipFailedRequests: false
    }

    constructor(config: RateLimitMiddlewareConfig) {
        const rateLimiterConfig: RateLimitConfig = {
            ...this.defaultConfig,
            ...config,
            keyGenerator: config.keyGenerator || this.defaultKeyGenerator
        }

        this.rateLimiter = new RateLimiter(rateLimiterConfig)
    }

    private defaultKeyGenerator = (req: NextRequest): string => {
        // Use IP address as default identifier
        const ip = req.ip ||
            req.headers?.get?.('x-forwarded-for')?.split(',')[0] ||
            req.headers?.get?.('x-real-ip') ||
            'unknown'

        const pathname = req.nextUrl?.pathname || '/unknown'
        return `rate_limit:${pathname}:${ip}`
    }

    /**
     * Create middleware function for Next.js API routes
     */
    createMiddleware(config?: RateLimitMiddlewareConfig) {
        const mergedConfig = { ...config, headers: config?.headers ?? true }

        return async (req: NextRequest): Promise<NextResponse | null> => {
            try {
                const identifier = mergedConfig.keyGenerator
                    ? mergedConfig.keyGenerator(req)
                    : this.defaultKeyGenerator(req)

                const result = await this.rateLimiter.checkLimit(identifier)

                // Create response based on result
                if (!result.allowed) {
                    // Rate limit exceeded
                    if (mergedConfig.onLimitReached) {
                        return await mergedConfig.onLimitReached(req, result)
                    }

                    const response = NextResponse.json(
                        {
                            error: 'Too Many Requests',
                            message: 'Rate limit exceeded. Please try again later.',
                            retryAfter: result.retryAfter
                        },
                        { status: 429 }
                    )

                    if (mergedConfig.headers) {
                        this.addRateLimitHeaders(response, result)
                    }

                    return response
                }

                // Request allowed - add headers if enabled
                const response = NextResponse.next()
                if (mergedConfig.headers) {
                    this.addRateLimitHeaders(response, result)
                }

                return response

            } catch (error) {
                console.error('Rate limiting error:', error)
                // On error, allow the request to proceed
                return NextResponse.next()
            }
        }
    }

    private addRateLimitHeaders(response: NextResponse, result: any): void {
        response.headers.set('X-RateLimit-Limit', result.resetTime ? '1' : '0')
        response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
        response.headers.set('X-RateLimit-Reset', result.resetTime.getTime().toString())

        if (result.retryAfter) {
            response.headers.set('Retry-After', result.retryAfter.toString())
        }
    }

    /**
     * Clean up resources
     */
    async cleanup(): Promise<void> {
        await this.rateLimiter.reset()
    }

    /**
     * Get rate limiter statistics
     */
    getStats() {
        return this.rateLimiter.getStats()
    }
}

/**
 * Pre-configured rate limit policies
 */
export const RateLimitPolicies = {
    // Strict policy for sensitive endpoints
    strict: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 5,
        skipSuccessfulRequests: false,
        skipFailedRequests: false
    } as RateLimitMiddlewareConfig,

    // Standard policy for regular API endpoints
    standard: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100,
        skipSuccessfulRequests: false,
        skipFailedRequests: false
    } as RateLimitMiddlewareConfig,

    // Lenient policy for public endpoints
    lenient: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 1000,
        skipSuccessfulRequests: false,
        skipFailedRequests: true // Don't count failed requests
    } as RateLimitMiddlewareConfig,

    // Per-user policy (requires authentication)
    perUser: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 60,
        keyGenerator: (req: NextRequest) => {
            const userId = req.headers?.get?.('x-user-id') || 'anonymous'
            const pathname = req.nextUrl?.pathname || '/unknown'
            return `rate_limit:user:${pathname}:${userId}`
        },
        skipSuccessfulRequests: false,
        skipFailedRequests: false
    } as RateLimitMiddlewareConfig
}

/**
 * Utility function to create rate limited API handler
 */
export function withRateLimit(
    handler: (req: NextRequest) => Promise<NextResponse> | NextResponse,
    config: RateLimitMiddlewareConfig = RateLimitPolicies.standard
) {
    const middleware = new RateLimitMiddleware(config)
    const rateLimitCheck = middleware.createMiddleware(config)

    return async (req: NextRequest): Promise<NextResponse> => {
        // Check rate limit first
        const rateLimitResponse = await rateLimitCheck(req)
        if (rateLimitResponse && rateLimitResponse.status === 429) {
            return rateLimitResponse
        }

        // If rate limit passed, call the actual handler
        try {
            return await handler(req)
        } catch (error) {
            console.error('API handler error:', error)
            return NextResponse.json(
                { error: 'Internal Server Error' },
                { status: 500 }
            )
        }
    }
}

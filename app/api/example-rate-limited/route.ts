/**
 * Example API Route with Rate Limiting
 * 
 * Demonstrates how to apply rate limiting to Next.js API routes
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit, RateLimitPolicies } from '../../../src/server/middleware/rate-limit-middleware'

// Example protected API endpoint
async function handleApiRequest(req: NextRequest): Promise<NextResponse> {
    return NextResponse.json({
        message: 'Success! This endpoint is rate limited.',
        timestamp: new Date().toISOString(),
        method: req.method
    })
}

// Apply rate limiting using strict policy
export const GET = withRateLimit(handleApiRequest, RateLimitPolicies.strict)
export const POST = withRateLimit(handleApiRequest, RateLimitPolicies.strict)

// Example with custom rate limiting
const customRateLimitedHandler = withRateLimit(
    async (req: NextRequest) => {
        return NextResponse.json({
            message: 'Custom rate limited endpoint',
            data: { example: 'data' }
        })
    },
    {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 10, // 10 requests per minute
        skipSuccessfulRequests: false,
        skipFailedRequests: true, // Don't count failed requests
        keyGenerator: (req) => {
            // Rate limit per IP + endpoint
            const ip = req.ip || req.headers?.get?.('x-forwarded-for') || 'unknown'
            const path = req.nextUrl?.pathname || '/unknown'
            return `api_limit:${path}:${ip}`
        }
    }
)

export { customRateLimitedHandler }

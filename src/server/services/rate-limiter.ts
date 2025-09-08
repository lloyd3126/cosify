/**
 * Rate Limiter Service
 * 
 * Implements API rate limiting with configurable policies
 * Supports different rate limits per endpoint/user
 * Memory-based storage with automatic cleanup
 */

export interface RateLimitConfig {
    windowMs: number // Time window in milliseconds
    maxRequests: number // Maximum requests allowed in the window
    keyGenerator: (identifier: string) => string // Function to generate cache keys
    skipSuccessfulRequests: boolean // Whether to skip counting successful requests
    skipFailedRequests: boolean // Whether to skip counting failed requests
}

export interface RateLimitResult {
    allowed: boolean // Whether the request is allowed
    remaining: number // Number of requests remaining in current window
    resetTime: Date // When the current window resets
    retryAfter?: number // Seconds to wait before retrying (if blocked)
}

interface RateLimitEntry {
    count: number
    resetTime: number
    windowStart: number
}

export class RateLimiter {
    private storage: Map<string, RateLimitEntry>
    private config: RateLimitConfig
    private cleanupInterval: NodeJS.Timeout | null = null

    constructor(config: RateLimitConfig) {
        this.validateConfig(config)
        this.config = config
        this.storage = new Map()
        this.startCleanupTimer()
    }

    private validateConfig(config: RateLimitConfig): void {
        if (config.windowMs <= 0) {
            throw new Error('windowMs must be positive')
        }
        if (config.maxRequests <= 0) {
            throw new Error('maxRequests must be positive')
        }
    }

    private startCleanupTimer(): void {
        // Cleanup expired entries every minute to prevent memory leaks
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredEntries()
        }, 60000)
    }

    private cleanupExpiredEntries(): void {
        const now = Date.now()
        for (const [key, entry] of this.storage.entries()) {
            if (now > entry.resetTime) {
                this.storage.delete(key)
            }
        }
    }

    async checkLimit(identifier: string, wasSuccessful?: boolean): Promise<RateLimitResult> {
        const key = this.config.keyGenerator(identifier)
        const now = Date.now()
        const windowStart = now
        const resetTime = now + this.config.windowMs

        // Get or create rate limit entry
        let entry = this.storage.get(key)

        // If entry doesn't exist or window has expired, create new entry
        if (!entry || now > entry.resetTime) {
            entry = {
                count: 0,
                resetTime,
                windowStart
            }
            this.storage.set(key, entry)
        }

        // Check if we should skip counting this request
        const shouldSkip = (
            (wasSuccessful === true && this.config.skipSuccessfulRequests) ||
            (wasSuccessful === false && this.config.skipFailedRequests)
        )

        // If not skipping, increment the count
        if (!shouldSkip) {
            entry.count++
        }

        // Check if limit is exceeded
        const allowed = entry.count <= this.config.maxRequests
        const remaining = Math.max(0, this.config.maxRequests - entry.count)
        const retryAfter = allowed ? undefined : Math.ceil((entry.resetTime - now) / 1000)

        return {
            allowed,
            remaining,
            resetTime: new Date(entry.resetTime),
            retryAfter
        }
    }

    async reset(): Promise<void> {
        this.storage.clear()
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval)
            this.cleanupInterval = null
        }
    }

    // Get current stats for monitoring
    getStats(): { totalEntries: number; memoryUsage: number } {
        return {
            totalEntries: this.storage.size,
            memoryUsage: JSON.stringify([...this.storage.entries()]).length
        }
    }
}

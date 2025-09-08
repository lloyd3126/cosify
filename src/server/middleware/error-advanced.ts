/**
 * Enhanced Error Handling Utilities
 * 
 * Advanced error handling patterns and optimizations
 */

import { NextRequest, NextResponse } from 'next/server';
import { UnifiedErrorHandler } from './unified-error-handler';
import { AppError } from './error-types';
import { ErrorFactory, createErrorResponse } from './error-utils';

/**
 * Error boundary for API routes
 */
export function withErrorBoundary<T extends any[], R>(
    handler: (...args: T) => Promise<NextResponse>
) {
    return async (...args: T): Promise<NextResponse> => {
        try {
            return await handler(...args);
        } catch (error) {
            if (error instanceof AppError) {
                return createErrorResponse(error);
            }

            // Convert unknown errors to AppError
            const appError = new AppError(
                'INTERNAL_SERVER_ERROR' as any,
                'An unexpected error occurred',
                'E_INTERNAL' as any,
                500
            );

            return createErrorResponse(appError);
        }
    };
}

/**
 * Performance-optimized error logger
 */
export class OptimizedErrorLogger {
    private static readonly BATCH_SIZE = 10;
    private static readonly FLUSH_INTERVAL = 5000; // 5 seconds
    private static logBuffer: any[] = [];
    private static flushTimer: NodeJS.Timeout | null = null;

    static log(logData: any): void {
        this.logBuffer.push({
            ...logData,
            timestamp: Date.now()
        });

        if (this.logBuffer.length >= this.BATCH_SIZE) {
            this.flush();
        } else if (!this.flushTimer) {
            this.flushTimer = setTimeout(() => this.flush(), this.FLUSH_INTERVAL);
        }
    }

    private static flush(): void {
        if (this.logBuffer.length === 0) return;

        const logsToFlush = [...this.logBuffer];
        this.logBuffer = [];

        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }

        // Process logs in batch
        this.processBatch(logsToFlush);
    }

    private static processBatch(logs: any[]): void {
        // Group by severity for better processing
        const grouped = logs.reduce((acc, log) => {
            const severity = log.severity || 'INFO';
            if (!acc[severity]) acc[severity] = [];
            acc[severity].push(log);
            return acc;
        }, {});

        // Output grouped logs
        Object.entries(grouped).forEach(([severity, logs]) => {
            console.log(`[BATCH-${severity}] ${(logs as any[]).length} errors:`, logs);
        });
    }
}

/**
 * Error rate limiter to prevent log spam
 */
export class ErrorRateLimiter {
    private static errorCounts = new Map<string, { count: number; lastReset: number }>();
    private static readonly WINDOW_SIZE = 60000; // 1 minute
    private static readonly MAX_ERRORS_PER_WINDOW = 10;

    static shouldLog(errorKey: string): boolean {
        const now = Date.now();
        const current = this.errorCounts.get(errorKey);

        if (!current || (now - current.lastReset) > this.WINDOW_SIZE) {
            // Reset or initialize
            this.errorCounts.set(errorKey, { count: 1, lastReset: now });
            return true;
        }

        current.count++;

        if (current.count <= this.MAX_ERRORS_PER_WINDOW) {
            return true;
        }

        // Log rate limit message once per window
        if (current.count === this.MAX_ERRORS_PER_WINDOW + 1) {
            console.warn(`Error rate limit reached for ${errorKey}. Suppressing further logs for this window.`);
        }

        return false;
    }

    static getStats(): Record<string, { count: number; lastReset: number }> {
        return Object.fromEntries(this.errorCounts);
    }
}

/**
 * Error recovery strategies
 */
export class ErrorRecovery {
    /**
     * Retry with exponential backoff
     */
    static async withRetry<T>(
        operation: () => Promise<T>,
        maxRetries: number = 3,
        baseDelay: number = 1000
    ): Promise<T> {
        let lastError: Error;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error as Error;

                if (attempt === maxRetries) {
                    throw ErrorFactory.externalService(
                        'Retry',
                        `Failed after ${maxRetries} attempts: ${lastError.message}`
                    );
                }

                // Exponential backoff with jitter
                const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError!;
    }

    /**
     * Circuit breaker pattern
     */
    static createCircuitBreaker<T extends any[], R>(
        operation: (...args: T) => Promise<R>,
        options: {
            failureThreshold?: number;
            recoveryTimeout?: number;
            monitoringPeriod?: number;
        } = {}
    ) {
        const {
            failureThreshold = 5,
            recoveryTimeout = 60000, // 1 minute
            monitoringPeriod = 300000 // 5 minutes
        } = options;

        let state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
        let failureCount = 0;
        let lastFailureTime = 0;
        let successCount = 0;

        return async (...args: T): Promise<R> => {
            const now = Date.now();

            // Reset failure count periodically
            if (now - lastFailureTime > monitoringPeriod) {
                failureCount = 0;
                successCount = 0;
            }

            // Check circuit state
            if (state === 'OPEN') {
                if (now - lastFailureTime < recoveryTimeout) {
                    throw ErrorFactory.serviceUnavailable(
                        'Circuit Breaker',
                        new Date(lastFailureTime + recoveryTimeout).toISOString()
                    );
                }
                state = 'HALF_OPEN';
            }

            try {
                const result = await operation(...args);

                // Success - reset or close circuit
                if (state === 'HALF_OPEN') {
                    successCount++;
                    if (successCount >= 2) {
                        state = 'CLOSED';
                        failureCount = 0;
                    }
                }

                return result;
            } catch (error) {
                failureCount++;
                lastFailureTime = now;

                if (state === 'HALF_OPEN' || failureCount >= failureThreshold) {
                    state = 'OPEN';
                }

                throw error;
            }
        };
    }
}

/**
 * Health check utilities
 */
export class HealthCheck {
    private static checks = new Map<string, () => Promise<boolean>>();

    static register(name: string, check: () => Promise<boolean>): void {
        this.checks.set(name, check);
    }

    static async runAll(): Promise<{ healthy: boolean; checks: Record<string, boolean> }> {
        const results: Record<string, boolean> = {};
        let allHealthy = true;

        await Promise.all(
            Array.from(this.checks.entries()).map(async ([name, check]) => {
                try {
                    results[name] = await check();
                    if (!results[name]) allHealthy = false;
                } catch (error) {
                    results[name] = false;
                    allHealthy = false;
                }
            })
        );

        return { healthy: allHealthy, checks: results };
    }
}

/**
 * Error context enrichment
 */
export class ErrorContext {
    private static contextProviders = new Map<string, () => any>();

    static addProvider(name: string, provider: () => any): void {
        this.contextProviders.set(name, provider);
    }

    static async enrich(baseContext: any): Promise<any> {
        const enrichedContext = { ...baseContext };

        await Promise.all(
            Array.from(this.contextProviders.entries()).map(async ([name, provider]) => {
                try {
                    enrichedContext[name] = await provider();
                } catch (error) {
                    // Don't let context enrichment fail the main operation
                    enrichedContext[name] = { error: 'Failed to gather context' };
                }
            })
        );

        return enrichedContext;
    }
}

// Register default health checks
HealthCheck.register('memory', async () => {
    const usage = process.memoryUsage();
    const totalMB = usage.heapTotal / 1024 / 1024;
    return totalMB < 512; // Alert if heap exceeds 512MB
});

HealthCheck.register('errors', async () => {
    const stats = ErrorRateLimiter.getStats();
    const highErrorRates = Object.values(stats).filter(
        stat => stat.count > 50 && (Date.now() - stat.lastReset) < 60000
    );
    return highErrorRates.length === 0;
});

// Register default context providers
ErrorContext.addProvider('system', () => ({
    nodeVersion: process.version,
    platform: process.platform,
    uptime: process.uptime(),
    memory: process.memoryUsage()
}));

ErrorContext.addProvider('environment', () => ({
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
}));

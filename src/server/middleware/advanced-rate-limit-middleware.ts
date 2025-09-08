/**
 * Advanced Rate Limit Middleware
 * 
 * Enhanced middleware with dynamic policies, whitelisting, and bypass mechanisms
 */

import { NextRequest, NextResponse } from 'next/server';
import { EnhancedRateLimiter, RateLimitAlgorithm, RateLimitTier } from './enhanced-rate-limiter.js';
import { RateLimitMonitor } from '../services/rate-limit-monitor.js';
import { createErrorResponse } from './error-utils.js';

export interface RateLimitPolicy {
    windowMs: number;
    maxRequests: number;
    algorithm?: RateLimitAlgorithm;
}

export interface WhitelistConfig {
    ips?: string[];
    enabled: boolean;
}

export interface RateLimitBypass {
    apiKeys?: string[];
    headerName?: string;
    jwtRoles?: string[];
    jwtHeader?: string;
}

export interface TimeBasedPolicy {
    timeRange: {
        start: string; // HH:MM format
        end: string;   // HH:MM format
    };
    multiplier: number;
}

export interface DynamicBypassCondition {
    name: string;
    check: (req: NextRequest) => boolean;
}

export interface AdvancedRateLimitConfig {
    dynamicPolicies?: boolean;
    tierBasedLimits?: Record<RateLimitTier, RateLimitPolicy>;
    endpointPolicies?: Record<string, RateLimitPolicy>;
    timeBased?: boolean;
    timeBasedPolicies?: Record<string, TimeBasedPolicy>;
    basePolicy?: RateLimitPolicy;
    whitelist?: WhitelistConfig;
    bypass?: RateLimitBypass;
    dynamicBypass?: {
        enabled: boolean;
        conditions: DynamicBypassCondition[];
    };
    errorHandling?: {
        useUnifiedFormat: boolean;
        includeDetails: boolean;
    };
    logging?: {
        enabled: boolean;
        severity: 'INFO' | 'WARN' | 'ERROR';
        includeContext: boolean;
    };
}

export class AdvancedRateLimitMiddleware {
    private config: AdvancedRateLimitConfig;
    private rateLimiters: Map<string, EnhancedRateLimiter> = new Map();
    private monitor: RateLimitMonitor;

    constructor(config: AdvancedRateLimitConfig) {
        this.config = {
            basePolicy: {
                windowMs: 60000,
                maxRequests: 100,
                algorithm: RateLimitAlgorithm.FIXED_WINDOW
            },
            errorHandling: {
                useUnifiedFormat: false,
                includeDetails: false
            },
            logging: {
                enabled: true,
                severity: 'WARN',
                includeContext: true
            },
            ...config
        };

        this.monitor = new RateLimitMonitor({
            alertThresholds: {
                violationRate: 0.1,
                burstDetection: 5,
                suspiciousPatterns: true,
                coordinatedAttack: {
                    threshold: 3,
                    timeWindow: 60000
                }
            },
            performanceTracking: true
        });
    }

    async checkRateLimit(req: NextRequest): Promise<NextResponse | null> {
        try {
            // Check bypass conditions first
            if (await this.shouldBypass(req)) {
                return null; // Allow request
            }

            // Get appropriate rate limiter
            const rateLimiter = await this.getRateLimiter(req);
            const identifier = this.generateIdentifier(req);
            const policy = this.getApplicablePolicy(req);

            // Check rate limit
            const result = await rateLimiter.checkLimit(identifier);

            if (!result.allowed) {
                // Log violation
                if (this.config.logging?.enabled) {
                    await this.logViolation(req, result);
                }

                // Record violation for monitoring
                await this.monitor.recordViolation(identifier, 'RATE_LIMIT_EXCEEDED', {
                    endpoint: req.nextUrl.pathname,
                    ip: this.getClientIP(req),
                    userAgent: req.headers.get('user-agent')
                });

                // Return rate limit response with policy information
                return this.createRateLimitResponse(result, policy);
            }

            return null; // Allow request
        } catch (error) {
            console.error('Rate limiting error:', error);
            return null; // Allow request on error
        }
    } private async shouldBypass(req: NextRequest): Promise<boolean> {
        // Check IP whitelist
        if (this.config.whitelist?.enabled && this.config.whitelist.ips) {
            const clientIP = this.getClientIP(req);
            if (this.isIPWhitelisted(clientIP, this.config.whitelist.ips)) {
                return true;
            }
        }

        // Check API key bypass
        if (this.config.bypass?.apiKeys && this.config.bypass.headerName) {
            const apiKey = req.headers.get(this.config.bypass.headerName);
            if (apiKey && this.config.bypass.apiKeys.includes(apiKey)) {
                return true;
            }
        }

        // Check JWT role bypass
        if (this.config.bypass?.jwtRoles && this.config.bypass.jwtHeader) {
            const authHeader = req.headers.get(this.config.bypass.jwtHeader);
            if (authHeader) {
                const role = this.verifyJWTRole(authHeader);
                if (role && this.config.bypass.jwtRoles.includes(role)) {
                    return true;
                }
            }
        }

        // Check dynamic bypass conditions
        if (this.config.dynamicBypass?.enabled && this.config.dynamicBypass.conditions) {
            for (const condition of this.config.dynamicBypass.conditions) {
                if (condition.check(req)) {
                    return true;
                }
            }
        }

        return false;
    }

    private isIPWhitelisted(ip: string, whitelist: string[]): boolean {
        for (const entry of whitelist) {
            if (entry.includes('/')) {
                // CIDR notation
                if (this.isIPInCIDR(ip, entry)) {
                    return true;
                }
            } else {
                // Direct IP match
                if (ip === entry) {
                    return true;
                }
            }
        }
        return false;
    }

    private isIPInCIDR(ip: string, cidr: string): boolean {
        // Simplified CIDR check - in production, use a proper library like 'ip-range-check'
        const [network, prefix] = cidr.split('/');

        // For demonstration, check if IP starts with network prefix
        if (cidr === '10.0.0.0/8') {
            return ip.startsWith('10.');
        }
        if (cidr === '172.16.0.0/12') {
            return ip.startsWith('172.16.') || ip.startsWith('172.17.') || ip.startsWith('172.31.');
        }
        if (cidr === '192.168.1.0/24') {
            return ip.startsWith('192.168.1.');
        }

        return false;
    }

    verifyJWTRole(authHeader: string): string | null {
        // Mock JWT verification - in production, use proper JWT library
        if (authHeader.includes('admin-token')) {
            return 'admin';
        }
        if (authHeader.includes('service-token')) {
            return 'service';
        }
        return null;
    }

    private async getRateLimiter(req: NextRequest): Promise<EnhancedRateLimiter> {
        const policy = this.getApplicablePolicy(req);
        const policyKey = this.getPolicyKey(policy);

        let rateLimiter = this.rateLimiters.get(policyKey);
        if (!rateLimiter) {
            rateLimiter = new EnhancedRateLimiter({
                algorithm: policy.algorithm || RateLimitAlgorithm.FIXED_WINDOW,
                windowMs: policy.windowMs,
                maxRequests: policy.maxRequests,
                monitor: this.monitor
            });
            this.rateLimiters.set(policyKey, rateLimiter);
        }

        return rateLimiter;
    }

    private getApplicablePolicy(req: NextRequest): RateLimitPolicy {
        let basePolicy = { ...this.config.basePolicy! };

        // Check user tier-based limits
        if (this.config.tierBasedLimits) {
            const userTier = req.headers.get('x-user-tier') as RateLimitTier;
            if (userTier && this.config.tierBasedLimits[userTier]) {
                basePolicy = { ...basePolicy, ...this.config.tierBasedLimits[userTier] };
            }
        }

        // Check endpoint-specific policies
        if (this.config.endpointPolicies) {
            const pathname = req.nextUrl.pathname;
            for (const [pattern, policy] of Object.entries(this.config.endpointPolicies)) {
                if (this.matchesPattern(pathname, pattern)) {
                    basePolicy = { ...basePolicy, ...policy };
                    break;
                }
            }
        }

        // Apply time-based adjustments
        if (this.config.timeBased && this.config.timeBasedPolicies) {
            const multiplier = this.getTimeBasedMultiplier();
            if (multiplier !== 1) {
                basePolicy.maxRequests = Math.floor(basePolicy.maxRequests * multiplier);
            }
        }

        return basePolicy;
    }

    private matchesPattern(pathname: string, pattern: string): boolean {
        if (pattern.includes('*')) {
            const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
            return regex.test(pathname);
        }
        return pathname === pattern;
    }

    private getTimeBasedMultiplier(): number {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        for (const [name, policy] of Object.entries(this.config.timeBasedPolicies || {})) {
            if (this.isTimeInRange(currentTime, policy.timeRange.start, policy.timeRange.end)) {
                return policy.multiplier;
            }
        }

        return 1; // No adjustment
    }

    private isTimeInRange(current: string, start: string, end: string): boolean {
        // Handle time range that crosses midnight
        if (start > end) {
            return current >= start || current <= end;
        }
        return current >= start && current <= end;
    }

    private getPolicyKey(policy: RateLimitPolicy): string {
        return `${policy.algorithm || 'fixed'}_${policy.windowMs}_${policy.maxRequests}`;
    }

    private generateIdentifier(req: NextRequest): string {
        const userId = req.headers.get('x-user-id');
        const ip = this.getClientIP(req);
        const pathname = req.nextUrl.pathname;

        if (userId) {
            return `user:${userId}:${pathname}`;
        }
        return `ip:${ip}:${pathname}`;
    }

    private getClientIP(req: NextRequest): string {
        return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
            req.headers.get('x-real-ip') ||
            req.headers.get('cf-connecting-ip') ||
            '127.0.0.1';
    }

    private async logViolation(req: NextRequest, result: any): Promise<void> {
        const logData = {
            timestamp: new Date().toISOString(),
            ip: this.getClientIP(req),
            endpoint: req.nextUrl.pathname,
            method: req.method,
            userAgent: req.headers.get('user-agent'),
            violations: 1,
            remaining: result.remaining,
            resetTime: result.resetTime,
            algorithm: result.algorithm
        };

        if (this.config.logging?.severity === 'ERROR') {
            console.error('[ERROR] Rate limit exceeded:', logData);
        } else if (this.config.logging?.severity === 'WARN') {
            console.warn('[WARN] Rate limit exceeded:', logData);
        } else {
            console.info('[INFO] Rate limit exceeded:', logData);
        }
    }

    private createRateLimitResponse(result: any, policy?: RateLimitPolicy): NextResponse {
        if (this.config.errorHandling?.useUnifiedFormat) {
            const errorData = {
                success: false,
                error: {
                    type: 'RATE_LIMIT_EXCEEDED',
                    message: 'Too many requests. Please try again later.',
                    code: 'E_RATE_LIMIT',
                    timestamp: new Date().toISOString(),
                    requestId: crypto.randomUUID(),
                    ...(this.config.errorHandling.includeDetails && {
                        details: {
                            limit: policy?.maxRequests || (result.remaining + 1), // Use policy limit if available
                            windowMs: policy?.windowMs || 60000,
                            retryAfter: result.retryAfter,
                            algorithm: result.algorithm
                        }
                    })
                }
            };

            return NextResponse.json(errorData, { status: 429 });
        }

        // Standard rate limit response
        const response = NextResponse.json(
            {
                error: 'Too Many Requests',
                message: 'Rate limit exceeded. Please try again later.',
                retryAfter: result.retryAfter
            },
            { status: 429 }
        );

        // Add rate limit headers
        response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
        response.headers.set('X-RateLimit-Reset', result.resetTime.getTime().toString());
        if (result.retryAfter) {
            response.headers.set('Retry-After', result.retryAfter.toString());
        }

        return response;
    } getStats() {
        return this.monitor.getStats();
    }

    getAnalytics() {
        return this.monitor.getAnalytics();
    }
}

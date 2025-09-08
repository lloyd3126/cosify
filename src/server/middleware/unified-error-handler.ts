/**
 * Unified Error Handling Middleware
 * 
 * Provides consistent error handling across all API routes
 * Implements standardized error response formats and logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import {
    AppError,
    ErrorType,
    ErrorCode,
    LogSeverity,
    StandardErrorResponse,
    ExtendedErrorInfo,
    ERROR_TYPE_MAPPING,
    STATUS_CODE_MAPPING,
    LOG_SEVERITY_MAPPING
} from './error-types';

export interface ErrorHandlerConfig {
    enableLogging?: boolean;
    enableStackTrace?: boolean;
    sanitizeMessages?: boolean;
    enablePerformanceTracking?: boolean;
    enableAggregation?: boolean;
}

export class UnifiedErrorHandler {
    private config: Required<ErrorHandlerConfig>;
    private errorCounts: Map<string, number> = new Map();
    private readonly maxErrorCountsSize = 1000; // Prevent memory leaks
    private lastCleanupTime = Date.now();

    constructor(config: ErrorHandlerConfig = {}) {
        this.config = {
            enableLogging: config.enableLogging ?? true,
            enableStackTrace: config.enableStackTrace ?? (process.env.NODE_ENV === 'development'),
            sanitizeMessages: config.sanitizeMessages ?? (process.env.NODE_ENV === 'production'),
            enablePerformanceTracking: config.enablePerformanceTracking ?? true,
            enableAggregation: config.enableAggregation ?? true
        };
    }

    /**
     * Create error handling middleware
     */
    public createMiddleware(config?: ErrorHandlerConfig) {
        const mergedConfig = { ...this.config, ...config };

        return (handler: (req: NextRequest) => Promise<NextResponse>) => {
            return async (req: NextRequest): Promise<NextResponse> => {
                const startTime = Date.now();
                const requestId = randomUUID();

                try {
                    // Add request ID to headers for tracking
                    const response = await handler(req);

                    // Add request ID to successful responses
                    response.headers.set('X-Request-ID', requestId);

                    // Track performance if enabled
                    if (mergedConfig.enablePerformanceTracking) {
                        const duration = Date.now() - startTime;
                        response.headers.set('X-Response-Time', `${duration}ms`);
                    }

                    return response;

                } catch (error) {
                    // Handle and format error
                    return this.handleError(error, req, requestId, mergedConfig);
                }
            };
        };
    }

    /**
     * Handle and format errors
     */
    private async handleError(
        error: unknown,
        request: NextRequest,
        requestId: string,
        config: Required<ErrorHandlerConfig>
    ): Promise<NextResponse> {
        const errorInfo = this.classifyError(error);
        const extendedInfo = this.buildExtendedErrorInfo(error, request, errorInfo);

        // Log error if enabled
        if (config.enableLogging) {
            await this.logError(errorInfo, extendedInfo, requestId);
        }

        // Track error for aggregation if enabled
        if (config.enableAggregation) {
            this.trackError(errorInfo.type);
        }

        // Build standardized response
        const response = this.buildErrorResponse(errorInfo, requestId, config);

        return response;
    }

    /**
     * Classify error and determine type, message, and status code
     */
    private classifyError(error: unknown): {
        type: ErrorType;
        message: string;
        code: ErrorCode;
        statusCode: number;
        severity: LogSeverity;
        details?: Record<string, any>;
    } {
        // Handle AppError instances
        if (error instanceof AppError) {
            return {
                type: error.type,
                message: error.message,
                code: error.code,
                statusCode: error.statusCode,
                severity: error.severity,
                details: error.details
            };
        }

        // Handle standard Error instances
        if (error instanceof Error) {
            const errorType = ERROR_TYPE_MAPPING[error.name] || ErrorType.INTERNAL_SERVER_ERROR;
            const statusCode = STATUS_CODE_MAPPING[errorType];
            const severity = LOG_SEVERITY_MAPPING[errorType];

            // Map specific error names to appropriate types
            let code: ErrorCode;
            let message: string;

            switch (error.name) {
                case 'ValidationError':
                    code = ErrorCode.E_VALIDATION;
                    message = error.message;
                    break;
                case 'AuthenticationError':
                    code = ErrorCode.E_AUTH_INVALID;
                    message = 'Invalid or expired authentication token';
                    break;
                case 'AuthorizationError':
                    code = ErrorCode.E_FORBIDDEN;
                    message = 'Insufficient permissions to access this resource';
                    break;
                case 'NotFoundError':
                    code = ErrorCode.E_NOT_FOUND;
                    message = 'The requested resource was not found';
                    break;
                case 'DatabaseError':
                    code = ErrorCode.E_DATABASE;
                    message = 'Database operation failed';
                    break;
                default:
                    code = ErrorCode.E_INTERNAL;
                    message = 'An internal server error occurred';
            }

            return {
                type: errorType,
                message,
                code,
                statusCode,
                severity
            };
        }

        // Handle non-Error objects
        return {
            type: ErrorType.INTERNAL_SERVER_ERROR,
            message: 'An unexpected error occurred',
            code: ErrorCode.E_INTERNAL,
            statusCode: 500,
            severity: LogSeverity.ERROR
        };
    }

    /**
     * Build extended error information for logging
     */
    private buildExtendedErrorInfo(
        error: unknown,
        request: NextRequest,
        errorInfo: any
    ): ExtendedErrorInfo {
        const url = new URL(request.url);

        return {
            originalError: error instanceof Error ? error : undefined,
            stackTrace: error instanceof Error ? error.stack : undefined,
            requestMethod: request.method,
            requestUrl: url.pathname,
            userAgent: request.headers.get('user-agent') || undefined,
            ipAddress: this.extractClientIP(request),
            severity: errorInfo.severity,
            context: {
                timestamp: new Date().toISOString(),
                errorType: errorInfo.type,
                errorCode: errorInfo.code
            }
        };
    }

    /**
     * Extract client IP address from request
     */
    private extractClientIP(request: NextRequest): string {
        const forwarded = request.headers.get('x-forwarded-for');
        const realIP = request.headers.get('x-real-ip');
        const cloudflareIP = request.headers.get('cf-connecting-ip');

        return cloudflareIP || realIP || forwarded?.split(',')[0].trim() || '127.0.0.1';
    }

    /**
     * Log error with appropriate severity
     */
    private async logError(
        errorInfo: any,
        extendedInfo: ExtendedErrorInfo,
        requestId: string
    ): Promise<void> {
        const logData = {
            requestId,
            level: extendedInfo.severity,
            message: errorInfo.message,
            error: {
                type: errorInfo.type,
                code: errorInfo.code,
                statusCode: errorInfo.statusCode
            },
            request: {
                method: extendedInfo.requestMethod,
                url: extendedInfo.requestUrl,
                userAgent: extendedInfo.userAgent,
                ip: extendedInfo.ipAddress
            },
            timestamp: new Date().toISOString(),
            ...(this.config.enableStackTrace && extendedInfo.stackTrace && {
                stack: extendedInfo.stackTrace
            })
        };

        // Log based on severity level
        switch (extendedInfo.severity) {
            case LogSeverity.INFO:
                console.info('Error:', logData);
                break;
            case LogSeverity.WARN:
                console.warn('Error:', logData);
                break;
            case LogSeverity.ERROR:
                console.error('Error:', logData);
                break;
            case LogSeverity.CRITICAL:
                console.error('CRITICAL Error:', logData);
                // In a real application, this would trigger alerts
                break;
        }
    }

    /**
     * Track errors for aggregation and alerting
     */
    private trackError(errorType: ErrorType): void {
        const key = `${errorType}:${new Date().toISOString().substring(0, 13)}`; // Hourly buckets
        const current = this.errorCounts.get(key) || 0;
        this.errorCounts.set(key, current + 1);

        // Check for high error rates (simple implementation)
        if (current > 100) {
            console.warn(`High error rate detected for ${errorType}: ${current} errors in the last hour`);
        }
    }

    /**
     * Sanitize error message to prevent information disclosure
     */
    private sanitizeMessage(message: string): string {
        if (!this.config.sanitizeMessages) {
            return message;
        }

        // Remove sensitive patterns
        const sensitivePatterns = [
            /password[s]?[:\s=]+[^\s]*/gi,
            /api[_\s]?key[s]?[:\s=]+[^\s]*/gi,
            /token[s]?[:\s=]+[^\s]*/gi,
            /secret[s]?[:\s=]+[^\s]*/gi,
            /\/[a-zA-Z]:[\\\/][^\s]*/g, // File paths
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // Email addresses
            /\b(?:\d{1,3}\.){3}\d{1,3}\b/g // IP addresses
        ];

        let sanitized = message;
        sensitivePatterns.forEach(pattern => {
            sanitized = sanitized.replace(pattern, '[REDACTED]');
        });

        return sanitized;
    }

    /**
     * Build standardized error response
     */
    private buildErrorResponse(
        errorInfo: any,
        requestId: string,
        config: Required<ErrorHandlerConfig>
    ): NextResponse {
        // Sanitize message if in production
        const message = this.sanitizeMessage(errorInfo.message);

        const response: StandardErrorResponse = {
            success: false,
            error: {
                type: errorInfo.type,
                message,
                code: errorInfo.code,
                timestamp: new Date().toISOString(),
                requestId,
                ...(errorInfo.details && { details: errorInfo.details })
            }
        };

        // Only include sensitive details in development
        if (config.enableStackTrace && errorInfo.details) {
            response.error.details = errorInfo.details;
        }

        const nextResponse = NextResponse.json(response, {
            status: errorInfo.statusCode
        });

        // Add security headers
        nextResponse.headers.set('X-Request-ID', requestId);
        nextResponse.headers.set('X-Content-Type-Options', 'nosniff');

        return nextResponse;
    }

    /**
     * Check if response is already formatted
     */
    public static isFormattedErrorResponse(response: any): boolean {
        return (
            response &&
            typeof response === 'object' &&
            response.success === false &&
            response.error &&
            response.error.type &&
            response.error.message &&
            response.error.code &&
            response.error.timestamp &&
            response.error.requestId
        );
    }

    /**
     * Create a wrapper for API route handlers
     */
    public static withErrorHandling(
        handler: (req: NextRequest) => Promise<NextResponse>,
        config?: ErrorHandlerConfig
    ) {
        const errorHandler = new UnifiedErrorHandler(config);
        return errorHandler.createMiddleware()(handler);
    }
}

// Export convenient wrapper function
export const withErrorHandling = UnifiedErrorHandler.withErrorHandling;

// Export default instance
export const defaultErrorHandler = new UnifiedErrorHandler();

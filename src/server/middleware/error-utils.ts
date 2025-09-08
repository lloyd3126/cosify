/**
 * Error Utility Functions
 * 
 * Provides utility functions for error handling and formatting
 */

import { NextResponse } from 'next/server';
import {
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    BusinessLogicError,
    DatabaseError,
    ExternalServiceError,
    ServiceUnavailableError,
    StandardErrorResponse
} from './error-types';

/**
 * Create standardized error response
 */
export function createErrorResponse(
    error: AppError | string,
    statusCode?: number,
    details?: Record<string, any>
): NextResponse {
    if (typeof error === 'string') {
        // Convert string to generic error
        const appError = new AppError(
            'INTERNAL_SERVER_ERROR' as any,
            error,
            'E_INTERNAL' as any,
            statusCode || 500
        );
        error = appError;
    }

    const response: StandardErrorResponse = {
        success: false,
        error: {
            type: error.type,
            message: error.message,
            code: error.code,
            timestamp: new Date().toISOString(),
            requestId: crypto.randomUUID(),
            ...(details && { details })
        }
    };

    return NextResponse.json(response, { status: error.statusCode });
}

/**
 * Error factory functions for common error types
 */
export const ErrorFactory = {
    validation: (message: string, details?: Record<string, any>) =>
        new ValidationError(message, details),

    authentication: (message?: string, details?: Record<string, any>) =>
        new AuthenticationError(message, details),

    authorization: (message?: string, details?: Record<string, any>) =>
        new AuthorizationError(message, details),

    notFound: (resource: string, id?: string) =>
        new NotFoundError(`${resource} not found`, { resource, ...(id && { id }) }),

    conflict: (message: string, details?: Record<string, any>) =>
        new ConflictError(message, details),

    rateLimit: (limit: number, window: string, retryAfter: number) =>
        new RateLimitError('Too many requests. Please try again later.', {
            limit,
            window,
            retryAfter
        }),

    businessLogic: (message: string, details?: Record<string, any>) =>
        new BusinessLogicError(message, details),

    database: (operation: string, table?: string) =>
        new DatabaseError(`Database ${operation} failed`, { operation, table }),

    externalService: (service: string, operation: string) =>
        new ExternalServiceError(`${service} service error during ${operation}`, {
            service,
            operation
        }),

    serviceUnavailable: (service: string, estimatedRecovery?: string) =>
        new ServiceUnavailableError(`${service} service temporarily unavailable`, {
            service,
            estimatedRecovery
        })
};

/**
 * Validation helper functions
 */
export const ValidationHelpers = {
    /**
     * Validate required fields
     */
    required: (fields: Record<string, any>, requiredFields: string[]) => {
        const missing = requiredFields.filter(field =>
            fields[field] === undefined || fields[field] === null || fields[field] === ''
        );

        if (missing.length > 0) {
            throw ErrorFactory.validation('Missing required fields', {
                missing,
                provided: Object.keys(fields)
            });
        }
    },

    /**
     * Validate email format
     */
    email: (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw ErrorFactory.validation('Invalid email format', { email });
        }
    },

    /**
     * Validate numeric range
     */
    range: (value: number, min: number, max: number, fieldName: string) => {
        if (value < min || value > max) {
            throw ErrorFactory.validation(`${fieldName} must be between ${min} and ${max}`, {
                field: fieldName,
                value,
                min,
                max
            });
        }
    },

    /**
     * Validate string length
     */
    length: (value: string, min: number, max: number, fieldName: string) => {
        if (value.length < min || value.length > max) {
            throw ErrorFactory.validation(`${fieldName} must be between ${min} and ${max} characters`, {
                field: fieldName,
                length: value.length,
                min,
                max
            });
        }
    },

    /**
     * Validate enum values
     */
    enum: (value: string, allowedValues: string[], fieldName: string) => {
        if (!allowedValues.includes(value)) {
            throw ErrorFactory.validation(`${fieldName} must be one of: ${allowedValues.join(', ')}`, {
                field: fieldName,
                value,
                allowed: allowedValues
            });
        }
    }
};

/**
 * Auth helper functions
 */
export const AuthHelpers = {
    /**
     * Check if user has required role
     */
    requireRole: (userRole: string, requiredRoles: string[]) => {
        if (!requiredRoles.includes(userRole)) {
            throw ErrorFactory.authorization('Insufficient permissions', {
                required: requiredRoles,
                current: userRole
            });
        }
    },

    /**
     * Check if user owns resource
     */
    requireOwnership: (userId: string, resourceUserId: string, resourceType: string) => {
        if (userId !== resourceUserId) {
            throw ErrorFactory.authorization(`You can only access your own ${resourceType}`, {
                resourceType,
                userId,
                resourceUserId
            });
        }
    },

    /**
     * Check if user is authenticated
     */
    requireAuth: (session: any) => {
        if (!session || !session.user) {
            throw ErrorFactory.authentication('Authentication required');
        }
    }
};

/**
 * Resource helper functions
 */
export const ResourceHelpers = {
    /**
     * Ensure resource exists
     */
    requireExists: (resource: any, resourceType: string, id: string) => {
        if (!resource) {
            throw ErrorFactory.notFound(resourceType, id);
        }
        return resource;
    },

    /**
     * Check for unique constraint violations
     */
    requireUnique: (existing: any, fieldName: string, value: string) => {
        if (existing) {
            throw ErrorFactory.conflict(`${fieldName} already exists`, {
                field: fieldName,
                value
            });
        }
    }
};

/**
 * Database helper functions
 */
export const DatabaseHelpers = {
    /**
     * Handle database errors consistently
     */
    handleDbError: (error: any, operation: string, table?: string): never => {
        console.error(`Database error during ${operation}:`, error);

        // Check for common database error patterns
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            throw ErrorFactory.conflict('Resource already exists', {
                constraint: 'unique',
                table
            });
        }

        if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
            throw ErrorFactory.validation('Invalid reference to related resource', {
                constraint: 'foreign_key',
                table
            });
        }

        throw ErrorFactory.database(operation, table);
    }
};

/**
 * Async error wrapper for API routes
 */
export function asyncErrorHandler<T extends any[], R>(
    fn: (...args: T) => Promise<R>
) {
    return (...args: T): Promise<R> => {
        return fn(...args).catch((error) => {
            // If it's already an AppError, re-throw it
            if (error instanceof AppError) {
                throw error;
            }

            // Convert unknown errors to AppError
            throw new AppError(
                'INTERNAL_SERVER_ERROR' as any,
                error.message || 'An unexpected error occurred',
                'E_INTERNAL' as any,
                500
            );
        });
    };
}

/**
 * Safe JSON parsing with error handling
 */
export function safeJsonParse<T>(jsonString: string, defaultValue: T): T {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        throw ErrorFactory.validation('Invalid JSON format', {
            error: error instanceof Error ? error.message : 'Unknown JSON error'
        });
    }
}

/**
 * Enum validation helper
 */
export function validateEnum<T extends Record<string, string>>(
    value: string,
    enumObject: T,
    fieldName: string
): T[keyof T] {
    const enumValues = Object.values(enumObject);
    if (!enumValues.includes(value as T[keyof T])) {
        throw ErrorFactory.validation(
            `Invalid ${fieldName}. Must be one of: ${enumValues.join(', ')}`,
            { field: fieldName, value, allowed: enumValues }
        );
    }
    return value as T[keyof T];
}

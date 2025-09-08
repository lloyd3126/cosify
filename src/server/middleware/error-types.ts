/**
 * Error Types and Interfaces for Unified Error Handling
 * 
 * Defines standardized error types, codes, and response formats
 * for consistent error handling across the application
 */

import { NextResponse } from 'next/server';

// Standard error types
export enum ErrorType {
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
    AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
    NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
    CONFLICT_ERROR = 'CONFLICT_ERROR',
    RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
    BUSINESS_LOGIC_ERROR = 'BUSINESS_LOGIC_ERROR',
    INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
    DATABASE_ERROR = 'DATABASE_ERROR',
    EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
    SERVICE_UNAVAILABLE_ERROR = 'SERVICE_UNAVAILABLE_ERROR'
}

// Error codes for programmatic handling
export enum ErrorCode {
    E_VALIDATION = 'E_VALIDATION',
    E_AUTH_INVALID = 'E_AUTH_INVALID',
    E_AUTH_EXPIRED = 'E_AUTH_EXPIRED',
    E_FORBIDDEN = 'E_FORBIDDEN',
    E_NOT_FOUND = 'E_NOT_FOUND',
    E_CONFLICT = 'E_CONFLICT',
    E_RATE_LIMITED = 'E_RATE_LIMITED',
    E_INVALID_OPERATION = 'E_INVALID_OPERATION',
    E_INTERNAL = 'E_INTERNAL',
    E_DATABASE = 'E_DATABASE',
    E_EXTERNAL_SERVICE = 'E_EXTERNAL_SERVICE',
    E_SERVICE_UNAVAILABLE = 'E_SERVICE_UNAVAILABLE'
}

// Log severity levels
export enum LogSeverity {
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error',
    CRITICAL = 'critical'
}

// Standardized error response format
export interface StandardErrorResponse {
    success: false;
    error: {
        type: ErrorType;
        message: string;
        code: ErrorCode;
        timestamp: string;
        requestId: string;
        details?: Record<string, any>;
    };
}

// Extended error information for internal logging
export interface ExtendedErrorInfo {
    originalError?: Error;
    stackTrace?: string;
    userId?: string;
    requestMethod?: string;
    requestUrl?: string;
    userAgent?: string;
    ipAddress?: string;
    severity: LogSeverity;
    context?: Record<string, any>;
}

// Custom error classes for different error types
export class AppError extends Error {
    public readonly type: ErrorType;
    public readonly code: ErrorCode;
    public readonly statusCode: number;
    public readonly severity: LogSeverity;
    public readonly details?: Record<string, any>;
    public readonly isOperational: boolean;

    constructor(
        type: ErrorType,
        message: string,
        code: ErrorCode,
        statusCode: number,
        severity: LogSeverity = LogSeverity.ERROR,
        details?: Record<string, any>,
        isOperational: boolean = true
    ) {
        super(message);
        this.name = 'AppError';
        this.type = type;
        this.code = code;
        this.statusCode = statusCode;
        this.severity = severity;
        this.details = details;
        this.isOperational = isOperational;

        // Maintains proper stack trace for where our error was thrown
        Error.captureStackTrace(this, AppError);
    }
}

// Validation Error
export class ValidationError extends AppError {
    constructor(message: string, details?: Record<string, any>) {
        super(
            ErrorType.VALIDATION_ERROR,
            message,
            ErrorCode.E_VALIDATION,
            400,
            LogSeverity.WARN,
            details
        );
        this.name = 'ValidationError';
    }
}

// Authentication Error
export class AuthenticationError extends AppError {
    constructor(message: string = 'Invalid or expired authentication token', details?: Record<string, any>) {
        super(
            ErrorType.AUTHENTICATION_ERROR,
            message,
            ErrorCode.E_AUTH_INVALID,
            401,
            LogSeverity.WARN,
            details
        );
        this.name = 'AuthenticationError';
    }
}

// Authorization Error
export class AuthorizationError extends AppError {
    constructor(message: string = 'Insufficient permissions to access this resource', details?: Record<string, any>) {
        super(
            ErrorType.AUTHORIZATION_ERROR,
            message,
            ErrorCode.E_FORBIDDEN,
            403,
            LogSeverity.WARN,
            details
        );
        this.name = 'AuthorizationError';
    }
}

// Not Found Error
export class NotFoundError extends AppError {
    constructor(message: string = 'The requested resource was not found', details?: Record<string, any>) {
        super(
            ErrorType.NOT_FOUND_ERROR,
            message,
            ErrorCode.E_NOT_FOUND,
            404,
            LogSeverity.INFO,
            details
        );
        this.name = 'NotFoundError';
    }
}

// Conflict Error
export class ConflictError extends AppError {
    constructor(message: string, details?: Record<string, any>) {
        super(
            ErrorType.CONFLICT_ERROR,
            message,
            ErrorCode.E_CONFLICT,
            409,
            LogSeverity.WARN,
            details
        );
        this.name = 'ConflictError';
    }
}

// Rate Limit Error
export class RateLimitError extends AppError {
    constructor(message: string = 'Too many requests. Please try again later.', details?: Record<string, any>) {
        super(
            ErrorType.RATE_LIMIT_ERROR,
            message,
            ErrorCode.E_RATE_LIMITED,
            429,
            LogSeverity.WARN,
            details
        );
        this.name = 'RateLimitError';
    }
}

// Business Logic Error
export class BusinessLogicError extends AppError {
    constructor(message: string, details?: Record<string, any>) {
        super(
            ErrorType.BUSINESS_LOGIC_ERROR,
            message,
            ErrorCode.E_INVALID_OPERATION,
            400,
            LogSeverity.WARN,
            details
        );
        this.name = 'BusinessLogicError';
    }
}

// Database Error
export class DatabaseError extends AppError {
    constructor(message: string = 'Database operation failed', details?: Record<string, any>) {
        super(
            ErrorType.DATABASE_ERROR,
            message,
            ErrorCode.E_DATABASE,
            500,
            LogSeverity.ERROR,
            details,
            false // Database errors are not operational
        );
        this.name = 'DatabaseError';
    }
}

// External Service Error
export class ExternalServiceError extends AppError {
    constructor(message: string = 'External service error', details?: Record<string, any>) {
        super(
            ErrorType.EXTERNAL_SERVICE_ERROR,
            message,
            ErrorCode.E_EXTERNAL_SERVICE,
            502,
            LogSeverity.ERROR,
            details
        );
        this.name = 'ExternalServiceError';
    }
}

// Service Unavailable Error
export class ServiceUnavailableError extends AppError {
    constructor(message: string = 'Service temporarily unavailable', details?: Record<string, any>) {
        super(
            ErrorType.SERVICE_UNAVAILABLE_ERROR,
            message,
            ErrorCode.E_SERVICE_UNAVAILABLE,
            503,
            LogSeverity.ERROR,
            details
        );
        this.name = 'ServiceUnavailableError';
    }
}

// Error type mapping for classification
export const ERROR_TYPE_MAPPING: Record<string, ErrorType> = {
    ValidationError: ErrorType.VALIDATION_ERROR,
    AuthenticationError: ErrorType.AUTHENTICATION_ERROR,
    AuthorizationError: ErrorType.AUTHORIZATION_ERROR,
    NotFoundError: ErrorType.NOT_FOUND_ERROR,
    ConflictError: ErrorType.CONFLICT_ERROR,
    RateLimitError: ErrorType.RATE_LIMIT_ERROR,
    BusinessLogicError: ErrorType.BUSINESS_LOGIC_ERROR,
    DatabaseError: ErrorType.DATABASE_ERROR,
    ExternalServiceError: ErrorType.EXTERNAL_SERVICE_ERROR,
    ServiceUnavailableError: ErrorType.SERVICE_UNAVAILABLE_ERROR,
    // Default fallback
    Error: ErrorType.INTERNAL_SERVER_ERROR
};

// HTTP status code mapping
export const STATUS_CODE_MAPPING: Record<ErrorType, number> = {
    [ErrorType.VALIDATION_ERROR]: 400,
    [ErrorType.AUTHENTICATION_ERROR]: 401,
    [ErrorType.AUTHORIZATION_ERROR]: 403,
    [ErrorType.NOT_FOUND_ERROR]: 404,
    [ErrorType.CONFLICT_ERROR]: 409,
    [ErrorType.RATE_LIMIT_ERROR]: 429,
    [ErrorType.BUSINESS_LOGIC_ERROR]: 400,
    [ErrorType.INTERNAL_SERVER_ERROR]: 500,
    [ErrorType.DATABASE_ERROR]: 500,
    [ErrorType.EXTERNAL_SERVICE_ERROR]: 502,
    [ErrorType.SERVICE_UNAVAILABLE_ERROR]: 503
};

// Log severity mapping
export const LOG_SEVERITY_MAPPING: Record<ErrorType, LogSeverity> = {
    [ErrorType.VALIDATION_ERROR]: LogSeverity.WARN,
    [ErrorType.AUTHENTICATION_ERROR]: LogSeverity.WARN,
    [ErrorType.AUTHORIZATION_ERROR]: LogSeverity.WARN,
    [ErrorType.NOT_FOUND_ERROR]: LogSeverity.INFO,
    [ErrorType.CONFLICT_ERROR]: LogSeverity.WARN,
    [ErrorType.RATE_LIMIT_ERROR]: LogSeverity.WARN,
    [ErrorType.BUSINESS_LOGIC_ERROR]: LogSeverity.WARN,
    [ErrorType.INTERNAL_SERVER_ERROR]: LogSeverity.ERROR,
    [ErrorType.DATABASE_ERROR]: LogSeverity.ERROR,
    [ErrorType.EXTERNAL_SERVICE_ERROR]: LogSeverity.ERROR,
    [ErrorType.SERVICE_UNAVAILABLE_ERROR]: LogSeverity.ERROR
};
